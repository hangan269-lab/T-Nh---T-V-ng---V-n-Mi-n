import { ALL_BRANDS, Brand, Product, SizeOption } from '../types/erp';

export interface ParsedQuickOrder {
  customerName?: string;
  customerPhone?: string;
  brand?: Brand;
  productId?: string;
  productLabel?: string;
  size?: SizeOption;
  quantity?: number;
  note?: string;
  matchedFields: string[];
  unmatchedProductHint?: string;
}

export function normalizeVietnamese(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP_WORDS = new Set([
  'lay',
  'dat',
  'mua',
  'chot',
  'order',
  'gui',
  'ship',
  'giao',
  'bo',
  'chiec',
  'cai',
  'set',
  'hop',
  'san',
  'pham',
  'sp',
  'sl',
  'so',
  'luong',
  'size',
  'sz',
  'co',
  'mau',
  'ao',
  'dai',
  'chi',
  'anh',
  'em',
  'co',
  'chu',
  'bac',
  'khach',
  'ten',
  'sdt',
  'dt',
  'va',
  'voi',
  'cho',
  'to',
  'nha',
  'vuong',
  'van',
  'mien',
]);

function extractPhone(text: string): { phone?: string; index: number; length: number } {
  // Match Vietnamese mobile/landline formats: 0xxx..., +84xxx..., 84xxx...
  const phoneRegex = /(?:\+?84[\s.-]*|0)(?:\d[\s.-]*){8,10}\d/;
  const match = phoneRegex.exec(text);
  if (!match) return { index: -1, length: 0 };

  const raw = match[0];
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('84') && digits.length >= 10) {
    digits = '0' + digits.slice(2);
  }
  if (digits.length < 9 || digits.length > 11) {
    return { index: -1, length: 0 };
  }
  return {
    phone: digits,
    index: match.index,
    length: raw.length,
  };
}

function cleanNameCandidate(raw: string): string {
  let cleaned = raw
    .replace(/^(?:tên|khách hàng|khách|kh|người nhận|họ tên)\s*[:\-–]?\s*/i, '')
    .replace(/(?:sđt|sdt|đt|dt|phone|tel)\s*[:\-–]?\s*$/i, '')
    .replace(/^[\s,.:;\-–|/]+|[\s,.:;\-–|/]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Remove trailing action verbs if name was extracted before them
  cleaned = cleaned.replace(/\s+(?:lấy|đặt|mua|chốt|order)$/i, '').trim();
  return cleaned;
}

function extractSize(text: string): { size?: SizeOption; matchedToken?: string } {
  const norm = normalizeVietnamese(text);
  const explicitRegex = /\b(?:size|sz|co)\s*[:\-]?\s*(freesize|free\s*size|fs|s|m|l)\b/i;
  const explicitMatch = explicitRegex.exec(norm);
  if (explicitMatch) {
    const val = explicitMatch[1].toLowerCase().replace(/\s+/g, '');
    if (val === 'freesize' || val === 'fs') {
      return { size: 'Freesize', matchedToken: explicitMatch[0] };
    }
    return { size: val.toUpperCase() as SizeOption, matchedToken: explicitMatch[0] };
  }

  const freesizeRegex = /\b(freesize|free\s*size)\b/i;
  const fsMatch = freesizeRegex.exec(norm);
  if (fsMatch) {
    return { size: 'Freesize', matchedToken: fsMatch[0] };
  }

  return {};
}

function extractBrand(text: string): Brand | undefined {
  const norm = normalizeVietnamese(text);
  for (const brand of ALL_BRANDS) {
    if (norm.includes(normalizeVietnamese(brand))) {
      return brand;
    }
  }
  return undefined;
}

function extractQuantity(textWithoutPhoneAndCodes: string): number | undefined {
  const norm = normalizeVietnamese(textWithoutPhoneAndCodes);

  // Priority 1: "x2", "x 2"
  const xMatch = /\bx\s*(\d{1,3})\b/i.exec(norm);
  if (xMatch) {
    const n = Number(xMatch[1]);
    if (n >= 1 && n <= 999) return n;
  }

  // Priority 2: verb + number + optional unit ("lay 1 bo", "dat 2 cai", "sl 3")
  const verbQtyRegex =
    /\b(?:lay|dat|mua|chot|order|sl|so luong)\s*[:\-]?\s*(\d{1,3})\b/i;
  const verbMatch = verbQtyRegex.exec(norm);
  if (verbMatch) {
    const n = Number(verbMatch[1]);
    if (n >= 1 && n <= 999) return n;
  }

  // Priority 3: number + unit ("2 bo", "1 hop", "3 set")
  const unitQtyRegex =
    /\b(\d{1,3})\s*(?:bo|chiec|cai|hop|set|ao|sp|san pham)\b/i;
  const unitMatch = unitQtyRegex.exec(norm);
  if (unitMatch) {
    const n = Number(unitMatch[1]);
    if (n >= 1 && n <= 999) return n;
  }

  return undefined;
}

function matchProduct(
  remainingText: string,
  products: Product[],
  detectedBrand?: Brand
): { product?: Product; score: number } {
  const normText = normalizeVietnamese(remainingText);
  const compactText = normText.replace(/[\s\-_]+/g, '');
  const textTokens = normText
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));

  let bestProduct: Product | undefined;
  let bestScore = 0;

  for (const product of products) {
    let score = 0;
    const normCode = normalizeVietnamese(product.code);
    const compactCode = normCode.replace(/[\s\-_]+/g, '');

    if (normCode && (normText.includes(normCode) || compactText.includes(compactCode))) {
      score += 120;
    }

    const normName = normalizeVietnamese(product.name);
    // Strip common category prefixes to compare core design name (e.g., "lua ngoc bich", "hoa mai")
    const coreName = normName
      .replace(/^(?:ao dai nam|ao dai nu|ao dai|set qua|hop tra|tra)\s+/, '')
      .trim();

    if (coreName && normText.includes(coreName)) {
      score += 80;
    } else if (normName && normText.includes(normName)) {
      score += 90;
    }

    const nameTokens = normName
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));

    let matchedTokenCount = 0;
    for (const token of nameTokens) {
      if (textTokens.includes(token)) {
        matchedTokenCount += 1;
      }
    }

    if (matchedTokenCount > 0) {
      score += matchedTokenCount * 15;
    }

    // Small brand affinity bonus ONLY if there is already a product text match
    if (score > 0 && detectedBrand && product.brand === detectedBrand) {
      score += 10;
    }

    if (score > bestScore) {
      bestScore = score;
      bestProduct = product;
    }
  }

  // Require at least 15 points (meaning a code, core phrase, or meaningful name token matched)
  if (bestScore < 15) {
    return { product: undefined, score: 0 };
  }

  return { product: bestProduct, score: bestScore };
}

export function parseQuickOrderText(rawText: string, products: Product[]): ParsedQuickOrder {
  const text = rawText.trim();
  if (!text) {
    return { matchedFields: [] };
  }

  const matchedFields: string[] = [];
  const phoneResult = extractPhone(text);
  const customerPhone = phoneResult.phone;
  if (customerPhone) {
    matchedFields.push('SĐT');
  }

  // Determine customer name
  let customerName: string | undefined;
  let bodyAfterCustomer = text;

  if (phoneResult.index > 0) {
    const beforePhone = text.slice(0, phoneResult.index);
    const candidate = cleanNameCandidate(beforePhone);
    if (candidate) {
      customerName = candidate;
      matchedFields.push('Tên khách');
    }
    bodyAfterCustomer = text.slice(phoneResult.index + phoneResult.length);
  } else if (phoneResult.index === 0) {
    bodyAfterCustomer = text.slice(phoneResult.length);
    const beforeVerb = bodyAfterCustomer.split(/\b(?:lấy|lay|đặt|dat|mua|chốt|chot|order)\b/i)[0];
    const candidate = cleanNameCandidate(beforeVerb || '');
    if (candidate && candidate.split(' ').length <= 5) {
      customerName = candidate;
      matchedFields.push('Tên khách');
      bodyAfterCustomer = bodyAfterCustomer.slice(beforeVerb.length);
    }
  } else {
    // No phone found; check if text starts with "Tên ... lấy/đặt..."
    const verbSplit = text.split(/\b(?:lấy|lay|đặt|dat|mua|chốt|chot|order)\b/i);
    if (verbSplit.length > 1) {
      const candidate = cleanNameCandidate(verbSplit[0]);
      if (candidate && candidate.split(' ').length <= 5) {
        customerName = candidate;
        matchedFields.push('Tên khách');
        bodyAfterCustomer = text.slice(verbSplit[0].length);
      }
    }
  }

  const detectedBrand = extractBrand(text);
  const { size, matchedToken: sizeToken } = extractSize(text);
  if (size) {
    matchedFields.push(`Size ${size}`);
  }

  // Strip phone, size token, and SKU codes before scanning for quantity
  let textForQty = normalizeVietnamese(bodyAfterCustomer);
  if (sizeToken) {
    textForQty = textForQty.replace(sizeToken, ' ');
  }
  for (const p of products) {
    const escapedCode = normalizeVietnamese(p.code).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    textForQty = textForQty.replace(new RegExp(escapedCode, 'gi'), ' ');
  }

  const quantity = extractQuantity(textForQty);
  if (quantity !== undefined) {
    matchedFields.push(`SL ${quantity}`);
  }

  // Match product from remaining text
  let textForProduct = normalizeVietnamese(bodyAfterCustomer);
  if (sizeToken) {
    textForProduct = textForProduct.replace(sizeToken, ' ');
  }
  const { product } = matchProduct(textForProduct, products, detectedBrand);

  const finalBrand = product?.brand ?? detectedBrand;
  if (finalBrand) {
    matchedFields.push(finalBrand);
  }
  if (product) {
    matchedFields.push(`Mẫu ${product.code}`);
  }

  let unmatchedProductHint: string | undefined;
  if (!product && bodyAfterCustomer.trim()) {
    unmatchedProductHint = bodyAfterCustomer
      .replace(sizeToken || '', '')
      .replace(/\b(?:lấy|lay|đặt|dat|mua|chốt|chot|order)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return {
    customerName,
    customerPhone,
    brand: finalBrand,
    productId: product?.id,
    productLabel: product ? `${product.code} — ${product.name}` : undefined,
    size,
    quantity,
    matchedFields,
    unmatchedProductHint: unmatchedProductHint || undefined,
  };
}

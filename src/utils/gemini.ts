import { GoogleGenAI, Type } from '@google/genai';
import {
  ALL_BRANDS,
  ALL_SHIPPING_METHODS,
  Brand,
  ExpenseBrandScope,
  ExpenseCategory,
  ExpenseStatus,
  Product,
  ShippingMethod,
  ShippingStatus,
  SizeOption,
} from '../types/erp';

export const GEMINI_STORAGE_KEY = 'gemini_api_key';

/**
 * Lấy API key của Gemini:
 * 1. Ưu tiên key do Admin nhập tay trong Cài đặt (lưu trong localStorage)
 * 2. Tiếp theo kiểm tra biến môi trường VITE_GEMINI_API_KEY (hoặc GEMINI_API_KEY)
 */
export function getGeminiApiKey(): string {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(GEMINI_STORAGE_KEY);
      if (stored && stored.trim().length > 0) {
        return stored.trim();
      }
    } catch {
      // Bỏ qua lỗi localStorage
    }
  }

  // Biến môi trường Vite client-side
  const viteKey = import.meta.env?.VITE_GEMINI_API_KEY;
  if (viteKey && typeof viteKey === 'string' && viteKey.trim().length > 0) {
    return viteKey.trim();
  }

  // Fallback nếu có biến trong process.env
  try {
    if (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) {
      return String(process.env.GEMINI_API_KEY).trim();
    }
  } catch {
    // Bỏ qua
  }

  return '';
}

export function saveGeminiApiKey(key: string): void {
  if (typeof window !== 'undefined') {
    try {
      const trimmed = key.trim();
      if (trimmed) {
        localStorage.setItem(GEMINI_STORAGE_KEY, trimmed);
      } else {
        localStorage.removeItem(GEMINI_STORAGE_KEY);
      }
    } catch {
      // Bỏ qua
    }
  }
}

export function getGeminiKeySource(): 'custom' | 'env' | 'none' {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(GEMINI_STORAGE_KEY);
      if (stored && stored.trim().length > 0) return 'custom';
    } catch {
      // Bỏ qua
    }
  }
  const viteKey = import.meta.env?.VITE_GEMINI_API_KEY;
  if (viteKey && typeof viteKey === 'string' && viteKey.trim().length > 0) return 'env';
  try {
    if (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) return 'env';
  } catch {
    // Bỏ qua
  }
  return 'none';
}

function getAiClient(customKey?: string): GoogleGenAI {
  const apiKey = (customKey || getGeminiApiKey()).trim();
  if (!apiKey) {
    throw new Error(
      'Chưa cấu hình Gemini API Key. Vui lòng bấm vào "Cài đặt" để nhập mã API Key miễn phí từ aistudio.google.com hoặc cấu hình biến VITE_GEMINI_API_KEY.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

/**
 * Kiểm tra kết nối Gemini API
 */
export async function testGeminiConnection(keyToTest?: string): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  try {
    const ai = getAiClient(keyToTest);
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Trả lời ngắn 1 từ: OK',
      config: {
        thinkingConfig: { thinkingLevel: 1 as unknown as undefined },
      },
    });
    const text = response.text?.trim() || '';
    if (text) {
      return { ok: true, message: 'Kết nối thành công với Gemini 2.5 Flash!' };
    }
    return { ok: false, error: 'Không nhận được phản hồi hợp lệ từ Gemini API.' };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg.includes('API_KEY_INVALID') || errorMsg.includes('API key not valid')) {
      return { ok: false, error: 'API Key không hợp lệ. Vui lòng kiểm tra lại mã khóa tạo từ aistudio.google.com.' };
    }
    if (errorMsg.includes('RESOURCE_EXHAUSTED')) {
      return { ok: false, error: 'Hết hạn mức truy vấn (Quota exceeded). Vui lòng thử lại sau.' };
    }
    return { ok: false, error: errorMsg };
  }
}

// ==========================================
// 1. PHÂN TÍCH EXCEL CHI PHÍ (EXPENSES)
// ==========================================

export interface ExtractedExpenseRow {
  date: string;
  category: string;
  brandScope: ExpenseBrandScope;
  detail: string;
  amount: number;
  paidBy: string;
  receiptNote: string;
  status: ExpenseStatus;
}

export async function parseExpensesWithGemini(rawText: string): Promise<ExtractedExpenseRow[]> {
  const ai = getAiClient();
  const prompt = `Bạn là trợ lý kế toán chuyên nghiệp của xưởng thời trang và trà "Tơ Nhã - Tơ Vương - Vân Miên".
Nhiệm vụ: Trích xuất các dòng chi phí từ dữ liệu thô (bảng tính Excel, Google Sheets copy-paste hoặc danh sách viết tay) thành mảng JSON chuẩn.

Dữ liệu thô cần xử lý:
${rawText}

Quy tắc chuẩn hóa:
1. date: Ngày phát sinh định dạng YYYY-MM-DD. Nếu chỉ có ngày tháng như "15/1" hoặc "15-1", hãy lấy năm hiện tại (${new Date().getFullYear()}). Nếu không có, để ngày hôm nay.
2. category: Hạng mục chi, tự động chọn gần đúng nhất trong các mục: "Nhập hàng", "Bao bì/Hộp", "Mua vải", "May tag", "Sản xuất/Chụp ảnh", "Vận chuyển", "Ăn uống/Di chuyển", "Marketing/Ads", "Khác".
3. brandScope: Nhánh áp dụng chi phí: "Tơ Nhã" (áo dài nữ), "Tơ Vương" (áo dài nam), "Vân Miên" (trà & quà tặng), hoặc "Dùng chung" (nếu chi phí chung xưởng/studio).
4. detail: Mô tả rõ ràng nội dung chi tiêu.
5. amount: Số tiền nguyên dương (VNĐ). Hãy bóc tách và loại bỏ ký tự ".", ",", "đ", "k" (ví dụ: "1.250.000", "1250k" -> 1250000).
6. paidBy: Người ứng tiền chi. Khớp theo danh sách mặc định: "Ngân chi", "Giang chi", "Hoa thanh toán", "Phương chi", "Linh chi", hoặc để đúng tên người ứng chi được nhắc tới. Nếu không rõ ai chi, mặc định "Ngân chi".
7. receiptNote: Ghi chú hóa đơn/chứng từ/số phiếu nếu có (hoặc để trống "").
8. status: Tình trạng thanh toán: "Hoàn thiện" nếu đã chi/đã xong, hoặc "Chưa" nếu tạm ứng hoặc chưa xong.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        description: 'Danh sách các dòng chi phí được bóc tách từ Excel',
        items: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING, description: 'Định dạng YYYY-MM-DD' },
            category: { type: Type.STRING, description: 'Hạng mục chi' },
            brandScope: { type: Type.STRING, description: 'Tơ Nhã, Tơ Vương, Vân Miên hoặc Dùng chung' },
            detail: { type: Type.STRING, description: 'Chi tiết nội dung chi' },
            amount: { type: Type.INTEGER, description: 'Số tiền VNĐ nguyên dương' },
            paidBy: { type: Type.STRING, description: 'Người ứng chi (Ngân chi, Giang chi...)' },
            receiptNote: { type: Type.STRING, description: 'Ghi chú chứng từ/hóa đơn' },
            status: { type: Type.STRING, description: 'Hoàn thiện hoặc Chưa' },
          },
          required: ['date', 'category', 'brandScope', 'detail', 'amount', 'paidBy', 'status'],
        },
      },
    },
  });

  const jsonText = response.text?.trim() || '[]';
  const rawList = JSON.parse(jsonText) as Array<Record<string, unknown>>;

  return rawList.map((item) => {
    const rawStatus = String(item.status || '').trim();
    const status: ExpenseStatus =
      rawStatus === 'Hoàn thiện' || rawStatus.toLowerCase().includes('hoàn')
        ? ExpenseStatus.COMPLETED
        : ExpenseStatus.PENDING;

    let brandScope: ExpenseBrandScope = 'Dùng chung';
    const rawScope = String(item.brandScope || '').trim();
    if (rawScope.includes('Nhã')) brandScope = Brand.TO_NHA;
    else if (rawScope.includes('Vương')) brandScope = Brand.TO_VUONG;
    else if (rawScope.includes('Miên')) brandScope = Brand.VAN_MIEN;

    const amountNum = Math.max(0, Math.round(Number(item.amount) || 0));

    return {
      date: String(item.date || new Date().toISOString().split('T')[0]),
      category: String(item.category || 'Khác'),
      brandScope,
      detail: String(item.detail || '').trim() || 'Chi phí vận hành',
      amount: amountNum,
      paidBy: String(item.paidBy || 'Ngân chi').trim(),
      receiptNote: String(item.receiptNote || '').trim(),
      status,
    };
  });
}

// ==========================================
// 2. PHÂN TÍCH EXCEL ĐƠN HÀNG (ORDERS)
// ==========================================

export interface ExtractedOrderItemRow {
  productCodeOrName: string;
  size: SizeOption;
  quantity: number;
  unitPrice: number;
}

export interface ExtractedOrderRow {
  date: string;
  brand: Brand;
  customerName: string;
  customerPhone: string;
  shippingAddress: string;
  shippingMethod: ShippingMethod;
  items: ExtractedOrderItemRow[];
  shippingFee: number;
  discount: number;
  paymentStatus: 'Đã thanh toán' | 'Chưa thanh toán';
  shippingStatus: ShippingStatus;
  note: string;
}

export async function parseOrdersWithGemini(
  rawText: string,
  existingProducts: Product[]
): Promise<ExtractedOrderRow[]> {
  const ai = getAiClient();
  const productCatalogSample = existingProducts
    .slice(0, 40)
    .map((p) => `[${p.code}] ${p.name} (${p.brand}) - Giá bán: ${p.sellPrice}`)
    .join('\n');

  const prompt = `Bạn là trợ lý bán hàng xuất sắc của xưởng "Tơ Nhã - Tơ Vương - Vân Miên".
Nhiệm vụ: Trích xuất danh sách các đơn hàng từ bảng tính Excel / Google Sheets cũ.

Danh mục sản phẩm hiện có trong kho để bạn đối chiếu:
${productCatalogSample}

Dữ liệu thô đơn hàng cần bóc tách:
${rawText}

Quy tắc xử lý:
1. date: Ngày tạo đơn định dạng YYYY-MM-DD.
2. brand: Tên thương hiệu: "Tơ Nhã" (áo dài nữ), "Tơ Vương" (áo dài nam), "Vân Miên" (trà & quà tặng).
3. customerName: Họ tên khách hàng.
4. customerPhone: Số điện thoại (chỉ lấy số 10 chữ số).
5. shippingAddress: Địa chỉ giao hàng đầy đủ.
6. shippingMethod: "Viettel Post" (nếu ghi VTP, Viettel, gửi bưu điện), "Ship nội thành" (nếu ship nhanh/Ahamove/Grab), hoặc "Khách tự lấy". Mặc định "Viettel Post".
7. items: Danh sách sản phẩm của đơn:
   - productCodeOrName: Tên mẫu hoặc mã sản phẩm gần nhất trong kho.
   - size: "S", "M", "L", hoặc "Freesize". Với trà/quà tặng luôn là "Freesize".
   - quantity: Số lượng (nguyên dương, tối thiểu 1).
   - unitPrice: Đơn giá bán một sản phẩm (nguyên dương).
8. shippingFee: Tiền ship thu khách (VNĐ nguyên dương, nếu miễn phí hoặc không có để 0).
9. discount: Tiền giảm giá (nếu có, để 0 nếu không).
10. paymentStatus: "Đã thanh toán" hoặc "Chưa thanh toán".
11. shippingStatus: "Chưa gửi", "Đã lên đơn VTP", hoặc "Đã giao".
12. note: Ghi chú đơn hàng.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        description: 'Danh sách đơn hàng bóc tách được',
        items: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING },
            brand: { type: Type.STRING },
            customerName: { type: Type.STRING },
            customerPhone: { type: Type.STRING },
            shippingAddress: { type: Type.STRING },
            shippingMethod: { type: Type.STRING },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  productCodeOrName: { type: Type.STRING },
                  size: { type: Type.STRING },
                  quantity: { type: Type.INTEGER },
                  unitPrice: { type: Type.INTEGER },
                },
                required: ['productCodeOrName', 'quantity'],
              },
            },
            shippingFee: { type: Type.INTEGER },
            discount: { type: Type.INTEGER },
            paymentStatus: { type: Type.STRING },
            shippingStatus: { type: Type.STRING },
            note: { type: Type.STRING },
          },
          required: ['customerName', 'customerPhone', 'items'],
        },
      },
    },
  });

  const jsonText = response.text?.trim() || '[]';
  const rawList = JSON.parse(jsonText) as Array<Record<string, unknown>>;

  return rawList.map((item) => {
    let brand = Brand.TO_NHA;
    const rawBrand = String(item.brand || '');
    if (rawBrand.includes('Vương')) brand = Brand.TO_VUONG;
    else if (rawBrand.includes('Miên')) brand = Brand.VAN_MIEN;

    let shippingMethod = ShippingMethod.VIETTEL_POST;
    const rawShip = String(item.shippingMethod || '');
    if (rawShip.includes('nội thành') || rawShip.includes('ship')) {
      shippingMethod = ShippingMethod.LOCAL_SHIP;
    } else if (rawShip.includes('tự lấy') || rawShip.includes('lấy')) {
      shippingMethod = ShippingMethod.PICKUP;
    }

    let shippingStatus = ShippingStatus.NOT_SENT;
    const rawShipStatus = String(item.shippingStatus || '');
    if (rawShipStatus.includes('giao')) shippingStatus = ShippingStatus.DELIVERED;
    else if (rawShipStatus.includes('lên') || rawShipStatus.includes('VTP')) {
      shippingStatus = ShippingStatus.VTP_CREATED;
    }

    const rawItems = (Array.isArray(item.items) ? item.items : []) as Array<Record<string, unknown>>;
    const parsedItems: ExtractedOrderItemRow[] = rawItems.map((rawIt) => {
      let size: SizeOption = 'M';
      const s = String(rawIt.size || '').toUpperCase().trim();
      if (s === 'S') size = 'S';
      else if (s === 'L') size = 'L';
      else if (s === 'FREESIZE' || s === 'FS' || brand === Brand.VAN_MIEN) size = 'Freesize';

      return {
        productCodeOrName: String(rawIt.productCodeOrName || 'Sản phẩm').trim(),
        size,
        quantity: Math.max(1, Math.round(Number(rawIt.quantity) || 1)),
        unitPrice: Math.max(0, Math.round(Number(rawIt.unitPrice) || 0)),
      };
    });

    if (parsedItems.length === 0) {
      parsedItems.push({
        productCodeOrName: 'Sản phẩm mới',
        size: brand === Brand.VAN_MIEN ? 'Freesize' : 'M',
        quantity: 1,
        unitPrice: 0,
      });
    }

    return {
      date: String(item.date || new Date().toISOString().split('T')[0]),
      brand,
      customerName: String(item.customerName || 'Khách hàng').trim(),
      customerPhone: String(item.customerPhone || '').replace(/\D/g, '').trim(),
      shippingAddress: String(item.shippingAddress || '').trim(),
      shippingMethod,
      items: parsedItems,
      shippingFee: Math.max(0, Math.round(Number(item.shippingFee) || 0)),
      discount: Math.max(0, Math.round(Number(item.discount) || 0)),
      paymentStatus:
        String(item.paymentStatus || '').includes('Đã') || String(item.paymentStatus || '').includes('paid')
          ? 'Đã thanh toán'
          : 'Chưa thanh toán',
      shippingStatus,
      note: String(item.note || '').trim(),
    };
  });
}

// ==========================================
// 3. PHÂN TÍCH EXCEL KHO HÀNG & MẪU MÃ (PRODUCTS)
// ==========================================

export interface ExtractedProductRow {
  code: string;
  name: string;
  brand: Brand;
  costPrice: number;
  sellPrice: number;
  initialStock: Partial<Record<SizeOption, number>>;
}

export async function parseProductsWithGemini(rawText: string): Promise<ExtractedProductRow[]> {
  const ai = getAiClient();
  const prompt = `Bạn là chuyên gia quản lý kho của "Tơ Nhã - Tơ Vương - Vân Miên".
Nhiệm vụ: Trích xuất danh mục mẫu sản phẩm và số lượng tồn ban đầu từ bảng tính Excel / Google Sheets thô.

Dữ liệu thô sản phẩm cần xử lý:
${rawText}

Quy tắc chuẩn hóa:
1. code: Mã sản phẩm (ví dụ: TN-01, TV-02, VM-TRA-01...). Nếu trong file không có mã, hãy tự động tạo mã thông minh theo nhánh (ví dụ TN-xx cho Tơ Nhã, TV-xx cho Tơ Vương, VM-xx cho Vân Miên).
2. name: Tên sản phẩm đầy đủ (ví dụ: "Áo dài Tơ Nhã Phủ Tơ", "Set Trà Phổ Nhĩ Quý").
3. brand: Một trong 3 thương hiệu: "Tơ Nhã" (áo dài nữ), "Tơ Vương" (áo dài nam), "Vân Miên" (trà & quà tặng).
4. costPrice: Giá vốn / giá nhập 1 sản phẩm (nguyên dương, VNĐ). Bỏ các ký tự ".", ",", "đ".
5. sellPrice: Giá niêm yết bán lẻ (nguyên dương, VNĐ).
6. initialStockS: Tồn kho ban đầu size S.
7. initialStockM: Tồn kho ban đầu size M.
8. initialStockL: Tồn kho ban đầu size L.
9. initialStockFreesize: Tồn kho ban đầu Freesize (với Vân Miên thường là Freesize).`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        description: 'Danh mục sản phẩm và tồn kho',
        items: {
          type: Type.OBJECT,
          properties: {
            code: { type: Type.STRING },
            name: { type: Type.STRING },
            brand: { type: Type.STRING },
            costPrice: { type: Type.INTEGER },
            sellPrice: { type: Type.INTEGER },
            initialStockS: { type: Type.INTEGER },
            initialStockM: { type: Type.INTEGER },
            initialStockL: { type: Type.INTEGER },
            initialStockFreesize: { type: Type.INTEGER },
          },
          required: ['name', 'brand', 'sellPrice'],
        },
      },
    },
  });

  const jsonText = response.text?.trim() || '[]';
  const rawList = JSON.parse(jsonText) as Array<Record<string, unknown>>;

  return rawList.map((item, index) => {
    let brand = Brand.TO_NHA;
    const rawBrand = String(item.brand || '');
    if (rawBrand.includes('Vương')) brand = Brand.TO_VUONG;
    else if (rawBrand.includes('Miên')) brand = Brand.VAN_MIEN;

    const prefix = brand === Brand.TO_NHA ? 'TN' : brand === Brand.TO_VUONG ? 'TV' : 'VM';
    const code = String(item.code || `${prefix}-${String(index + 1).padStart(2, '0')}`).trim();
    const name = String(item.name || `Sản phẩm ${index + 1}`).trim();
    const costPrice = Math.max(0, Math.round(Number(item.costPrice) || 0));
    const sellPrice = Math.max(0, Math.round(Number(item.sellPrice) || 0));

    const initialStock: Partial<Record<SizeOption, number>> = {};
    if (Number(item.initialStockS) > 0) initialStock.S = Math.round(Number(item.initialStockS));
    if (Number(item.initialStockM) > 0) initialStock.M = Math.round(Number(item.initialStockM));
    if (Number(item.initialStockL) > 0) initialStock.L = Math.round(Number(item.initialStockL));
    if (Number(item.initialStockFreesize) > 0) {
      initialStock.Freesize = Math.round(Number(item.initialStockFreesize));
    }
    // Nếu không có size nào mà là Vân Miên -> Freesize = 1
    if (Object.keys(initialStock).length === 0) {
      if (brand === Brand.VAN_MIEN) {
        initialStock.Freesize = 0;
      } else {
        initialStock.M = 0;
      }
    }

    return {
      code,
      name,
      brand,
      costPrice,
      sellPrice,
      initialStock,
    };
  });
}

// ==========================================
// 4. BÓC TÁCH ĐƠN TỪ TIN NHẮN KHÁCH HÀNG (CHAT PARSER)
// ==========================================

export interface ParsedChatOrder {
  customerName: string;
  customerPhone: string;
  shippingAddress: string;
  shippingMethod: ShippingMethod;
  brand: Brand;
  items: Array<{
    matchedProductId?: string;
    productCode: string;
    productName: string;
    size: SizeOption;
    quantity: number;
    unitPrice: number;
  }>;
  note: string;
  summary: string;
}

export async function parseCustomerChatWithGemini(
  chatText: string,
  catalog: Product[]
): Promise<ParsedChatOrder> {
  const ai = getAiClient();
  const activeProducts = catalog.filter((p) => !p.isArchived);

  // Tạo danh mục gọn gàng để Gemini đối chiếu chính xác
  const catalogContext = activeProducts
    .map(
      (p) =>
        `- id: "${p.id}", code: "${p.code}", name: "${p.name}", brand: "${p.brand}", price: ${p.sellPrice}, sizes: [${Object.keys(p.initialStock || {}).join(', ')}]`
    )
    .join('\n');

  const prompt = `Bạn là trợ lý AI thông minh chốt đơn của xưởng "Tơ Nhã - Tơ Vương - Vân Miên".
Nhiệm vụ: Phân tích đoạn tin nhắn chốt đơn của khách hàng dưới đây và trích xuất thành JSON chính xác để tự động điền form tạo đơn.

Danh mục sản phẩm hiện có trong kho:
${catalogContext}

Đoạn tin nhắn của khách:
"""
${chatText}
"""

Yêu cầu phân tích:
1. customerName: Tên khách hàng (ví dụ "Hoa", "Chị Lan", "Anh Dũng"). Bỏ các đại từ xưng hô thừa nếu có.
2. customerPhone: Số điện thoại khách (chỉ lấy số 10 chữ số).
3. shippingAddress: Địa chỉ giao hàng nếu có (ví dụ "số 5 Lý Thường Kiệt", "123 Cầu Giấy HN").
4. shippingMethod:
   - "Viettel Post" nếu có nhắc tới VTP, Viettel, bưu điện, gửi bưu cục, hoặc mặc định nếu ở xa/ngoại thành.
   - "Ship nội thành" nếu nhắc tới ship hỏa tốc, ship liền, grab, ahamove, nội thành Hà Nội.
   - "Khách tự lấy" nếu qua xưởng/shop lấy.
5. items: Danh sách sản phẩm mà khách đặt mua. Đối chiếu TÊN hoặc MÔ TẢ trong tin nhắn với danh mục kho phía trên để chọn đúng mã sản phẩm:
   - matchedProductId: ID chính xác của sản phẩm trong danh mục nếu khớp được, hoặc để trống "".
   - productCode: Mã sản phẩm (code) khớp được.
   - productName: Tên sản phẩm khớp được.
   - size: "S", "M", "L", hoặc "Freesize". Với trà/quà tặng Vân Miên luôn là "Freesize".
   - quantity: Số lượng khách mua (số nguyên dương, mặc định 1).
   - unitPrice: Đơn giá bán của sản phẩm trong kho.
6. brand: Tên thương hiệu chủ đạo của đơn: "Tơ Nhã" (áo dài nữ), "Tơ Vương" (áo dài nam), hoặc "Vân Miên" (trà & quà tặng).
7. note: Ghi chú thêm từ khách (ví dụ yêu cầu giờ giao, ghi thiệp quà tặng...).
8. summary: Tóm tắt 1 câu ngắn gọn tiếng Việt các thông tin đã bóc tách.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          customerName: { type: Type.STRING },
          customerPhone: { type: Type.STRING },
          shippingAddress: { type: Type.STRING },
          shippingMethod: { type: Type.STRING },
          brand: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                matchedProductId: { type: Type.STRING },
                productCode: { type: Type.STRING },
                productName: { type: Type.STRING },
                size: { type: Type.STRING },
                quantity: { type: Type.INTEGER },
                unitPrice: { type: Type.INTEGER },
              },
              required: ['productName', 'quantity'],
            },
          },
          note: { type: Type.STRING },
          summary: { type: Type.STRING },
        },
        required: ['customerName', 'items'],
      },
    },
  });

  const jsonText = response.text?.trim() || '{}';
  const data = JSON.parse(jsonText) as Record<string, unknown>;

  let brand = Brand.TO_NHA;
  const rawBrand = String(data.brand || '');
  if (rawBrand.includes('Vương')) brand = Brand.TO_VUONG;
  else if (rawBrand.includes('Miên')) brand = Brand.VAN_MIEN;

  let shippingMethod = ShippingMethod.VIETTEL_POST;
  const rawShip = String(data.shippingMethod || '');
  if (rawShip.includes('nội thành') || rawShip.includes('Ship nội thành')) {
    shippingMethod = ShippingMethod.LOCAL_SHIP;
  } else if (rawShip.includes('tự lấy') || rawShip.includes('Khách tự lấy')) {
    shippingMethod = ShippingMethod.PICKUP;
  }

  const rawItems = (Array.isArray(data.items) ? data.items : []) as Array<Record<string, unknown>>;
  const items = rawItems.map((raw) => {
    let matchedId = String(raw.matchedProductId || '').trim();
    let product = activeProducts.find((p) => p.id === matchedId);

    // Nếu ID chưa khớp, thử tìm theo mã hoặc tên
    if (!product) {
      const codeOrName = String(raw.productCode || raw.productName || '').toLowerCase();
      product = activeProducts.find(
        (p) =>
          p.code.toLowerCase() === codeOrName ||
          p.name.toLowerCase().includes(codeOrName) ||
          codeOrName.includes(p.name.toLowerCase())
      );
      if (product) {
        matchedId = product.id;
      }
    }

    let size: SizeOption = 'M';
    const rawSize = String(raw.size || '').toUpperCase().trim();
    if (rawSize === 'S') size = 'S';
    else if (rawSize === 'L') size = 'L';
    else if (rawSize === 'FREESIZE' || rawSize === 'FS' || (product && product.brand === Brand.VAN_MIEN)) {
      size = 'Freesize';
    }

    return {
      matchedProductId: product?.id,
      productCode: product?.code || String(raw.productCode || 'SP'),
      productName: product?.name || String(raw.productName || 'Sản phẩm'),
      size,
      quantity: Math.max(1, Math.round(Number(raw.quantity) || 1)),
      unitPrice: product?.sellPrice ?? Math.max(0, Math.round(Number(raw.unitPrice) || 0)),
    };
  });

  return {
    customerName: String(data.customerName || '').trim(),
    customerPhone: String(data.customerPhone || '').replace(/\D/g, '').trim(),
    shippingAddress: String(data.shippingAddress || '').trim(),
    shippingMethod,
    brand,
    items,
    note: String(data.note || '').trim(),
    summary: String(data.summary || '').trim(),
  };
}

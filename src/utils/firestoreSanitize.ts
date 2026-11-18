import {
  AppBackupSnapshot,
  AppNotification,
  AppState,
  AuditLogEntry,
  BudgetItem,
  ChinaPartner,
  Expense,
  Order,
  OrderItem,
  Product,
  Shareholder,
  SizeOption,
  StockImport,
  UserAccount,
} from '../types/erp';

export const WORKSPACE_ID = 'nhavuongmien_studio';
export const SYSTEM_META_DOC_ID = 'meta';

export const BUSINESS_COLLECTIONS = [
  'products',
  'stockImports',
  'orders',
  'shareholders',
  'expenses',
  'budgetItems',
  'accounts',
  'auditLogs',
  'backups',
  'chinaPartners',
  'notifications',
] as const;

export type BusinessCollectionName = (typeof BUSINESS_COLLECTIONS)[number];

export const BLUEPRINT_LIMITS = {
  ID_MAX: 128,
  ID_PATTERN: /^[a-zA-Z0-9_\-]+$/,
  CODE_MAX: 40,
  NAME_MAX: 160,
  PHONE_MAX: 32,
  ADDRESS_MAX: 500,
  NOTE_MAX: 500,
  CATEGORY_MAX: 80,
  USERNAME_MAX: 64,
  PIN_MIN: 4,
  PIN_MAX: 32,
  DATE_MAX: 20,
  TIMESTAMP_MAX: 64,
  ORDER_ITEMS_MAX: 30,
} as const;

export function sanitizeId(rawId: string, fallbackPrefix = 'doc'): string {
  const cleaned = String(rawId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_\-]/g, '_');
  if (cleaned.length > 0) {
    return cleaned.slice(0, BLUEPRINT_LIMITS.ID_MAX);
  }
  return `${fallbackPrefix}_${Date.now()}`;
}

export function clampStr(val: unknown, maxLen: number): string {
  const s = String(val ?? '').trim();
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

export function clampOptStr(val: unknown, maxLen: number): string | undefined {
  if (val === undefined || val === null) return undefined;
  const s = String(val).trim();
  if (!s) return undefined;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

export function clampNum(val: unknown, min = 0, max = 100000000000): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function sanitizeStockMap(
  raw: Partial<Record<SizeOption, number>> | undefined
): Partial<Record<SizeOption, number>> {
  const out: Partial<Record<SizeOption, number>> = {};
  if (!raw) return out;
  const sizes: SizeOption[] = ['S', 'M', 'L', 'Freesize'];
  for (const s of sizes) {
    if (raw[s] !== undefined && Number.isFinite(Number(raw[s]))) {
      out[s] = clampNum(raw[s], -100000, 100000);
    }
  }
  return out;
}

export function sanitizeProductPayload(p: Product): Record<string, unknown> {
  const doc: Record<string, unknown> = {
    id: sanitizeId(p.id, 'prd'),
    code: clampStr(p.code, BLUEPRINT_LIMITS.CODE_MAX) || 'SKU',
    name: clampStr(p.name, BLUEPRINT_LIMITS.NAME_MAX) || 'Sản phẩm',
    brand: p.brand,
    costPrice: clampNum(p.costPrice, 0, 1000000000),
    sellPrice: clampNum(p.sellPrice, 0, 1000000000),
    initialStock: sanitizeStockMap(p.initialStock),
  };
  if (p.stockAdjustments && Object.keys(p.stockAdjustments).length > 0) {
    doc.stockAdjustments = sanitizeStockMap(p.stockAdjustments);
  }
  if (p.isArchived !== undefined) {
    doc.isArchived = Boolean(p.isArchived);
  }
  return doc;
}

export function sanitizeStockImportPayload(imp: StockImport): Record<string, unknown> {
  const doc: Record<string, unknown> = {
    id: sanitizeId(imp.id, 'imp'),
    date: clampStr(imp.date, BLUEPRINT_LIMITS.DATE_MAX),
    productId: sanitizeId(imp.productId, 'prd'),
    size: imp.size,
    quantity: clampNum(imp.quantity, 1, 100000),
    unitCost: clampNum(imp.unitCost, 0, 1000000000),
  };
  const note = clampOptStr(imp.note, BLUEPRINT_LIMITS.NOTE_MAX);
  if (note !== undefined) doc.note = note;
  const enteredBy = clampOptStr(imp.enteredBy, BLUEPRINT_LIMITS.NAME_MAX);
  if (enteredBy !== undefined) doc.enteredBy = enteredBy;
  return doc;
}

function sanitizeOrderItems(items: OrderItem[]): OrderItem[] {
  return items.slice(0, BLUEPRINT_LIMITS.ORDER_ITEMS_MAX).map((item) => ({
    productId: sanitizeId(item.productId, 'prd'),
    productCode: clampStr(item.productCode, BLUEPRINT_LIMITS.CODE_MAX) || 'SKU',
    productName: clampStr(item.productName, BLUEPRINT_LIMITS.NAME_MAX) || 'Sản phẩm',
    size: item.size,
    quantity: clampNum(item.quantity, 1, 100000),
    unitPrice: clampNum(item.unitPrice, 0, 1000000000),
  }));
}

export function sanitizeOrderPayload(o: Order): Record<string, unknown> {
  const doc: Record<string, unknown> = {
    id: sanitizeId(o.id, 'ord'),
    code: clampStr(o.code, BLUEPRINT_LIMITS.CODE_MAX) || 'DH-0001',
    date: clampStr(o.date, BLUEPRINT_LIMITS.DATE_MAX),
    brand: o.brand,
    customerName: clampStr(o.customerName, BLUEPRINT_LIMITS.NAME_MAX) || 'Khách hàng',
    customerPhone: clampStr(o.customerPhone, BLUEPRINT_LIMITS.PHONE_MAX) || '0000000000',
    shippingAddress: clampStr(o.shippingAddress, BLUEPRINT_LIMITS.ADDRESS_MAX) || 'Chưa cập nhật',
    shippingMethod: o.shippingMethod,
    shopShippingCost: clampNum(o.shopShippingCost, 0, 100000000),
    shippingCostPayer: clampStr(o.shippingCostPayer || 'Ngân chi', BLUEPRINT_LIMITS.NAME_MAX),
    shippingStatus: o.shippingStatus,
    weightGrams: clampNum(o.weightGrams || 500, 1, 1000000),
    items: sanitizeOrderItems(o.items),
    shippingFee: clampNum(o.shippingFee, 0, 100000000),
    note: clampStr(o.note ?? '', BLUEPRINT_LIMITS.NOTE_MAX),
    paymentStatus: o.paymentStatus,
    isCancelled: Boolean(o.isCancelled),
    createdAt: clampStr(o.createdAt || new Date().toISOString(), BLUEPRINT_LIMITS.TIMESTAMP_MAX),
    createdBy: clampStr(o.createdBy || 'Hệ thống', BLUEPRINT_LIMITS.NAME_MAX),
  };
  if (o.discount !== undefined && Number.isFinite(Number(o.discount))) {
    const cleanDiscount = clampNum(o.discount, 0, 100000000);
    if (cleanDiscount > 0 || o.discount === 0) {
      doc.discount = cleanDiscount;
    }
  }
  const confirmedBy = clampOptStr(o.paymentConfirmedBy, BLUEPRINT_LIMITS.NAME_MAX);
  if (confirmedBy !== undefined) doc.paymentConfirmedBy = confirmedBy;
  const confirmedAt = clampOptStr(o.paymentConfirmedAt, BLUEPRINT_LIMITS.TIMESTAMP_MAX);
  if (confirmedAt !== undefined) doc.paymentConfirmedAt = confirmedAt;
  const cancelledBy = clampOptStr(o.cancelledBy, BLUEPRINT_LIMITS.NAME_MAX);
  if (cancelledBy !== undefined) doc.cancelledBy = cancelledBy;
  const cancelledAt = clampOptStr(o.cancelledAt, BLUEPRINT_LIMITS.TIMESTAMP_MAX);
  if (cancelledAt !== undefined) doc.cancelledAt = cancelledAt;
  return doc;
}

export function sanitizeShareholderPayload(sh: Shareholder): Record<string, unknown> {
  const doc: Record<string, unknown> = {
    id: sanitizeId(sh.id, 'sh'),
    name: clampStr(sh.name, BLUEPRINT_LIMITS.NAME_MAX) || 'Cổ đông',
    contribution: clampNum(sh.contribution, 0, 100000000000),
  };
  const note = clampOptStr(sh.note, BLUEPRINT_LIMITS.NOTE_MAX);
  if (note !== undefined) doc.note = note;
  const updatedBy = clampOptStr(sh.updatedBy, BLUEPRINT_LIMITS.NAME_MAX);
  if (updatedBy !== undefined) doc.updatedBy = updatedBy;
  return doc;
}

export function sanitizeExpensePayload(exp: Expense): Record<string, unknown> {
  const doc: Record<string, unknown> = {
    id: sanitizeId(exp.id, 'exp'),
    date: clampStr(exp.date, BLUEPRINT_LIMITS.DATE_MAX),
    category: clampStr(exp.category, BLUEPRINT_LIMITS.CATEGORY_MAX) || 'Khác',
    brandScope: exp.brandScope,
    detail: clampStr(exp.detail, BLUEPRINT_LIMITS.ADDRESS_MAX) || 'Khoản chi',
    amount: clampNum(exp.amount, 0, 100000000000),
    paidBy: clampStr(exp.paidBy, BLUEPRINT_LIMITS.NAME_MAX) || 'Ngân chi',
    receiptNote: clampStr(exp.receiptNote ?? '', BLUEPRINT_LIMITS.NOTE_MAX),
    status: exp.status,
  };
  if (exp.linkedOrderId) doc.linkedOrderId = sanitizeId(exp.linkedOrderId, 'ord');
  if (exp.linkedImportId) doc.linkedImportId = sanitizeId(exp.linkedImportId, 'imp');
  const enteredBy = clampOptStr(exp.enteredBy, BLUEPRINT_LIMITS.NAME_MAX);
  if (enteredBy !== undefined) doc.enteredBy = enteredBy;
  const updatedBy = clampOptStr(exp.updatedBy, BLUEPRINT_LIMITS.NAME_MAX);
  if (updatedBy !== undefined) doc.updatedBy = updatedBy;
  const updatedAt = clampOptStr(exp.updatedAt, BLUEPRINT_LIMITS.TIMESTAMP_MAX);
  if (updatedAt !== undefined) doc.updatedAt = updatedAt;
  return doc;
}

export function sanitizeBudgetItemPayload(item: BudgetItem): Record<string, unknown> {
  return {
    id: sanitizeId(item.id, 'bdg'),
    category: clampStr(item.category, BLUEPRINT_LIMITS.CATEGORY_MAX) || 'Khác',
    detail: clampStr(item.detail, BLUEPRINT_LIMITS.ADDRESS_MAX) || 'Dự trù',
    quantity: clampNum(item.quantity, 1, 1000000),
    estimatedUnitPrice: clampNum(item.estimatedUnitPrice, 0, 100000000000),
  };
}

export function sanitizeUserAccountPayload(acc: UserAccount): Record<string, unknown> {
  const rawPin = clampStr(acc.pin, BLUEPRINT_LIMITS.PIN_MAX);
  return {
    id: sanitizeId(acc.id, 'acc'),
    name: clampStr(acc.name, BLUEPRINT_LIMITS.NAME_MAX) || 'Thành viên',
    username: clampStr(acc.username, BLUEPRINT_LIMITS.USERNAME_MAX) || 'user',
    role: acc.role,
    pin: rawPin.length >= BLUEPRINT_LIMITS.PIN_MIN ? rawPin : '1234',
    createdAt: clampStr(acc.createdAt || new Date().toISOString(), BLUEPRINT_LIMITS.TIMESTAMP_MAX),
  };
}

export function sanitizeAuditLogPayload(entry: AuditLogEntry): Record<string, unknown> {
  const doc: Record<string, unknown> = {
    id: sanitizeId(entry.id, 'log'),
    timestamp: clampStr(entry.timestamp || new Date().toISOString(), BLUEPRINT_LIMITS.TIMESTAMP_MAX),
    actorId: clampStr(entry.actorId, BLUEPRINT_LIMITS.ID_MAX),
    actorName: clampStr(entry.actorName, BLUEPRINT_LIMITS.NAME_MAX),
    category: entry.category,
    action: clampStr(entry.action, BLUEPRINT_LIMITS.NAME_MAX),
    detail: clampStr(entry.detail, BLUEPRINT_LIMITS.NOTE_MAX) || entry.action,
  };
  const oldValue = clampOptStr(entry.oldValue, BLUEPRINT_LIMITS.NOTE_MAX);
  if (oldValue !== undefined) doc.oldValue = oldValue;
  const newValue = clampOptStr(entry.newValue, BLUEPRINT_LIMITS.NOTE_MAX);
  if (newValue !== undefined) doc.newValue = newValue;
  return doc;
}

export function sanitizeChinaPartnerPayload(cp: ChinaPartner): Record<string, unknown> {
  return {
    id: sanitizeId(cp.id, 'cp'),
    name: clampStr(cp.name, BLUEPRINT_LIMITS.NAME_MAX) || 'Đối tác TQ',
    region: clampStr(cp.region, BLUEPRINT_LIMITS.NAME_MAX) || 'Hàng Châu',
    specialty: clampStr(cp.specialty, BLUEPRINT_LIMITS.ADDRESS_MAX) || 'Lụa tơ tằm',
    contactWeChat: clampStr(cp.contactWeChat, BLUEPRINT_LIMITS.USERNAME_MAX) || '',
    phoneOrWhatsApp: clampStr(cp.phoneOrWhatsApp, BLUEPRINT_LIMITS.PHONE_MAX) || '',
    channel: cp.channel || 'Chính ngạch',
    exchangeRateCNY: clampNum(cp.exchangeRateCNY, 1000, 10000),
    rating: clampNum(cp.rating, 1, 5),
    status: cp.status || 'Hợp tác thường xuyên',
    notes: clampStr(cp.notes ?? '', BLUEPRINT_LIMITS.NOTE_MAX),
    lastOrderDate: clampStr(cp.lastOrderDate, BLUEPRINT_LIMITS.DATE_MAX),
  };
}

export function sanitizeNotificationPayload(n: AppNotification): Record<string, unknown> {
  const validType =
    n.type === 'order' || n.type === 'finance' || n.type === 'inventory' || n.type === 'system'
      ? n.type
      : 'system';

  const seenReadBy = new Set<string>();
  const cleanReadBy: string[] = [];
  if (Array.isArray(n.readBy)) {
    for (const rawUid of n.readBy) {
      const uid = clampStr(rawUid, BLUEPRINT_LIMITS.ID_MAX);
      if (uid && !seenReadBy.has(uid)) {
        seenReadBy.add(uid);
        cleanReadBy.push(uid);
        if (cleanReadBy.length >= 50) break;
      }
    }
  }

  return {
    id: sanitizeId(n.id, 'ntf'),
    title: clampStr(n.title, BLUEPRINT_LIMITS.NAME_MAX) || 'Thông báo mới',
    message: clampStr(n.message, BLUEPRINT_LIMITS.NOTE_MAX) || 'Có thay đổi dữ liệu mới',
    type: validType,
    actorId: clampStr(n.actorId, BLUEPRINT_LIMITS.ID_MAX) || 'system',
    actorName: clampStr(n.actorName, BLUEPRINT_LIMITS.NAME_MAX) || 'Hệ thống',
    createdAt: clampStr(n.createdAt || new Date().toISOString(), BLUEPRINT_LIMITS.TIMESTAMP_MAX),
    readBy: cleanReadBy,
  };
}

export function sanitizeBackupSnapshotPayload(bak: AppBackupSnapshot): Record<string, unknown> {
  const rawSnap = bak.snapshot ?? {
    products: [],
    stockImports: [],
    orders: [],
    shareholders: [],
    expenses: [],
    budgetItems: [],
    accounts: [],
    chinaPartners: [],
  };

  const products = (Array.isArray(rawSnap.products) ? rawSnap.products : [])
    .slice(0, 500)
    .map(sanitizeProductPayload);
  const stockImports = (Array.isArray(rawSnap.stockImports) ? rawSnap.stockImports : [])
    .slice(0, 1000)
    .map(sanitizeStockImportPayload);
  const orders = (Array.isArray(rawSnap.orders) ? rawSnap.orders : [])
    .slice(0, 1000)
    .map(sanitizeOrderPayload);
  const shareholders = (Array.isArray(rawSnap.shareholders) ? rawSnap.shareholders : [])
    .slice(0, 100)
    .map(sanitizeShareholderPayload);
  const expenses = (Array.isArray(rawSnap.expenses) ? rawSnap.expenses : [])
    .slice(0, 1000)
    .map(sanitizeExpensePayload);
  const budgetItems = (Array.isArray(rawSnap.budgetItems) ? rawSnap.budgetItems : [])
    .slice(0, 500)
    .map(sanitizeBudgetItemPayload);
  const accounts = (Array.isArray(rawSnap.accounts) ? rawSnap.accounts : [])
    .slice(0, 100)
    .map(sanitizeUserAccountPayload);
  const chinaPartners = (Array.isArray(rawSnap.chinaPartners) ? rawSnap.chinaPartners : [])
    .slice(0, 200)
    .map(sanitizeChinaPartnerPayload);

  return {
    id: sanitizeId(bak.id, 'bak'),
    createdAt: clampStr(bak.createdAt || new Date().toISOString(), BLUEPRINT_LIMITS.TIMESTAMP_MAX),
    actorId: clampStr(bak.actorId || 'system', BLUEPRINT_LIMITS.ID_MAX),
    actorName: clampStr(bak.actorName || 'Hệ thống', BLUEPRINT_LIMITS.NAME_MAX),
    category: bak.category || 'Hệ thống',
    action: clampStr(bak.action || 'Sao lưu dữ liệu', BLUEPRINT_LIMITS.NAME_MAX),
    detail: clampStr(bak.detail || bak.action || 'Sao lưu tự động', BLUEPRINT_LIMITS.NOTE_MAX),
    summary: {
      productsCount: clampNum(bak.summary?.productsCount ?? products.length, 0, 500),
      stockImportsCount: clampNum(bak.summary?.stockImportsCount ?? stockImports.length, 0, 1000),
      ordersCount: clampNum(bak.summary?.ordersCount ?? orders.length, 0, 1000),
      shareholdersCount: clampNum(bak.summary?.shareholdersCount ?? shareholders.length, 0, 100),
      expensesCount: clampNum(bak.summary?.expensesCount ?? expenses.length, 0, 1000),
      budgetItemsCount: clampNum(bak.summary?.budgetItemsCount ?? budgetItems.length, 0, 500),
      accountsCount: clampNum(bak.summary?.accountsCount ?? accounts.length, 0, 100),
      chinaPartnersCount: clampNum(bak.summary?.chinaPartnersCount ?? chinaPartners.length, 0, 200),
    },
    snapshot: {
      products,
      stockImports,
      orders,
      shareholders,
      expenses,
      budgetItems,
      accounts,
      chinaPartners,
    },
  };
}

export function sanitizeEntityForCollection(
  collectionName: BusinessCollectionName,
  record: unknown
): Record<string, unknown> {
  switch (collectionName) {
    case 'products':
      return sanitizeProductPayload(record as Product);
    case 'stockImports':
      return sanitizeStockImportPayload(record as StockImport);
    case 'orders':
      return sanitizeOrderPayload(record as Order);
    case 'shareholders':
      return sanitizeShareholderPayload(record as Shareholder);
    case 'expenses':
      return sanitizeExpensePayload(record as Expense);
    case 'budgetItems':
      return sanitizeBudgetItemPayload(record as BudgetItem);
    case 'accounts':
      return sanitizeUserAccountPayload(record as UserAccount);
    case 'auditLogs':
      return sanitizeAuditLogPayload(record as AuditLogEntry);
    case 'backups':
      return sanitizeBackupSnapshotPayload(record as AppBackupSnapshot);
    case 'chinaPartners':
      return sanitizeChinaPartnerPayload(record as ChinaPartner);
    case 'notifications':
      return sanitizeNotificationPayload(record as AppNotification);
  }
}

export interface DiffUpsertOp {
  collection: BusinessCollectionName;
  id: string;
  data: Record<string, unknown>;
  isCreate: boolean;
}

export interface DiffDeleteOp {
  collection: BusinessCollectionName;
  id: string;
}

export interface StateDiffResult {
  upserts: DiffUpsertOp[];
  deletes: DiffDeleteOp[];
  updateSystemMeta: boolean;
}

function stableEquals(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function computeStateDiffOps(prev: AppState, next: AppState): StateDiffResult {
  const upserts: DiffUpsertOp[] = [];
  const deletes: DiffDeleteOp[] = [];

  for (const col of BUSINESS_COLLECTIONS) {
    const prevList = prev[col] as Array<{ id: string }>;
    const nextList = next[col] as Array<{ id: string }>;

    const prevMap = new Map<string, Record<string, unknown>>();
    for (const item of prevList) {
      const sanitized = sanitizeEntityForCollection(col, item);
      prevMap.set(String(sanitized.id), sanitized);
    }

    const nextIds = new Set<string>();
    for (const item of nextList) {
      const sanitized = sanitizeEntityForCollection(col, item);
      const id = String(sanitized.id);
      nextIds.add(id);
      const existingSanitized = prevMap.get(id);
      if (!existingSanitized) {
        upserts.push({ collection: col, id, data: sanitized, isCreate: true });
      } else if (!stableEquals(existingSanitized, sanitized)) {
        upserts.push({ collection: col, id, data: sanitized, isCreate: false });
      }
    }

    for (const id of prevMap.keys()) {
      if (!nextIds.has(id)) {
        deletes.push({ collection: col, id });
      }
    }
  }

  return {
    upserts,
    deletes,
    updateSystemMeta: prev.isSampleData !== next.isSampleData || prev.appIcon !== next.appIcon,
  };
}

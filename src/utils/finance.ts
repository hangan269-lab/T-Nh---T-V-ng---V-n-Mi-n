import {
  ALL_BRANDS,
  ALL_SIZES,
  AppState,
  AuditCategory,
  AuditLogEntry,
  Brand,
  BudgetItem,
  Expense,
  ExpenseStatus,
  Order,
  OrderItem,
  PaymentStatus,
  Product,
  Shareholder,
  ShippingMethod,
  ShippingStatus,
  SizeOption,
  StockImport,
  UserAccount,
  UserRole,
} from '../types/erp';

export interface ActorIdentity {
  id: string;
  name: string;
  role: UserRole;
}

const DEFAULT_ACTOR: ActorIdentity = {
  id: 'acc_ngan',
  name: 'Ngân',
  role: 'Admin',
};

export function getTodayISO(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getRelativeISO(daysOffset: number, baseDate: Date = new Date()): string {
  const d = new Date(baseDate);
  d.setDate(d.getDate() + daysOffset);
  return getTodayISO(d);
}

export function formatDateVN(isoDate: string): string {
  if (!isoDate || !isoDate.includes('-')) return isoDate;
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

export function formatAuditTimestamp(isoString: string): string {
  if (!isoString) return '';
  const dt = new Date(isoString);
  if (Number.isNaN(dt.getTime())) return isoString;
  const hh = String(dt.getHours()).padStart(2, '0');
  const mm = String(dt.getMinutes()).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  const mo = String(dt.getMonth() + 1).padStart(2, '0');
  return `${hh}:${mm} ${dd}/${mo}`;
}

export function formatVND(
  amount: number,
  options: { parenthesesForNegative?: boolean } = {}
): string {
  const rounded = Math.round(amount);
  const absFormatted = new Intl.NumberFormat('vi-VN').format(Math.abs(rounded));
  if (rounded < 0) {
    if (options.parenthesesForNegative) {
      return `(${absFormatted} đ)`;
    }
    return `-${absFormatted} đ`;
  }
  return `${absFormatted} đ`;
}

export function formatCompactVND(amount: number): string {
  const rounded = Math.round(amount);
  const absFormatted = new Intl.NumberFormat('vi-VN').format(Math.abs(rounded));
  return rounded < 0 ? `-${absFormatted}đ` : `${absFormatted}đ`;
}

export function createAuditEntry(input: {
  actor: ActorIdentity;
  category: AuditCategory;
  action: string;
  detail: string;
  oldValue?: string;
  newValue?: string;
  timestamp?: string;
}): AuditLogEntry {
  return {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: input.timestamp ?? new Date().toISOString(),
    actorId: input.actor.id,
    actorName: input.actor.name,
    category: input.category,
    action: input.action,
    detail: input.detail,
    oldValue: input.oldValue,
    newValue: input.newValue,
  };
}

export function authenticateUser(
  accounts: UserAccount[],
  identifier: string,
  pin: string
): { ok: true; account: UserAccount } | { ok: false; error: string } {
  const cleanId = identifier.trim().toLowerCase();
  const cleanPin = pin.trim();
  if (!cleanId) {
    return { ok: false, error: 'Vui lòng chọn tài khoản hoặc nhập tên đăng nhập.' };
  }
  if (!cleanPin) {
    return { ok: false, error: 'Vui lòng nhập mật khẩu / mã PIN.' };
  }

  const matched = accounts.find(
    (a) => a.username.toLowerCase() === cleanId || a.name.toLowerCase() === cleanId
  );
  if (!matched) {
    return { ok: false, error: 'Không tìm thấy tài khoản phù hợp.' };
  }
  if (matched.pin !== cleanPin) {
    return { ok: false, error: 'Mật khẩu / mã PIN không đúng. Vui lòng thử lại.' };
  }
  return { ok: true, account: matched };
}

export function createUserAccountWithAudit(
  state: AppState,
  input: { name: string; username: string; role: UserRole; pin: string },
  actor: ActorIdentity
): { ok: true; state: AppState; account: UserAccount } | { ok: false; error: string } {
  if (actor.role !== 'Admin') {
    return { ok: false, error: 'Chỉ Admin mới có quyền tạo tài khoản mới.' };
  }
  const name = input.name.trim();
  const username = input.username.trim().toLowerCase().replace(/\s+/g, '');
  const pin = input.pin.trim();

  if (!name || !username) {
    return { ok: false, error: 'Vui lòng nhập đầy đủ Tên hiển thị và Tên đăng nhập.' };
  }
  if (pin.length < 4) {
    return { ok: false, error: 'Mã PIN / mật khẩu phải có ít nhất 4 ký tự.' };
  }
  const duplicate = state.accounts.some(
    (a) =>
      a.username.toLowerCase() === username ||
      a.name.toLowerCase() === name.toLowerCase()
  );
  if (duplicate) {
    return { ok: false, error: 'Tên đăng nhập hoặc tên thành viên đã tồn tại.' };
  }

  const account: UserAccount = {
    id: `acc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    username,
    role: input.role,
    pin,
    createdAt: new Date().toISOString(),
  };

  const log = createAuditEntry({
    actor,
    category: 'Tài khoản',
    action: 'Tạo tài khoản mới',
    detail: `${actor.name} đã tạo tài khoản "${account.name}" (Tên đăng nhập: ${account.username}, Vai trò: ${account.role})`,
  });

  return {
    ok: true,
    account,
    state: {
      ...state,
      accounts: [...state.accounts, account],
      auditLogs: [log, ...state.auditLogs],
    },
  };
}

export function changeUserPinWithAudit(
  state: AppState,
  targetUserId: string,
  newPin: string,
  actor: ActorIdentity,
  currentPinForSelf?: string
): { ok: true; state: AppState } | { ok: false; error: string } {
  const target = state.accounts.find((a) => a.id === targetUserId);
  if (!target) {
    return { ok: false, error: 'Không tìm thấy tài khoản cần đổi mật khẩu.' };
  }
  const isSelf = target.id === actor.id;
  if (!isSelf && actor.role !== 'Admin') {
    return { ok: false, error: 'Bạn chỉ được đổi mã PIN của chính mình.' };
  }
  if (isSelf && currentPinForSelf !== undefined && target.pin !== currentPinForSelf.trim()) {
    return { ok: false, error: 'Mã PIN hiện tại không chính xác.' };
  }
  const cleanNewPin = newPin.trim();
  if (cleanNewPin.length < 4) {
    return { ok: false, error: 'Mã PIN / mật khẩu mới phải có ít nhất 4 ký tự.' };
  }

  const log = createAuditEntry({
    actor,
    category: 'Tài khoản',
    action: 'Đổi mã PIN / Mật khẩu',
    detail: isSelf
      ? `${actor.name} đã tự thay đổi mã PIN đăng nhập`
      : `${actor.name} đã đặt lại mã PIN cho tài khoản ${target.name}`,
  });

  return {
    ok: true,
    state: {
      ...state,
      accounts: state.accounts.map((a) =>
        a.id === targetUserId ? { ...a, pin: cleanNewPin } : a
      ),
      auditLogs: [log, ...state.auditLogs],
    },
  };
}

export function getOrderItemsSubtotal(order: Pick<Order, 'items'>): number {
  return order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

export function getOrderTotal(order: Pick<Order, 'items' | 'shippingFee'>): number {
  return getOrderItemsSubtotal(order) + (order.shippingFee || 0);
}

export function getOrderCOD(
  order: Pick<Order, 'items' | 'shippingFee' | 'paymentStatus' | 'isCancelled'>
): number {
  if (order.isCancelled || order.paymentStatus === PaymentStatus.PAID) {
    return 0;
  }
  return getOrderTotal(order);
}

export function syncOrderShippingExpense(expenses: Expense[], order: Order): Expense[] {
  const filtered = expenses.filter((e) => e.linkedOrderId !== order.id);
  if (order.isCancelled || !order.shopShippingCost || order.shopShippingCost <= 0) {
    return filtered;
  }

  const linkedExpense: Expense = {
    id: `exp_ship_${order.id}`,
    linkedOrderId: order.id,
    date: order.date,
    category: 'Vận chuyển',
    brandScope: order.brand,
    detail: `${order.shippingMethod} - Đơn của ${order.customerName} (${order.customerPhone})`,
    amount: Math.round(order.shopShippingCost),
    paidBy: order.shippingCostPayer || 'Ngân chi',
    receiptNote: `Cước VC đơn ${order.code}`,
    status: ExpenseStatus.COMPLETED,
    enteredBy: order.createdBy,
  };

  return [linkedExpense, ...filtered];
}

export interface InventoryRow {
  key: string;
  productId: string;
  productCode: string;
  productName: string;
  brand: Brand;
  costPrice: number;
  sellPrice: number;
  size: SizeOption;
  initialStock: number;
  totalImported: number;
  totalSold: number;
  currentStock: number;
  isLowStock: boolean;
}

export function getProductActiveSizes(
  product: Product,
  stockImports: StockImport[],
  orders: Order[]
): SizeOption[] {
  const sizeSet = new Set<SizeOption>();

  for (const size of ALL_SIZES) {
    if (product.initialStock[size] !== undefined) {
      sizeSet.add(size);
    }
  }

  for (const imp of stockImports) {
    if (imp.productId === product.id) {
      sizeSet.add(imp.size);
    }
  }

  for (const order of orders) {
    if (order.isCancelled) continue;
    for (const item of order.items) {
      if (item.productId === product.id) {
        sizeSet.add(item.size);
      }
    }
  }

  if (sizeSet.size === 0) {
    return product.brand === Brand.VAN_MIEN ? ['Freesize'] : ['S', 'M', 'L'];
  }

  return ALL_SIZES.filter((s) => sizeSet.has(s));
}

export function computeInventoryRows(
  products: Product[],
  stockImports: StockImport[],
  orders: Order[]
): InventoryRow[] {
  const rows: InventoryRow[] = [];

  for (const product of products) {
    const sizes = getProductActiveSizes(product, stockImports, orders);
    for (const size of sizes) {
      const initialStock = product.initialStock[size] ?? 0;
      const totalImported = stockImports
        .filter((imp) => imp.productId === product.id && imp.size === size)
        .reduce((sum, imp) => sum + imp.quantity, 0);
      const totalSold = orders
        .filter((o) => !o.isCancelled)
        .flatMap((o) => o.items)
        .filter((item) => item.productId === product.id && item.size === size)
        .reduce((sum, item) => sum + item.quantity, 0);
      const currentStock = initialStock + totalImported - totalSold;

      rows.push({
        key: `${product.id}_${size}`,
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        brand: product.brand,
        costPrice: product.costPrice,
        sellPrice: product.sellPrice,
        size,
        initialStock,
        totalImported,
        totalSold,
        currentStock,
        isLowStock: currentStock <= 1,
      });
    }
  }

  return rows;
}

export function getAvailableStock(
  productId: string,
  size: SizeOption,
  products: Product[],
  stockImports: StockImport[],
  orders: Order[]
): number {
  const product = products.find((p) => p.id === productId);
  if (!product) return 0;

  const initialStock = product.initialStock[size] ?? 0;
  const totalImported = stockImports
    .filter((imp) => imp.productId === productId && imp.size === size)
    .reduce((sum, imp) => sum + imp.quantity, 0);
  const totalSold = orders
    .filter((o) => !o.isCancelled)
    .flatMap((o) => o.items)
    .filter((item) => item.productId === productId && item.size === size)
    .reduce((sum, item) => sum + item.quantity, 0);

  return initialStock + totalImported - totalSold;
}

export interface BrandPnLRow {
  brand: Brand;
  importCost: number;
  salesRevenue: number;
  operatingExpense: number;
  profit: number;
  activeOrderCount: number;
}

export interface PnLSummary {
  byBrand: BrandPnLRow[];
  total: {
    importCost: number;
    salesRevenue: number;
    operatingExpense: number;
    profit: number;
    activeOrderCount: number;
  };
}

export function computeBrandPnL(
  products: Product[],
  stockImports: StockImport[],
  orders: Order[],
  expenses: Expense[]
): PnLSummary {
  const productMap = new Map<string, Product>();
  for (const p of products) {
    productMap.set(p.id, p);
  }

  const brandImportCost: Record<Brand, number> = {
    [Brand.TO_NHA]: 0,
    [Brand.TO_VUONG]: 0,
    [Brand.VAN_MIEN]: 0,
  };

  for (const p of products) {
    const initQty = ALL_SIZES.reduce((sum, s) => sum + (p.initialStock[s] ?? 0), 0);
    brandImportCost[p.brand] += initQty * p.costPrice;
  }

  for (const imp of stockImports) {
    const prod = productMap.get(imp.productId);
    if (prod) {
      brandImportCost[prod.brand] += imp.quantity * imp.unitCost;
    }
  }

  const brandSales: Record<Brand, number> = {
    [Brand.TO_NHA]: 0,
    [Brand.TO_VUONG]: 0,
    [Brand.VAN_MIEN]: 0,
  };
  const brandOrderCounts: Record<Brand, number> = {
    [Brand.TO_NHA]: 0,
    [Brand.TO_VUONG]: 0,
    [Brand.VAN_MIEN]: 0,
  };

  for (const order of orders) {
    if (order.isCancelled) continue;
    brandSales[order.brand] += getOrderTotal(order);
    brandOrderCounts[order.brand] += 1;
  }

  const brandOperatingExpense: Record<Brand, number> = {
    [Brand.TO_NHA]: 0,
    [Brand.TO_VUONG]: 0,
    [Brand.VAN_MIEN]: 0,
  };

  for (const exp of expenses) {
    if (exp.category === 'Nhập hàng') continue;
    if (exp.brandScope === 'Dùng chung') {
      const base = Math.floor(exp.amount / 3);
      const remainder = exp.amount - base * 3;
      brandOperatingExpense[Brand.TO_NHA] += base + (remainder >= 1 ? 1 : 0);
      brandOperatingExpense[Brand.TO_VUONG] += base + (remainder >= 2 ? 1 : 0);
      brandOperatingExpense[Brand.VAN_MIEN] += base;
    } else {
      brandOperatingExpense[exp.brandScope] += exp.amount;
    }
  }

  const byBrand: BrandPnLRow[] = ALL_BRANDS.map((brand) => {
    const importCost = brandImportCost[brand];
    const salesRevenue = brandSales[brand];
    const operatingExpense = brandOperatingExpense[brand];
    const profit = salesRevenue - importCost - operatingExpense;
    return {
      brand,
      importCost,
      salesRevenue,
      operatingExpense,
      profit,
      activeOrderCount: brandOrderCounts[brand],
    };
  });

  const total = byBrand.reduce(
    (acc, row) => ({
      importCost: acc.importCost + row.importCost,
      salesRevenue: acc.salesRevenue + row.salesRevenue,
      operatingExpense: acc.operatingExpense + row.operatingExpense,
      profit: acc.profit + row.profit,
      activeOrderCount: acc.activeOrderCount + row.activeOrderCount,
    }),
    {
      importCost: 0,
      salesRevenue: 0,
      operatingExpense: 0,
      profit: 0,
      activeOrderCount: 0,
    }
  );

  return { byBrand, total };
}

export interface TodayStats {
  todayOrders: Order[];
  orderCount: number;
  paidRevenue: number;
  unpaidRevenue: number;
  totalRevenue: number;
}

export function computeTodayStats(orders: Order[], todayISO: string = getTodayISO()): TodayStats {
  const todayAll = orders.filter((o) => o.date === todayISO);
  const activeToday = todayAll.filter((o) => !o.isCancelled);

  let paidRevenue = 0;
  let unpaidRevenue = 0;

  for (const o of activeToday) {
    const total = getOrderTotal(o);
    if (o.paymentStatus === PaymentStatus.PAID) {
      paidRevenue += total;
    } else {
      unpaidRevenue += total;
    }
  }

  return {
    todayOrders: todayAll,
    orderCount: activeToday.length,
    paidRevenue,
    unpaidRevenue,
    totalRevenue: paidRevenue + unpaidRevenue,
  };
}

export interface FundSummary {
  totalCapital: number;
  totalSpent: number;
  currentBalance: number;
}

export function computeFundSummary(
  shareholders: Shareholder[],
  expenses: Expense[]
): FundSummary {
  const totalCapital = shareholders.reduce((sum, s) => sum + s.contribution, 0);
  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
  return {
    totalCapital,
    totalSpent,
    currentBalance: totalCapital - totalSpent,
  };
}

export interface BudgetSummary {
  totalBudget: number;
  balanceDifference: number; // currentBalance - totalBudget
  additionalNeeded: number; // max(0, totalBudget - currentBalance)
}

export function computeBudgetSummary(
  budgetItems: BudgetItem[],
  currentBalance: number
): BudgetSummary {
  const totalBudget = budgetItems.reduce(
    (sum, item) => sum + item.quantity * item.estimatedUnitPrice,
    0
  );
  const balanceDifference = currentBalance - totalBudget;
  return {
    totalBudget,
    balanceDifference,
    additionalNeeded: balanceDifference < 0 ? Math.abs(balanceDifference) : 0,
  };
}

export interface OrderDraftInput {
  date: string;
  brand: Brand;
  customerName: string;
  customerPhone: string;
  shippingAddress: string;
  shippingMethod: ShippingMethod;
  shopShippingCost: number;
  shippingCostPayer?: string;
  shippingStatus?: ShippingStatus;
  weightGrams?: number;
  items: Array<{
    productId: string;
    size: SizeOption;
    quantity: number;
    unitPrice?: number;
  }>;
  shippingFee: number;
  note: string;
  paymentStatus: PaymentStatus;
}

export type OrderCreateResult =
  | { ok: true; state: AppState; order: Order }
  | { ok: false; error: string };

export function createOrderWithValidation(
  state: AppState,
  draft: OrderDraftInput,
  actor: ActorIdentity = DEFAULT_ACTOR
): OrderCreateResult {
  const customerName = draft.customerName.trim();
  const customerPhone = draft.customerPhone.trim();
  const shippingAddress = draft.shippingAddress.trim();

  if (!draft.date) {
    return { ok: false, error: 'Vui lòng chọn ngày đặt hàng.' };
  }
  if (!customerName) {
    return { ok: false, error: 'Vui lòng nhập tên người nhận.' };
  }
  if (!customerPhone) {
    return { ok: false, error: 'Vui lòng nhập số điện thoại người nhận.' };
  }
  if (!shippingAddress) {
    return {
      ok: false,
      error: 'Vui lòng nhập địa chỉ giao hàng chi tiết (số nhà, đường, phường/xã, quận/huyện, tỉnh/TP).',
    };
  }
  if (!draft.items || draft.items.length === 0) {
    return { ok: false, error: 'Đơn hàng cần ít nhất 1 sản phẩm.' };
  }
  if (draft.shippingFee < 0 || Number.isNaN(draft.shippingFee)) {
    return { ok: false, error: 'Phí ship khách trả không hợp lệ.' };
  }
  if (draft.shopShippingCost < 0 || Number.isNaN(draft.shopShippingCost)) {
    return { ok: false, error: 'Cước phí vận chuyển shop trả không hợp lệ.' };
  }

  const weightGrams = draft.weightGrams ?? 500;
  if (!Number.isFinite(weightGrams) || weightGrams <= 0) {
    return { ok: false, error: 'Trọng lượng đơn hàng (gram) phải lớn hơn 0.' };
  }

  // Aggregate requested qty per (productId, size) to validate against stock accurately
  const requestedBySku = new Map<string, { product: Product; size: SizeOption; qty: number }>();
  const resolvedItems: OrderItem[] = [];

  for (const rawItem of draft.items) {
    if (!rawItem.productId) {
      return { ok: false, error: 'Vui lòng chọn mẫu sản phẩm cho tất cả các dòng.' };
    }
    const product = state.products.find((p) => p.id === rawItem.productId);
    if (!product) {
      return { ok: false, error: 'Không tìm thấy mẫu sản phẩm đã chọn.' };
    }
    if (!Number.isFinite(rawItem.quantity) || rawItem.quantity <= 0) {
      return { ok: false, error: `Số lượng của "${product.name}" phải lớn hơn 0.` };
    }
    const unitPrice =
      rawItem.unitPrice !== undefined && Number.isFinite(rawItem.unitPrice)
        ? rawItem.unitPrice
        : product.sellPrice;
    if (unitPrice < 0) {
      return { ok: false, error: `Đơn giá của "${product.name}" không hợp lệ.` };
    }

    const skuKey = `${product.id}_${rawItem.size}`;
    const existing = requestedBySku.get(skuKey);
    if (existing) {
      existing.qty += rawItem.quantity;
    } else {
      requestedBySku.set(skuKey, { product, size: rawItem.size, qty: rawItem.quantity });
    }

    resolvedItems.push({
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      size: rawItem.size,
      quantity: rawItem.quantity,
      unitPrice,
    });
  }

  for (const { product, size, qty } of requestedBySku.values()) {
    const available = getAvailableStock(
      product.id,
      size,
      state.products,
      state.stockImports,
      state.orders
    );
    if (qty > available) {
      return {
        ok: false,
        error: `Tồn kho không đủ cho "${product.code} - ${product.name}" (Size ${size}): còn ${available}, đang đặt ${qty}.`,
      };
    }
  }

  const nowISO = new Date().toISOString();
  const nextSeq = state.orders.length + 1;
  const code = `DH-${String(nextSeq).padStart(4, '0')}`;
  const order: Order = {
    id: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    code,
    date: draft.date,
    brand: draft.brand,
    customerName,
    customerPhone,
    shippingAddress,
    shippingMethod: draft.shippingMethod,
    shopShippingCost: Math.round(draft.shopShippingCost || 0),
    shippingCostPayer: draft.shippingCostPayer?.trim() || 'Ngân chi',
    shippingStatus: draft.shippingStatus ?? ShippingStatus.NOT_SENT,
    weightGrams: Math.round(weightGrams),
    items: resolvedItems,
    shippingFee: Math.round(draft.shippingFee || 0),
    note: draft.note.trim(),
    paymentStatus: draft.paymentStatus,
    isCancelled: false,
    createdAt: nowISO,
    createdBy: actor.name,
    paymentConfirmedBy: draft.paymentStatus === PaymentStatus.PAID ? actor.name : undefined,
    paymentConfirmedAt: draft.paymentStatus === PaymentStatus.PAID ? nowISO : undefined,
  };

  const nextExpenses = syncOrderShippingExpense(state.expenses, order);
  const totalAmount = getOrderTotal(order);
  const log = createAuditEntry({
    actor,
    category: 'Đơn hàng',
    action: 'Tạo đơn hàng',
    detail: `${actor.name} đã tạo đơn hàng #${order.code} (Khách: ${order.customerName} - ${formatCompactVND(totalAmount)})`,
    timestamp: nowISO,
  });

  return {
    ok: true,
    order,
    state: {
      ...state,
      orders: [order, ...state.orders],
      expenses: nextExpenses,
      auditLogs: [log, ...state.auditLogs],
    },
  };
}

export function confirmOrderPayment(
  state: AppState,
  orderId: string,
  actor: ActorIdentity = DEFAULT_ACTOR
): AppState {
  const target = state.orders.find((o) => o.id === orderId);
  if (!target || target.isCancelled || target.paymentStatus === PaymentStatus.PAID) {
    return state;
  }
  const nowISO = new Date().toISOString();
  const totalAmount = getOrderTotal(target);
  const log = createAuditEntry({
    actor,
    category: 'Đơn hàng',
    action: 'Xác nhận thanh toán',
    detail: `${actor.name} đã xác nhận ĐÃ THANH TOÁN cho đơn #${target.code} (Khách: ${target.customerName} - ${formatCompactVND(totalAmount)})`,
    oldValue: PaymentStatus.UNPAID,
    newValue: PaymentStatus.PAID,
    timestamp: nowISO,
  });

  return {
    ...state,
    orders: state.orders.map((o) =>
      o.id === orderId && !o.isCancelled
        ? {
            ...o,
            paymentStatus: PaymentStatus.PAID,
            paymentConfirmedBy: actor.name,
            paymentConfirmedAt: nowISO,
          }
        : o
    ),
    auditLogs: [log, ...state.auditLogs],
  };
}

export function cancelOrder(
  state: AppState,
  orderId: string,
  actor: ActorIdentity = DEFAULT_ACTOR
): AppState {
  const target = state.orders.find((o) => o.id === orderId);
  if (!target || target.isCancelled) return state;

  const nowISO = new Date().toISOString();
  let updatedOrder: Order | null = null;
  const nextOrders = state.orders.map((o) => {
    if (o.id === orderId) {
      updatedOrder = {
        ...o,
        isCancelled: true,
        cancelledBy: actor.name,
        cancelledAt: nowISO,
      };
      return updatedOrder;
    }
    return o;
  });

  const nextExpenses = updatedOrder
    ? syncOrderShippingExpense(state.expenses, updatedOrder)
    : state.expenses;

  const log = createAuditEntry({
    actor,
    category: 'Đơn hàng',
    action: 'Hủy đơn hàng',
    detail: `${actor.name} đã HỦY đơn hàng #${target.code} (Khách: ${target.customerName} - ${formatCompactVND(getOrderTotal(target))})`,
    timestamp: nowISO,
  });

  return {
    ...state,
    orders: nextOrders,
    expenses: nextExpenses,
    auditLogs: [log, ...state.auditLogs],
  };
}

export interface OrderShippingUpdate {
  shippingAddress?: string;
  shippingMethod?: ShippingMethod;
  shopShippingCost?: number;
  shippingCostPayer?: string;
  shippingStatus?: ShippingStatus;
  weightGrams?: number;
}

export function updateOrderShipping(
  state: AppState,
  orderId: string,
  patch: OrderShippingUpdate,
  actor: ActorIdentity = DEFAULT_ACTOR
): AppState {
  const prevOrder = state.orders.find((o) => o.id === orderId);
  if (!prevOrder) return state;

  let updatedOrder: Order | null = null;
  const nextOrders = state.orders.map((o) => {
    if (o.id !== orderId) return o;
    updatedOrder = {
      ...o,
      shippingAddress:
        patch.shippingAddress !== undefined ? patch.shippingAddress.trim() : o.shippingAddress,
      shippingMethod: patch.shippingMethod ?? o.shippingMethod,
      shopShippingCost:
        patch.shopShippingCost !== undefined
          ? Math.max(0, Math.round(patch.shopShippingCost))
          : o.shopShippingCost,
      shippingCostPayer:
        patch.shippingCostPayer !== undefined
          ? patch.shippingCostPayer.trim() || 'Ngân chi'
          : o.shippingCostPayer,
      shippingStatus: patch.shippingStatus ?? o.shippingStatus,
      weightGrams:
        patch.weightGrams !== undefined
          ? Math.max(1, Math.round(patch.weightGrams))
          : o.weightGrams,
    };
    return updatedOrder;
  });

  if (!updatedOrder) return state;
  const nextOrder: Order = updatedOrder;

  const changes: string[] = [];
  if (prevOrder.shippingStatus !== nextOrder.shippingStatus) {
    changes.push(`Trạng thái VC từ "${prevOrder.shippingStatus}" thành "${nextOrder.shippingStatus}"`);
  }
  if (prevOrder.shopShippingCost !== nextOrder.shopShippingCost) {
    changes.push(
      `Cước VC shop từ ${formatCompactVND(prevOrder.shopShippingCost)} thành ${formatCompactVND(nextOrder.shopShippingCost)}`
    );
  }
  if (prevOrder.shippingMethod !== nextOrder.shippingMethod) {
    changes.push(`Đơn vị VC từ "${prevOrder.shippingMethod}" thành "${nextOrder.shippingMethod}"`);
  }
  if (prevOrder.shippingCostPayer !== nextOrder.shippingCostPayer) {
    changes.push(`Người chi cước từ "${prevOrder.shippingCostPayer}" thành "${nextOrder.shippingCostPayer}"`);
  }
  if (prevOrder.shippingAddress !== nextOrder.shippingAddress) {
    changes.push(`Địa chỉ giao hàng đã cập nhật`);
  }
  if (prevOrder.weightGrams !== nextOrder.weightGrams) {
    changes.push(`Trọng lượng từ ${prevOrder.weightGrams}g thành ${nextOrder.weightGrams}g`);
  }

  const nextExpenses = syncOrderShippingExpense(state.expenses, nextOrder);
  const nextLogs =
    changes.length > 0
      ? [
          createAuditEntry({
            actor,
            category: 'Đơn hàng',
            action: 'Sửa vận chuyển đơn',
            detail: `${actor.name} đã cập nhật vận chuyển đơn #${nextOrder.code}: ${changes.join('; ')}`,
          }),
          ...state.auditLogs,
        ]
      : state.auditLogs;

  return {
    ...state,
    orders: nextOrders,
    expenses: nextExpenses,
    auditLogs: nextLogs,
  };
}

export function markOrdersShippingStatus(
  state: AppState,
  orderIds: string[],
  status: ShippingStatus,
  actor: ActorIdentity = DEFAULT_ACTOR
): AppState {
  const idSet = new Set(orderIds);
  const affectedCodes = state.orders
    .filter((o) => idSet.has(o.id) && !o.isCancelled && o.shippingStatus !== status)
    .map((o) => o.code);

  if (affectedCodes.length === 0) return state;

  const log = createAuditEntry({
    actor,
    category: 'Đơn hàng',
    action: 'Cập nhật trạng thái VTP',
    detail: `${actor.name} đã chuyển ${affectedCodes.length} đơn (${affectedCodes.join(', ')}) sang trạng thái "${status}"`,
  });

  return {
    ...state,
    orders: state.orders.map((o) =>
      idSet.has(o.id) && !o.isCancelled ? { ...o, shippingStatus: status } : o
    ),
    auditLogs: [log, ...state.auditLogs],
  };
}

export function addExpenseWithAudit(
  state: AppState,
  exp: Omit<Expense, 'id' | 'enteredBy'>,
  actor: ActorIdentity
): AppState {
  const newExpense: Expense = {
    ...exp,
    id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    enteredBy: actor.name,
  };
  const log = createAuditEntry({
    actor,
    category: 'Tài chính',
    action: 'Thêm khoản chi',
    detail: `${actor.name} đã thêm khoản chi '${newExpense.detail}' (${newExpense.category}) · ${formatCompactVND(newExpense.amount)} (${newExpense.paidBy})`,
  });
  return {
    ...state,
    expenses: [newExpense, ...state.expenses],
    auditLogs: [log, ...state.auditLogs],
  };
}

export type ExpenseUpdatePatch = Partial<
  Pick<
    Expense,
    'date' | 'category' | 'brandScope' | 'detail' | 'amount' | 'paidBy' | 'receiptNote' | 'status'
  >
>;

export function updateExpenseWithAudit(
  state: AppState,
  expenseId: string,
  patch: ExpenseUpdatePatch,
  actor: ActorIdentity
): AppState {
  const prev = state.expenses.find((e) => e.id === expenseId);
  if (!prev) return state;

  const updated: Expense = {
    ...prev,
    date: patch.date ?? prev.date,
    category: patch.category ?? prev.category,
    brandScope: patch.brandScope ?? prev.brandScope,
    detail: patch.detail !== undefined ? patch.detail.trim() || prev.detail : prev.detail,
    amount:
      patch.amount !== undefined && Number.isFinite(patch.amount)
        ? Math.max(0, Math.round(patch.amount))
        : prev.amount,
    paidBy: patch.paidBy !== undefined ? patch.paidBy.trim() || prev.paidBy : prev.paidBy,
    receiptNote: patch.receiptNote !== undefined ? patch.receiptNote.trim() : prev.receiptNote,
    status: patch.status ?? prev.status,
    updatedBy: actor.name,
    updatedAt: new Date().toISOString(),
  };

  const diffs: string[] = [];
  const oldParts: string[] = [];
  const newParts: string[] = [];

  if (prev.detail !== updated.detail) {
    diffs.push(`chi tiết từ '${prev.detail}' thành '${updated.detail}'`);
    oldParts.push(`Chi tiết: ${prev.detail}`);
    newParts.push(`Chi tiết: ${updated.detail}`);
  }
  if (prev.amount !== updated.amount) {
    diffs.push(`số tiền từ ${formatCompactVND(prev.amount)} thành ${formatCompactVND(updated.amount)}`);
    oldParts.push(formatCompactVND(prev.amount));
    newParts.push(formatCompactVND(updated.amount));
  }
  if (prev.category !== updated.category) {
    diffs.push(`hạng mục từ '${prev.category}' thành '${updated.category}'`);
    oldParts.push(prev.category);
    newParts.push(updated.category);
  }
  if (prev.brandScope !== updated.brandScope) {
    diffs.push(`nhánh từ '${prev.brandScope}' thành '${updated.brandScope}'`);
    oldParts.push(prev.brandScope);
    newParts.push(updated.brandScope);
  }
  if (prev.paidBy !== updated.paidBy) {
    diffs.push(`người ứng chi từ '${prev.paidBy}' thành '${updated.paidBy}'`);
    oldParts.push(prev.paidBy);
    newParts.push(updated.paidBy);
  }
  if (prev.status !== updated.status) {
    diffs.push(`tình trạng từ '${prev.status}' thành '${updated.status}'`);
    oldParts.push(prev.status);
    newParts.push(updated.status);
  }
  if (prev.date !== updated.date) {
    diffs.push(`ngày từ ${formatDateVN(prev.date)} thành ${formatDateVN(updated.date)}`);
  }
  if (prev.receiptNote !== updated.receiptNote) {
    diffs.push(`ghi chú từ '${prev.receiptNote || 'trống'}' thành '${updated.receiptNote || 'trống'}'`);
  }

  if (diffs.length === 0) return state;

  const nextOrders = updated.linkedOrderId
    ? state.orders.map((o) =>
        o.id === updated.linkedOrderId
          ? { ...o, shopShippingCost: updated.amount, shippingCostPayer: updated.paidBy }
          : o
      )
    : state.orders;

  const log = createAuditEntry({
    actor,
    category: 'Tài chính',
    action: 'Sửa khoản chi',
    detail: `${actor.name} đã sửa khoản chi '${prev.detail}': ${diffs.join('; ')}`,
    oldValue: oldParts.join(' · ') || undefined,
    newValue: newParts.join(' · ') || undefined,
  });

  return {
    ...state,
    expenses: state.expenses.map((e) => (e.id === expenseId ? updated : e)),
    orders: nextOrders,
    auditLogs: [log, ...state.auditLogs],
  };
}

export function toggleExpenseStatus(
  state: AppState,
  expenseId: string,
  actor: ActorIdentity = DEFAULT_ACTOR
): AppState {
  const prev = state.expenses.find((e) => e.id === expenseId);
  if (!prev) return state;

  const nextStatus =
    prev.status === ExpenseStatus.PENDING ? ExpenseStatus.COMPLETED : ExpenseStatus.PENDING;

  const log = createAuditEntry({
    actor,
    category: 'Tài chính',
    action: 'Đổi tình trạng chi',
    detail: `${actor.name} đã đổi tình trạng khoản chi '${prev.detail}' từ ${prev.status} thành ${nextStatus}`,
    oldValue: prev.status,
    newValue: nextStatus,
  });

  return {
    ...state,
    expenses: state.expenses.map((e) =>
      e.id === expenseId
        ? { ...e, status: nextStatus, updatedBy: actor.name, updatedAt: new Date().toISOString() }
        : e
    ),
    auditLogs: [log, ...state.auditLogs],
  };
}

export function deleteExpenseWithAudit(
  state: AppState,
  expenseId: string,
  actor: ActorIdentity
): { ok: true; state: AppState } | { ok: false; error: string } {
  if (actor.role !== 'Admin') {
    return {
      ok: false,
      error: 'Chỉ Admin (Ngân) mới có quyền xóa vĩnh viễn giao dịch tài chính.',
    };
  }
  const target = state.expenses.find((e) => e.id === expenseId);
  if (!target) {
    return { ok: false, error: 'Không tìm thấy khoản chi cần xóa.' };
  }

  const nextExpenses = state.expenses.filter((e) => e.id !== expenseId);
  const nextOrders = target.linkedOrderId
    ? state.orders.map((o) =>
        o.id === target.linkedOrderId ? { ...o, shopShippingCost: 0 } : o
      )
    : state.orders;

  const log = createAuditEntry({
    actor,
    category: 'Tài chính',
    action: 'Xóa vĩnh viễn khoản chi',
    detail: `${actor.name} đã xóa vĩnh viễn khoản chi '${target.detail}' (${formatCompactVND(target.amount)} · ${target.paidBy})`,
    oldValue: `${target.detail} (${formatCompactVND(target.amount)})`,
    newValue: 'Đã xóa',
  });

  return {
    ok: true,
    state: {
      ...state,
      expenses: nextExpenses,
      orders: nextOrders,
      auditLogs: [log, ...state.auditLogs],
    },
  };
}

export function addShareholderWithAudit(
  state: AppState,
  sh: Omit<Shareholder, 'id'>,
  actor: ActorIdentity
): AppState {
  const created: Shareholder = {
    ...sh,
    id: `sh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    updatedBy: actor.name,
  };
  const log = createAuditEntry({
    actor,
    category: 'Tài chính',
    action: 'Thêm vốn góp cổ đông',
    detail: `${actor.name} đã thêm cổ đông '${created.name}' với số vốn ${formatCompactVND(created.contribution)}`,
  });
  return {
    ...state,
    shareholders: [...state.shareholders, created],
    auditLogs: [log, ...state.auditLogs],
  };
}

export function updateShareholderWithAudit(
  state: AppState,
  shareholderId: string,
  patch: Partial<Pick<Shareholder, 'name' | 'contribution' | 'note'>>,
  actor: ActorIdentity
): AppState {
  const prev = state.shareholders.find((s) => s.id === shareholderId);
  if (!prev) return state;

  const updated: Shareholder = {
    ...prev,
    name: patch.name !== undefined ? patch.name.trim() || prev.name : prev.name,
    contribution:
      patch.contribution !== undefined && Number.isFinite(patch.contribution)
        ? Math.max(0, Math.round(patch.contribution))
        : prev.contribution,
    note: patch.note !== undefined ? patch.note.trim() : prev.note,
    updatedBy: actor.name,
  };

  const diffs: string[] = [];
  if (prev.name !== updated.name) {
    diffs.push(`tên từ '${prev.name}' thành '${updated.name}'`);
  }
  if (prev.contribution !== updated.contribution) {
    diffs.push(
      `vốn góp từ ${formatCompactVND(prev.contribution)} thành ${formatCompactVND(updated.contribution)}`
    );
  }
  if ((prev.note || '') !== (updated.note || '')) {
    diffs.push(`ghi chú từ '${prev.note || 'trống'}' thành '${updated.note || 'trống'}'`);
  }
  if (diffs.length === 0) return state;

  const log = createAuditEntry({
    actor,
    category: 'Tài chính',
    action: 'Sửa vốn góp cổ đông',
    detail: `${actor.name} đã sửa vốn góp cổ đông '${prev.name}': ${diffs.join('; ')}`,
    oldValue: formatCompactVND(prev.contribution),
    newValue: formatCompactVND(updated.contribution),
  });

  return {
    ...state,
    shareholders: state.shareholders.map((s) => (s.id === shareholderId ? updated : s)),
    auditLogs: [log, ...state.auditLogs],
  };
}

export function deleteShareholderWithAudit(
  state: AppState,
  shareholderId: string,
  actor: ActorIdentity
): { ok: true; state: AppState } | { ok: false; error: string } {
  if (actor.role !== 'Admin') {
    return {
      ok: false,
      error: 'Chỉ Admin (Ngân) mới có quyền xóa vĩnh viễn cổ đông góp vốn.',
    };
  }
  const target = state.shareholders.find((s) => s.id === shareholderId);
  if (!target) {
    return { ok: false, error: 'Không tìm thấy cổ đông cần xóa.' };
  }

  const log = createAuditEntry({
    actor,
    category: 'Tài chính',
    action: 'Xóa cổ đông góp vốn',
    detail: `${actor.name} đã xóa cổ đông '${target.name}' (Vốn góp: ${formatCompactVND(target.contribution)})`,
    oldValue: `${target.name} (${formatCompactVND(target.contribution)})`,
    newValue: 'Đã xóa',
  });

  return {
    ok: true,
    state: {
      ...state,
      shareholders: state.shareholders.filter((s) => s.id !== shareholderId),
      auditLogs: [log, ...state.auditLogs],
    },
  };
}

export function saveProductWithAudit(
  state: AppState,
  productInput: Omit<Product, 'id'> & { id?: string },
  actor: ActorIdentity
): AppState {
  if (productInput.id) {
    const prev = state.products.find((p) => p.id === productInput.id);
    if (!prev) return state;

    const updated: Product = {
      ...prev,
      ...productInput,
      id: prev.id,
    };

    const diffs: string[] = [];
    const oldVals: string[] = [];
    const newVals: string[] = [];

    if (prev.code !== updated.code) {
      diffs.push(`mã từ '${prev.code}' thành '${updated.code}'`);
    }
    if (prev.name !== updated.name) {
      diffs.push(`tên từ '${prev.name}' thành '${updated.name}'`);
    }
    if (prev.brand !== updated.brand) {
      diffs.push(`nhánh từ '${prev.brand}' thành '${updated.brand}'`);
    }
    if (prev.costPrice !== updated.costPrice) {
      diffs.push(
        `giá nhập từ ${formatCompactVND(prev.costPrice)} thành ${formatCompactVND(updated.costPrice)}`
      );
      oldVals.push(`Nhập ${formatCompactVND(prev.costPrice)}`);
      newVals.push(`Nhập ${formatCompactVND(updated.costPrice)}`);
    }
    if (prev.sellPrice !== updated.sellPrice) {
      diffs.push(
        `giá bán từ ${formatCompactVND(prev.sellPrice)} thành ${formatCompactVND(updated.sellPrice)}`
      );
      oldVals.push(`Bán ${formatCompactVND(prev.sellPrice)}`);
      newVals.push(`Bán ${formatCompactVND(updated.sellPrice)}`);
    }

    for (const s of ALL_SIZES) {
      const prevQty = prev.initialStock[s] ?? 0;
      const nextQty = updated.initialStock[s] ?? 0;
      if (prevQty !== nextQty) {
        diffs.push(`tồn đầu Size ${s} từ ${prevQty} thành ${nextQty}`);
        oldVals.push(`${s}:${prevQty}`);
        newVals.push(`${s}:${nextQty}`);
      }
    }

    if (diffs.length === 0) return state;

    const log = createAuditEntry({
      actor,
      category: 'Kho hàng',
      action: 'Sửa mẫu & tồn kho',
      detail: `${actor.name} đã sửa mẫu ${updated.code} (${updated.name}): ${diffs.join('; ')}`,
      oldValue: oldVals.join(' · ') || undefined,
      newValue: newVals.join(' · ') || undefined,
    });

    return {
      ...state,
      products: state.products.map((p) => (p.id === prev.id ? updated : p)),
      auditLogs: [log, ...state.auditLogs],
    };
  }

  const newProduct: Product = {
    ...productInput,
    id: `prd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  };
  const log = createAuditEntry({
    actor,
    category: 'Kho hàng',
    action: 'Thêm mẫu mới',
    detail: `${actor.name} đã thêm mẫu ${newProduct.code} · ${newProduct.name} (${newProduct.brand}, giá bán ${formatCompactVND(newProduct.sellPrice)})`,
  });

  return {
    ...state,
    products: [newProduct, ...state.products],
    auditLogs: [log, ...state.auditLogs],
  };
}

export function addStockImportWithAudit(
  state: AppState,
  imp: Omit<StockImport, 'id' | 'enteredBy'>,
  alsoRecordCashExpense: boolean,
  actor: ActorIdentity
): AppState {
  const newImport: StockImport = {
    ...imp,
    id: `imp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    enteredBy: actor.name,
  };
  const product = state.products.find((p) => p.id === imp.productId);
  const nextExpenses = [...state.expenses];

  if (alsoRecordCashExpense && product) {
    nextExpenses.unshift({
      id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      date: imp.date,
      category: 'Nhập hàng',
      brandScope: product.brand,
      detail: `Nhập kho ${product.code} (${imp.size}) × ${imp.quantity}`,
      amount: imp.quantity * imp.unitCost,
      paidBy: actor.name === 'Hoa' ? 'Hoa thanh toán' : `${actor.name} chi`,
      receiptNote: imp.note || 'Phiếu nhập kho',
      status: ExpenseStatus.COMPLETED,
      enteredBy: actor.name,
    });
  }

  const log = createAuditEntry({
    actor,
    category: 'Kho hàng',
    action: 'Nhập kho mới',
    detail: `${actor.name} đã nhập kho +${imp.quantity} ${
      product ? `${product.code} · ${product.name}` : imp.productId
    } (Size ${imp.size}) · Đơn giá ${formatCompactVND(imp.unitCost)}`,
  });

  return {
    ...state,
    stockImports: [newImport, ...state.stockImports],
    expenses: nextExpenses,
    auditLogs: [log, ...state.auditLogs],
  };
}

export function exportStateToJSON(state: AppState): string {
  return JSON.stringify(
    {
      version: 3,
      exportedAt: new Date().toISOString(),
      data: state,
    },
    null,
    2
  );
}

function normalizeImportedOrder(o: Partial<Order> & Record<string, unknown>): Order {
  return {
    id: String(o.id ?? ''),
    code: String(o.code ?? ''),
    date: String(o.date ?? ''),
    brand: o.brand as Brand,
    customerName: String(o.customerName ?? ''),
    customerPhone: String(o.customerPhone ?? ''),
    shippingAddress: String(o.shippingAddress ?? ''),
    shippingMethod: (o.shippingMethod as ShippingMethod) ?? ShippingMethod.VIETTEL_POST,
    shopShippingCost: Number(o.shopShippingCost) || 0,
    shippingCostPayer: String(o.shippingCostPayer ?? 'Ngân chi'),
    shippingStatus: (o.shippingStatus as ShippingStatus) ?? ShippingStatus.NOT_SENT,
    weightGrams: Number(o.weightGrams) > 0 ? Number(o.weightGrams) : 500,
    items: Array.isArray(o.items) ? (o.items as OrderItem[]) : [],
    shippingFee: Number(o.shippingFee) || 0,
    note: String(o.note ?? ''),
    paymentStatus: (o.paymentStatus as PaymentStatus) ?? PaymentStatus.UNPAID,
    isCancelled: Boolean(o.isCancelled),
    createdAt: String(o.createdAt ?? ''),
    createdBy: String(o.createdBy ?? 'Hệ thống'),
    paymentConfirmedBy: o.paymentConfirmedBy ? String(o.paymentConfirmedBy) : undefined,
    paymentConfirmedAt: o.paymentConfirmedAt ? String(o.paymentConfirmedAt) : undefined,
    cancelledBy: o.cancelledBy ? String(o.cancelledBy) : undefined,
    cancelledAt: o.cancelledAt ? String(o.cancelledAt) : undefined,
  };
}

function defaultFallbackAccounts(): UserAccount[] {
  const createdAt = '2026-11-01T08:00:00.000Z';
  return [
    { id: 'acc_ngan', name: 'Ngân', username: 'ngan', role: 'Admin', pin: '1234', createdAt },
    { id: 'acc_giang', name: 'Giang', username: 'giang', role: 'Thành viên', pin: '1234', createdAt },
    { id: 'acc_hoa', name: 'Hoa', username: 'hoa', role: 'Thành viên', pin: '1234', createdAt },
    { id: 'acc_phuong', name: 'Phương', username: 'phuong', role: 'Thành viên', pin: '1234', createdAt },
    { id: 'acc_linh', name: 'Linh', username: 'linh', role: 'Thành viên', pin: '1234', createdAt },
  ];
}

export function parseImportedJSON(
  raw: string
): { ok: true; state: AppState } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(raw);
    const candidate = parsed?.data ?? parsed;
    if (
      !candidate ||
      !Array.isArray(candidate.products) ||
      !Array.isArray(candidate.stockImports) ||
      !Array.isArray(candidate.orders) ||
      !Array.isArray(candidate.shareholders) ||
      !Array.isArray(candidate.expenses) ||
      !Array.isArray(candidate.budgetItems)
    ) {
      return {
        ok: false,
        error: 'Cấu trúc file JSON không hợp lệ. Thiếu các bảng dữ liệu chuẩn.',
      };
    }
    const accounts =
      Array.isArray(candidate.accounts) && candidate.accounts.length > 0
        ? (candidate.accounts as UserAccount[])
        : defaultFallbackAccounts();
    const auditLogs = Array.isArray(candidate.auditLogs)
      ? (candidate.auditLogs as AuditLogEntry[])
      : [];
    return {
      ok: true,
      state: {
        products: candidate.products,
        stockImports: candidate.stockImports,
        orders: candidate.orders.map(normalizeImportedOrder),
        shareholders: candidate.shareholders,
        expenses: candidate.expenses,
        budgetItems: candidate.budgetItems,
        accounts,
        auditLogs,
        isSampleData: Boolean(candidate.isSampleData),
      },
    };
  } catch {
    return { ok: false, error: 'Không thể đọc file JSON. Vui lòng kiểm tra định dạng.' };
  }
}

function escapeCSV(value: string | number): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportOrdersToCSV(orders: Order[]): string {
  const header = [
    'Mã đơn',
    'Ngày đặt',
    'Người tạo đơn',
    'Nhánh',
    'Khách hàng',
    'Số điện thoại',
    'Địa chỉ giao hàng',
    'Hình thức VC',
    'Trạng thái gửi hàng',
    'Cước shop trả (VND)',
    'Sản phẩm',
    'Phí ship khách trả',
    'Tổng thu (VND)',
    'Tiền thu hộ COD (VND)',
    'Thanh toán',
    'Xác nhận thanh toán bởi',
    'Tình trạng',
    'Ghi chú',
  ].join(',');

  const lines = orders.map((o) => {
    const itemsSummary = o.items
      .map((i) => `${i.productCode} ${i.productName} (${i.size}) x${i.quantity}`)
      .join(' | ');
    return [
      escapeCSV(o.code),
      escapeCSV(o.date),
      escapeCSV(o.createdBy || 'Hệ thống'),
      escapeCSV(o.brand),
      escapeCSV(o.customerName),
      escapeCSV(o.customerPhone),
      escapeCSV(o.shippingAddress),
      escapeCSV(o.shippingMethod),
      escapeCSV(o.shippingStatus),
      escapeCSV(o.shopShippingCost),
      escapeCSV(itemsSummary),
      escapeCSV(o.shippingFee),
      escapeCSV(getOrderTotal(o)),
      escapeCSV(getOrderCOD(o)),
      escapeCSV(o.paymentStatus),
      escapeCSV(o.paymentConfirmedBy || ''),
      escapeCSV(o.isCancelled ? 'Đã hủy' : 'Hoạt động'),
      escapeCSV(o.note),
    ].join(',');
  });

  // UTF-8 BOM for proper Vietnamese rendering in Excel
  return '\uFEFF' + [header, ...lines].join('\n');
}

export function formatShortVTPCodes(code: string): string {
  return code.replace(/[^A-Za-z0-9]/g, '');
}

export function exportViettelPostCSV(orders: Order[]): string {
  const header = [
    'Mã đơn hàng',
    'Tên người nhận',
    'Số điện thoại người nhận',
    'Địa chỉ nhận chi tiết',
    'Tên hàng hóa',
    'Trọng lượng (gram)',
    'Tiền thu hộ COD',
    'Dịch vụ vận chuyển',
    'Ghi chú giao hàng',
  ].join(',');

  const lines = orders.map((o) => {
    const goodsName = o.items
      .map((i) => `${i.quantity}x ${i.productName} (${i.size})`)
      .join(', ');
    const noteText = o.note
      ? `${o.note} - Cho xem hàng, không cho thử`
      : 'Cho xem hàng, không cho thử';

    return [
      escapeCSV(formatShortVTPCodes(o.code)),
      escapeCSV(o.customerName),
      escapeCSV(o.customerPhone),
      escapeCSV(o.shippingAddress),
      escapeCSV(goodsName),
      escapeCSV(o.weightGrams || 500),
      escapeCSV(getOrderCOD(o)),
      escapeCSV('VCN - Chuyển phát nhanh'),
      escapeCSV(noteText),
    ].join(',');
  });

  return '\uFEFF' + [header, ...lines].join('\n');
}

export function exportPnLToCSV(pnl: PnLSummary): string {
  const header = [
    'Nhánh thương hiệu',
    'Số đơn hoạt động',
    'Tổng giá nhập (VND)',
    'Tổng giá bán (VND)',
    'Chi phí vận hành (VND)',
    'Lợi nhuận (VND)',
  ].join(',');

  const lines = pnl.byBrand.map((row) =>
    [
      escapeCSV(row.brand),
      escapeCSV(row.activeOrderCount),
      escapeCSV(row.importCost),
      escapeCSV(row.salesRevenue),
      escapeCSV(row.operatingExpense),
      escapeCSV(row.profit),
    ].join(',')
  );

  lines.push(
    [
      escapeCSV('Tổng cộng'),
      escapeCSV(pnl.total.activeOrderCount),
      escapeCSV(pnl.total.importCost),
      escapeCSV(pnl.total.salesRevenue),
      escapeCSV(pnl.total.operatingExpense),
      escapeCSV(pnl.total.profit),
    ].join(',')
  );

  return '\uFEFF' + [header, ...lines].join('\n');
}

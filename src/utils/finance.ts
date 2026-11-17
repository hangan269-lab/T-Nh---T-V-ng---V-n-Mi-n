import {
  ALL_BRANDS,
  ALL_SIZES,
  AppState,
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
} from '../types/erp';

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
  draft: OrderDraftInput
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
    createdAt: new Date().toISOString(),
  };

  const nextExpenses = syncOrderShippingExpense(state.expenses, order);

  return {
    ok: true,
    order,
    state: {
      ...state,
      orders: [order, ...state.orders],
      expenses: nextExpenses,
    },
  };
}

export function confirmOrderPayment(state: AppState, orderId: string): AppState {
  return {
    ...state,
    orders: state.orders.map((o) =>
      o.id === orderId && !o.isCancelled ? { ...o, paymentStatus: PaymentStatus.PAID } : o
    ),
  };
}

export function cancelOrder(state: AppState, orderId: string): AppState {
  let updatedOrder: Order | null = null;
  const nextOrders = state.orders.map((o) => {
    if (o.id === orderId) {
      updatedOrder = { ...o, isCancelled: true };
      return updatedOrder;
    }
    return o;
  });

  const nextExpenses = updatedOrder
    ? syncOrderShippingExpense(state.expenses, updatedOrder)
    : state.expenses;

  return {
    ...state,
    orders: nextOrders,
    expenses: nextExpenses,
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
  patch: OrderShippingUpdate
): AppState {
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

  const nextExpenses = updatedOrder
    ? syncOrderShippingExpense(state.expenses, updatedOrder)
    : state.expenses;

  return {
    ...state,
    orders: nextOrders,
    expenses: nextExpenses,
  };
}

export function markOrdersShippingStatus(
  state: AppState,
  orderIds: string[],
  status: ShippingStatus
): AppState {
  const idSet = new Set(orderIds);
  return {
    ...state,
    orders: state.orders.map((o) =>
      idSet.has(o.id) && !o.isCancelled ? { ...o, shippingStatus: status } : o
    ),
  };
}

export function toggleExpenseStatus(state: AppState, expenseId: string): AppState {
  return {
    ...state,
    expenses: state.expenses.map((e) =>
      e.id === expenseId
        ? {
            ...e,
            status:
              e.status === ExpenseStatus.PENDING
                ? ExpenseStatus.COMPLETED
                : ExpenseStatus.PENDING,
          }
        : e
    ),
  };
}

export function exportStateToJSON(state: AppState): string {
  return JSON.stringify(
    {
      version: 2,
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
  };
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
    return {
      ok: true,
      state: {
        products: candidate.products,
        stockImports: candidate.stockImports,
        orders: candidate.orders.map(normalizeImportedOrder),
        shareholders: candidate.shareholders,
        expenses: candidate.expenses,
        budgetItems: candidate.budgetItems,
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

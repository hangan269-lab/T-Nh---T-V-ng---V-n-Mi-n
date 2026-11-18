import {
  ALL_BRANDS,
  ALL_SIZES,
  AppBackupSnapshot,
  AppNotification,
  AppState,
  AuditCategory,
  AuditLogEntry,
  Brand,
  BudgetItem,
  ChinaPartner,
  Expense,
  ExpenseStatus,
  NotificationType,
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

export function parseVNDInput(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed) return NaN;
  if (trimmed.startsWith('-')) return -1;
  const digits = trimmed.replace(/[^\d]/g, '');
  if (!digits) return NaN;
  return Number(digits);
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

export const MAX_NOTIFICATIONS_HISTORY = 120;

export function createAppNotification(input: {
  title: string;
  message: string;
  type: NotificationType;
  actor: Pick<ActorIdentity, 'id' | 'name'>;
  createdAt?: string;
}): AppNotification {
  return {
    id: `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: input.title,
    message: input.message,
    type: input.type,
    actorId: input.actor.id,
    actorName: input.actor.name,
    createdAt: input.createdAt ?? new Date().toISOString(),
    readBy: input.actor.id ? [input.actor.id] : [],
  };
}

export function appendNotificationToState(
  state: AppState,
  notification: AppNotification
): AppState {
  const current = Array.isArray(state.notifications) ? state.notifications : [];
  return {
    ...state,
    notifications: [notification, ...current].slice(0, MAX_NOTIFICATIONS_HISTORY),
  };
}

export function markNotificationReadInState(
  state: AppState,
  notificationId: string,
  userId: string
): AppState {
  if (!userId) return state;
  const current = Array.isArray(state.notifications) ? state.notifications : [];
  let changed = false;
  const next = current.map((n) => {
    if (n.id !== notificationId) return n;
    const readBy = Array.isArray(n.readBy) ? n.readBy : [];
    if (readBy.includes(userId)) return n;
    changed = true;
    return { ...n, readBy: [...readBy, userId] };
  });
  return changed ? { ...state, notifications: next } : state;
}

export function markAllNotificationsReadInState(state: AppState, userId: string): AppState {
  if (!userId) return state;
  const current = Array.isArray(state.notifications) ? state.notifications : [];
  let changed = false;
  const next = current.map((n) => {
    const readBy = Array.isArray(n.readBy) ? n.readBy : [];
    if (readBy.includes(userId)) return n;
    changed = true;
    return { ...n, readBy: [...readBy, userId] };
  });
  return changed ? { ...state, notifications: next } : state;
}

export const MAX_BACKUP_SNAPSHOTS = 25;

function cloneSnapshotList<T>(list: T[]): T[] {
  return JSON.parse(JSON.stringify(list)) as T[];
}

export function createPreDeleteBackupSnapshot(
  state: AppState,
  actor: ActorIdentity,
  meta: {
    category: AuditCategory;
    action: string;
    detail: string;
    createdAt?: string;
  }
): AppBackupSnapshot {
  const products = cloneSnapshotList(state.products);
  const stockImports = cloneSnapshotList(state.stockImports);
  const orders = cloneSnapshotList(state.orders);
  const shareholders = cloneSnapshotList(state.shareholders);
  const expenses = cloneSnapshotList(state.expenses);
  const budgetItems = cloneSnapshotList(state.budgetItems);
  const accounts = cloneSnapshotList(state.accounts);
  const chinaPartners = cloneSnapshotList(state.chinaPartners ?? []);

  return {
    id: `bak_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: meta.createdAt ?? new Date().toISOString(),
    actorId: actor.id,
    actorName: actor.name,
    category: meta.category,
    action: meta.action,
    detail: meta.detail,
    summary: {
      productsCount: products.length,
      stockImportsCount: stockImports.length,
      ordersCount: orders.length,
      shareholdersCount: shareholders.length,
      expensesCount: expenses.length,
      budgetItemsCount: budgetItems.length,
      accountsCount: accounts.length,
      chinaPartnersCount: chinaPartners.length,
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

export function prependBackupSnapshot(
  existingBackups: AppBackupSnapshot[] | undefined,
  snapshot: AppBackupSnapshot
): AppBackupSnapshot[] {
  const current = Array.isArray(existingBackups) ? existingBackups : [];
  return [snapshot, ...current].slice(0, MAX_BACKUP_SNAPSHOTS);
}

export function restoreFromBackupWithAudit(
  state: AppState,
  backupId: string,
  actor: ActorIdentity = DEFAULT_ACTOR
): { ok: true; state: AppState; backup: AppBackupSnapshot } | { ok: false; error: string } {
  const target = (state.backups ?? []).find((b) => b.id === backupId);
  if (!target) {
    return { ok: false, error: 'Không tìm thấy bản sao lưu cần khôi phục.' };
  }

  const safetyBackup = createPreDeleteBackupSnapshot(state, actor, {
    category: 'Hệ thống',
    action: 'Trước khi khôi phục bản sao lưu',
    detail: `${actor.name} đã tạo điểm sao lưu an toàn trước khi khôi phục bản lúc ${formatAuditTimestamp(target.createdAt)} (${target.action})`,
  });

  const restoredAccounts =
    actor.role === 'Admin' && target.snapshot.accounts.length > 0
      ? cloneSnapshotList(target.snapshot.accounts)
      : state.accounts;

  const log = createAuditEntry({
    actor,
    category: 'Hệ thống',
    action: 'Khôi phục bản sao lưu',
    detail: `${actor.name} đã khôi phục dữ liệu từ bản sao lưu "${target.action}" (${target.detail})`,
    oldValue: `${state.orders.length} đơn · ${state.products.length} mẫu`,
    newValue: `${target.summary.ordersCount} đơn · ${target.summary.productsCount} mẫu`,
  });

  return {
    ok: true,
    backup: target,
    state: {
      ...state,
      products: cloneSnapshotList(target.snapshot.products),
      stockImports: cloneSnapshotList(target.snapshot.stockImports),
      orders: cloneSnapshotList(target.snapshot.orders),
      shareholders: cloneSnapshotList(target.snapshot.shareholders),
      expenses: cloneSnapshotList(target.snapshot.expenses),
      budgetItems: cloneSnapshotList(target.snapshot.budgetItems),
      chinaPartners: cloneSnapshotList(target.snapshot.chinaPartners || []),
      accounts: restoredAccounts,
      auditLogs: [log, ...state.auditLogs],
      backups: prependBackupSnapshot(state.backups, safetyBackup),
      isSampleData: false,
    },
  };
}

export function resetSystemDataWithAudit(
  state: AppState,
  actor: ActorIdentity = DEFAULT_ACTOR
): { ok: true; state: AppState; backup: AppBackupSnapshot } | { ok: false; error: string } {
  if (actor.role !== 'Admin') {
    return { ok: false, error: 'Chỉ tài khoản Admin mới có quyền reset dữ liệu hệ thống.' };
  }

  const backup = createPreDeleteBackupSnapshot(state, actor, {
    category: 'Hệ thống',
    action: 'Trước khi Reset hệ thống về 0',
    detail: `${actor.name} đã reset dữ liệu toàn hệ thống về 0 (${state.orders.length} đơn, ${state.products.length} mẫu, ${state.expenses.length} chi phí)`,
  });

  const log = createAuditEntry({
    actor,
    category: 'Hệ thống',
    action: 'Reset dữ liệu về 0',
    detail: `${actor.name} đã reset dữ liệu hệ thống về 0 và tự động lưu bản sao lưu khôi phục`,
    oldValue: `${state.orders.length} đơn · ${state.products.length} mẫu`,
    newValue: '0 (Đã lưu bản sao lưu)',
  });

  return {
    ok: true,
    backup,
    state: {
      products: [],
      stockImports: [],
      orders: [],
      shareholders: [],
      expenses: [],
      budgetItems: [],
      chinaPartners: [],
      accounts: state.accounts,
      auditLogs: [log, ...state.auditLogs],
      backups: prependBackupSnapshot(state.backups, backup),
      notifications: state.notifications ?? [],
      isSampleData: false,
    },
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

export function updateUserAccountWithAudit(
  state: AppState,
  targetUserId: string,
  input: { name: string; username: string; role: UserRole; pin?: string },
  actor: ActorIdentity
): { ok: true; state: AppState } | { ok: false; error: string } {
  if (actor.role !== 'Admin') {
    return { ok: false, error: 'Chỉ Admin mới có quyền chỉnh sửa tài khoản thành viên.' };
  }
  const prev = state.accounts.find((a) => a.id === targetUserId);
  if (!prev) {
    return { ok: false, error: 'Không tìm thấy tài khoản cần sửa.' };
  }

  const name = input.name.trim();
  const username = input.username.trim().toLowerCase().replace(/\s+/g, '');
  const cleanPin = input.pin !== undefined ? input.pin.trim() : '';

  if (!name || !username) {
    return { ok: false, error: 'Vui lòng nhập đầy đủ Tên hiển thị và Tên đăng nhập.' };
  }
  if (cleanPin && cleanPin.length < 4) {
    return { ok: false, error: 'Mã PIN mới phải có ít nhất 4 ký tự.' };
  }
  const duplicate = state.accounts.some(
    (a) =>
      a.id !== targetUserId &&
      (a.username.toLowerCase() === username || a.name.toLowerCase() === name.toLowerCase())
  );
  if (duplicate) {
    return { ok: false, error: 'Tên đăng nhập hoặc tên thành viên đã tồn tại.' };
  }

  const adminCount = state.accounts.filter((a) => a.role === 'Admin').length;
  if (prev.role === 'Admin' && input.role !== 'Admin' && adminCount <= 1) {
    return { ok: false, error: 'Hệ thống phải giữ lại ít nhất 1 tài khoản Admin.' };
  }

  const updated: UserAccount = {
    ...prev,
    name,
    username,
    role: input.role,
    pin: cleanPin || prev.pin,
  };

  const diffs: string[] = [];
  if (prev.name !== updated.name) diffs.push(`tên '${prev.name}' → '${updated.name}'`);
  if (prev.username !== updated.username) diffs.push(`username '${prev.username}' → '${updated.username}'`);
  if (prev.role !== updated.role) diffs.push(`vai trò '${prev.role}' → '${updated.role}'`);
  if (cleanPin && cleanPin !== prev.pin) diffs.push('đổi mã PIN');

  if (diffs.length === 0) return { ok: true, state };

  const log = createAuditEntry({
    actor,
    category: 'Tài khoản',
    action: 'Sửa tài khoản thành viên',
    detail: `${actor.name} đã sửa tài khoản ${prev.name}: ${diffs.join('; ')}`,
    oldValue: `${prev.name} (${prev.username} · ${prev.role})`,
    newValue: `${updated.name} (${updated.username} · ${updated.role})`,
  });

  return {
    ok: true,
    state: {
      ...state,
      accounts: state.accounts.map((a) => (a.id === targetUserId ? updated : a)),
      auditLogs: [log, ...state.auditLogs],
    },
  };
}

export function deleteUserAccountWithAudit(
  state: AppState,
  targetUserId: string,
  actor: ActorIdentity
): { ok: true; state: AppState } | { ok: false; error: string } {
  if (actor.role !== 'Admin') {
    return { ok: false, error: 'Chỉ Admin mới có quyền xóa tài khoản thành viên.' };
  }
  if (targetUserId === actor.id) {
    return { ok: false, error: 'Không thể tự xóa tài khoản đang đăng nhập.' };
  }
  const target = state.accounts.find((a) => a.id === targetUserId);
  if (!target) {
    return { ok: false, error: 'Không tìm thấy tài khoản cần xóa.' };
  }
  const adminCount = state.accounts.filter((a) => a.role === 'Admin').length;
  if (target.role === 'Admin' && adminCount <= 1) {
    return { ok: false, error: 'Hệ thống phải giữ lại ít nhất 1 tài khoản Admin.' };
  }

  const backup = createPreDeleteBackupSnapshot(state, actor, {
    category: 'Tài khoản',
    action: 'Trước khi xóa tài khoản thành viên',
    detail: `Xóa tài khoản '${target.name}' (${target.username} · ${target.role})`,
  });

  const log = createAuditEntry({
    actor,
    category: 'Tài khoản',
    action: 'Xóa tài khoản thành viên',
    detail: `${actor.name} đã xóa tài khoản '${target.name}' (${target.username} · ${target.role})`,
    oldValue: `${target.name} (${target.username})`,
    newValue: 'Đã xóa',
  });

  return {
    ok: true,
    state: {
      ...state,
      accounts: state.accounts.filter((a) => a.id !== targetUserId),
      auditLogs: [log, ...state.auditLogs],
      backups: prependBackupSnapshot(state.backups, backup),
    },
  };
}

export function getOrderItemsSubtotal(order: Pick<Order, 'items'>): number {
  return order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

export function getOrderTotal(
  order: Pick<Order, 'items' | 'shippingFee' | 'discount'>
): number {
  return Math.max(
    0,
    getOrderItemsSubtotal(order) + (order.shippingFee || 0) - (order.discount || 0)
  );
}

export function getOrderCOD(
  order: Pick<Order, 'items' | 'shippingFee' | 'discount' | 'paymentStatus' | 'isCancelled'>
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
  adjustment: number;
  currentStock: number;
  isLowStock: boolean;
  isArchived: boolean;
}

export function suggestNextProductCode(brand: Brand, products: Product[]): string {
  const prefix =
    brand === Brand.TO_NHA ? 'TN' : brand === Brand.TO_VUONG ? 'TV' : 'VM';
  const regex = new RegExp(`^${prefix}[-_]?(\\d+)$`, 'i');
  let maxNum = 0;
  for (const p of products) {
    const match = p.code.trim().match(regex);
    if (match) {
      const n = Number(match[1]);
      if (Number.isFinite(n) && n > maxNum) {
        maxNum = n;
      }
    }
  }
  return `${prefix}-${String(maxNum + 1).padStart(2, '0')}`;
}

export function hasProductOrderHistory(
  productId: string,
  orders: Order[]
): { hasOrders: boolean; orderCount: number; activeOrderCount: number } {
  let orderCount = 0;
  let activeOrderCount = 0;
  for (const o of orders) {
    if (o.items.some((item) => item.productId === productId)) {
      orderCount += 1;
      if (!o.isCancelled) {
        activeOrderCount += 1;
      }
    }
  }
  return {
    hasOrders: orderCount > 0,
    orderCount,
    activeOrderCount,
  };
}

export function getProductActiveSizes(
  product: Product,
  stockImports: StockImport[],
  orders: Order[]
): SizeOption[] {
  const sizeSet = new Set<SizeOption>();

  for (const size of ALL_SIZES) {
    if (
      product.initialStock[size] !== undefined ||
      product.stockAdjustments?.[size] !== undefined
    ) {
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
      const adjustment = product.stockAdjustments?.[size] ?? 0;
      const totalImported = stockImports
        .filter((imp) => imp.productId === product.id && imp.size === size)
        .reduce((sum, imp) => sum + imp.quantity, 0);
      const totalSold = orders
        .filter((o) => !o.isCancelled)
        .flatMap((o) => o.items)
        .filter((item) => item.productId === product.id && item.size === size)
        .reduce((sum, item) => sum + item.quantity, 0);
      const currentStock = initialStock + adjustment + totalImported - totalSold;

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
        adjustment,
        currentStock,
        isLowStock: currentStock <= 1,
        isArchived: Boolean(product.isArchived),
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
  const adjustment = product.stockAdjustments?.[size] ?? 0;
  const totalImported = stockImports
    .filter((imp) => imp.productId === productId && imp.size === size)
    .reduce((sum, imp) => sum + imp.quantity, 0);
  const totalSold = orders
    .filter((o) => !o.isCancelled)
    .flatMap((o) => o.items)
    .filter((item) => item.productId === productId && item.size === size)
    .reduce((sum, item) => sum + item.quantity, 0);

  return initialStock + adjustment + totalImported - totalSold;
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
  discount?: number;
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
  const rawDiscount = draft.discount ?? 0;
  if (!Number.isFinite(rawDiscount) || rawDiscount < 0) {
    return { ok: false, error: 'Số tiền giảm giá không hợp lệ.' };
  }
  const discount = Math.round(rawDiscount);

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
    if (product.isArchived) {
      return {
        ok: false,
        error: `Mẫu "${product.code} - ${product.name}" đã ngừng kinh doanh, không thể tạo đơn mới.`,
      };
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

  const itemsSubtotal = resolvedItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const grossTotal = itemsSubtotal + Math.round(draft.shippingFee || 0);
  if (discount > grossTotal) {
    return {
      ok: false,
      error: 'Số tiền giảm giá không được lớn hơn tổng tiền hàng và phí ship.',
    };
  }

  const nowISO = new Date().toISOString();
  let maxOrderNum = 0;
  for (const o of state.orders) {
    const match = o.code.match(/^DH-(\d+)$/i);
    if (match) {
      const n = Number(match[1]);
      if (Number.isFinite(n) && n > maxOrderNum) maxOrderNum = n;
    }
  }
  const nextSeq = Math.max(state.orders.length + 1, maxOrderNum + 1);
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
    ...(discount > 0 ? { discount } : {}),
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

export function updateOrderWithValidation(
  state: AppState,
  orderId: string,
  draft: OrderDraftInput,
  actor: ActorIdentity = DEFAULT_ACTOR
): OrderCreateResult {
  const prevOrder = state.orders.find((o) => o.id === orderId);
  if (!prevOrder) {
    return { ok: false, error: 'Không tìm thấy đơn hàng cần chỉnh sửa.' };
  }

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
      error: 'Vui lòng nhập địa chỉ giao hàng chi tiết.',
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
  const rawDiscount = draft.discount ?? 0;
  if (!Number.isFinite(rawDiscount) || rawDiscount < 0) {
    return { ok: false, error: 'Số tiền giảm giá không hợp lệ.' };
  }
  const discount = Math.round(rawDiscount);

  const weightGrams = draft.weightGrams ?? 500;
  if (!Number.isFinite(weightGrams) || weightGrams <= 0) {
    return { ok: false, error: 'Trọng lượng đơn hàng (gram) phải lớn hơn 0.' };
  }

  const prevProductIds = new Set(prevOrder.items.map((i) => i.productId));
  const requestedBySku = new Map<string, { product: Product; size: SizeOption; qty: number }>();
  const resolvedItems: OrderItem[] = [];

  for (const rawItem of draft.items) {
    if (!rawItem.productId) {
      return { ok: false, error: 'Vui lòng chọn mẫu sản phẩm cho tất cả các dòng.' };
    }
    const product = state.products.find((p) => p.id === rawItem.productId);
    if (!product) {
      const legacyItem = prevOrder.items.find((i) => i.productId === rawItem.productId);
      if (!legacyItem) {
        return { ok: false, error: 'Không tìm thấy mẫu sản phẩm đã chọn.' };
      }
      if (!Number.isFinite(rawItem.quantity) || rawItem.quantity <= 0) {
        return { ok: false, error: `Số lượng của "${legacyItem.productName}" phải lớn hơn 0.` };
      }
      resolvedItems.push({
        ...legacyItem,
        size: rawItem.size,
        quantity: rawItem.quantity,
        unitPrice:
          rawItem.unitPrice !== undefined && Number.isFinite(rawItem.unitPrice)
            ? rawItem.unitPrice
            : legacyItem.unitPrice,
      });
      continue;
    }

    if (product.isArchived && !prevProductIds.has(product.id)) {
      return {
        ok: false,
        error: `Mẫu "${product.code} - ${product.name}" đã ngừng kinh doanh, không thể thêm vào đơn.`,
      };
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

  // Validate stock excluding prevOrder's own items (restores old quantities first, then deducts new)
  if (!prevOrder.isCancelled) {
    const ordersWithoutPrev = state.orders.filter((o) => o.id !== orderId);
    for (const { product, size, qty } of requestedBySku.values()) {
      const available = getAvailableStock(
        product.id,
        size,
        state.products,
        state.stockImports,
        ordersWithoutPrev
      );
      if (qty > available) {
        return {
          ok: false,
          error: `Tồn kho không đủ cho "${product.code} - ${product.name}" (Size ${size}): còn ${available} (đã hoàn phần đơn cũ), đang đặt ${qty}.`,
        };
      }
    }
  }

  const itemsSubtotal = resolvedItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const grossTotal = itemsSubtotal + Math.round(draft.shippingFee || 0);
  if (discount > grossTotal) {
    return {
      ok: false,
      error: 'Số tiền giảm giá không được lớn hơn tổng tiền hàng và phí ship.',
    };
  }

  const nowISO = new Date().toISOString();
  const isNowPaid = draft.paymentStatus === PaymentStatus.PAID;
  const updatedOrder: Order = {
    ...prevOrder,
    date: draft.date,
    brand: draft.brand,
    customerName,
    customerPhone,
    shippingAddress,
    shippingMethod: draft.shippingMethod,
    shopShippingCost: Math.round(draft.shopShippingCost || 0),
    shippingCostPayer: draft.shippingCostPayer?.trim() || prevOrder.shippingCostPayer || 'Ngân chi',
    shippingStatus: draft.shippingStatus ?? prevOrder.shippingStatus,
    weightGrams: Math.round(weightGrams),
    items: resolvedItems,
    shippingFee: Math.round(draft.shippingFee || 0),
    discount: discount > 0 ? discount : prevOrder.discount ? 0 : undefined,
    note: draft.note.trim(),
    paymentStatus: draft.paymentStatus,
    paymentConfirmedBy: isNowPaid
      ? prevOrder.paymentConfirmedBy ?? actor.name
      : undefined,
    paymentConfirmedAt: isNowPaid
      ? prevOrder.paymentConfirmedAt ?? nowISO
      : undefined,
  };

  const nextExpenses = syncOrderShippingExpense(state.expenses, updatedOrder);
  const prevTotal = getOrderTotal(prevOrder);
  const nextTotal = getOrderTotal(updatedOrder);

  const log = createAuditEntry({
    actor,
    category: 'Đơn hàng',
    action: 'Sửa đơn hàng',
    detail: `${actor.name} đã chỉnh sửa đơn hàng #${updatedOrder.code} (Khách: ${updatedOrder.customerName} · Tổng: ${formatCompactVND(nextTotal)})`,
    oldValue: `${prevOrder.customerName} · ${formatCompactVND(prevTotal)}`,
    newValue: `${updatedOrder.customerName} · ${formatCompactVND(nextTotal)}`,
    timestamp: nowISO,
  });

  return {
    ok: true,
    order: updatedOrder,
    state: {
      ...state,
      orders: state.orders.map((o) => (o.id === orderId ? updatedOrder : o)),
      expenses: nextExpenses,
      auditLogs: [log, ...state.auditLogs],
    },
  };
}

export function deleteOrderWithAudit(
  state: AppState,
  orderId: string,
  actor: ActorIdentity = DEFAULT_ACTOR
): AppState {
  const target = state.orders.find((o) => o.id === orderId);
  if (!target) return state;

  const totalAmount = getOrderTotal(target);
  const backup = createPreDeleteBackupSnapshot(state, actor, {
    category: 'Đơn hàng',
    action: `Trước khi xóa đơn #${target.code}`,
    detail: `Xóa đơn hàng #${target.code} của khách ${target.customerName} (${formatCompactVND(totalAmount)})`,
  });

  const nextOrders = state.orders.filter((o) => o.id !== orderId);
  const nextExpenses = state.expenses.filter((e) => e.linkedOrderId !== orderId);

  const log = createAuditEntry({
    actor,
    category: 'Đơn hàng',
    action: 'Xóa đơn hàng',
    detail: `${actor.name} đã xóa đơn hàng #${target.code} của khách ${target.customerName} (${formatCompactVND(totalAmount)}), hoàn lại tồn kho và xóa cước VC liên kết`,
    oldValue: `#${target.code} · ${target.customerName} (${formatCompactVND(totalAmount)})`,
    newValue: 'Đã xóa',
  });

  return {
    ...state,
    orders: nextOrders,
    expenses: nextExpenses,
    auditLogs: [log, ...state.auditLogs],
    backups: prependBackupSnapshot(state.backups, backup),
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

  const backup = createPreDeleteBackupSnapshot(state, actor, {
    category: 'Tài chính',
    action: 'Trước khi xóa khoản chi',
    detail: `Xóa khoản chi '${target.detail}' (${formatCompactVND(target.amount)} · ${target.paidBy})`,
  });

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
      backups: prependBackupSnapshot(state.backups, backup),
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

  const backup = createPreDeleteBackupSnapshot(state, actor, {
    category: 'Tài chính',
    action: 'Trước khi xóa cổ đông góp vốn',
    detail: `Xóa cổ đông '${target.name}' (Vốn góp: ${formatCompactVND(target.contribution)})`,
  });

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
      backups: prependBackupSnapshot(state.backups, backup),
    },
  };
}

export interface SaveProductInput {
  id?: string;
  code: string;
  name: string;
  brand: Brand;
  costPrice: number;
  sellPrice: number;
  initialStock: Partial<Record<SizeOption, number>>;
  targetCurrentStock?: Partial<Record<SizeOption, number>>;
  adjustmentReason?: string;
}

export type SaveProductResult =
  | { ok: true; state: AppState; product: Product; hasStockAdjustment: boolean }
  | { ok: false; error: string };

export function saveProductWithValidation(
  state: AppState,
  productInput: SaveProductInput,
  actor: ActorIdentity = DEFAULT_ACTOR
): SaveProductResult {
  const code = productInput.code.trim();
  const name = productInput.name.trim();
  const costPrice = Math.round(Number(productInput.costPrice));
  const sellPrice = Math.round(Number(productInput.sellPrice));

  if (!code || !name) {
    return { ok: false, error: 'Vui lòng nhập đầy đủ Mã mẫu và Tên mẫu sản phẩm.' };
  }
  if (!Number.isFinite(costPrice) || costPrice < 0 || !Number.isFinite(sellPrice) || sellPrice < 0) {
    return { ok: false, error: 'Giá nhập và Giá bán niêm yết phải là số hợp lệ không âm.' };
  }

  const duplicateCode = state.products.some(
    (p) => p.id !== productInput.id && p.code.trim().toLowerCase() === code.toLowerCase()
  );
  if (duplicateCode) {
    return { ok: false, error: `Mã mẫu "${code}" đã tồn tại trong danh mục.` };
  }

  if (productInput.id) {
    const prev = state.products.find((p) => p.id === productInput.id);
    if (!prev) {
      return { ok: false, error: 'Không tìm thấy mẫu sản phẩm cần chỉnh sửa.' };
    }

    const nextAdjustments: Partial<Record<SizeOption, number>> = {
      ...(prev.stockAdjustments ?? {}),
    };
    const nextInitialStock: Partial<Record<SizeOption, number>> = productInput.targetCurrentStock
      ? { ...prev.initialStock }
      : { ...productInput.initialStock };

    const infoDiffs: string[] = [];
    const oldInfoVals: string[] = [];
    const newInfoVals: string[] = [];

    if (prev.code !== code) {
      infoDiffs.push(`mã từ '${prev.code}' thành '${code}'`);
      oldInfoVals.push(prev.code);
      newInfoVals.push(code);
    }
    if (prev.name !== name) {
      infoDiffs.push(`tên từ '${prev.name}' thành '${name}'`);
      oldInfoVals.push(prev.name);
      newInfoVals.push(name);
    }
    if (prev.brand !== productInput.brand) {
      infoDiffs.push(`nhánh từ '${prev.brand}' thành '${productInput.brand}'`);
      oldInfoVals.push(prev.brand);
      newInfoVals.push(productInput.brand);
    }
    if (prev.costPrice !== costPrice) {
      infoDiffs.push(
        `giá nhập từ ${formatCompactVND(prev.costPrice)} thành ${formatCompactVND(costPrice)}`
      );
      oldInfoVals.push(`Nhập ${formatCompactVND(prev.costPrice)}`);
      newInfoVals.push(`Nhập ${formatCompactVND(costPrice)}`);
    }
    if (prev.sellPrice !== sellPrice) {
      infoDiffs.push(
        `giá bán từ ${formatCompactVND(prev.sellPrice)} thành ${formatCompactVND(sellPrice)}`
      );
      oldInfoVals.push(`Bán ${formatCompactVND(prev.sellPrice)}`);
      newInfoVals.push(`Bán ${formatCompactVND(sellPrice)}`);
    }

    const stockDiffs: string[] = [];
    const oldStockVals: string[] = [];
    const newStockVals: string[] = [];

    if (productInput.targetCurrentStock) {
      for (const s of ALL_SIZES) {
        const targetRaw = productInput.targetCurrentStock[s];
        if (targetRaw === undefined) continue;
        const targetQty = Math.round(Number(targetRaw));
        if (!Number.isFinite(targetQty) || targetQty < 0) {
          return { ok: false, error: `Số lượng tồn kho Size ${s} không được nhỏ hơn 0.` };
        }
        const beforeQty = getAvailableStock(
          prev.id,
          s,
          state.products,
          state.stockImports,
          state.orders
        );
        if (targetQty !== beforeQty) {
          const delta = targetQty - beforeQty;
          nextAdjustments[s] = (prev.stockAdjustments?.[s] ?? 0) + delta;
          if (prev.initialStock[s] === undefined) {
            nextInitialStock[s] = 0;
          }
          const deltaLabel = delta > 0 ? `+${delta}` : String(delta);
          stockDiffs.push(`Size ${s}: ${beforeQty} → ${targetQty} (${deltaLabel})`);
          oldStockVals.push(`${s}: ${beforeQty}`);
          newStockVals.push(`${s}: ${targetQty}`);
        }
      }
    } else {
      for (const s of ALL_SIZES) {
        const prevQty = prev.initialStock[s] ?? 0;
        const nextQty = nextInitialStock[s] ?? 0;
        if (prevQty !== nextQty) {
          stockDiffs.push(`tồn đầu Size ${s} từ ${prevQty} thành ${nextQty}`);
          oldStockVals.push(`${s}:${prevQty}`);
          newStockVals.push(`${s}:${nextQty}`);
        }
      }
    }

    const updated: Product = {
      ...prev,
      code,
      name,
      brand: productInput.brand,
      costPrice,
      sellPrice,
      initialStock: nextInitialStock,
      stockAdjustments: nextAdjustments,
    };

    if (infoDiffs.length === 0 && stockDiffs.length === 0) {
      return { ok: true, state, product: prev, hasStockAdjustment: false };
    }

    const newLogs: AuditLogEntry[] = [];
    if (infoDiffs.length > 0) {
      newLogs.push(
        createAuditEntry({
          actor,
          category: 'Kho hàng',
          action: 'Sửa mẫu sản phẩm',
          detail: `${actor.name} đã sửa mẫu ${updated.code} (${updated.name}): ${infoDiffs.join('; ')}`,
          oldValue: oldInfoVals.join(' · ') || undefined,
          newValue: newInfoVals.join(' · ') || undefined,
        })
      );
    }

    if (stockDiffs.length > 0) {
      const reasonSuffix = productInput.adjustmentReason?.trim()
        ? ` · Lý do: ${productInput.adjustmentReason.trim()}`
        : '';
      newLogs.unshift(
        createAuditEntry({
          actor,
          category: 'Kho hàng',
          action: 'Điều chỉnh tồn kho',
          detail: `${actor.name} đã điều chỉnh tồn kho ${updated.code} (${updated.name}): ${stockDiffs.join(', ')}${reasonSuffix}`,
          oldValue: oldStockVals.join(' · ') || undefined,
          newValue: newStockVals.join(' · ') || undefined,
        })
      );
    }

    return {
      ok: true,
      product: updated,
      hasStockAdjustment: stockDiffs.length > 0,
      state: {
        ...state,
        products: state.products.map((p) => (p.id === prev.id ? updated : p)),
        auditLogs: [...newLogs, ...state.auditLogs],
      },
    };
  }

  const normalizedInitialStock: Partial<Record<SizeOption, number>> = {};
  const stockSummaryParts: string[] = [];
  for (const s of ALL_SIZES) {
    if (productInput.initialStock[s] !== undefined) {
      const qty = Math.max(0, Math.round(Number(productInput.initialStock[s]) || 0));
      normalizedInitialStock[s] = qty;
      stockSummaryParts.push(`${s}:${qty}`);
    }
  }

  const newProduct: Product = {
    id: `prd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    code,
    name,
    brand: productInput.brand,
    costPrice,
    sellPrice,
    initialStock: normalizedInitialStock,
    isArchived: false,
  };

  const stockNote =
    stockSummaryParts.length > 0 ? ` · Tồn đầu: ${stockSummaryParts.join(', ')}` : '';
  const log = createAuditEntry({
    actor,
    category: 'Kho hàng',
    action: 'Thêm mẫu mới',
    detail: `${actor.name} đã thêm mẫu ${newProduct.code} · ${newProduct.name} (${newProduct.brand}, nhập ${formatCompactVND(newProduct.costPrice)}, bán ${formatCompactVND(newProduct.sellPrice)}${stockNote})`,
  });

  return {
    ok: true,
    product: newProduct,
    hasStockAdjustment: false,
    state: {
      ...state,
      products: [newProduct, ...state.products],
      auditLogs: [log, ...state.auditLogs],
    },
  };
}

export function saveProductWithAudit(
  state: AppState,
  productInput: SaveProductInput,
  actor: ActorIdentity
): AppState {
  const res = saveProductWithValidation(state, productInput, actor);
  return res.ok ? res.state : state;
}

export function archiveProductWithAudit(
  state: AppState,
  productId: string,
  archive: boolean,
  actor: ActorIdentity
): { ok: true; state: AppState } | { ok: false; error: string } {
  if (actor.role !== 'Admin') {
    return {
      ok: false,
      error: 'Chỉ tài khoản Admin (Ngân) mới có quyền ngừng kinh doanh hoặc mở bán lại mẫu sản phẩm.',
    };
  }
  const target = state.products.find((p) => p.id === productId);
  if (!target) {
    return { ok: false, error: 'Không tìm thấy mẫu sản phẩm.' };
  }
  if (Boolean(target.isArchived) === archive) {
    return { ok: true, state };
  }

  const log = createAuditEntry({
    actor,
    category: 'Kho hàng',
    action: archive ? 'Ngừng kinh doanh mẫu' : 'Mở bán lại mẫu',
    detail: archive
      ? `${actor.name} đã chuyển mẫu ${target.code} (${target.name}) sang Ngừng kinh doanh (ẩn khỏi đơn mới, giữ số liệu báo cáo cũ)`
      : `${actor.name} đã mở bán lại mẫu ${target.code} (${target.name})`,
    oldValue: archive ? 'Đang kinh doanh' : 'Ngừng kinh doanh',
    newValue: archive ? 'Ngừng kinh doanh' : 'Đang kinh doanh',
  });

  return {
    ok: true,
    state: {
      ...state,
      products: state.products.map((p) =>
        p.id === productId ? { ...p, isArchived: archive } : p
      ),
      auditLogs: [log, ...state.auditLogs],
    },
  };
}

export function deleteProductWithAudit(
  state: AppState,
  productId: string,
  actor: ActorIdentity
): { ok: true; state: AppState } | { ok: false; error: string } {
  if (actor.role !== 'Admin') {
    return {
      ok: false,
      error: 'Chỉ tài khoản Admin (Ngân) mới có quyền xóa mẫu sản phẩm khỏi danh mục.',
    };
  }
  const target = state.products.find((p) => p.id === productId);
  if (!target) {
    return { ok: false, error: 'Không tìm thấy mẫu sản phẩm cần xóa.' };
  }

  const history = hasProductOrderHistory(productId, state.orders);
  const historyNote = history.hasOrders
    ? ` (đã bảo toàn dữ liệu trên ${history.orderCount} đơn hàng cũ)`
    : '';

  const backup = createPreDeleteBackupSnapshot(state, actor, {
    category: 'Kho hàng',
    action: `Trước khi xóa mẫu ${target.code}`,
    detail: `Xóa mẫu ${target.code} (${target.name})${historyNote}`,
  });

  const log = createAuditEntry({
    actor,
    category: 'Kho hàng',
    action: 'Xóa mẫu sản phẩm',
    detail: `${actor.name} đã xóa hoàn toàn mẫu ${target.code} (${target.name}) khỏi danh mục kho hàng${historyNote}`,
    oldValue: `${target.code} · ${target.name}`,
    newValue: 'Đã xóa hoàn toàn',
  });

  return {
    ok: true,
    state: {
      ...state,
      products: state.products.filter((p) => p.id !== productId),
      auditLogs: [log, ...state.auditLogs],
      backups: prependBackupSnapshot(state.backups, backup),
    },
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
      linkedImportId: newImport.id,
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

export function updateStockImportWithValidation(
  state: AppState,
  importId: string,
  patch: Omit<StockImport, 'id' | 'enteredBy'>,
  actor: ActorIdentity = DEFAULT_ACTOR
): { ok: true; state: AppState } | { ok: false; error: string } {
  const prev = state.stockImports.find((i) => i.id === importId);
  if (!prev) {
    return { ok: false, error: 'Không tìm thấy phiếu nhập kho cần sửa.' };
  }
  const qty = Math.round(Number(patch.quantity));
  const unitCost = Math.round(Number(patch.unitCost));
  if (!patch.date || !patch.productId) {
    return { ok: false, error: 'Vui lòng chọn đầy đủ ngày nhập và mẫu sản phẩm.' };
  }
  if (!Number.isFinite(qty) || qty <= 0) {
    return { ok: false, error: 'Số lượng nhập phải lớn hơn 0.' };
  }
  if (!Number.isFinite(unitCost) || unitCost < 0) {
    return { ok: false, error: 'Đơn giá nhập không hợp lệ.' };
  }

  const updated: StockImport = {
    ...prev,
    date: patch.date,
    productId: patch.productId,
    size: patch.size,
    quantity: qty,
    unitCost,
    note: patch.note?.trim() ?? '',
  };

  const nextStockImports = state.stockImports.map((i) => (i.id === importId ? updated : i));
  const product = state.products.find((p) => p.id === updated.productId);
  const nextExpenses = state.expenses.map((e) =>
    e.linkedImportId === importId && product
      ? {
          ...e,
          date: updated.date,
          brandScope: product.brand,
          detail: `Nhập kho ${product.code} (${updated.size}) × ${updated.quantity}`,
          amount: updated.quantity * updated.unitCost,
          receiptNote: updated.note || 'Phiếu nhập kho',
          updatedBy: actor.name,
          updatedAt: new Date().toISOString(),
        }
      : e
  );

  const log = createAuditEntry({
    actor,
    category: 'Kho hàng',
    action: 'Sửa phiếu nhập kho',
    detail: `${actor.name} đã sửa phiếu nhập ${
      product ? `${product.code} (${updated.size})` : updated.productId
    }: SL ${prev.quantity} → ${updated.quantity}, giá ${formatCompactVND(prev.unitCost)} → ${formatCompactVND(updated.unitCost)}`,
    oldValue: `SL ${prev.quantity} · ${formatCompactVND(prev.unitCost)}`,
    newValue: `SL ${updated.quantity} · ${formatCompactVND(updated.unitCost)}`,
  });

  return {
    ok: true,
    state: {
      ...state,
      stockImports: nextStockImports,
      expenses: nextExpenses,
      auditLogs: [log, ...state.auditLogs],
    },
  };
}

export function deleteStockImportWithAudit(
  state: AppState,
  importId: string,
  actor: ActorIdentity = DEFAULT_ACTOR
): AppState {
  const target = state.stockImports.find((i) => i.id === importId);
  if (!target) return state;

  const product = state.products.find((p) => p.id === target.productId);
  const backup = createPreDeleteBackupSnapshot(state, actor, {
    category: 'Kho hàng',
    action: 'Trước khi xóa phiếu nhập kho',
    detail: `Xóa phiếu nhập +${target.quantity} ${
      product ? `${product.code} · ${product.name}` : target.productId
    } (${target.size})`,
  });

  const nextImports = state.stockImports.filter((i) => i.id !== importId);
  const nextExpenses = state.expenses.filter((e) => e.linkedImportId !== importId);

  const log = createAuditEntry({
    actor,
    category: 'Kho hàng',
    action: 'Xóa phiếu nhập kho',
    detail: `${actor.name} đã xóa phiếu nhập +${target.quantity} ${
      product ? `${product.code} · ${product.name}` : target.productId
    } (Size ${target.size}, thành tiền ${formatCompactVND(target.quantity * target.unitCost)})`,
    oldValue: `${product?.code ?? target.productId} (${target.size}) × ${target.quantity}`,
    newValue: 'Đã xóa',
  });

  return {
    ...state,
    stockImports: nextImports,
    expenses: nextExpenses,
    auditLogs: [log, ...state.auditLogs],
    backups: prependBackupSnapshot(state.backups, backup),
  };
}

export function addBudgetItemWithAudit(
  state: AppState,
  item: Omit<BudgetItem, 'id'>,
  actor: ActorIdentity = DEFAULT_ACTOR
): AppState {
  const created: BudgetItem = {
    ...item,
    id: `bdg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  };
  const log = createAuditEntry({
    actor,
    category: 'Tài chính',
    action: 'Thêm dự trù ngân sách',
    detail: `${actor.name} đã thêm dự trù '${created.detail}' (${created.quantity} × ${formatCompactVND(created.estimatedUnitPrice)})`,
  });
  return {
    ...state,
    budgetItems: [...state.budgetItems, created],
    auditLogs: [log, ...state.auditLogs],
  };
}

export function updateBudgetItemWithAudit(
  state: AppState,
  budgetId: string,
  patch: Omit<BudgetItem, 'id'>,
  actor: ActorIdentity = DEFAULT_ACTOR
): AppState {
  const prev = state.budgetItems.find((b) => b.id === budgetId);
  if (!prev) return state;

  const updated: BudgetItem = {
    id: prev.id,
    category: patch.category,
    detail: patch.detail.trim() || prev.detail,
    quantity: Math.max(1, Math.round(Number(patch.quantity) || 1)),
    estimatedUnitPrice: Math.max(0, Math.round(Number(patch.estimatedUnitPrice) || 0)),
  };

  const log = createAuditEntry({
    actor,
    category: 'Tài chính',
    action: 'Sửa dự trù ngân sách',
    detail: `${actor.name} đã sửa dự trù '${updated.detail}': ${formatCompactVND(prev.quantity * prev.estimatedUnitPrice)} → ${formatCompactVND(updated.quantity * updated.estimatedUnitPrice)}`,
    oldValue: formatCompactVND(prev.quantity * prev.estimatedUnitPrice),
    newValue: formatCompactVND(updated.quantity * updated.estimatedUnitPrice),
  });

  return {
    ...state,
    budgetItems: state.budgetItems.map((b) => (b.id === budgetId ? updated : b)),
    auditLogs: [log, ...state.auditLogs],
  };
}

export function deleteBudgetItemWithAudit(
  state: AppState,
  budgetId: string,
  actor: ActorIdentity = DEFAULT_ACTOR
): AppState {
  const target = state.budgetItems.find((b) => b.id === budgetId);
  if (!target) return state;

  const backup = createPreDeleteBackupSnapshot(state, actor, {
    category: 'Tài chính',
    action: 'Trước khi xóa dự trù ngân sách',
    detail: `Xóa dòng dự trù '${target.detail}' (${formatCompactVND(target.quantity * target.estimatedUnitPrice)})`,
  });

  const log = createAuditEntry({
    actor,
    category: 'Tài chính',
    action: 'Xóa dự trù ngân sách',
    detail: `${actor.name} đã xóa dòng dự trù '${target.detail}' (${formatCompactVND(target.quantity * target.estimatedUnitPrice)})`,
    oldValue: target.detail,
    newValue: 'Đã xóa',
  });

  return {
    ...state,
    budgetItems: state.budgetItems.filter((b) => b.id !== budgetId),
    auditLogs: [log, ...state.auditLogs],
    backups: prependBackupSnapshot(state.backups, backup),
  };
}

export function addChinaPartnerWithAudit(
  state: AppState,
  partner: Omit<ChinaPartner, 'id'>,
  actor: ActorIdentity = DEFAULT_ACTOR
): AppState {
  const created: ChinaPartner = {
    ...partner,
    id: `cp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  };
  const log = createAuditEntry({
    actor,
    category: 'Kho hàng',
    action: 'Thêm đối tác TQ',
    detail: `${actor.name} đã thêm đối tác TQ '${created.name}' (${created.region})`,
  });
  return {
    ...state,
    chinaPartners: [...(state.chinaPartners || []), created],
    auditLogs: [log, ...state.auditLogs],
  };
}

export function updateChinaPartnerWithAudit(
  state: AppState,
  partnerId: string,
  patch: Partial<ChinaPartner>,
  actor: ActorIdentity = DEFAULT_ACTOR
): AppState {
  const prev = (state.chinaPartners || []).find((p) => p.id === partnerId);
  if (!prev) return state;

  const updated: ChinaPartner = {
    ...prev,
    ...patch,
    id: prev.id,
  };

  const log = createAuditEntry({
    actor,
    category: 'Kho hàng',
    action: 'Sửa đối tác TQ',
    detail: `${actor.name} đã cập nhật thông tin đối tác TQ '${updated.name}'`,
    oldValue: prev.name,
    newValue: updated.name,
  });

  return {
    ...state,
    chinaPartners: (state.chinaPartners || []).map((p) => (p.id === partnerId ? updated : p)),
    auditLogs: [log, ...state.auditLogs],
  };
}

export function deleteChinaPartnerWithAudit(
  state: AppState,
  partnerId: string,
  actor: ActorIdentity = DEFAULT_ACTOR
): AppState {
  const target = (state.chinaPartners || []).find((p) => p.id === partnerId);
  if (!target) return state;

  const backup = createPreDeleteBackupSnapshot(state, actor, {
    category: 'Kho hàng',
    action: 'Trước khi xóa đối tác TQ',
    detail: `Xóa đối tác TQ '${target.name}' (${target.region})`,
  });

  const log = createAuditEntry({
    actor,
    category: 'Kho hàng',
    action: 'Xóa đối tác TQ',
    detail: `${actor.name} đã xóa đối tác TQ '${target.name}' (${target.region})`,
    oldValue: target.name,
    newValue: 'Đã xóa',
  });

  return {
    ...state,
    chinaPartners: (state.chinaPartners || []).filter((p) => p.id !== partnerId),
    auditLogs: [log, ...state.auditLogs],
    backups: prependBackupSnapshot(state.backups, backup),
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
    ...(Number(o.discount) > 0 ? { discount: Math.round(Number(o.discount)) } : {}),
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
    { id: 'acc_ngan', name: 'Ngân', username: 'ngan', role: 'Admin', pin: '1111', createdAt },
    { id: 'acc_giang', name: 'Giang', username: 'giang', role: 'Thành viên', pin: '2222', createdAt },
    { id: 'acc_hoa', name: 'Hoa', username: 'hoa', role: 'Thành viên', pin: '3333', createdAt },
    { id: 'acc_phuong', name: 'Phương', username: 'phuong', role: 'Thành viên', pin: '4444', createdAt },
    { id: 'acc_linh', name: 'Linh', username: 'linh', role: 'Thành viên', pin: '5555', createdAt },
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
    const backups = Array.isArray(candidate.backups)
      ? (candidate.backups as AppBackupSnapshot[])
      : [];
    const chinaPartners = Array.isArray(candidate.chinaPartners)
      ? (candidate.chinaPartners as ChinaPartner[])
      : [];
    const notifications = Array.isArray(candidate.notifications)
      ? (candidate.notifications as AppNotification[])
      : [];
    return {
      ok: true,
      state: {
        products: candidate.products.map((p: Product) => ({
          ...p,
          stockAdjustments: p.stockAdjustments ?? undefined,
          isArchived: Boolean(p.isArchived),
        })),
        stockImports: candidate.stockImports,
        orders: candidate.orders.map(normalizeImportedOrder),
        shareholders: candidate.shareholders,
        expenses: candidate.expenses,
        budgetItems: candidate.budgetItems,
        chinaPartners,
        accounts,
        auditLogs,
        backups,
        notifications,
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
    'Giảm giá (VND)',
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
      escapeCSV(o.discount || 0),
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

export type ShippingExportFilter = 'all' | ShippingMethod;

export function getShippingMethodSlug(shippingFilter: ShippingExportFilter): string {
  switch (shippingFilter) {
    case ShippingMethod.VIETTEL_POST:
      return 'Viettel_Post';
    case ShippingMethod.LOCAL_SHIP:
      return 'Ship_noi_thanh';
    case ShippingMethod.PICKUP:
      return 'Khach_tu_lay';
    default:
      return 'Tat_ca_van_chuyen';
  }
}

export function filterOrdersByShippingMethod(
  orders: Order[],
  shippingFilter: ShippingExportFilter,
  options: { includeCancelled?: boolean } = {}
): Order[] {
  const includeCancelled = options.includeCancelled ?? false;
  return orders.filter((o) => {
    if (!includeCancelled && o.isCancelled) return false;
    if (shippingFilter !== 'all' && o.shippingMethod !== shippingFilter) return false;
    return true;
  });
}

export function exportOrderRecipientsToCSV(
  orders: Order[],
  shippingFilter: ShippingExportFilter = 'all',
  options: { includeCancelled?: boolean } = {}
): string {
  const matched = filterOrdersByShippingMethod(orders, shippingFilter, options);
  const header = ['Tên người nhận', 'Số điện thoại', 'Địa chỉ'].join(',');
  const lines = matched.map((o) =>
    [
      escapeCSV(o.customerName),
      escapeCSV(o.customerPhone),
      escapeCSV(o.shippingAddress),
    ].join(',')
  );
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

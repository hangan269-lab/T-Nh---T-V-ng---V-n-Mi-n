export enum Brand {
  TO_NHA = 'Tơ Nhã',
  TO_VUONG = 'Tơ Vương',
  VAN_MIEN = 'Vân Miên',
}

export const ALL_BRANDS: Brand[] = [Brand.TO_NHA, Brand.TO_VUONG, Brand.VAN_MIEN];

export const BRAND_SUBTITLES: Record<Brand, string> = {
  [Brand.TO_NHA]: 'Áo dài nữ',
  [Brand.TO_VUONG]: 'Áo dài nam',
  [Brand.VAN_MIEN]: 'Trà & Quà tặng',
};

export type SizeOption = 'S' | 'M' | 'L' | 'Freesize';

export const ALL_SIZES: SizeOption[] = ['S', 'M', 'L', 'Freesize'];

export enum PaymentStatus {
  UNPAID = 'Chưa thanh toán',
  PAID = 'Đã thanh toán',
}

export enum ShippingMethod {
  VIETTEL_POST = 'Viettel Post',
  LOCAL_SHIP = 'Ship nội thành',
  PICKUP = 'Khách tự lấy',
}

export const ALL_SHIPPING_METHODS: ShippingMethod[] = [
  ShippingMethod.VIETTEL_POST,
  ShippingMethod.LOCAL_SHIP,
  ShippingMethod.PICKUP,
];

export enum ShippingStatus {
  NOT_SENT = 'Chưa gửi',
  VTP_CREATED = 'Đã lên đơn VTP',
  DELIVERED = 'Đã giao',
}

export const ALL_SHIPPING_STATUSES: ShippingStatus[] = [
  ShippingStatus.NOT_SENT,
  ShippingStatus.VTP_CREATED,
  ShippingStatus.DELIVERED,
];

export enum ExpenseStatus {
  PENDING = 'Chưa',
  COMPLETED = 'Hoàn thiện',
}

export const EXPENSE_CATEGORIES = [
  'Nhập hàng',
  'Bao bì/Hộp',
  'Mua vải',
  'May tag',
  'Sản xuất/Chụp ảnh',
  'Vận chuyển',
  'Ăn uống/Di chuyển',
  'Marketing/Ads',
  'Khác',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const DEFAULT_PAYERS = [
  'Ngân chi',
  'Giang chi',
  'Hoa thanh toán',
  'Phương chi',
  'Linh chi',
] as const;

export type UserRole = 'Admin' | 'Thành viên';

export interface UserAccount {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  pin: string;
  createdAt: string;
}

export type AuditCategory = 'Đơn hàng' | 'Tài chính' | 'Kho hàng' | 'Tài khoản' | 'Hệ thống';

export interface AuditLogEntry {
  id: string;
  timestamp: string; // ISO string
  actorId: string;
  actorName: string;
  category: AuditCategory;
  action: string;
  detail: string;
  oldValue?: string;
  newValue?: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  brand: Brand;
  costPrice: number;
  sellPrice: number;
  initialStock: Partial<Record<SizeOption, number>>;
  stockAdjustments?: Partial<Record<SizeOption, number>>;
  isArchived?: boolean;
}

export interface StockImport {
  id: string;
  date: string; // YYYY-MM-DD
  productId: string;
  size: SizeOption;
  quantity: number;
  unitCost: number;
  note?: string;
  enteredBy?: string;
}

export interface OrderItem {
  productId: string;
  productCode: string;
  productName: string;
  size: SizeOption;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  code: string;
  date: string; // YYYY-MM-DD
  brand: Brand;
  customerName: string;
  customerPhone: string;
  shippingAddress: string;
  shippingMethod: ShippingMethod;
  shopShippingCost: number;
  shippingCostPayer: string;
  shippingStatus: ShippingStatus;
  weightGrams: number;
  items: OrderItem[];
  shippingFee: number;
  discount?: number;
  note: string;
  paymentStatus: PaymentStatus;
  isCancelled: boolean;
  createdAt: string;
  createdBy: string;
  paymentConfirmedBy?: string;
  paymentConfirmedAt?: string;
  cancelledBy?: string;
  cancelledAt?: string;
}

export interface Shareholder {
  id: string;
  name: string;
  contribution: number;
  note?: string;
  updatedBy?: string;
}

export type ExpenseBrandScope = Brand | 'Dùng chung';

export interface Expense {
  id: string;
  linkedOrderId?: string;
  linkedImportId?: string;
  date: string; // YYYY-MM-DD
  category: ExpenseCategory | string;
  brandScope: ExpenseBrandScope;
  detail: string;
  amount: number;
  paidBy: string;
  receiptNote: string;
  status: ExpenseStatus;
  enteredBy?: string;
  updatedBy?: string;
  updatedAt?: string;
}

export interface BudgetItem {
  id: string;
  category: string;
  detail: string;
  quantity: number;
  estimatedUnitPrice: number;
}

export interface AppBackupSnapshotData {
  products: Product[];
  stockImports: StockImport[];
  orders: Order[];
  shareholders: Shareholder[];
  expenses: Expense[];
  budgetItems: BudgetItem[];
  accounts: UserAccount[];
}

export interface AppBackupSnapshotSummary {
  productsCount: number;
  stockImportsCount: number;
  ordersCount: number;
  shareholdersCount: number;
  expensesCount: number;
  budgetItemsCount: number;
  accountsCount: number;
}

export interface AppBackupSnapshot {
  id: string;
  createdAt: string; // ISO string
  actorId: string;
  actorName: string;
  category: AuditCategory;
  action: string;
  detail: string;
  summary: AppBackupSnapshotSummary;
  snapshot: AppBackupSnapshotData;
}

export interface AppState {
  products: Product[];
  stockImports: StockImport[];
  orders: Order[];
  shareholders: Shareholder[];
  expenses: Expense[];
  budgetItems: BudgetItem[];
  accounts: UserAccount[];
  auditLogs: AuditLogEntry[];
  backups: AppBackupSnapshot[];
  isSampleData: boolean;
}

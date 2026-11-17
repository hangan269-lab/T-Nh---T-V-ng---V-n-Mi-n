import React, { useEffect, useRef, useState } from 'react';
import {
  Boxes,
  Calculator,
  Download,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  RotateCcw,
  Settings,
  ShoppingBag,
  Trash2,
  Upload,
  Wallet,
  X,
} from 'lucide-react';
import { AccountSettingsModal } from './components/AccountSettingsModal';
import { AuditLogTab } from './components/AuditLogTab';
import { BudgetTab } from './components/BudgetTab';
import { ConfirmModal } from './components/ConfirmModal';
import { DashboardTab } from './components/DashboardTab';
import { FinanceTab } from './components/FinanceTab';
import { InventoryTab } from './components/InventoryTab';
import { LoginScreen } from './components/LoginScreen';
import { OrdersTab } from './components/OrdersTab';
import { createEmptyState, createSeedState } from './data/seedData';
import {
  AppState,
  BudgetItem,
  Expense,
  Order,
  Product,
  Shareholder,
  ShippingStatus,
  StockImport,
  UserAccount,
  UserRole,
} from './types/erp';
import {
  ActorIdentity,
  addBudgetItemWithAudit,
  addExpenseWithAudit,
  addShareholderWithAudit,
  addStockImportWithAudit,
  archiveProductWithAudit,
  authenticateUser,
  cancelOrder,
  changeUserPinWithAudit,
  computeBrandPnL,
  confirmOrderPayment,
  createOrderWithValidation,
  createUserAccountWithAudit,
  deleteBudgetItemWithAudit,
  deleteExpenseWithAudit,
  deleteOrderWithAudit,
  deleteProductWithAudit,
  deleteShareholderWithAudit,
  deleteStockImportWithAudit,
  deleteUserAccountWithAudit,
  ExpenseUpdatePatch,
  exportOrdersToCSV,
  exportPnLToCSV,
  exportStateToJSON,
  exportViettelPostCSV,
  formatDateVN,
  getTodayISO,
  markOrdersShippingStatus,
  OrderDraftInput,
  OrderShippingUpdate,
  parseImportedJSON,
  SaveProductInput,
  saveProductWithValidation,
  toggleExpenseStatus,
  updateBudgetItemWithAudit,
  updateExpenseWithAudit,
  updateOrderShipping,
  updateOrderWithValidation,
  updateShareholderWithAudit,
  updateStockImportWithValidation,
  updateUserAccountWithAudit,
} from './utils/finance';
import { downloadFinanceXLSX, downloadOrdersXLSX } from './utils/excelExport';

type TabId = 'dashboard' | 'orders' | 'inventory' | 'finance' | 'budget' | 'audit';

const STORAGE_KEY = 'tn_tv_vm_erp_state_v1';
const SESSION_USER_KEY = 'tn_tv_vm_active_user_v1';

const NAV_ITEMS: Array<{
  id: TabId;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'dashboard',
    label: 'Tổng quan & P&L',
    subtitle: 'Báo cáo lãi lỗ & hôm nay',
    icon: LayoutDashboard,
  },
  {
    id: 'orders',
    label: 'Đơn hàng',
    subtitle: 'Đầu ra & thanh toán',
    icon: ShoppingBag,
  },
  {
    id: 'inventory',
    label: 'Kho hàng & Mẫu',
    subtitle: 'Nhập - Xuất - Tồn',
    icon: Boxes,
  },
  {
    id: 'finance',
    label: 'Tài chính & Quỹ',
    subtitle: 'Vốn góp & chi phí',
    icon: Wallet,
  },
  {
    id: 'budget',
    label: 'Dự trù ngân sách',
    subtitle: 'Kế hoạch nhập & Ads',
    icon: Calculator,
  },
  {
    id: 'audit',
    label: 'Lịch sử thao tác',
    subtitle: 'Nhật ký chỉnh sửa',
    icon: History,
  },
];

function loadInitialState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = parseImportedJSON(raw);
      if (parsed.ok) {
        return parsed.state;
      }
    }
  } catch {
    // Fallback to seed data if storage is unavailable
  }
  return createSeedState();
}

function loadInitialSessionUserId(accounts: UserAccount[]): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1' && accounts[0]) {
      return accounts[0].id;
    }
    const saved = sessionStorage.getItem(SESSION_USER_KEY);
    if (saved && accounts.some((a) => a.id === saved)) {
      return saved;
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function App() {
  const [state, setState] = useState<AppState>(() => loadInitialState());
  const [currentUserId, setCurrentUserId] = useState<string | null>(() =>
    loadInitialSessionUserId(loadInitialState().accounts)
  );
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [isOrderCreateOpen, setIsOrderCreateOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentUser = state.accounts.find((a) => a.id === currentUserId) ?? null;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
  }, [state]);

  useEffect(() => {
    try {
      if (currentUserId) {
        sessionStorage.setItem(SESSION_USER_KEY, currentUserId);
      } else {
        sessionStorage.removeItem(SESSION_USER_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const showNotice = (text: string, type: 'success' | 'error' = 'success') => {
    setNotice({ type, text });
  };

  const handleLogin = (
    identifier: string,
    pin: string
  ): { ok: true } | { ok: false; error: string } => {
    const res = authenticateUser(state.accounts, identifier, pin);
    if (!res.ok) return res;
    setCurrentUserId(res.account.id);
    setActiveTab('dashboard');
    setNotice(null);
    return { ok: true };
  };

  const handleLogout = () => {
    setCurrentUserId(null);
    setSettingsOpen(false);
    setIsOrderCreateOpen(false);
    setMobileMenuOpen(false);
    setNotice(null);
  };

  if (!currentUser) {
    return <LoginScreen accounts={state.accounts} onLogin={handleLogin} />;
  }

  const actor: ActorIdentity = {
    id: currentUser.id,
    name: currentUser.name,
    role: currentUser.role,
  };

  const handleOpenNewOrder = () => {
    setActiveTab('orders');
    setIsOrderCreateOpen(true);
    setMobileMenuOpen(false);
  };

  const handleCreateOrder = (
    draft: OrderDraftInput
  ): { ok: true } | { ok: false; error: string } => {
    const result = createOrderWithValidation(state, draft, actor);
    if (!result.ok) {
      return result;
    }
    setState(result.state);
    const hasShipCost = result.order.shopShippingCost > 0;
    showNotice(
      hasShipCost
        ? `Đã tạo đơn ${result.order.code} (${actor.name}), trừ tồn kho và tự động hạch toán cước vận chuyển vào Quỹ.`
        : `Đã tạo đơn ${result.order.code} (${actor.name}) và tự động trừ tồn kho.`
    );
    return { ok: true };
  };

  const handleUpdateOrder = (
    orderId: string,
    draft: OrderDraftInput
  ): { ok: true } | { ok: false; error: string } => {
    const result = updateOrderWithValidation(state, orderId, draft, actor);
    if (!result.ok) {
      return result;
    }
    setState(result.state);
    showNotice(
      `Đã cập nhật đơn hàng ${result.order.code}, tự động cân đối lại tồn kho và cước vận chuyển.`
    );
    return { ok: true };
  };

  const handleDeleteOrder = (orderId: string) => {
    const target = state.orders.find((o) => o.id === orderId);
    setState((prev) => deleteOrderWithAudit(prev, orderId, actor));
    showNotice(
      `Đã xóa đơn hàng ${target?.code ?? ''}, tự động hoàn lại tồn kho, doanh thu và cước VC liên kết.`
    );
  };

  const handleConfirmPayment = (orderId: string) => {
    setState((prev) => confirmOrderPayment(prev, orderId, actor));
    showNotice(`Đã xác nhận thanh toán bởi ${actor.name} (COD cập nhật về 0 đ).`);
  };

  const handleCancelOrder = (orderId: string) => {
    setState((prev) => cancelOrder(prev, orderId, actor));
    showNotice(
      `Đã hủy đơn hàng bởi ${actor.name}, hoàn lại tồn kho và xóa khoản chi cước vận chuyển liên kết.`
    );
  };

  const handleUpdateOrderShipping = (orderId: string, patch: OrderShippingUpdate) => {
    setState((prev) => updateOrderShipping(prev, orderId, patch, actor));
    if (patch.shopShippingCost !== undefined) {
      showNotice(
        patch.shopShippingCost > 0
          ? 'Đã cập nhật thông tin vận chuyển, ghi lịch sử và đồng bộ khoản chi sang Sổ Quỹ.'
          : 'Đã cập nhật vận chuyển và gỡ khoản chi cước khỏi Sổ Quỹ.'
      );
    } else {
      showNotice('Đã cập nhật thông tin vận chuyển đơn hàng.');
    }
  };

  const handleMarkOrdersShippingStatus = (orderIds: string[], status: ShippingStatus) => {
    setState((prev) => markOrdersShippingStatus(prev, orderIds, status, actor));
    showNotice(`Đã chuyển ${orderIds.length} đơn sang trạng thái "${status}".`);
  };

  const handleExportViettelPostCSV = (ordersToExport: Order[]) => {
    const today = getTodayISO();
    triggerDownload(
      exportViettelPostCSV(ordersToExport),
      `viettel-post-don-hang-${today}.csv`,
      'text/csv;charset=utf-8'
    );
    showNotice(`Đã xuất ${ordersToExport.length} đơn hàng ra file CSV chuẩn Viettel Post.`);
  };

  const handleSaveProduct = (
    productInput: SaveProductInput
  ): { ok: true; hasStockAdjustment?: boolean } | { ok: false; error: string } => {
    const res = saveProductWithValidation(state, productInput, actor);
    if (!res.ok) {
      return res;
    }
    setState(res.state);
    if (productInput.id) {
      showNotice(
        res.hasStockAdjustment
          ? 'Đã cập nhật mẫu sản phẩm, điều chỉnh tồn kho và lưu nhật ký chỉnh sửa.'
          : 'Đã cập nhật thông tin mẫu sản phẩm và lưu nhật ký chỉnh sửa.'
      );
    } else {
      showNotice(`Đã thêm mẫu sản phẩm mới ${res.product.code} (${res.product.name}).`);
    }
    return { ok: true, hasStockAdjustment: res.hasStockAdjustment };
  };

  const handleArchiveProduct = (productId: string, archive: boolean) => {
    const res = archiveProductWithAudit(state, productId, archive, actor);
    if (!res.ok) {
      showNotice(res.error, 'error');
      return;
    }
    setState(res.state);
    showNotice(
      archive
        ? 'Đã chuyển mẫu sang Ngừng kinh doanh (ẩn khỏi đơn mới, giữ nguyên số liệu báo cáo cũ).'
        : 'Đã mở bán lại mẫu sản phẩm.'
    );
  };

  const handleDeleteProduct = (productId: string) => {
    const res = deleteProductWithAudit(state, productId, actor);
    if (!res.ok) {
      showNotice(res.error, 'error');
      return;
    }
    setState(res.state);
    showNotice('Đã xóa mẫu sản phẩm khỏi danh mục kho hàng.');
  };

  const handleAddStockImport = (
    imp: Omit<StockImport, 'id' | 'enteredBy'>,
    alsoRecordCashExpense: boolean
  ) => {
    setState((prev) => addStockImportWithAudit(prev, imp, alsoRecordCashExpense, actor));
    showNotice(`Đã nhập kho mới (${actor.name}) và cập nhật Tổng giá nhập.`);
  };

  const handleUpdateStockImport = (
    importId: string,
    patch: Omit<StockImport, 'id' | 'enteredBy'>
  ): { ok: true } | { ok: false; error: string } => {
    const res = updateStockImportWithValidation(state, importId, patch, actor);
    if (!res.ok) return res;
    setState(res.state);
    showNotice('Đã cập nhật phiếu nhập kho, tồn kho và Tổng giá nhập.');
    return { ok: true };
  };

  const handleDeleteStockImport = (importId: string) => {
    setState((prev) => deleteStockImportWithAudit(prev, importId, actor));
    showNotice('Đã xóa phiếu nhập kho và tự động cân đối lại tồn kho, Tổng giá nhập.');
  };

  const handleAddShareholder = (sh: Omit<Shareholder, 'id'>) => {
    setState((prev) => addShareholderWithAudit(prev, sh, actor));
    showNotice(`Đã thêm cổ đông ${sh.name}.`);
  };

  const handleUpdateShareholder = (
    id: string,
    patch: Partial<Pick<Shareholder, 'name' | 'contribution' | 'note'>>
  ) => {
    setState((prev) => updateShareholderWithAudit(prev, id, patch, actor));
    showNotice('Đã cập nhật vốn góp cổ đông và ghi lại giá trị cũ → mới vào Lịch sử.');
  };

  const handleDeleteShareholder = (id: string) => {
    const res = deleteShareholderWithAudit(state, id, actor);
    if (!res.ok) {
      showNotice(res.error, 'error');
      return;
    }
    setState(res.state);
    showNotice('Đã xóa cổ đông khỏi danh sách góp vốn.');
  };

  const handleAddExpense = (exp: Omit<Expense, 'id' | 'enteredBy'>) => {
    setState((prev) => addExpenseWithAudit(prev, exp, actor));
    showNotice(`Đã ghi nhận khoản chi mới (${actor.name}) vào Quỹ tiền mặt.`);
  };

  const handleUpdateExpense = (id: string, patch: ExpenseUpdatePatch) => {
    setState((prev) => updateExpenseWithAudit(prev, id, patch, actor));
    showNotice('Đã cập nhật khoản chi và lưu vết giá trị cũ → mới vào Lịch sử thao tác.');
  };

  const handleToggleExpenseStatus = (id: string) => {
    setState((prev) => toggleExpenseStatus(prev, id, actor));
  };

  const handleDeleteExpense = (id: string) => {
    const res = deleteExpenseWithAudit(state, id, actor);
    if (!res.ok) {
      showNotice(res.error, 'error');
      return;
    }
    setState(res.state);
    showNotice('Đã xóa vĩnh viễn khoản chi và đồng bộ lại Quỹ tiền mặt.');
  };

  const handleChangePin = (
    targetUserId: string,
    newPin: string,
    currentPinForSelf?: string
  ): { ok: true } | { ok: false; error: string } => {
    const res = changeUserPinWithAudit(state, targetUserId, newPin, actor, currentPinForSelf);
    if (!res.ok) return res;
    setState(res.state);
    return { ok: true };
  };

  const handleCreateAccount = (input: {
    name: string;
    username: string;
    role: UserRole;
    pin: string;
  }): { ok: true } | { ok: false; error: string } => {
    const res = createUserAccountWithAudit(state, input, actor);
    if (!res.ok) return res;
    setState(res.state);
    return { ok: true };
  };

  const handleUpdateAccount = (
    targetUserId: string,
    input: { name: string; username: string; role: UserRole; pin?: string }
  ): { ok: true } | { ok: false; error: string } => {
    const res = updateUserAccountWithAudit(state, targetUserId, input, actor);
    if (!res.ok) return res;
    setState(res.state);
    return { ok: true };
  };

  const handleDeleteAccount = (
    targetUserId: string
  ): { ok: true } | { ok: false; error: string } => {
    const res = deleteUserAccountWithAudit(state, targetUserId, actor);
    if (!res.ok) return res;
    setState(res.state);
    return { ok: true };
  };

  const handleAddBudgetItem = (item: Omit<BudgetItem, 'id'>) => {
    setState((prev) => addBudgetItemWithAudit(prev, item, actor));
    showNotice('Đã thêm hạng mục dự trù ngân sách.');
  };

  const handleUpdateBudgetItem = (id: string, patch: Omit<BudgetItem, 'id'>) => {
    setState((prev) => updateBudgetItemWithAudit(prev, id, patch, actor));
    showNotice('Đã cập nhật hạng mục dự trù ngân sách.');
  };

  const handleDeleteBudgetItem = (id: string) => {
    setState((prev) => deleteBudgetItemWithAudit(prev, id, actor));
    showNotice('Đã xóa hạng mục dự trù ngân sách.');
  };

  const handleExportJSON = () => {
    const today = getTodayISO();
    triggerDownload(
      exportStateToJSON(state),
      `tonha-tovuong-vanmien-backup-${today}.json`,
      'application/json;charset=utf-8'
    );
    showNotice('Đã xuất file sao lưu JSON.');
  };

  const handleExportOrdersCSV = () => {
    const today = getTodayISO();
    triggerDownload(
      exportOrdersToCSV(state.orders),
      `don-hang-${today}.csv`,
      'text/csv;charset=utf-8'
    );
    showNotice('Đã xuất danh sách đơn hàng ra file CSV.');
  };

  const handleExportOrdersXLSX = (ordersToExport: Order[]) => {
    const filename = downloadOrdersXLSX(ordersToExport, getTodayISO());
    showNotice(`Đã xuất ${ordersToExport.length} đơn hàng ra file Excel (${filename}).`);
  };

  const handleExportFinanceXLSX = () => {
    const filename = downloadFinanceXLSX(state, getTodayISO());
    showNotice(`Đã xuất Báo cáo Tài chính Thu Chi & Tổng hợp ra file Excel (${filename}).`);
  };

  const handleExportPnLCSV = () => {
    const today = getTodayISO();
    const pnl = computeBrandPnL(
      state.products,
      state.stockImports,
      state.orders,
      state.expenses
    );
    triggerDownload(
      exportPnLToCSV(pnl),
      `bao-cao-tong-hop-${today}.csv`,
      'text/csv;charset=utf-8'
    );
    showNotice('Đã xuất báo cáo P&L Tổng hợp ra file CSV.');
  };

  const handleImportJSONFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseImportedJSON(text);
      if (!parsed.ok) {
        showNotice(parsed.error, 'error');
        return;
      }
      setState(parsed.state);
      showNotice('Đã khôi phục toàn bộ dữ liệu từ file JSON.');
    } catch {
      showNotice('Không thể đọc file sao lưu đã chọn.', 'error');
    } finally {
      e.target.value = '';
    }
  };

  const handleClearSampleData = () => {
    if (currentUser.role !== 'Admin') {
      showNotice('Chỉ tài khoản Admin mới có quyền xóa dữ liệu mẫu.', 'error');
      setConfirmClearOpen(false);
      return;
    }
    setState((prev) => createEmptyState(prev.accounts));
    setConfirmClearOpen(false);
    showNotice('Đã xóa toàn bộ dữ liệu mẫu. Bạn có thể bắt đầu nhập liệu thực tế.');
  };

  const handleRestoreSampleData = () => {
    if (currentUser.role !== 'Admin') {
      showNotice('Chỉ tài khoản Admin mới có quyền nạp lại dữ liệu mẫu.', 'error');
      return;
    }
    setState(createSeedState());
    showNotice('Đã nạp lại bộ dữ liệu mẫu để trải nghiệm.');
  };

  const activeNav = NAV_ITEMS.find((n) => n.id === activeTab) ?? NAV_ITEMS[0];
  const todayISO = getTodayISO();
  const hasAnyData =
    state.products.length > 0 ||
    state.orders.length > 0 ||
    state.expenses.length > 0 ||
    state.shareholders.length > 0 ||
    state.stockImports.length > 0 ||
    state.budgetItems.length > 0;

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col justify-between bg-[#FFFFFF] border-r border-[#E4DFD5] p-5">
      <div>
        {/* Brand Wordmark */}
        <div className="border-b border-[#ECE7DD] pb-5">
          <div className="font-serif text-lg font-bold tracking-tight text-[#1A1F1E]">
            Tơ Nhã · Tơ Vương
          </div>
          <div className="mt-0.5 text-xs font-medium text-[#0D4F43]">
            &amp; Vân Miên Studio
          </div>
        </div>

        {/* Navigation Links */}
        <nav aria-label="Phân hệ quản trị" className="mt-5 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left ${
                  isActive
                    ? 'bg-[#0D4F43] text-white'
                    : 'text-[#1A1F1E] hover:bg-[#FAF8F4]'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    isActive ? 'text-white' : 'text-[#57605E]'
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{item.label}</span>
                  <span
                    className={`block truncate text-[11px] ${
                      isActive ? 'text-white/80' : 'text-[#57605E]'
                    }`}
                  >
                    {item.subtitle}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Backup & Data Management */}
      <div className="border-t border-[#ECE7DD] pt-4 space-y-2">
        <div className="text-[11px] font-semibold text-[#57605E]">
          Sao lưu &amp; Dữ liệu
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleExportJSON}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-2 text-xs font-medium text-[#1A1F1E] transition-colors hover:bg-[#FAF8F4] whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            Xuất JSON
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-2 text-xs font-medium text-[#1A1F1E] transition-colors hover:bg-[#FAF8F4] whitespace-nowrap"
          >
            <Upload className="h-3.5 w-3.5" />
            Nhập JSON
          </button>
        </div>

        <button
          type="button"
          onClick={handleExportOrdersCSV}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#E4DFD5] bg-[#FAF8F4] px-3 py-2 text-xs font-medium text-[#1A1F1E] transition-colors hover:bg-[#F3EFE6] whitespace-nowrap"
        >
          <Download className="h-3.5 w-3.5" />
          Xuất CSV Đơn hàng
        </button>

        {currentUser.role === 'Admin' &&
          (hasAnyData ? (
            <button
              type="button"
              onClick={() => setConfirmClearOpen(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#A63429]/25 bg-white px-3 py-2 text-xs font-medium text-[#A63429] transition-colors hover:bg-[#A63429]/5 whitespace-nowrap"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Reset dữ liệu về 0
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRestoreSampleData}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#0D4F43]/30 bg-white px-3 py-2 text-xs font-medium text-[#0D4F43] transition-colors hover:bg-[#0D4F43]/5 whitespace-nowrap"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Nạp dữ liệu mẫu
            </button>
          ))}

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleImportJSONFile}
          className="hidden"
          aria-label="Chọn file JSON để nhập dữ liệu"
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#1A1F1E] lg:flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-[#1A1F1E]/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-50 w-72 max-w-[85vw] h-full bg-white shadow-xl">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Đóng menu điều hướng"
              className="absolute right-3 top-4 rounded-lg p-1.5 text-[#57605E] hover:bg-[#F3EFE6]"
            >
              <X className="h-5 w-5" />
            </button>
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar Contract: Breadcrumb/Title — Date Context — User & Primary Action */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-[#E4DFD5] bg-[#FAF8F4]/95 px-4 backdrop-blur-xs sm:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Mở menu điều hướng"
              className="rounded-lg p-2 text-[#1A1F1E] hover:bg-[#F3EFE6] lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="font-serif text-lg font-semibold text-[#1A1F1E] truncate sm:text-xl">
              {activeNav.label}
            </h1>
            <span className="hidden xl:inline text-xs text-[#57605E] whitespace-nowrap">
              · {formatDateVN(todayISO)}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#57605E] whitespace-nowrap">
              <span>
                Xin chào, <strong className="font-semibold text-[#1A1F1E]">{currentUser.name}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span className={currentUser.role === 'Admin' ? 'font-medium text-[#0D4F43]' : ''}>
                {currentUser.role === 'Admin' ? 'Quản lý' : 'Thành viên'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              aria-label="Xem lịch sử thao tác"
              title="Lịch sử thao tác"
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 ${
                activeTab === 'audit'
                  ? 'border-[#0D4F43] bg-[#0D4F43]/10 text-[#0D4F43]'
                  : 'border-[#E4DFD5] bg-white text-[#1A1F1E] hover:bg-[#FAF8F4]'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Lịch sử</span>
            </button>

            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Cài đặt tài khoản"
              title="Cài đặt tài khoản & Đổi PIN"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-1.5 text-xs font-medium text-[#1A1F1E] hover:bg-[#FAF8F4] whitespace-nowrap shrink-0"
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Cài đặt</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              aria-label="Đăng xuất / Đổi người dùng"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-1.5 text-xs font-medium text-[#A63429] hover:bg-[#A63429]/5 whitespace-nowrap shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Đăng xuất / Đổi người dùng</span>
              <span className="sm:hidden">{currentUser.name}</span>
            </button>

            <button
              type="button"
              onClick={handleOpenNewOrder}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D4F43] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#093B32] whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Tạo đơn mới</span>
            </button>
          </div>
        </header>

        {/* Feedback banner */}
        {notice && (
          <div className="mx-4 mt-4 sm:mx-8">
            <div
              role="status"
              className={`flex items-center justify-between gap-4 rounded-lg border px-4 py-2.5 text-sm ${
                notice.type === 'error'
                  ? 'border-[#A63429]/30 bg-[#A63429]/10 text-[#A63429]'
                  : 'border-[#0D4F43]/30 bg-[#0D4F43]/10 text-[#0D4F43]'
              }`}
            >
              <span>{notice.text}</span>
              <button
                type="button"
                onClick={() => setNotice(null)}
                aria-label="Đóng thông báo"
                className="rounded p-1 hover:bg-black/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Active Tab Viewport */}
        <main className="mx-auto w-full max-w-[1280px] flex-1 p-4 sm:p-8">
          {activeTab === 'dashboard' && (
            <DashboardTab
              state={state}
              isAdmin={currentUser.role === 'Admin'}
              hasAnyData={hasAnyData}
              onNavigateTab={(tab) => setActiveTab(tab)}
              onConfirmPayment={handleConfirmPayment}
              onExportPnLCSV={handleExportPnLCSV}
              onExportFinanceXLSX={handleExportFinanceXLSX}
              onRequestClearSampleData={() => setConfirmClearOpen(true)}
            />
          )}

          {activeTab === 'orders' && (
            <OrdersTab
              state={state}
              currentUser={currentUser}
              isCreateOpen={isOrderCreateOpen}
              onOpenCreate={() => setIsOrderCreateOpen(true)}
              onCloseCreate={() => setIsOrderCreateOpen(false)}
              onCreateOrder={handleCreateOrder}
              onUpdateOrder={handleUpdateOrder}
              onDeleteOrder={handleDeleteOrder}
              onConfirmPayment={handleConfirmPayment}
              onCancelOrder={handleCancelOrder}
              onUpdateOrderShipping={handleUpdateOrderShipping}
              onMarkOrdersShippingStatus={handleMarkOrdersShippingStatus}
              onExportOrdersCSV={handleExportOrdersCSV}
              onExportOrdersXLSX={handleExportOrdersXLSX}
              onExportViettelPostCSV={handleExportViettelPostCSV}
            />
          )}

          {activeTab === 'inventory' && (
            <InventoryTab
              state={state}
              currentUser={currentUser}
              onSaveProduct={handleSaveProduct}
              onArchiveProduct={handleArchiveProduct}
              onDeleteProduct={handleDeleteProduct}
              onAddStockImport={handleAddStockImport}
              onUpdateStockImport={handleUpdateStockImport}
              onDeleteStockImport={handleDeleteStockImport}
            />
          )}

          {activeTab === 'finance' && (
            <FinanceTab
              state={state}
              currentUser={currentUser}
              onAddShareholder={handleAddShareholder}
              onUpdateShareholder={handleUpdateShareholder}
              onDeleteShareholder={handleDeleteShareholder}
              onAddExpense={handleAddExpense}
              onUpdateExpense={handleUpdateExpense}
              onToggleExpenseStatus={handleToggleExpenseStatus}
              onDeleteExpense={handleDeleteExpense}
              onExportFinanceXLSX={handleExportFinanceXLSX}
            />
          )}

          {activeTab === 'budget' && (
            <BudgetTab
              state={state}
              onAddBudgetItem={handleAddBudgetItem}
              onUpdateBudgetItem={handleUpdateBudgetItem}
              onDeleteBudgetItem={handleDeleteBudgetItem}
            />
          )}

          {activeTab === 'audit' && <AuditLogTab state={state} />}
        </main>
      </div>

      <ConfirmModal
        open={confirmClearOpen}
        title="Xóa toàn bộ dữ liệu mẫu (Reset hệ thống về 0)?"
        description="Hành động này sẽ xóa sạch toàn bộ đơn hàng, tồn kho, danh mục mẫu, phiếu nhập kho, cổ đông, chi phí, dự trù và nhật ký hiện tại (giữ nguyên tài khoản thành viên) để đặt lại Dashboard, P&L và Quỹ tiền mặt về 0."
        confirmLabel="Xác nhận Reset về 0"
        onConfirm={handleClearSampleData}
        onCancel={() => setConfirmClearOpen(false)}
      />

      <AccountSettingsModal
        open={settingsOpen}
        currentUser={currentUser}
        accounts={state.accounts}
        hasSystemData={hasAnyData}
        onClose={() => setSettingsOpen(false)}
        onChangePin={handleChangePin}
        onCreateAccount={handleCreateAccount}
        onUpdateAccount={handleUpdateAccount}
        onDeleteAccount={handleDeleteAccount}
        onRequestResetSystem={() => setConfirmClearOpen(true)}
      />
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import {
  Boxes,
  Calculator,
  Download,
  LayoutDashboard,
  Menu,
  Plus,
  RotateCcw,
  ShoppingBag,
  Trash2,
  Upload,
  Wallet,
  X,
} from 'lucide-react';
import { BudgetTab } from './components/BudgetTab';
import { ConfirmModal } from './components/ConfirmModal';
import { DashboardTab } from './components/DashboardTab';
import { FinanceTab } from './components/FinanceTab';
import { InventoryTab } from './components/InventoryTab';
import { OrdersTab } from './components/OrdersTab';
import { createEmptyState, createSeedState } from './data/seedData';
import {
  AppState,
  BudgetItem,
  Expense,
  ExpenseStatus,
  Order,
  Product,
  Shareholder,
  ShippingStatus,
  StockImport,
} from './types/erp';
import {
  cancelOrder,
  computeBrandPnL,
  confirmOrderPayment,
  createOrderWithValidation,
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
  toggleExpenseStatus,
  updateOrderShipping,
} from './utils/finance';

type TabId = 'dashboard' | 'orders' | 'inventory' | 'finance' | 'budget';

const STORAGE_KEY = 'tn_tv_vm_erp_state_v1';

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
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [isOrderCreateOpen, setIsOrderCreateOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
  }, [state]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const showNotice = (text: string, type: 'success' | 'error' = 'success') => {
    setNotice({ type, text });
  };

  const handleOpenNewOrder = () => {
    setActiveTab('orders');
    setIsOrderCreateOpen(true);
    setMobileMenuOpen(false);
  };

  const handleCreateOrder = (
    draft: OrderDraftInput
  ): { ok: true } | { ok: false; error: string } => {
    const result = createOrderWithValidation(state, draft);
    if (!result.ok) {
      return result;
    }
    setState(result.state);
    const hasShipCost = result.order.shopShippingCost > 0;
    showNotice(
      hasShipCost
        ? `Đã tạo đơn ${result.order.code}, trừ tồn kho và tự động hạch toán cước vận chuyển vào Quỹ.`
        : `Đã tạo đơn ${result.order.code} và tự động trừ tồn kho.`
    );
    return { ok: true };
  };

  const handleConfirmPayment = (orderId: string) => {
    setState((prev) => confirmOrderPayment(prev, orderId));
    showNotice('Đã xác nhận thanh toán đơn hàng (COD cập nhật về 0 đ).');
  };

  const handleCancelOrder = (orderId: string) => {
    setState((prev) => cancelOrder(prev, orderId));
    showNotice('Đã hủy đơn hàng, hoàn lại tồn kho và xóa khoản chi cước vận chuyển liên kết (nếu có).');
  };

  const handleUpdateOrderShipping = (orderId: string, patch: OrderShippingUpdate) => {
    setState((prev) => updateOrderShipping(prev, orderId, patch));
    if (patch.shopShippingCost !== undefined) {
      showNotice(
        patch.shopShippingCost > 0
          ? 'Đã cập nhật thông tin vận chuyển và đồng bộ khoản chi sang Sổ Quỹ.'
          : 'Đã cập nhật vận chuyển và gỡ khoản chi cước khỏi Sổ Quỹ.'
      );
    } else {
      showNotice('Đã cập nhật thông tin vận chuyển đơn hàng.');
    }
  };

  const handleMarkOrdersShippingStatus = (orderIds: string[], status: ShippingStatus) => {
    setState((prev) => markOrdersShippingStatus(prev, orderIds, status));
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

  const handleSaveProduct = (productInput: Omit<Product, 'id'> & { id?: string }) => {
    setState((prev) => {
      if (productInput.id) {
        return {
          ...prev,
          products: prev.products.map((p) =>
            p.id === productInput.id ? { ...p, ...productInput, id: p.id } : p
          ),
        };
      }
      const newProduct: Product = {
        ...productInput,
        id: `prd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      };
      return {
        ...prev,
        products: [newProduct, ...prev.products],
      };
    });
    showNotice(
      productInput.id ? 'Đã cập nhật thông tin mẫu sản phẩm.' : 'Đã thêm mẫu sản phẩm mới.'
    );
  };

  const handleAddStockImport = (
    imp: Omit<StockImport, 'id'>,
    alsoRecordCashExpense: boolean
  ) => {
    setState((prev) => {
      const newImport: StockImport = {
        ...imp,
        id: `imp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      };
      const product = prev.products.find((p) => p.id === imp.productId);
      const nextExpenses = [...prev.expenses];

      if (alsoRecordCashExpense && product) {
        nextExpenses.unshift({
          id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          date: imp.date,
          category: 'Nhập hàng',
          brandScope: product.brand,
          detail: `Nhập kho ${product.code} (${imp.size}) × ${imp.quantity}`,
          amount: imp.quantity * imp.unitCost,
          paidBy: 'Ngân chi',
          receiptNote: imp.note || 'Phiếu nhập kho',
          status: ExpenseStatus.COMPLETED,
        });
      }

      return {
        ...prev,
        stockImports: [newImport, ...prev.stockImports],
        expenses: nextExpenses,
      };
    });
    showNotice('Đã nhập kho mới và cập nhật Tổng giá nhập.');
  };

  const handleAddShareholder = (sh: Omit<Shareholder, 'id'>) => {
    setState((prev) => ({
      ...prev,
      shareholders: [
        ...prev.shareholders,
        { ...sh, id: `sh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` },
      ],
    }));
    showNotice(`Đã thêm cổ đông ${sh.name}.`);
  };

  const handleDeleteShareholder = (id: string) => {
    setState((prev) => ({
      ...prev,
      shareholders: prev.shareholders.filter((s) => s.id !== id),
    }));
    showNotice('Đã xóa cổ đông khỏi danh sách góp vốn.');
  };

  const handleAddExpense = (exp: Omit<Expense, 'id'>) => {
    setState((prev) => ({
      ...prev,
      expenses: [
        { ...exp, id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` },
        ...prev.expenses,
      ],
    }));
    showNotice('Đã ghi nhận khoản chi mới vào Quỹ tiền mặt.');
  };

  const handleToggleExpenseStatus = (id: string) => {
    setState((prev) => toggleExpenseStatus(prev, id));
  };

  const handleDeleteExpense = (id: string) => {
    setState((prev) => {
      const target = prev.expenses.find((e) => e.id === id);
      const nextExpenses = prev.expenses.filter((e) => e.id !== id);
      const nextOrders = target?.linkedOrderId
        ? prev.orders.map((o) =>
            o.id === target.linkedOrderId ? { ...o, shopShippingCost: 0 } : o
          )
        : prev.orders;
      return {
        ...prev,
        expenses: nextExpenses,
        orders: nextOrders,
      };
    });
    showNotice('Đã xóa khoản chi và đồng bộ lại Quỹ tiền mặt.');
  };

  const handleAddBudgetItem = (item: Omit<BudgetItem, 'id'>) => {
    setState((prev) => ({
      ...prev,
      budgetItems: [
        ...prev.budgetItems,
        { ...item, id: `bdg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` },
      ],
    }));
    showNotice('Đã thêm hạng mục dự trù ngân sách.');
  };

  const handleDeleteBudgetItem = (id: string) => {
    setState((prev) => ({
      ...prev,
      budgetItems: prev.budgetItems.filter((b) => b.id !== id),
    }));
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
    setState(createEmptyState());
    setConfirmClearOpen(false);
    showNotice('Đã xóa toàn bộ dữ liệu mẫu. Bạn có thể bắt đầu nhập liệu thực tế.');
  };

  const handleRestoreSampleData = () => {
    setState(createSeedState());
    showNotice('Đã nạp lại bộ dữ liệu mẫu để trải nghiệm.');
  };

  const activeNav = NAV_ITEMS.find((n) => n.id === activeTab) ?? NAV_ITEMS[0];
  const todayISO = getTodayISO();

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
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
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

        {state.products.length > 0 || state.orders.length > 0 || state.expenses.length > 0 ? (
          <button
            type="button"
            onClick={() => setConfirmClearOpen(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#A63429]/25 bg-white px-3 py-2 text-xs font-medium text-[#A63429] transition-colors hover:bg-[#A63429]/5 whitespace-nowrap"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Xóa dữ liệu mẫu
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
        )}

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
        {/* Top Bar Contract: Breadcrumb/Title — Date Context — Primary Action */}
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
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-[#57605E] whitespace-nowrap">
            <span>Hôm nay: {formatDateVN(todayISO)}</span>
            <span aria-hidden="true">·</span>
            <span>Tơ Nhã · Tơ Vương · Vân Miên</span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleOpenNewOrder}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D4F43] px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-[#093B32] whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              Tạo đơn mới
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
              onNavigateTab={(tab) => setActiveTab(tab)}
              onConfirmPayment={handleConfirmPayment}
              onExportPnLCSV={handleExportPnLCSV}
            />
          )}

          {activeTab === 'orders' && (
            <OrdersTab
              state={state}
              isCreateOpen={isOrderCreateOpen}
              onOpenCreate={() => setIsOrderCreateOpen(true)}
              onCloseCreate={() => setIsOrderCreateOpen(false)}
              onCreateOrder={handleCreateOrder}
              onConfirmPayment={handleConfirmPayment}
              onCancelOrder={handleCancelOrder}
              onUpdateOrderShipping={handleUpdateOrderShipping}
              onMarkOrdersShippingStatus={handleMarkOrdersShippingStatus}
              onExportOrdersCSV={handleExportOrdersCSV}
              onExportViettelPostCSV={handleExportViettelPostCSV}
            />
          )}

          {activeTab === 'inventory' && (
            <InventoryTab
              state={state}
              onSaveProduct={handleSaveProduct}
              onAddStockImport={handleAddStockImport}
            />
          )}

          {activeTab === 'finance' && (
            <FinanceTab
              state={state}
              onAddShareholder={handleAddShareholder}
              onDeleteShareholder={handleDeleteShareholder}
              onAddExpense={handleAddExpense}
              onToggleExpenseStatus={handleToggleExpenseStatus}
              onDeleteExpense={handleDeleteExpense}
            />
          )}

          {activeTab === 'budget' && (
            <BudgetTab
              state={state}
              onAddBudgetItem={handleAddBudgetItem}
              onDeleteBudgetItem={handleDeleteBudgetItem}
            />
          )}
        </main>
      </div>

      <ConfirmModal
        open={confirmClearOpen}
        title="Xóa toàn bộ dữ liệu mẫu?"
        description="Hành động này sẽ xóa sạch danh mục mẫu, đơn hàng, tồn kho, cổ đông, chi phí và dự trù hiện tại để bạn bắt đầu nhập liệu thực tế. Bạn nên Xuất JSON sao lưu trước nếu cần giữ lại."
        confirmLabel="Xóa toàn bộ dữ liệu"
        onConfirm={handleClearSampleData}
        onCancel={() => setConfirmClearOpen(false)}
      />
    </div>
  );
}

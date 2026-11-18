import React, { useEffect, useRef, useState } from 'react';
import {
  ArchiveRestore,
  Boxes,
  Crown,
  Download,
  Flower,
  Gem,
  History,
  LayoutDashboard,
  Leaf,
  LogOut,
  Menu,
  Plus,
  Settings,
  ShoppingBag,
  Sparkles,
  Star,
  Trash2,
  Upload,
  Wallet,
  WifiOff,
  X,
} from 'lucide-react';
import { AccountSettingsModal } from './components/AccountSettingsModal';
import { AiExcelImportModal, AiImportMode } from './components/AiExcelImportModal';
import { AuditLogTab } from './components/AuditLogTab';
import { BackupRestoreModal } from './components/BackupRestoreModal';
import { ConfirmModal } from './components/ConfirmModal';
import { DashboardTab } from './components/DashboardTab';
import { FinanceTab } from './components/FinanceTab';
import { InventoryTab } from './components/InventoryTab';
import { LoginScreen } from './components/LoginScreen';
import { NotificationCenter } from './components/NotificationCenter';
import { NotificationToast } from './components/NotificationToast';
import { OrderExportFormat, OrderExportMode } from './components/OrderExportModal';
import { OrdersTab } from './components/OrdersTab';
import { createEmptyState } from './data/seedData';
import { notificationTypeToTab, usePWA } from './hooks/usePWA';
import {
  AppBackupSnapshot,
  AppNotification,
  AppState,
  AuditLogEntry,
  Expense,
  NotificationType,
  Order,
  PaymentStatus,
  Product,
  Shareholder,
  ShippingStatus,
  StockImport,
  UserAccount,
  UserRole,
} from './types/erp';
import {
  ExtractedExpenseRow,
  ExtractedOrderRow,
  ExtractedProductRow,
} from './utils/gemini';
import {
  ActorIdentity,
  addExpenseWithAudit,
  addShareholderWithAudit,
  addStockImportWithAudit,
  appendNotificationToState,
  archiveProductWithAudit,
  authenticateUser,
  cancelOrder,
  changeUserPinWithAudit,
  computeBrandPnL,
  confirmOrderPayment,
  createAppNotification,
  createOrderWithValidation,
  createUserAccountWithAudit,
  deleteExpenseWithAudit,
  deleteOrderWithAudit,
  deleteProductWithAudit,
  deleteShareholderWithAudit,
  deleteStockImportWithAudit,
  deleteUserAccountWithAudit,
  ExpenseUpdatePatch,
  exportOrderRecipientsToCSV,
  exportOrdersToCSV,
  exportPnLToCSV,
  exportStateToJSON,
  exportViettelPostCSV,
  formatCompactVND,
  formatDateVN,
  formatVND,
  getOrderTotal,
  getShippingMethodSlug,
  getTodayISO,
  markAllNotificationsReadInState,
  markNotificationReadInState,
  markOrdersShippingStatus,
  OrderDraftInput,
  OrderShippingUpdate,
  parseImportedJSON,
  resetSystemDataWithAudit,
  restoreFromBackupWithAudit,
  SaveProductInput,
  saveProductWithValidation,
  ShippingExportFilter,
  toggleExpenseStatus,
  updateExpenseWithAudit,
  updateOrderShipping,
  updateOrderWithValidation,
  updateShareholderWithAudit,
  updateStockImportWithValidation,
  updateUserAccountWithAudit,
} from './utils/finance';
import {
  getNotificationSoundEnabled,
  playNotificationChime,
  setNotificationSoundEnabled,
} from './utils/sound';
import {
  downloadFinanceXLSX,
  downloadOrderRecipientsXLSX,
  downloadOrdersXLSX,
} from './utils/excelExport';
import { formatFirestoreErrorForUser } from './utils/firestoreError';
import { ensureAnonymousAuth, testConnection } from './firebase';
import {
  commitStateDiffToFirestore,
  ensureWorkspaceSeeded,
  FirestoreMetaCache,
  subscribeWorkspaceRealtime,
} from './utils/firestoreSync';

type TabId = 'dashboard' | 'orders' | 'inventory' | 'finance' | 'audit';

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
    id: 'audit',
    label: 'Lịch sử thao tác',
    subtitle: 'Nhật ký chỉnh sửa',
    icon: History,
  },
];

function resolveSavedSessionUserId(accounts: UserAccount[]): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1' && accounts[0]) {
      return accounts[0].id;
    }
    const saved = localStorage.getItem(SESSION_USER_KEY);
    if (saved && accounts.some((a) => a.id === saved)) {
      return saved;
    }
  } catch {
    // Ignore localStorage errors
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
  const initialEmpty = createEmptyState();
  const [state, setState] = useState<AppState>(initialEmpty);
  const stateRef = useRef<AppState>(initialEmpty);
  const metaCacheRef = useRef<FirestoreMetaCache>(new Map());

  const [firestoreLoading, setFirestoreLoading] = useState(true);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [fatalError, setFatalError] = useState<Error | null>(null);

  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SESSION_USER_KEY);
    } catch {
      return null;
    }
  });
  const currentUserIdRef = useRef<string | null>(currentUserId);

  const [activeTab, setActiveTab] = useState<TabId>(() => {
    try {
      const tabParam = new URLSearchParams(window.location.search).get('tab');
      if (
        tabParam === 'dashboard' ||
        tabParam === 'orders' ||
        tabParam === 'inventory' ||
        tabParam === 'finance' ||
        tabParam === 'audit'
      ) {
        return tabParam;
      }
    } catch {
      // Ignore URL errors
    }
    return 'dashboard';
  });
  const [isOrderCreateOpen, setIsOrderCreateOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [aiImportMode, setAiImportMode] = useState<AiImportMode | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [toastNotifications, setToastNotifications] = useState<AppNotification[]>([]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(getNotificationSoundEnabled);
  const soundEnabledRef = useRef(soundEnabled);
  const appSessionStartRef = useRef<string>(new Date().toISOString());
  const seenNotificationIdsRef = useRef<Set<string>>(new Set());
  const initialNotificationsLoadedRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pwa = usePWA({
    onNotificationNavigate: (tab) => setActiveTab(tab),
  });
  const showSystemNotificationRef = useRef(pwa.showSystemNotification);
  showSystemNotificationRef.current = pwa.showSystemNotification;

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
    setNotificationSoundEnabled(soundEnabled);
  }, [soundEnabled]);

  if (fatalError) {
    throw fatalError;
  }

  const currentUser = state.accounts.find((a) => a.id === currentUserId) ?? null;

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
    try {
      if (currentUserId) {
        localStorage.setItem(SESSION_USER_KEY, currentUserId);
      } else {
        localStorage.removeItem(SESSION_USER_KEY);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [currentUserId]);

  useEffect(() => {
    let activeUnsubscribe: (() => void) | null = null;
    let cancelled = false;

    const connectFirestore = async () => {
      setFirestoreLoading(true);
      setStartupError(null);
      initialNotificationsLoadedRef.current = false;
      try {
        await ensureAnonymousAuth();
        if (cancelled) return;

        const conn = await testConnection();
        if (cancelled) return;
        if (!conn.ok && conn.offline) {
          throw new Error('the client is offline');
        }

        await ensureWorkspaceSeeded(metaCacheRef.current);
        if (cancelled) return;

        activeUnsubscribe = subscribeWorkspaceRealtime(metaCacheRef.current, {
          onStateChange: (nextState) => {
            if (cancelled) return;
            stateRef.current = nextState;
            setState(nextState);

            // Process incoming real-time notifications from teammates
            const allNotifications = nextState.notifications ?? [];
            if (!initialNotificationsLoadedRef.current) {
              for (const n of allNotifications) {
                seenNotificationIdsRef.current.add(n.id);
              }
            } else {
              const incomingNew: AppNotification[] = [];
              for (const n of allNotifications) {
                if (!seenNotificationIdsRef.current.has(n.id)) {
                  seenNotificationIdsRef.current.add(n.id);
                  const activeUserId = currentUserIdRef.current;
                  if (
                    activeUserId &&
                    n.actorId !== activeUserId &&
                    n.createdAt >= appSessionStartRef.current
                  ) {
                    incomingNew.push(n);
                  }
                }
              }

              if (incomingNew.length > 0) {
                setToastNotifications((prev) => [...incomingNew, ...prev].slice(0, 3));
                for (const item of incomingNew) {
                  window.setTimeout(() => {
                    setToastNotifications((prev) => prev.filter((t) => t.id !== item.id));
                  }, 7000);
                  void showSystemNotificationRef.current(item.title, item.message, {
                    tag: item.id,
                    tab: notificationTypeToTab(item.type),
                  });
                }
                if (soundEnabledRef.current) {
                  playNotificationChime();
                }
              }
            }

            if (nextState.accounts.length > 0) {
              const activeId = currentUserIdRef.current;
              if (!activeId) {
                const resolved = resolveSavedSessionUserId(nextState.accounts);
                if (resolved) {
                  setCurrentUserId(resolved);
                }
              } else if (!nextState.accounts.some((a) => a.id === activeId)) {
                setCurrentUserId(null);
              }
            }
          },
          onReady: () => {
            if (!cancelled) {
              for (const n of stateRef.current.notifications ?? []) {
                seenNotificationIdsRef.current.add(n.id);
              }
              initialNotificationsLoadedRef.current = true;
              setStartupError(null);
              setFirestoreLoading(false);
            }
          },
          onError: (err) => {
            if (!cancelled) {
              setFirestoreLoading(false);
              if (!currentUserIdRef.current || stateRef.current.accounts.length === 0) {
                setStartupError(formatFirestoreErrorForUser(err));
              } else {
                setFatalError(err instanceof Error ? err : new Error(String(err)));
              }
            }
          },
        });
      } catch (err) {
        if (!cancelled) {
          setFirestoreLoading(false);
          setStartupError(formatFirestoreErrorForUser(err));
        }
      }
    };

    void connectFirestore();

    return () => {
      cancelled = true;
      if (activeUnsubscribe) {
        activeUnsubscribe();
      }
    };
  }, [retryNonce]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const showNotice = (text: string, type: 'success' | 'error' = 'success') => {
    setNotice({ type, text });
  };

  const commitNextState = (nextOrUpdater: AppState | ((prev: AppState) => AppState)) => {
    const prevState = stateRef.current;
    const nextState =
      typeof nextOrUpdater === 'function' ? nextOrUpdater(prevState) : nextOrUpdater;
    if (nextState === prevState) return;
    stateRef.current = nextState;
    setState(nextState);

    void commitStateDiffToFirestore(prevState, nextState, metaCacheRef.current).catch((error) => {
      showNotice(formatFirestoreErrorForUser(error), 'error');
    });
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

  if (firestoreLoading || startupError || !currentUser) {
    return (
      <LoginScreen
        accounts={state.accounts}
        firestoreLoading={firestoreLoading}
        startupError={startupError}
        onRetryStartup={() => setRetryNonce((n) => n + 1)}
        onLogin={handleLogin}
      />
    );
  }

  const actor: ActorIdentity = {
    id: currentUser.id,
    name: currentUser.name,
    role: currentUser.role,
  };

  const withNotification = (
    targetState: AppState,
    type: NotificationType,
    title: string,
    message: string
  ): AppState => {
    const notif = createAppNotification({ title, message, type, actor });
    seenNotificationIdsRef.current.add(notif.id);
    return appendNotificationToState(targetState, notif);
  };

  const handleMarkNotificationRead = (notificationId: string) => {
    commitNextState((prev) => markNotificationReadInState(prev, notificationId, currentUser.id));
  };

  const handleMarkAllNotificationsRead = () => {
    commitNextState((prev) => markAllNotificationsReadInState(prev, currentUser.id));
  };

  const handleSendTestNotification = () => {
    if (soundEnabled) {
      playNotificationChime();
    }
    void pwa.showSystemNotification(
      'Nhà Năn Niên - Thông báo thử',
      `Xin chào ${currentUser.name}, thông báo đẩy trên thiết bị này đã sẵn sàng hoạt động!`,
      { tag: 'n3-test-notification', tab: 'dashboard' }
    );
  };

  const handleOpenNewOrder = () => {
    setActiveTab('orders');
    setIsOrderCreateOpen(true);
    setMobileMenuOpen(false);
  };

  const handleCreateOrder = (
    draft: OrderDraftInput
  ): { ok: true } | { ok: false; error: string } => {
    const result = createOrderWithValidation(stateRef.current, draft, actor);
    if (!result.ok) {
      return result;
    }
    const orderTotal = formatCompactVND(getOrderTotal(result.order));
    commitNextState(
      withNotification(
        result.state,
        'order',
        `Đơn hàng mới #${result.order.code}`,
        `${actor.name} vừa tạo đơn hàng #${result.order.code} (${result.order.customerName} - ${orderTotal})`
      )
    );
    const hasShipCost = result.order.shopShippingCost > 0;
    showNotice(
      hasShipCost
        ? `Đã tạo đơn ${result.order.code} (${actor.name}), trừ tồn kho và tự động đồng bộ Firestore.`
        : `Đã tạo đơn ${result.order.code} (${actor.name}), trừ tồn kho và đồng bộ Firestore.`
    );
    return { ok: true };
  };

  const handleUpdateOrder = (
    orderId: string,
    draft: OrderDraftInput
  ): { ok: true } | { ok: false; error: string } => {
    const result = updateOrderWithValidation(stateRef.current, orderId, draft, actor);
    if (!result.ok) {
      return result;
    }
    const orderTotal = formatCompactVND(getOrderTotal(result.order));
    commitNextState(
      withNotification(
        result.state,
        'order',
        `Sửa đơn hàng #${result.order.code}`,
        `${actor.name} vừa chỉnh sửa đơn hàng #${result.order.code} (${result.order.customerName} - ${orderTotal})`
      )
    );
    showNotice(
      `Đã cập nhật đơn hàng ${result.order.code}, tự động cân đối lại tồn kho và đồng bộ Firestore.`
    );
    return { ok: true };
  };

  const handleDeleteOrder = (orderId: string) => {
    const target = stateRef.current.orders.find((o) => o.id === orderId);
    commitNextState((prev) => {
      const next = deleteOrderWithAudit(prev, orderId, actor);
      if (next === prev || !target) return next;
      return withNotification(
        next,
        'order',
        `Xóa đơn hàng #${target.code}`,
        `${actor.name} vừa xóa đơn hàng #${target.code} (${target.customerName})`
      );
    });
    showNotice(
      `Đã xóa đơn hàng ${target?.code ?? ''}, hoàn lại tồn kho và tự động lưu bản sao lưu khôi phục.`
    );
  };

  const handleConfirmPayment = (orderId: string) => {
    const target = stateRef.current.orders.find((o) => o.id === orderId);
    commitNextState((prev) => {
      const next = confirmOrderPayment(prev, orderId, actor);
      if (next === prev || !target) return next;
      return withNotification(
        next,
        'order',
        `Xác nhận thanh toán #${target.code}`,
        `${actor.name} vừa xác nhận ĐÃ THANH TOÁN đơn #${target.code} (${target.customerName} - ${formatCompactVND(getOrderTotal(target))})`
      );
    });
    showNotice(`Đã xác nhận thanh toán bởi ${actor.name} (COD cập nhật về 0 đ).`);
  };

  const handleCancelOrder = (orderId: string) => {
    const target = stateRef.current.orders.find((o) => o.id === orderId);
    commitNextState((prev) => {
      const next = cancelOrder(prev, orderId, actor);
      if (next === prev || !target) return next;
      return withNotification(
        next,
        'order',
        `Hủy đơn hàng #${target.code}`,
        `${actor.name} vừa hủy đơn hàng #${target.code} (${target.customerName})`
      );
    });
    showNotice(
      `Đã hủy đơn hàng bởi ${actor.name}, hoàn lại tồn kho và xóa khoản chi cước vận chuyển liên kết.`
    );
  };

  const handleUpdateOrderShipping = (orderId: string, patch: OrderShippingUpdate) => {
    const target = stateRef.current.orders.find((o) => o.id === orderId);
    commitNextState((prev) => {
      const next = updateOrderShipping(prev, orderId, patch, actor);
      if (next === prev || !target) return next;
      return withNotification(
        next,
        'order',
        `Cập nhật vận chuyển #${target.code}`,
        `${actor.name} vừa cập nhật vận chuyển đơn #${target.code}${patch.shippingStatus ? ` (${patch.shippingStatus})` : ''}`
      );
    });
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
    commitNextState((prev) => {
      const next = markOrdersShippingStatus(prev, orderIds, status, actor);
      if (next === prev) return next;
      return withNotification(
        next,
        'order',
        'Cập nhật trạng thái vận chuyển',
        `${actor.name} vừa chuyển ${orderIds.length} đơn sang trạng thái "${status}"`
      );
    });
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
  ): { ok: true; hasStockAdjustment?: boolean; product?: Product } | { ok: false; error: string } => {
    const res = saveProductWithValidation(stateRef.current, productInput, actor);
    if (!res.ok) {
      return res;
    }
    const notifTitle = productInput.id
      ? res.hasStockAdjustment
        ? `Điều chỉnh tồn kho ${res.product.code}`
        : `Cập nhật mẫu ${res.product.code}`
      : `Thêm mẫu mới ${res.product.code}`;
    const notifMsg = productInput.id
      ? res.hasStockAdjustment
        ? `${actor.name} vừa điều chỉnh tồn kho mẫu ${res.product.code} (${res.product.name})`
        : `${actor.name} vừa chỉnh sửa thông tin mẫu ${res.product.code} (${res.product.name})`
      : `${actor.name} vừa thêm mẫu sản phẩm mới ${res.product.code} · ${res.product.name}`;

    commitNextState(
      res.state === stateRef.current
        ? res.state
        : withNotification(res.state, 'inventory', notifTitle, notifMsg)
    );
    if (productInput.id) {
      showNotice(
        res.hasStockAdjustment
          ? 'Đã cập nhật mẫu sản phẩm, điều chỉnh tồn kho và đồng bộ Firestore.'
          : 'Đã cập nhật thông tin mẫu sản phẩm và đồng bộ Firestore.'
      );
    } else {
      showNotice(`Đã thêm mẫu sản phẩm mới ${res.product.code} (${res.product.name}).`);
    }
    return { ok: true, hasStockAdjustment: res.hasStockAdjustment, product: res.product };
  };

  const handleArchiveProduct = (productId: string, archive: boolean) => {
    const target = stateRef.current.products.find((p) => p.id === productId);
    const res = archiveProductWithAudit(stateRef.current, productId, archive, actor);
    if (!res.ok) {
      showNotice(res.error, 'error');
      return;
    }
    commitNextState(
      res.state === stateRef.current || !target
        ? res.state
        : withNotification(
            res.state,
            'inventory',
            archive ? `Ngừng bán ${target.code}` : `Mở bán lại ${target.code}`,
            `${actor.name} vừa ${archive ? 'ngừng kinh doanh' : 'mở bán lại'} mẫu ${target.code} (${target.name})`
          )
    );
    showNotice(
      archive
        ? 'Đã chuyển mẫu sang Ngừng kinh doanh (ẩn khỏi đơn mới, giữ nguyên số liệu báo cáo cũ).'
        : 'Đã mở bán lại mẫu sản phẩm.'
    );
  };

  const handleDeleteProduct = (productId: string) => {
    const target = stateRef.current.products.find((p) => p.id === productId);
    const res = deleteProductWithAudit(stateRef.current, productId, actor);
    if (!res.ok) {
      showNotice(res.error, 'error');
      return;
    }
    commitNextState(
      target
        ? withNotification(
            res.state,
            'inventory',
            `Xóa mẫu ${target.code}`,
            `${actor.name} vừa xóa mẫu ${target.code} (${target.name}) khỏi kho hàng`
          )
        : res.state
    );
    showNotice('Đã xóa mẫu sản phẩm khỏi danh mục kho hàng (đã lưu bản sao lưu khôi phục).');
  };

  const handleAddStockImport = (
    imp: Omit<StockImport, 'id' | 'enteredBy'>,
    alsoRecordCashExpense: boolean
  ) => {
    const product = stateRef.current.products.find((p) => p.id === imp.productId);
    commitNextState((prev) => {
      const next = addStockImportWithAudit(prev, imp, alsoRecordCashExpense, actor);
      return withNotification(
        next,
        'inventory',
        'Nhập kho mới',
        `${actor.name} vừa nhập kho +${imp.quantity} ${
          product ? `${product.code} · ${product.name}` : 'sản phẩm'
        } (Size ${imp.size})`
      );
    });
    showNotice(`Đã nhập kho mới (${actor.name}) và cập nhật Tổng giá nhập.`);
  };

  const handleUpdateStockImport = (
    importId: string,
    patch: Omit<StockImport, 'id' | 'enteredBy'>
  ): { ok: true } | { ok: false; error: string } => {
    const res = updateStockImportWithValidation(stateRef.current, importId, patch, actor);
    if (!res.ok) return res;
    const product = stateRef.current.products.find((p) => p.id === patch.productId);
    commitNextState(
      withNotification(
        res.state,
        'inventory',
        'Cập nhật phiếu nhập kho',
        `${actor.name} vừa sửa phiếu nhập kho ${product ? `${product.code} (${patch.size})` : ''} · SL ${patch.quantity}`
      )
    );
    showNotice('Đã cập nhật phiếu nhập kho, tồn kho và Tổng giá nhập.');
    return { ok: true };
  };

  const handleDeleteStockImport = (importId: string) => {
    const target = stateRef.current.stockImports.find((i) => i.id === importId);
    const product = target
      ? stateRef.current.products.find((p) => p.id === target.productId)
      : undefined;
    commitNextState((prev) => {
      const next = deleteStockImportWithAudit(prev, importId, actor);
      if (next === prev || !target) return next;
      return withNotification(
        next,
        'inventory',
        'Xóa phiếu nhập kho',
        `${actor.name} vừa xóa phiếu nhập +${target.quantity} ${product ? product.code : ''} (${target.size})`
      );
    });
    showNotice('Đã xóa phiếu nhập kho, cân đối lại tồn kho và tự động lưu bản sao lưu.');
  };

  const handleAddShareholder = (sh: Omit<Shareholder, 'id'>) => {
    commitNextState((prev) => {
      const next = addShareholderWithAudit(prev, sh, actor);
      return withNotification(
        next,
        'finance',
        'Thêm vốn góp cổ đông',
        `${actor.name} vừa thêm vốn góp của ${sh.name} (${formatCompactVND(sh.contribution)})`
      );
    });
    showNotice(`Đã thêm cổ đông ${sh.name}.`);
  };

  const handleUpdateShareholder = (
    id: string,
    patch: Partial<Pick<Shareholder, 'name' | 'contribution' | 'note'>>
  ) => {
    const target = stateRef.current.shareholders.find((s) => s.id === id);
    commitNextState((prev) => {
      const next = updateShareholderWithAudit(prev, id, patch, actor);
      if (next === prev || !target) return next;
      return withNotification(
        next,
        'finance',
        'Cập nhật vốn góp',
        `${actor.name} vừa sửa vốn góp của ${patch.name ?? target.name} (${formatCompactVND(patch.contribution ?? target.contribution)})`
      );
    });
    showNotice('Đã cập nhật vốn góp cổ đông và ghi lại giá trị cũ → mới vào Lịch sử.');
  };

  const handleDeleteShareholder = (id: string) => {
    const target = stateRef.current.shareholders.find((s) => s.id === id);
    const res = deleteShareholderWithAudit(stateRef.current, id, actor);
    if (!res.ok) {
      showNotice(res.error, 'error');
      return;
    }
    commitNextState(
      target
        ? withNotification(
            res.state,
            'finance',
            'Xóa cổ đông góp vốn',
            `${actor.name} vừa xóa cổ đông ${target.name} khỏi danh sách góp vốn`
          )
        : res.state
    );
    showNotice('Đã xóa cổ đông khỏi danh sách góp vốn (đã lưu bản sao lưu khôi phục).');
  };

  const handleAddExpense = (exp: Omit<Expense, 'id' | 'enteredBy'>) => {
    commitNextState((prev) => {
      const next = addExpenseWithAudit(prev, exp, actor);
      return withNotification(
        next,
        'finance',
        'Khoản chi mới',
        `${actor.name} vừa thêm khoản chi ${exp.category} ${formatCompactVND(exp.amount)} (${exp.detail})`
      );
    });
    showNotice(`Đã ghi nhận khoản chi mới (${actor.name}) vào Quỹ tiền mặt.`);
  };

  const handleUpdateExpense = (id: string, patch: ExpenseUpdatePatch) => {
    const target = stateRef.current.expenses.find((e) => e.id === id);
    commitNextState((prev) => {
      const next = updateExpenseWithAudit(prev, id, patch, actor);
      if (next === prev || !target) return next;
      return withNotification(
        next,
        'finance',
        'Sửa khoản chi',
        `${actor.name} vừa sửa khoản chi '${patch.detail ?? target.detail}' (${formatCompactVND(patch.amount ?? target.amount)})`
      );
    });
    showNotice('Đã cập nhật khoản chi và lưu vết giá trị cũ → mới vào Lịch sử thao tác.');
  };

  const handleToggleExpenseStatus = (id: string) => {
    const target = stateRef.current.expenses.find((e) => e.id === id);
    commitNextState((prev) => {
      const next = toggleExpenseStatus(prev, id, actor);
      if (next === prev || !target) return next;
      return withNotification(
        next,
        'finance',
        'Đổi trạng thái khoản chi',
        `${actor.name} vừa cập nhật trạng thái khoản chi '${target.detail}'`
      );
    });
  };

  const handleDeleteExpense = (id: string) => {
    const target = stateRef.current.expenses.find((e) => e.id === id);
    const res = deleteExpenseWithAudit(stateRef.current, id, actor);
    if (!res.ok) {
      showNotice(res.error, 'error');
      return;
    }
    commitNextState(
      target
        ? withNotification(
            res.state,
            'finance',
            'Xóa khoản chi',
            `${actor.name} vừa xóa khoản chi '${target.detail}' (${formatCompactVND(target.amount)})`
          )
        : res.state
    );
    showNotice('Đã xóa khoản chi, đồng bộ lại Quỹ tiền mặt và tự động lưu bản sao lưu.');
  };

  const handleChangePin = (
    targetUserId: string,
    newPin: string,
    currentPinForSelf?: string
  ): { ok: true } | { ok: false; error: string } => {
    const res = changeUserPinWithAudit(
      stateRef.current,
      targetUserId,
      newPin,
      actor,
      currentPinForSelf
    );
    if (!res.ok) return res;
    commitNextState(res.state);
    return { ok: true };
  };

  const handleCreateAccount = (input: {
    name: string;
    username: string;
    role: UserRole;
    pin: string;
  }): { ok: true } | { ok: false; error: string } => {
    const res = createUserAccountWithAudit(stateRef.current, input, actor);
    if (!res.ok) return res;
    commitNextState(res.state);
    return { ok: true };
  };

  const handleUpdateAccount = (
    targetUserId: string,
    input: { name: string; username: string; role: UserRole; pin?: string }
  ): { ok: true } | { ok: false; error: string } => {
    const res = updateUserAccountWithAudit(stateRef.current, targetUserId, input, actor);
    if (!res.ok) return res;
    commitNextState(res.state);
    return { ok: true };
  };

  const handleDeleteAccount = (
    targetUserId: string
  ): { ok: true } | { ok: false; error: string } => {
    const res = deleteUserAccountWithAudit(stateRef.current, targetUserId, actor);
    if (!res.ok) return res;
    commitNextState(res.state);
    return { ok: true };
  };

  const handleExportJSON = () => {
    const today = getTodayISO();
    triggerDownload(
      exportStateToJSON(stateRef.current),
      `tonha-tovuong-vanmien-backup-${today}.json`,
      'application/json;charset=utf-8'
    );
    showNotice('Đã xuất file sao lưu JSON.');
  };

  const handleExportOrdersCSV = () => {
    const today = getTodayISO();
    triggerDownload(
      exportOrdersToCSV(stateRef.current.orders),
      `don-hang-${today}.csv`,
      'text/csv;charset=utf-8'
    );
    showNotice('Đã xuất danh sách đơn hàng ra file CSV.');
  };

  const handleExportOrdersCustom = ({
    orders,
    shippingFilter,
    mode,
    format,
  }: {
    orders: Order[];
    shippingFilter: ShippingExportFilter;
    mode: OrderExportMode;
    format: OrderExportFormat;
  }) => {
    const today = getTodayISO();
    const shippingLabel =
      shippingFilter === 'all' ? 'Tất cả hình thức vận chuyển' : shippingFilter;
    const slug = getShippingMethodSlug(shippingFilter).toLowerCase().replace(/_/g, '-');

    if (mode === 'recipients') {
      if (format === 'xlsx') {
        const filename = downloadOrderRecipientsXLSX(orders, shippingFilter, today, {
          includeCancelled: true,
        });
        showNotice(
          `Đã xuất thông tin người nhận của ${orders.length} đơn (${shippingLabel}) ra file Excel (${filename}).`
        );
      } else {
        const filename = `danh-sach-nguoi-nhan-${slug}-${today}.csv`;
        triggerDownload(
          exportOrderRecipientsToCSV(orders, shippingFilter, { includeCancelled: true }),
          filename,
          'text/csv;charset=utf-8'
        );
        showNotice(
          `Đã xuất thông tin người nhận của ${orders.length} đơn (${shippingLabel}) ra file CSV (${filename}).`
        );
      }
      return;
    }

    if (format === 'xlsx') {
      const filename = downloadOrdersXLSX(orders, today, shippingFilter);
      showNotice(
        `Đã xuất ${orders.length} đơn hàng (${shippingLabel}) ra file Excel (${filename}).`
      );
    } else {
      const filename =
        shippingFilter === 'all' ? `don-hang-${today}.csv` : `don-hang-${slug}-${today}.csv`;
      triggerDownload(exportOrdersToCSV(orders), filename, 'text/csv;charset=utf-8');
      showNotice(
        `Đã xuất ${orders.length} đơn hàng (${shippingLabel}) ra file CSV (${filename}).`
      );
    }
  };

  const handleExportFinanceXLSX = () => {
    const filename = downloadFinanceXLSX(stateRef.current, getTodayISO());
    showNotice(`Đã xuất Báo cáo Tài chính Thu Chi & Tổng hợp ra file Excel (${filename}).`);
  };

  const handleExportPnLCSV = () => {
    const today = getTodayISO();
    const pnl = computeBrandPnL(
      stateRef.current.products,
      stateRef.current.stockImports,
      stateRef.current.orders,
      stateRef.current.expenses
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
      commitNextState(parsed.state);
      showNotice('Đã khôi phục toàn bộ dữ liệu từ file JSON và đồng bộ lên Firestore.');
    } catch {
      showNotice('Không thể đọc file sao lưu đã chọn.', 'error');
    } finally {
      e.target.value = '';
    }
  };

  const handleResetSystemData = () => {
    const res = resetSystemDataWithAudit(stateRef.current, actor);
    setConfirmClearOpen(false);
    if (!res.ok) {
      showNotice(res.error, 'error');
      return;
    }
    commitNextState(res.state);
    showNotice('Đã reset toàn bộ dữ liệu về 0 và tự động lưu bản sao lưu trước khi reset.');
  };

  const handleRestoreBackup = (backupId: string) => {
    const res = restoreFromBackupWithAudit(stateRef.current, backupId, actor);
    if (!res.ok) {
      showNotice(res.error, 'error');
      return;
    }
    commitNextState(res.state);
    showNotice(
      `Đã khôi phục dữ liệu từ bản sao lưu "${res.backup.action}" (${res.backup.summary.ordersCount} đơn, ${res.backup.summary.productsCount} mẫu).`
    );
  };

  const handleDownloadBackupJSON = (backup: AppBackupSnapshot) => {
    const datePart = backup.createdAt.slice(0, 10) || getTodayISO();
    const stateToExport: AppState = {
      ...backup.snapshot,
      auditLogs: stateRef.current.auditLogs,
      backups: [],
      notifications: [],
      isSampleData: false,
    };
    triggerDownload(
      exportStateToJSON(stateToExport),
      `sao-luu-cu-${datePart}-${backup.id}.json`,
      'application/json;charset=utf-8'
    );
    showNotice('Đã tải file JSON bản sao lưu cũ.');
  };

  const handleUpdateAppIcon = (newIcon: string) => {
    commitNextState((prev: AppState) => ({
      ...prev,
      appIcon: newIcon,
    }));
    showNotice(`Đã đổi biểu tượng đại diện của ứng dụng sang "${newIcon}".`);
  };

  const handleSaveAiExpenses = (extracted: ExtractedExpenseRow[]) => {
    if (extracted.length === 0) return;
    const nowIso = new Date().toISOString();
    const newExpenses: Expense[] = extracted.map((row, idx) => ({
      id: `exp_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      date: row.date,
      category: row.category,
      brandScope: row.brandScope,
      detail: row.detail,
      amount: row.amount,
      paidBy: row.paidBy,
      receiptNote: row.receiptNote,
      status: row.status,
      enteredBy: actor.name,
    }));

    const auditEntry: AuditLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: nowIso,
      actorId: actor.id,
      actorName: actor.name,
      category: 'Tài chính',
      action: 'Nhập Excel hàng loạt bằng AI',
      detail: `${actor.name} đã dùng Gemini AI nhập hàng loạt ${extracted.length} khoản chi (${formatVND(
        extracted.reduce((sum, e) => sum + e.amount, 0)
      )}) từ Excel/Sheets.`,
    };

    const totalAiExpenses = extracted.reduce((sum, e) => sum + e.amount, 0);
    commitNextState((prev: AppState) =>
      withNotification(
        {
          ...prev,
          expenses: [...newExpenses, ...prev.expenses],
          auditLogs: [auditEntry, ...prev.auditLogs],
        },
        'finance',
        `Nhập ${extracted.length} khoản chi bằng AI`,
        `${actor.name} vừa nhập ${extracted.length} khoản chi (${formatCompactVND(totalAiExpenses)}) từ Excel/AI`
      )
    );

    showNotice(
      `Đã nạp thành công ${extracted.length} khoản chi phí từ bảng tính vào sổ quỹ và đồng bộ Firestore.`
    );
  };

  const handleSaveAiOrders = (extracted: ExtractedOrderRow[]) => {
    if (extracted.length === 0) return;
    const nowIso = new Date().toISOString();

    let maxNumber = 0;
    for (const o of stateRef.current.orders) {
      const match = /^DH-(\d+)$/i.exec(o.code);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNumber) maxNumber = n;
      }
    }

    const newOrders: Order[] = extracted.map((row, idx) => {
      const codeNum = maxNumber + idx + 1;
      const orderCode = `DH-${String(codeNum).padStart(3, '0')}`;

      const items = row.items.map((it) => {
        const prod = stateRef.current.products.find(
          (p) =>
            p.code.toLowerCase() === it.productCodeOrName.toLowerCase() ||
            p.name.toLowerCase().includes(it.productCodeOrName.toLowerCase())
        );
        return {
          productId: prod ? prod.id : (stateRef.current.products[0]?.id ?? `temp_${idx}`),
          productCode: prod ? prod.code : it.productCodeOrName,
          productName: prod ? prod.name : it.productCodeOrName,
          size: it.size,
          quantity: it.quantity,
          unitPrice: it.unitPrice || prod?.sellPrice || 0,
        };
      });

      return {
        id: `ord_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        code: orderCode,
        date: row.date,
        brand: row.brand,
        customerName: row.customerName,
        customerPhone: row.customerPhone,
        shippingAddress: row.shippingAddress,
        shippingMethod: row.shippingMethod,
        shopShippingCost: 0,
        shippingCostPayer: 'Khách chịu',
        shippingStatus: row.shippingStatus,
        weightGrams: 500,
        items,
        shippingFee: row.shippingFee,
        discount: row.discount,
        note: row.note,
        paymentStatus:
          row.paymentStatus === 'Đã thanh toán'
            ? PaymentStatus.PAID
            : PaymentStatus.UNPAID,
        isCancelled: false,
        createdAt: nowIso,
        createdBy: actor.name,
      };
    });

    const auditEntry: AuditLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: nowIso,
      actorId: actor.id,
      actorName: actor.name,
      category: 'Đơn hàng',
      action: 'Nhập Excel hàng loạt bằng AI',
      detail: `${actor.name} đã dùng Gemini AI nhập hàng loạt ${extracted.length} đơn hàng từ bảng tính Excel/Sheets.`,
    };

    commitNextState((prev: AppState) =>
      withNotification(
        {
          ...prev,
          orders: [...newOrders, ...prev.orders],
          auditLogs: [auditEntry, ...prev.auditLogs],
        },
        'order',
        `Nhập ${extracted.length} đơn hàng bằng AI`,
        `${actor.name} vừa thêm ${extracted.length} đơn hàng mới từ bảng tính Excel/AI`
      )
    );

    showNotice(
      `Đã nạp thành công ${extracted.length} đơn hàng từ bảng tính vào hệ thống và đồng bộ Firestore.`
    );
  };

  const handleSaveAiProducts = (extracted: ExtractedProductRow[]) => {
    if (extracted.length === 0) return;
    const nowIso = new Date().toISOString();

    const newProducts: Product[] = extracted.map((row, idx) => ({
      id: `prod_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      code: row.code,
      name: row.name,
      brand: row.brand,
      costPrice: row.costPrice,
      sellPrice: row.sellPrice,
      initialStock: row.initialStock,
      stockAdjustments: {},
      isArchived: false,
    }));

    const auditEntry: AuditLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: nowIso,
      actorId: actor.id,
      actorName: actor.name,
      category: 'Kho hàng',
      action: 'Nhập Excel hàng loạt bằng AI',
      detail: `${actor.name} đã dùng Gemini AI nạp danh mục ${extracted.length} mẫu sản phẩm vào kho hàng.`,
    };

    commitNextState((prev: AppState) =>
      withNotification(
        {
          ...prev,
          products: [...prev.products, ...newProducts],
          auditLogs: [auditEntry, ...prev.auditLogs],
        },
        'inventory',
        `Nạp ${extracted.length} mẫu kho bằng AI`,
        `${actor.name} vừa nạp danh mục ${extracted.length} mẫu sản phẩm mới vào kho`
      )
    );

    showNotice(
      `Đã nạp thành công ${extracted.length} mẫu sản phẩm vào danh mục kho và đồng bộ Firestore.`
    );
  };

  const renderAppIcon = (iconName?: string) => {
    switch (iconName) {
      case 'Flower':
        return <Flower className="h-5 w-5 text-[#0D4F43]" />;
      case 'Crown':
        return <Crown className="h-5 w-5 text-[#0D4F43]" />;
      case 'Gem':
        return <Gem className="h-5 w-5 text-[#0D4F43]" />;
      case 'Leaf':
        return <Leaf className="h-5 w-5 text-[#0D4F43]" />;
      case 'Star':
        return <Star className="h-5 w-5 text-[#0D4F43]" />;
      case 'Sparkles':
      default:
        return <Sparkles className="h-5 w-5 text-[#0D4F43]" />;
    }
  };

  const activeNav = NAV_ITEMS.find((n) => n.id === activeTab) ?? NAV_ITEMS[0];
  const todayISO = getTodayISO();
  const hasAnyData =
    state.products.length > 0 ||
    state.orders.length > 0 ||
    state.expenses.length > 0 ||
    state.shareholders.length > 0 ||
    state.stockImports.length > 0;

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col justify-between bg-[#FFFFFF] border-r border-[#E4DFD5] p-5">
      <div>
        {/* Brand Wordmark */}
        <div className="border-b border-[#ECE7DD] pb-5">
          <div className="flex items-center gap-2">
            {renderAppIcon(state.appIcon)}
            <div className="font-serif text-lg font-bold tracking-tight text-[#1A1F1E]">
              Tơ Nhã · Tơ Vương
            </div>
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
          Sao lưu &amp; Dữ liệu Cloud
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

        <button
          type="button"
          onClick={() => {
            setBackupModalOpen(true);
            setMobileMenuOpen(false);
          }}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#0D4F43]/30 bg-[#0D4F43]/[0.04] px-3 py-2 text-xs font-medium text-[#0D4F43] transition-colors hover:bg-[#0D4F43]/10 whitespace-nowrap"
        >
          <ArchiveRestore className="h-3.5 w-3.5" />
          Bản sao lưu ({state.backups.length})
        </button>

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
            {!pwa.isOnline && (
              <span
                title="Đang mất kết nối mạng - dữ liệu sẽ tự đồng bộ khi có mạng lại"
                className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800 whitespace-nowrap"
              >
                <WifiOff className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Ngoại tuyến</span>
              </span>
            )}

            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              title="Bấm để đổi mã PIN hoặc mở cài đặt tài khoản"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-[#57605E] transition-colors hover:bg-[#F3EFE6] whitespace-nowrap"
            >
              <span>
                Xin chào, <strong className="font-semibold text-[#1A1F1E]">{currentUser.name}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span className={currentUser.role === 'Admin' ? 'font-medium text-[#0D4F43]' : ''}>
                {currentUser.role === 'Admin' ? 'Quản lý' : 'Thành viên'}
              </span>
            </button>

            <NotificationCenter
              notifications={state.notifications ?? []}
              currentUserId={currentUser.id}
              soundEnabled={soundEnabled}
              onToggleSound={() => setSoundEnabled((prev) => !prev)}
              onMarkRead={handleMarkNotificationRead}
              onMarkAllRead={handleMarkAllNotificationsRead}
              onNavigateTab={(tab) => setActiveTab(tab)}
              notificationPermission={pwa.notificationPermission}
              isIOS={pwa.isIOS}
              isInstalled={pwa.isInstalled}
              canInstallPrompt={pwa.canInstallPrompt}
              onRequestPermission={pwa.requestNotificationPermission}
              onInstallApp={pwa.installApp}
              onSendTestNotification={handleSendTestNotification}
            />

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
              onExportOrdersCustom={handleExportOrdersCustom}
              onExportViettelPostCSV={handleExportViettelPostCSV}
              onSaveProduct={handleSaveProduct}
              onOpenAiExcelImport={() => setAiImportMode('orders')}
              onOpenSettings={() => setSettingsOpen(true)}
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
              onOpenAiExcelImport={() => setAiImportMode('products')}
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
              onOpenAiExcelImport={() => setAiImportMode('expenses')}
            />
          )}

          {activeTab === 'audit' && (
            <AuditLogTab
              state={state}
              onRestoreBackup={handleRestoreBackup}
              onDownloadBackupJSON={handleDownloadBackupJSON}
            />
          )}
        </main>
      </div>

      <ConfirmModal
        open={confirmClearOpen}
        title="Reset toàn bộ dữ liệu hệ thống về 0?"
        description="Hành động này sẽ đặt lại đơn hàng, tồn kho, danh mục mẫu, phiếu nhập kho, cổ đông và chi phí về 0 trên Cloud Firestore (giữ nguyên tài khoản thành viên). Hệ thống sẽ tự động lưu 1 bản sao lưu toàn bộ dữ liệu trước khi reset để bạn có thể khôi phục lại bất cứ lúc nào."
        confirmLabel="Xác nhận Reset về 0"
        onConfirm={handleResetSystemData}
        onCancel={() => setConfirmClearOpen(false)}
      />

      <BackupRestoreModal
        open={backupModalOpen}
        backups={state.backups}
        onClose={() => setBackupModalOpen(false)}
        onRestoreBackup={handleRestoreBackup}
        onDownloadBackupJSON={handleDownloadBackupJSON}
      />

      {aiImportMode && (
        <AiExcelImportModal
          open={Boolean(aiImportMode)}
          mode={aiImportMode}
          existingProducts={state.products}
          onClose={() => setAiImportMode(null)}
          onOpenSettings={() => {
            setAiImportMode(null);
            setSettingsOpen(true);
          }}
          onSaveExpenses={handleSaveAiExpenses}
          onSaveOrders={handleSaveAiOrders}
          onSaveProducts={handleSaveAiProducts}
        />
      )}

      <AccountSettingsModal
        open={settingsOpen}
        currentUser={currentUser}
        accounts={state.accounts}
        hasSystemData={hasAnyData}
        appIcon={state.appIcon || 'Sparkles'}
        onChangeAppIcon={handleUpdateAppIcon}
        onClose={() => setSettingsOpen(false)}
        onChangePin={handleChangePin}
        onCreateAccount={handleCreateAccount}
        onUpdateAccount={handleUpdateAccount}
        onDeleteAccount={handleDeleteAccount}
        onRequestResetSystem={() => setConfirmClearOpen(true)}
        notificationPermission={pwa.notificationPermission}
        isIOS={pwa.isIOS}
        isInstalled={pwa.isInstalled}
        canInstallPrompt={pwa.canInstallPrompt}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((prev) => !prev)}
        onRequestNotificationPermission={pwa.requestNotificationPermission}
        onInstallApp={pwa.installApp}
        onSendTestNotification={handleSendTestNotification}
      />

      <NotificationToast
        items={toastNotifications}
        onDismiss={(id) => setToastNotifications((prev) => prev.filter((t) => t.id !== id))}
        onSelect={(item, tab) => {
          handleMarkNotificationRead(item.id);
          setActiveTab(tab);
          setToastNotifications((prev) => prev.filter((t) => t.id !== item.id));
        }}
      />
    </div>
  );
}

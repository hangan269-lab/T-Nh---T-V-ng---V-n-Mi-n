import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardPaste,
  Clock,
  Download,
  Edit3,
  FileSpreadsheet,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Truck,
  X,
  XCircle,
} from 'lucide-react';
import {
  ALL_BRANDS,
  ALL_SHIPPING_METHODS,
  ALL_SHIPPING_STATUSES,
  ALL_SIZES,
  AppState,
  Brand,
  DEFAULT_PAYERS,
  Order,
  PaymentStatus,
  Product,
  ShippingMethod,
  ShippingStatus,
  SizeOption,
  UserAccount,
} from '../types/erp';
import {
  formatAuditTimestamp,
  formatDateVN,
  formatVND,
  getAvailableStock,
  getOrderCOD,
  getOrderTotal,
  getProductActiveSizes,
  getTodayISO,
  OrderDraftInput,
  OrderShippingUpdate,
  parseVNDInput,
  SaveProductInput,
  ShippingExportFilter,
} from '../utils/finance';
import { getGeminiApiKey, parseCustomerChatWithGemini } from '../utils/gemini';
import { parseQuickOrderText } from '../utils/orderParser';
import { ConfirmModal } from './ConfirmModal';
import { OrderEditModal } from './OrderEditModal';
import {
  OrderExportFormat,
  OrderExportModal,
  OrderExportMode,
} from './OrderExportModal';
import { ProductModal } from './ProductModal';

type OrderFilter = 'all' | 'today' | 'unpaid' | 'paid' | 'vtp_not_sent';

interface OrdersTabProps {
  state: AppState;
  currentUser: UserAccount;
  isCreateOpen: boolean;
  onOpenCreate: () => void;
  onCloseCreate: () => void;
  onCreateOrder: (draft: OrderDraftInput) => { ok: true } | { ok: false; error: string };
  onUpdateOrder: (
    orderId: string,
    draft: OrderDraftInput
  ) => { ok: true } | { ok: false; error: string };
  onDeleteOrder: (orderId: string) => void;
  onConfirmPayment: (orderId: string) => void;
  onCancelOrder: (orderId: string) => void;
  onUpdateOrderShipping: (orderId: string, patch: OrderShippingUpdate) => void;
  onMarkOrdersShippingStatus: (orderIds: string[], status: ShippingStatus) => void;
  onExportOrdersCustom: (params: {
    orders: Order[];
    shippingFilter: ShippingExportFilter;
    mode: OrderExportMode;
    format: OrderExportFormat;
  }) => void;
  onExportViettelPostCSV: (ordersToExport: Order[]) => void;
  onSaveProduct?: (
    input: SaveProductInput
  ) => { ok: true; hasStockAdjustment?: boolean; product?: Product } | { ok: false; error: string };
  onOpenAiExcelImport?: () => void;
  onOpenSettings?: () => void;
}

interface DraftLine {
  key: string;
  productId: string;
  size: SizeOption;
  quantity: number;
  unitPrice: number;
}

export const OrdersTab: React.FC<OrdersTabProps> = ({
  state,
  currentUser,
  isCreateOpen,
  onOpenCreate,
  onCloseCreate,
  onCreateOrder,
  onUpdateOrder,
  onDeleteOrder,
  onConfirmPayment,
  onCancelOrder,
  onUpdateOrderShipping,
  onMarkOrdersShippingStatus,
  onExportOrdersCustom,
  onExportViettelPostCSV,
  onSaveProduct,
  onOpenAiExcelImport,
  onOpenSettings,
}) => {
  const todayISO = getTodayISO();
  const [filter, setFilter] = useState<OrderFilter>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [creatorFilter, setCreatorFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);
  const [fullEditOrder, setFullEditOrder] = useState<Order | null>(null);

  // Export modal state
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportInitialFormat, setExportInitialFormat] = useState<OrderExportFormat>('xlsx');

  // Batch selection & VTP export confirmation
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [vtpPromptOrderIds, setVtpPromptOrderIds] = useState<string[] | null>(null);
  const [exportWarning, setExportWarning] = useState<string | null>(null);

  // Inline shipping edit state
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editAddress, setEditAddress] = useState('');
  const [editMethod, setEditMethod] = useState<ShippingMethod>(ShippingMethod.VIETTEL_POST);
  const [editShopCost, setEditShopCost] = useState('0');
  const [editPayer, setEditPayer] = useState<string>(DEFAULT_PAYERS[0]);
  const [editStatus, setEditStatus] = useState<ShippingStatus>(ShippingStatus.NOT_SENT);
  const [editWeight, setEditWeight] = useState('500');

  // Create order form state
  const [date, setDate] = useState(todayISO);
  const [brand, setBrand] = useState<Brand>(Brand.TO_NHA);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>(
    ShippingMethod.VIETTEL_POST
  );
  const [shippingStatus, setShippingStatus] = useState<ShippingStatus>(ShippingStatus.NOT_SENT);
  const [shopShippingCost, setShopShippingCost] = useState<string>('0');
  const [shippingCostPayer, setShippingCostPayer] = useState<string>(DEFAULT_PAYERS[0]);
  const [weightGrams, setWeightGrams] = useState<string>('500');
  const [shippingFee, setShippingFee] = useState<string>('0');
  const [discount, setDiscount] = useState<string>('');
  const [note, setNote] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(PaymentStatus.UNPAID);
  const [formError, setFormError] = useState<string | null>(null);
  const [quickPasteText, setQuickPasteText] = useState('');
  const [quickParseNotice, setQuickParseNotice] = useState<string | null>(null);
  const [aiParsingOrder, setAiParsingOrder] = useState(false);
  const [quickProductModalOpen, setQuickProductModalOpen] = useState(false);

  const activeProducts = useMemo(
    () => state.products.filter((p) => !p.isArchived),
    [state.products]
  );

  const brandProducts = useMemo(
    () => activeProducts.filter((p) => p.brand === brand),
    [activeProducts, brand]
  );

  const otherBrandProducts = useMemo(
    () => activeProducts.filter((p) => p.brand !== brand),
    [activeProducts, brand]
  );

  const getProductTotalStock = (p: Product): number =>
    getProductActiveSizes(p, state.stockImports, state.orders).reduce(
      (sum, s) => sum + getAvailableStock(p.id, s, state.products, state.stockImports, state.orders),
      0
    );

  const pickBestSizeForProduct = (p: Product, preferred?: SizeOption): SizeOption => {
    if (p.brand === Brand.VAN_MIEN) return 'Freesize';
    const sizes = getProductActiveSizes(p, state.stockImports, state.orders);
    if (preferred && preferred !== 'Freesize') {
      const avail = getAvailableStock(p.id, preferred, state.products, state.stockImports, state.orders);
      if (avail > 0) return preferred;
    }
    const inStockSize = sizes.find(
      (s) => s !== 'Freesize' && getAvailableStock(p.id, s, state.products, state.stockImports, state.orders) > 0
    );
    return inStockSize ?? (preferred && preferred !== 'Freesize' ? preferred : 'M');
  };

  const makeDefaultLine = (targetBrand: Brand): DraftLine => {
    const prods = state.products.filter((p) => p.brand === targetBrand && !p.isArchived);
    const first = prods[0] ?? state.products.find((p) => !p.isArchived);
    const defaultSize: SizeOption = first
      ? pickBestSizeForProduct(first)
      : targetBrand === Brand.VAN_MIEN
        ? 'Freesize'
        : 'M';
    return {
      key: `line_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      productId: first?.id ?? '',
      size: defaultSize,
      quantity: 1,
      unitPrice: first?.sellPrice ?? 0,
    };
  };

  const [lines, setLines] = useState<DraftLine[]>(() => [makeDefaultLine(Brand.TO_NHA)]);

  useEffect(() => {
    if (activeProducts.length === 0) return;
    setLines((prev) => {
      let changed = false;
      const next = prev.map((line) => {
        const currentProduct = activeProducts.find((p) => p.id === line.productId);
        if (currentProduct) return line;
        const fallback = brandProducts[0] ?? activeProducts[0];
        if (!fallback) return line;
        changed = true;
        return {
          ...line,
          productId: fallback.id,
          size: pickBestSizeForProduct(fallback, line.size),
          unitPrice: fallback.sellPrice,
        };
      });
      return changed ? next : prev;
    });
  }, [isCreateOpen, activeProducts, brandProducts]);

  const handleApplyQuickPaste = async (rawInput: string) => {
    const trimmed = rawInput.trim();
    if (!trimmed) {
      setQuickParseNotice(null);
      return;
    }

    const activeProds = state.products.filter((p) => !p.isArchived);
    const apiKey = getGeminiApiKey();

    if (apiKey) {
      setAiParsingOrder(true);
      setQuickParseNotice(null);
      setFormError(null);
      try {
        const parsed = await parseCustomerChatWithGemini(trimmed, activeProds);
        if (parsed.customerName) setCustomerName(parsed.customerName);
        if (parsed.customerPhone) setCustomerPhone(parsed.customerPhone);
        if (parsed.shippingAddress) setShippingAddress(parsed.shippingAddress);
        if (parsed.shippingMethod) setShippingMethod(parsed.shippingMethod);
        if (parsed.brand) setBrand(parsed.brand);
        if (parsed.note) setNote(parsed.note);

        if (parsed.items && parsed.items.length > 0) {
          const newLines: DraftLine[] = parsed.items.map((it, idx) => {
            let prod = activeProds.find((p) => p.id === it.matchedProductId);
            if (!prod) {
              const codeOrName = (it.productCode || it.productName || '').toLowerCase();
              prod =
                activeProds.find((p) => p.code.toLowerCase() === codeOrName) ||
                activeProds.find((p) => p.name.toLowerCase().includes(codeOrName)) ||
                activeProds.find((p) => p.brand === parsed.brand) ||
                activeProds[0];
            }
            return {
              key: `line_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
              productId: prod ? prod.id : (activeProds[0]?.id ?? ''),
              size: it.size,
              quantity: Math.max(1, it.quantity),
              unitPrice: prod ? prod.sellPrice : it.unitPrice,
            };
          });
          setLines(newLines);
        }

        const summaryParts: string[] = [];
        if (parsed.customerName) summaryParts.push(`Khách: ${parsed.customerName}`);
        if (parsed.customerPhone) summaryParts.push(`SĐT: ${parsed.customerPhone}`);
        if (parsed.shippingAddress) summaryParts.push(`Đ/c: ${parsed.shippingAddress}`);
        if (parsed.shippingMethod) summaryParts.push(`Vận chuyển: ${parsed.shippingMethod}`);
        if (parsed.items.length > 0) {
          summaryParts.push(
            `Sản phẩm: ${parsed.items.map((it) => `${it.productName} (x${it.quantity} - ${it.size})`).join(', ')}`
          );
        }

        setQuickParseNotice(
          `✨ AI Gemini 3.8 Flash đã bóc tách & điền tự động: ${summaryParts.join(' · ')}`
        );
        setAiParsingOrder(false);
        return;
      } catch (err: unknown) {
        console.warn('Gemini chat parsing encountered error, falling back to regex:', err);
      } finally {
        setAiParsingOrder(false);
      }
    }

    // Heuristic regex fallback if no Gemini key or network fails:
    const parsed = parseQuickOrderText(trimmed, activeProds);
    setFormError(null);

    if (parsed.customerName) {
      setCustomerName(parsed.customerName);
    }
    if (parsed.customerPhone) {
      setCustomerPhone(parsed.customerPhone);
    }

    const nextBrand = parsed.brand ?? brand;
    if (parsed.brand) {
      setBrand(parsed.brand);
    }

    const matchedProduct = parsed.productId
      ? activeProds.find((p) => p.id === parsed.productId)
      : activeProds.find((p) => p.brand === nextBrand);

    const nextSize: SizeOption =
      parsed.size ?? (nextBrand === Brand.VAN_MIEN ? 'Freesize' : 'M');
    const nextQty = parsed.quantity ?? 1;

    if (matchedProduct) {
      setLines([
        {
          key: `line_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          productId: matchedProduct.id,
          size: nextSize,
          quantity: nextQty,
          unitPrice: matchedProduct.sellPrice,
        },
      ]);
    } else if (parsed.size || parsed.quantity) {
      setLines((prev) =>
        prev.map((l, idx) =>
          idx === 0
            ? {
                ...l,
                size: parsed.size ?? l.size,
                quantity: parsed.quantity ?? l.quantity,
              }
            : l
        )
      );
    }

    if (parsed.matchedFields.length === 0) {
      setQuickParseNotice(
        'Chưa nhận diện được thông tin rõ ràng. Hãy thử dạng: "Chị Lan 0912345678 lấy 1 bộ Tơ Nhã Hoa Mai size M".'
      );
    } else if (parsed.unmatchedProductHint && !parsed.productId) {
      setQuickParseNotice(
        `Đã điền: ${parsed.matchedFields.join(' · ')}. Chưa khớp mẫu trong danh mục — vui lòng chọn lại mẫu phù hợp.`
      );
    } else {
      setQuickParseNotice(`Đã tách & điền tự động: ${parsed.matchedFields.join(' · ')}.`);
    }
  };

  const handleBrandChange = (nextBrand: Brand) => {
    setBrand(nextBrand);
    setLines([makeDefaultLine(nextBrand)]);
    setFormError(null);
  };

  const handleAddLine = () => {
    setLines((prev) => [...prev, makeDefaultLine(brand)]);
  };

  const handleRemoveLine = (key: string) => {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));
  };

  const handleLineProductChange = (key: string, productId: string) => {
    const product = state.products.find((p) => p.id === productId);
    const targetIndex = lines.findIndex((l) => l.key === key);
    if (product && targetIndex === 0 && product.brand !== brand) {
      setBrand(product.brand);
    }
    setFormError(null);
    setLines((prev) =>
      prev.map((l) =>
        l.key === key
          ? {
              ...l,
              productId,
              size: product ? pickBestSizeForProduct(product, l.size) : l.size,
              unitPrice: product ? product.sellPrice : l.unitPrice,
            }
          : l
      )
    );
  };

  const handleLineChange = <K extends keyof DraftLine>(
    key: string,
    field: K,
    value: DraftLine[K]
  ) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  };

  const draftItemsSubtotal = lines.reduce(
    (sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0),
    0
  );
  const parseOptionalDiscount = (raw: string): number => {
    const trimmed = raw.trim();
    if (!trimmed) return 0;
    const parsed = parseVNDInput(trimmed);
    return Number.isNaN(parsed) ? 0 : parsed;
  };
  const draftDiscount = parseOptionalDiscount(discount);
  const effectiveDraftDiscount = Math.max(0, draftDiscount);
  const draftTotal = Math.max(
    0,
    draftItemsSubtotal + (Number(shippingFee) || 0) - effectiveDraftDiscount
  );
  const draftCOD = paymentStatus === PaymentStatus.PAID ? 0 : draftTotal;

  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const res = onCreateOrder({
      date,
      brand,
      customerName,
      customerPhone,
      shippingAddress,
      shippingMethod,
      shopShippingCost: Number(shopShippingCost) || 0,
      shippingCostPayer,
      shippingStatus,
      weightGrams: Number(weightGrams) || 500,
      items: lines.map((l) => ({
        productId: l.productId,
        size: l.size,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
      })),
      shippingFee: Number(shippingFee) || 0,
      discount: draftDiscount,
      note,
      paymentStatus,
    });

    if (!res.ok) {
      setFormError(res.error);
      return;
    }

    // Reset form
    setCustomerName('');
    setCustomerPhone('');
    setShippingAddress('');
    setShippingMethod(ShippingMethod.VIETTEL_POST);
    setShippingStatus(ShippingStatus.NOT_SENT);
    setShopShippingCost('0');
    setWeightGrams('500');
    setShippingFee('0');
    setDiscount('');
    setNote('');
    setPaymentStatus(PaymentStatus.UNPAID);
    setQuickPasteText('');
    setQuickParseNotice(null);
    setLines([makeDefaultLine(brand)]);
    onCloseCreate();
  };

  const vtpNotSentOrders = useMemo(
    () =>
      state.orders.filter(
        (o) =>
          !o.isCancelled &&
          o.shippingMethod === ShippingMethod.VIETTEL_POST &&
          o.shippingStatus === ShippingStatus.NOT_SENT
      ),
    [state.orders]
  );

  const creatorStats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const acc of state.accounts) {
      counts.set(acc.name, 0);
    }
    for (const o of state.orders) {
      if (o.isCancelled) continue;
      const name = o.createdBy || 'Hệ thống';
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
  }, [state.accounts, state.orders]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    for (const o of state.orders) {
      if (o.date && o.date.length >= 7) {
        months.add(o.date.slice(0, 7));
      }
    }
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [state.orders]);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return state.orders.filter((order) => {
      if (filter === 'today' && order.date !== todayISO) return false;
      if (filter === 'unpaid' && (order.isCancelled || order.paymentStatus !== PaymentStatus.UNPAID))
        return false;
      if (filter === 'paid' && (order.isCancelled || order.paymentStatus !== PaymentStatus.PAID))
        return false;
      if (
        filter === 'vtp_not_sent' &&
        (order.isCancelled ||
          order.shippingMethod !== ShippingMethod.VIETTEL_POST ||
          order.shippingStatus !== ShippingStatus.NOT_SENT)
      )
        return false;

      if (monthFilter !== 'all' && !order.date.startsWith(monthFilter)) {
        return false;
      }

      if (creatorFilter !== 'all' && (order.createdBy || 'Hệ thống') !== creatorFilter) {
        return false;
      }

      if (q) {
        const matchName = order.customerName.toLowerCase().includes(q);
        const matchPhone = order.customerPhone.toLowerCase().includes(q);
        const matchCode = order.code.toLowerCase().includes(q);
        const matchAddr = order.shippingAddress.toLowerCase().includes(q);
        const matchCreator = (order.createdBy || '').toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchCode && !matchAddr && !matchCreator) return false;
      }
      return true;
    });
  }, [state.orders, filter, monthFilter, creatorFilter, searchQuery, todayISO]);

  const selectableVisibleIds = useMemo(
    () => filteredOrders.filter((o) => !o.isCancelled).map((o) => o.id),
    [filteredOrders]
  );

  const allVisibleSelected =
    selectableVisibleIds.length > 0 &&
    selectableVisibleIds.every((id) => selectedIds.includes(id));

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !selectableVisibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...selectableVisibleIds])));
    }
  };

  const toggleSelectOne = (orderId: string) => {
    setSelectedIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const handleOpenShippingEdit = (order: Order) => {
    setEditingOrderId(order.id);
    setEditAddress(order.shippingAddress);
    setEditMethod(order.shippingMethod);
    setEditShopCost(String(order.shopShippingCost || 0));
    setEditPayer(order.shippingCostPayer || DEFAULT_PAYERS[0]);
    setEditStatus(order.shippingStatus);
    setEditWeight(String(order.weightGrams || 500));
  };

  const handleSaveShippingEdit = (orderId: string) => {
    onUpdateOrderShipping(orderId, {
      shippingAddress: editAddress,
      shippingMethod: editMethod,
      shopShippingCost: Number(editShopCost) || 0,
      shippingCostPayer: editPayer,
      shippingStatus: editStatus,
      weightGrams: Number(editWeight) || 500,
    });
    setEditingOrderId(null);
  };

  const handleExportVTP = () => {
    setExportWarning(null);
    const tickedOrders = state.orders.filter((o) => !o.isCancelled && selectedIds.includes(o.id));
    const targetOrders = tickedOrders.length > 0 ? tickedOrders : vtpNotSentOrders;

    if (targetOrders.length === 0) {
      setExportWarning(
        'Không có đơn Viettel Post nào ở trạng thái "Chưa gửi" và bạn cũng chưa tick chọn đơn nào.'
      );
      return;
    }

    onExportViettelPostCSV(targetOrders);
    setVtpPromptOrderIds(targetOrders.map((o) => o.id));
  };

  const selectedCount = selectedIds.filter((id) =>
    state.orders.some((o) => o.id === id && !o.isCancelled)
  ).length;

  return (
    <div className="space-y-6">
      {/* Form tạo đơn hàng mới */}
      {isCreateOpen && (
        <section
          aria-labelledby="create-order-heading"
          className="rounded-xl border border-[#0D4F43]/30 bg-white p-6"
        >
          <div className="flex items-center justify-between gap-4 border-b border-[#ECE7DD] pb-4">
            <div>
              <h2 id="create-order-heading" className="font-serif text-xl font-semibold text-[#1A1F1E]">
                Tạo đơn hàng mới
              </h2>
              <p className="mt-0.5 text-xs text-[#57605E]">
                Người tạo đơn: <strong className="text-[#0D4F43]">{currentUser.name}</strong> (tự động ghi nhận theo tài khoản đang đăng nhập) · Tự động trừ tồn kho, tính COD và hạch toán cước VC.
              </p>
            </div>
            <button
              type="button"
              onClick={onCloseCreate}
              aria-label="Đóng biểu mẫu tạo đơn"
              className="rounded-lg p-2 text-[#57605E] transition-colors hover:bg-[#F3EFE6] hover:text-[#1A1F1E]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmitOrder} className="mt-5 space-y-5">
            {formError && (
              <div
                role="alert"
                className="rounded-lg border border-[#A63429]/30 bg-[#A63429]/5 px-4 py-3 text-sm font-medium text-[#A63429]"
              >
                {formError}
              </div>
            )}

            {/* Ô Dán nhanh thông tin khách từ tin nhắn */}
            <div className="rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50/40 via-white to-indigo-50/30 p-4 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="order-quick-paste"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-900"
                >
                  <Sparkles className="h-4 w-4 text-purple-600 animate-pulse" />
                  ✨ Dán tin nhắn chốt đơn (AI tự điền form)
                </label>
                <span className="text-[11px] text-[#57605E]">
                  AI Gemini 3.8 Flash tự động bóc tách Tên, SĐT, Địa chỉ, khớp đúng Mẫu trong kho, Số lượng và Vận chuyển
                </span>
              </div>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-stretch">
                <textarea
                  id="order-quick-paste"
                  rows={2}
                  placeholder="Ví dụ: Hoa 0988111222 số 5 Lý Thường Kiệt lấy 2 set phủ tơ size S với 1 trà phổ nhĩ, gửi VTP"
                  value={quickPasteText}
                  onChange={(e) => setQuickPasteText(e.target.value)}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData('text');
                    if (pasted) {
                      window.setTimeout(() => {
                        handleApplyQuickPaste(
                          (document.getElementById('order-quick-paste') as HTMLTextAreaElement)
                            ?.value || pasted
                        );
                      }, 0);
                    }
                  }}
                  className="flex-1 rounded-lg border border-purple-200 bg-white px-3 py-2 text-sm text-[#1A1F1E] placeholder:text-[#8A918E] focus:border-purple-600 focus:ring-1 focus:ring-purple-600 focus:outline-none"
                />
                <div className="flex gap-2 sm:flex-col sm:justify-center">
                  <button
                    type="button"
                    onClick={() => handleApplyQuickPaste(quickPasteText)}
                    disabled={aiParsingOrder || !quickPasteText.trim()}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:from-purple-700 hover:to-indigo-700 disabled:opacity-45 whitespace-nowrap shrink-0"
                  >
                    {aiParsingOrder ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Đang bóc tách...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>AI Tự điền form</span>
                      </>
                    )}
                  </button>
                  {quickPasteText && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuickPasteText('');
                        setQuickParseNotice(null);
                      }}
                      className="rounded-lg border border-[#E4DFD5] bg-white px-3 py-1 text-xs font-medium text-[#57605E] hover:bg-[#F3EFE6] whitespace-nowrap shrink-0"
                    >
                      Xóa ô dán
                    </button>
                  )}
                </div>
              </div>
              {aiParsingOrder && (
                <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-purple-100/60 px-3 py-1.5 text-xs font-medium text-purple-900">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-600" />
                  <span>Đang dùng AI đọc và chuẩn hóa dữ liệu...</span>
                </div>
              )}
              {quickParseNotice && !aiParsingOrder && (
                <p role="status" className="mt-2 text-xs font-medium text-purple-900 bg-purple-50 rounded-lg p-2 border border-purple-200/60">
                  {quickParseNotice}
                </p>
              )}
            </div>

            {/* Thông tin khách hàng & giao nhận */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label htmlFor="order-date" className="block text-xs font-medium text-[#57605E]">
                  Ngày đặt
                </label>
                <input
                  id="order-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-sm text-[#1A1F1E] focus:border-[#0D4F43] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label htmlFor="order-brand" className="block text-xs font-medium text-[#57605E]">
                  Nhánh thương hiệu
                </label>
                <select
                  id="order-brand"
                  value={brand}
                  onChange={(e) => handleBrandChange(e.target.value as Brand)}
                  className="mt-1.5 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-sm text-[#1A1F1E] focus:border-[#0D4F43] focus:outline-none"
                >
                  {ALL_BRANDS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="order-customer-name" className="block text-xs font-medium text-[#57605E]">
                  Tên người nhận
                </label>
                <input
                  id="order-customer-name"
                  type="text"
                  placeholder="Ví dụ: Nguyễn Minh Châu"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-sm text-[#1A1F1E] focus:border-[#0D4F43] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label htmlFor="order-customer-phone" className="block text-xs font-medium text-[#57605E]">
                  Số điện thoại
                </label>
                <input
                  id="order-customer-phone"
                  type="tel"
                  placeholder="0912 345 678"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-sm text-[#1A1F1E] focus:border-[#0D4F43] focus:outline-none"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="order-address" className="block text-xs font-medium text-[#57605E]">
                  Địa chỉ giao hàng <span className="text-[#A63429]">*</span>
                </label>
                <input
                  id="order-address"
                  type="text"
                  placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố"
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-sm text-[#1A1F1E] focus:border-[#0D4F43] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label htmlFor="order-shipping-method" className="block text-xs font-medium text-[#57605E]">
                  Hình thức vận chuyển
                </label>
                <select
                  id="order-shipping-method"
                  value={shippingMethod}
                  onChange={(e) => {
                    const m = e.target.value as ShippingMethod;
                    setShippingMethod(m);
                    if (m === ShippingMethod.PICKUP) {
                      setShippingStatus(ShippingStatus.DELIVERED);
                    }
                  }}
                  className="mt-1.5 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-sm text-[#1A1F1E] focus:border-[#0D4F43] focus:outline-none"
                >
                  {ALL_SHIPPING_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="order-shipping-status" className="block text-xs font-medium text-[#57605E]">
                  Trạng thái gửi hàng
                </label>
                <select
                  id="order-shipping-status"
                  value={shippingStatus}
                  onChange={(e) => setShippingStatus(e.target.value as ShippingStatus)}
                  className="mt-1.5 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-sm text-[#1A1F1E] focus:border-[#0D4F43] focus:outline-none"
                >
                  {ALL_SHIPPING_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Danh sách mẫu đặt */}
            <div className="border-t border-[#ECE7DD] pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-semibold text-[#1A1F1E]">
                    Sản phẩm trong đơn ({lines.length})
                  </span>
                  <span className="ml-2 text-[11px] text-[#57605E]">
                    Chọn mẫu sẽ tự động điền giá bán và trừ tồn kho khi lưu đơn
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {onSaveProduct && (
                    <button
                      type="button"
                      onClick={() => setQuickProductModalOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#0D4F43]/30 bg-white px-3 py-1.5 text-xs font-medium text-[#0D4F43] transition-colors hover:bg-[#0D4F43]/5 whitespace-nowrap shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Thêm nhanh mẫu mới
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4DFD5] bg-[#FAF8F4] px-3 py-1.5 text-xs font-medium text-[#0D4F43] transition-colors hover:bg-[#F3EFE6] whitespace-nowrap shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Thêm mẫu khác
                  </button>
                </div>
              </div>

              {activeProducts.length === 0 ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#B45309]/25 bg-[#FEF3C7]/40 px-4 py-3 text-xs text-[#92400E]">
                  <span>
                    Kho hàng hiện chưa có mẫu sản phẩm nào. Hãy bấm <strong>&ldquo;Thêm nhanh mẫu mới&rdquo;</strong> ngay bên cạnh hoặc tạo mẫu ở tab Kho hàng &amp; Mẫu.
                  </span>
                  {onSaveProduct && (
                    <button
                      type="button"
                      onClick={() => setQuickProductModalOpen(true)}
                      className="inline-flex items-center gap-1 rounded-md bg-[#0D4F43] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#093B32] whitespace-nowrap shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Tạo mẫu ngay
                    </button>
                  )}
                </div>
              ) : (
                brandProducts.length === 0 && (
                  <p className="mt-3 rounded-lg border border-[#E4DFD5] bg-[#FAF8F4] px-4 py-2.5 text-xs text-[#57605E]">
                    Nhánh <strong className="text-[#1A1F1E]">{brand}</strong> chưa có mẫu nào — bạn có thể chọn mẫu từ các nhánh khác ngay trong ô chọn mẫu bên dưới hoặc thêm mẫu mới.
                  </p>
                )
              )}

              <div className="mt-3 space-y-3">
                {lines.map((line, index) => {
                  const selectedProduct = activeProducts.find((p) => p.id === line.productId);
                  const available = line.productId
                    ? getAvailableStock(
                        line.productId,
                        line.size,
                        state.products,
                        state.stockImports,
                        state.orders
                      )
                    : 0;
                  const qtyNum = Number(line.quantity) || 0;
                  const unitPriceNum = Number(line.unitPrice) || 0;
                  const lineTotal = qtyNum * unitPriceNum;
                  const remainingAfterOrder = available - qtyNum;
                  const productStockBreakdown = selectedProduct
                    ? getProductActiveSizes(selectedProduct, state.stockImports, state.orders)
                        .map(
                          (s) =>
                            `${s}:${getAvailableStock(
                              selectedProduct.id,
                              s,
                              state.products,
                              state.stockImports,
                              state.orders
                            )}`
                        )
                        .join(' · ')
                    : '';

                  return (
                    <div
                      key={line.key}
                      className="rounded-lg border border-[#ECE7DD] bg-[#FAF8F4]/70 p-3 space-y-2"
                    >
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2.5fr)_minmax(0,1.1fr)_84px_125px_155px_36px] lg:items-end">
                        <div className="sm:col-span-2 lg:col-span-1">
                          <label
                            htmlFor={`line-product-${line.key}`}
                            className="block text-xs font-medium text-[#57605E]"
                          >
                            Ô chọn mẫu sản phẩm #{index + 1}
                          </label>
                          <select
                            id={`line-product-${line.key}`}
                            value={line.productId}
                            onChange={(e) => handleLineProductChange(line.key, e.target.value)}
                            className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-sm text-[#1A1F1E] focus:border-[#0D4F43] focus:outline-none"
                          >
                            <option value="">
                              {activeProducts.length === 0
                                ? '-- Chưa có mẫu trong kho --'
                                : '-- Chọn mẫu sản phẩm --'}
                            </option>
                            {brandProducts.length > 0 && (
                              <optgroup label={`Nhánh ${brand}`}>
                                {brandProducts.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.code} — {p.name} ({formatVND(p.sellPrice)} · Tồn: {getProductTotalStock(p)})
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {otherBrandProducts.length > 0 && (
                              <optgroup label="Mẫu nhánh khác">
                                {otherBrandProducts.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    [{p.brand}] {p.code} — {p.name} ({formatVND(p.sellPrice)} · Tồn: {getProductTotalStock(p)})
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                        </div>

                        <div>
                          <label
                            htmlFor={`line-size-${line.key}`}
                            className="block text-xs font-medium text-[#57605E]"
                          >
                            Size (Tồn: <span className="font-mono font-semibold text-[#1A1F1E]">{available}</span>)
                          </label>
                          <select
                            id={`line-size-${line.key}`}
                            value={line.size}
                            onChange={(e) =>
                              handleLineChange(line.key, 'size', e.target.value as SizeOption)
                            }
                            className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-sm text-[#1A1F1E] focus:border-[#0D4F43] focus:outline-none"
                          >
                            {ALL_SIZES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label
                            htmlFor={`line-qty-${line.key}`}
                            className="block text-xs font-medium text-[#57605E]"
                          >
                            Số lượng
                          </label>
                          <input
                            id={`line-qty-${line.key}`}
                            type="number"
                            min={1}
                            value={line.quantity}
                            onChange={(e) =>
                              handleLineChange(line.key, 'quantity', Number(e.target.value))
                            }
                            className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 font-mono text-sm text-[#1A1F1E] tabular-nums focus:border-[#0D4F43] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor={`line-price-${line.key}`}
                            className="block text-xs font-medium text-[#57605E]"
                          >
                            Giá bán niêm yết (đ)
                          </label>
                          <input
                            id={`line-price-${line.key}`}
                            type="number"
                            min={0}
                            value={line.unitPrice}
                            onChange={(e) =>
                              handleLineChange(line.key, 'unitPrice', Number(e.target.value))
                            }
                            className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 font-mono text-sm text-[#1A1F1E] tabular-nums focus:border-[#0D4F43] focus:outline-none"
                          />
                        </div>

                        <div>
                          <span className="block text-xs font-medium text-[#57605E]">
                            Thành tiền (SL × Giá)
                          </span>
                          <div
                            data-testid={`line-subtotal-${index}`}
                            className="mt-1 w-full rounded-lg border border-[#0D4F43]/25 bg-[#0D4F43]/5 px-3 py-2 text-right font-mono text-sm font-semibold text-[#0D4F43] tabular-nums"
                          >
                            {formatVND(lineTotal)}
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(line.key)}
                            disabled={lines.length === 1}
                            aria-label={`Xóa dòng sản phẩm #${index + 1}`}
                            className="rounded-lg p-2 text-[#57605E] transition-colors hover:bg-[#A63429]/10 hover:text-[#A63429] disabled:opacity-35"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {selectedProduct && (
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E4DFD5]/70 pt-2 text-[11px]">
                          <span className="text-[#57605E]">
                            Tồn kho <strong className="text-[#1A1F1E]">{selectedProduct.code}</strong>:{' '}
                            <span className="font-mono">{productStockBreakdown}</span>
                            <span className="mx-1.5 text-[#C7C0B3]">|</span>
                            Đơn giá: <span className="font-mono">{qtyNum} × {formatVND(unitPriceNum)} = <strong className="text-[#0D4F43]">{formatVND(lineTotal)}</strong></span>
                          </span>
                          {qtyNum > 0 && remainingAfterOrder >= 0 ? (
                            <span className="font-medium text-[#0D4F43]">
                              Tồn Size {line.size} sẽ tự điều chỉnh sau khi tạo đơn:{' '}
                              <span className="font-mono font-semibold tabular-nums">
                                {available} → {remainingAfterOrder}
                              </span>
                            </span>
                          ) : (
                            <span className="font-semibold text-[#A63429]">
                              Tồn kho Size {line.size} chỉ còn {available} (không đủ cho SL {qtyNum})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Thanh toán, Giảm giá & Cước vận chuyển */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label htmlFor="order-shipping" className="block text-xs font-medium text-[#57605E]">
                  Phí ship khách trả (đ)
                </label>
                <input
                  id="order-shipping"
                  type="number"
                  min={0}
                  value={shippingFee}
                  onChange={(e) => setShippingFee(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 font-mono text-sm text-[#1A1F1E] tabular-nums focus:border-[#0D4F43] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="order-discount" className="block text-xs font-medium text-[#57605E]">
                  Giảm giá (đ) <span className="font-normal text-[#8A918E]">(Tuỳ chọn khi có KM)</span>
                </label>
                <input
                  id="order-discount"
                  type="text"
                  inputMode="numeric"
                  placeholder="0 (Để trống nếu không KM)"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 font-mono text-sm text-[#1A1F1E] placeholder:font-sans placeholder:text-xs placeholder:text-[#8A918E] tabular-nums focus:border-[#0D4F43] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="order-shop-shipping-cost" className="block text-xs font-medium text-[#57605E]">
                  Cước VC shop trả (đ)
                </label>
                <input
                  id="order-shop-shipping-cost"
                  type="number"
                  min={0}
                  value={shopShippingCost}
                  onChange={(e) => setShopShippingCost(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 font-mono text-sm text-[#1A1F1E] tabular-nums focus:border-[#0D4F43] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="order-shipping-payer" className="block text-xs font-medium text-[#57605E]">
                  Người ứng chi cước
                </label>
                <select
                  id="order-shipping-payer"
                  value={shippingCostPayer}
                  onChange={(e) => setShippingCostPayer(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-sm text-[#1A1F1E] focus:border-[#0D4F43] focus:outline-none"
                >
                  {DEFAULT_PAYERS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="order-weight" className="block text-xs font-medium text-[#57605E]">
                  Trọng lượng (gram)
                </label>
                <input
                  id="order-weight"
                  type="number"
                  min={1}
                  value={weightGrams}
                  onChange={(e) => setWeightGrams(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 font-mono text-sm text-[#1A1F1E] tabular-nums focus:border-[#0D4F43] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="order-payment-status" className="block text-xs font-medium text-[#57605E]">
                  Trạng thái thanh toán
                </label>
                <select
                  id="order-payment-status"
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                  className="mt-1.5 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-sm text-[#1A1F1E] focus:border-[#0D4F43] focus:outline-none"
                >
                  <option value={PaymentStatus.UNPAID}>Chưa thanh toán</option>
                  <option value={PaymentStatus.PAID}>Đã thanh toán</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="order-note" className="block text-xs font-medium text-[#57605E]">
                  Ghi chú đơn hàng
                </label>
                <input
                  id="order-note"
                  type="text"
                  placeholder="Ghi chú giao hàng, số đo..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-sm text-[#1A1F1E] focus:border-[#0D4F43] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#ECE7DD] pt-4">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[#57605E]">
                <div>
                  Tiền hàng:{' '}
                  <span className="font-mono font-medium text-[#1A1F1E] tabular-nums">
                    {formatVND(draftItemsSubtotal)}
                  </span>
                </div>
                {effectiveDraftDiscount > 0 && (
                  <div>
                    Giảm giá:{' '}
                    <span className="font-mono font-medium text-[#A63429] tabular-nums">
                      -{formatVND(effectiveDraftDiscount)}
                    </span>
                  </div>
                )}
                <div>
                  Tổng giá trị đơn:{' '}
                  <span
                    data-testid="draft-order-total"
                    className="font-mono text-lg font-semibold text-[#1A1F1E] tabular-nums"
                  >
                    {formatVND(draftTotal)}
                  </span>
                </div>
                <div>
                  Tiền thu hộ (COD):{' '}
                  <span
                    data-testid="draft-order-cod"
                    className={`font-mono text-lg font-semibold tabular-nums ${
                      draftCOD > 0 ? 'text-[#B45309]' : 'text-[#0D4F43]'
                    }`}
                  >
                    {formatVND(draftCOD)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onCloseCreate}
                  className="rounded-lg border border-[#E4DFD5] bg-white px-4 py-2 text-sm font-medium text-[#1A1F1E] transition-colors hover:bg-[#FAF8F4] whitespace-nowrap shrink-0"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#0D4F43] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#093B32] whitespace-nowrap shrink-0"
                >
                  Lưu đơn hàng
                </button>
              </div>
            </div>
          </form>
        </section>
      )}

      {/* Bộ lọc & Danh sách đơn hàng */}
      <section aria-labelledby="orders-list-heading" className="rounded-xl border border-[#E4DFD5] bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#ECE7DD] pb-4">
          <div>
            <h2 id="orders-list-heading" className="font-serif text-xl font-semibold text-[#1A1F1E]">
              Danh sách đơn hàng
            </h2>
            <p className="mt-0.5 text-xs text-[#57605E]">
              Hiển thị {filteredOrders.length} / {state.orders.length} đơn hàng ·{' '}
              <span className="font-medium text-[#0D4F43]">
                {vtpNotSentOrders.length} đơn Viettel Post chưa gửi
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportVTP}
              className="inline-flex items-center gap-2 rounded-lg bg-[#A63429] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#8B2920] whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="h-4 w-4" />
              {selectedCount > 0
                ? `Xuất file Excel/CSV Viettel Post (${selectedCount} đơn đã chọn)`
                : `Xuất file Excel/CSV Viettel Post (${vtpNotSentOrders.length} đơn chưa gửi)`}
            </button>
            <button
              type="button"
              onClick={() => {
                setExportInitialFormat('xlsx');
                setExportModalOpen(true);
              }}
              disabled={state.orders.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-[#166534] px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-[#14532D] disabled:opacity-45 whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Xuất Excel Đơn hàng
            </button>
            <button
              type="button"
              onClick={() => {
                setExportInitialFormat('csv');
                setExportModalOpen(true);
              }}
              disabled={state.orders.length === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-[#E4DFD5] bg-white px-3.5 py-2 text-xs font-medium text-[#1A1F1E] transition-colors hover:bg-[#FAF8F4] disabled:opacity-45 whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              Xuất CSV
            </button>
            {onOpenAiExcelImport && (
              <button
                type="button"
                onClick={onOpenAiExcelImport}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:from-purple-700 hover:to-indigo-700 whitespace-nowrap shrink-0"
              >
                <Sparkles className="h-4 w-4" />
                ✨ Nhập nhanh từ Excel (AI)
              </button>
            )}
            {!isCreateOpen && (
              <button
                type="button"
                onClick={onOpenCreate}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0D4F43] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#093B32] whitespace-nowrap shrink-0"
              >
                <Plus className="h-4 w-4" />
                Tạo đơn mới
              </button>
            )}
          </div>
        </div>

        {exportWarning && (
          <div
            role="alert"
            className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-[#B45309]/30 bg-[#FEF3C7]/70 px-4 py-2.5 text-xs font-medium text-[#92400E]"
          >
            <span>{exportWarning}</span>
            <button
              type="button"
              onClick={() => setExportWarning(null)}
              aria-label="Đóng cảnh báo xuất file"
              className="rounded p-1 hover:bg-black/5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Filter bar + Member filter + Search */}
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div
              className="flex flex-wrap items-center gap-1 rounded-lg bg-[#F3EFE6] p-1"
              role="group"
              aria-label="Bộ lọc đơn hàng"
            >
              {(
                [
                  { id: 'all', label: 'Tất cả' },
                  { id: 'today', label: 'Hôm nay' },
                  { id: 'vtp_not_sent', label: 'Đơn Viettel Post chưa gửi' },
                  { id: 'unpaid', label: 'Chưa thanh toán' },
                  { id: 'paid', label: 'Đã thanh toán' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={filter === tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={`rounded-md px-3 py-1.5 text-xs whitespace-nowrap shrink-0 ${
                    filter === tab.id
                      ? 'bg-white font-semibold text-[#0D4F43] shadow-xs border border-[#E4DFD5]'
                      : 'font-medium text-[#57605E] hover:text-[#1A1F1E] border border-transparent'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              <select
                aria-label="Lọc đơn theo tháng"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-xs font-medium text-[#1A1F1E] focus:border-[#0D4F43] focus:outline-none"
              >
                <option value="all">Tất cả các tháng</option>
                {availableMonths.map((ym) => {
                  const [y, m] = ym.split('-');
                  return (
                    <option key={ym} value={ym}>
                      Tháng {m}/{y}
                    </option>
                  );
                })}
              </select>

              <div className="relative flex-1 sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#57605E]" />
                <input
                  type="search"
                  aria-label="Tìm theo tên, SĐT, địa chỉ, người tạo hoặc mã đơn"
                  placeholder="Tìm tên, SĐT, địa chỉ, mã đơn..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-[#E4DFD5] bg-[#FAF8F4] py-2 pl-9 pr-3 text-sm text-[#1A1F1E] placeholder:text-[#8A918E] focus:border-[#0D4F43] focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-[#57605E]">Lọc theo người tạo đơn:</span>
            <div
              className="flex flex-wrap items-center gap-1 rounded-lg bg-[#F3EFE6] p-1"
              role="group"
              aria-label="Lọc đơn theo thành viên"
            >
              <button
                type="button"
                aria-pressed={creatorFilter === 'all'}
                onClick={() => setCreatorFilter('all')}
                className={`rounded-md px-2.5 py-1 text-xs whitespace-nowrap shrink-0 ${
                  creatorFilter === 'all'
                    ? 'bg-white font-semibold text-[#0D4F43] shadow-xs border border-[#E4DFD5]'
                    : 'font-medium text-[#57605E] hover:text-[#1A1F1E] border border-transparent'
                }`}
              >
                Tất cả ({state.orders.filter((o) => !o.isCancelled).length})
              </button>
              {creatorStats.map((m) => (
                <button
                  key={m.name}
                  type="button"
                  aria-pressed={creatorFilter === m.name}
                  onClick={() => setCreatorFilter(m.name)}
                  className={`rounded-md px-2.5 py-1 text-xs whitespace-nowrap shrink-0 ${
                    creatorFilter === m.name
                      ? 'bg-white font-semibold text-[#0D4F43] shadow-xs border border-[#E4DFD5]'
                      : 'font-medium text-[#57605E] hover:text-[#1A1F1E] border border-transparent'
                  }`}
                >
                  {m.name} ({m.count})
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Orders table */}
        {filteredOrders.length === 0 ? (
          <div className="mt-6 rounded-lg bg-[#FAF8F4] px-6 py-10 text-center">
            <p className="text-sm font-medium text-[#1A1F1E]">Không có đơn hàng nào phù hợp</p>
            <p className="mt-1 text-xs text-[#57605E]">
              Thử đổi bộ lọc hoặc nhấn "Tạo đơn mới" để ghi nhận đơn hàng mới.
            </p>
            {!isCreateOpen && (
              <button
                type="button"
                onClick={onOpenCreate}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#0D4F43] px-4 py-2 text-xs font-medium text-white hover:bg-[#093B32]"
              >
                <Plus className="h-3.5 w-3.5" />
                Tạo đơn mới
              </button>
            )}
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[940px] text-left text-xs">
              <thead>
                <tr className="border-b border-[#E4DFD5] text-xs font-semibold text-[#57605E]">
                  <th className="py-3 pr-1.5 w-7">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      aria-label="Chọn tất cả đơn hàng đang hiển thị"
                      className="h-4 w-4 rounded border-[#E4DFD5] accent-[#0D4F43]"
                    />
                  </th>
                  <th className="py-3 pr-2">Mã / Ngày</th>
                  <th className="py-3 px-2">Người tạo</th>
                  <th className="py-3 px-2">Khách hàng &amp; Địa chỉ</th>
                  <th className="py-3 px-2">Nhánh &amp; Sản phẩm</th>
                  <th className="py-3 px-2">Vận chuyển &amp; Cước</th>
                  <th className="py-3 px-2 text-right">Tổng thu / COD</th>
                  <th className="py-3 px-2">Thanh toán</th>
                  <th className="py-3 pl-2 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECE7DD]">
                {filteredOrders.map((order) => {
                  const total = getOrderTotal(order);
                  const cod = getOrderCOD(order);
                  const isPaid = order.paymentStatus === PaymentStatus.PAID;
                  const isChecked = selectedIds.includes(order.id);
                  const isEditingThis = editingOrderId === order.id;

                  return (
                    <React.Fragment key={order.id}>
                      <tr
                        className={`transition-colors hover:bg-[#FAF8F4] ${
                          order.isCancelled ? 'bg-[#FAF8F4]/60 opacity-60' : ''
                        }`}
                      >
                        <td className="py-3.5 pr-1.5 align-top">
                          <input
                            type="checkbox"
                            disabled={order.isCancelled}
                            checked={isChecked}
                            onChange={() => toggleSelectOne(order.id)}
                            aria-label={`Chọn đơn ${order.code}`}
                            className="mt-0.5 h-4 w-4 rounded border-[#E4DFD5] accent-[#0D4F43] disabled:opacity-35"
                          />
                        </td>

                        <td className="py-3.5 pr-2 align-top whitespace-nowrap">
                          <div className="font-mono text-xs font-semibold text-[#1A1F1E]">
                            {order.code}
                          </div>
                          <div className="mt-0.5 font-mono text-[11px] text-[#57605E] tabular-nums">
                            {formatDateVN(order.date)}
                          </div>
                        </td>

                        <td className="py-3.5 px-2 align-top whitespace-nowrap">
                          <div className="text-xs font-semibold text-[#1A1F1E]">
                            {order.createdBy || 'Hệ thống'}
                          </div>
                          <div className="mt-0.5 text-[11px] text-[#57605E]">Người tạo</div>
                        </td>

                        <td className="py-3.5 px-2 align-top max-w-[165px] break-words">
                          <div className="text-xs font-medium text-[#1A1F1E]">{order.customerName}</div>
                          <div className="mt-0.5 font-mono text-[11px] text-[#57605E]">
                            {order.customerPhone}
                          </div>
                          {order.shippingAddress && (
                            <div className="mt-1 text-[11px] leading-snug text-[#57605E]">
                              {order.shippingAddress}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-2 align-top max-w-[185px] break-words">
                          <div className="text-xs font-semibold text-[#0D4F43]">
                            {order.brand} · <span className="font-mono text-[#57605E]">{order.weightGrams || 500}g</span>
                          </div>
                          <ul className="mt-1 space-y-0.5 text-xs text-[#1A1F1E]">
                            {order.items.map((item, idx) => (
                              <li key={`${order.id}_${idx}`}>
                                <span className="font-mono">{item.productCode}</span> ·{' '}
                                {item.productName} (Size {item.size}) ×{' '}
                                <span className="font-mono font-semibold">{item.quantity}</span>
                              </li>
                            ))}
                          </ul>
                          {order.note && (
                            <div className="mt-1 text-[11px] italic text-[#57605E]">
                              Ghi chú: {order.note}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-2 align-top">
                          <div className="inline-flex items-center gap-1 text-xs font-medium text-[#1A1F1E] whitespace-nowrap">
                            <Truck className="h-3.5 w-3.5 text-[#57605E]" />
                            {order.shippingMethod}
                          </div>
                          <div className="mt-1">
                            {!order.isCancelled ? (
                              <select
                                aria-label={`Trạng thái gửi hàng đơn ${order.code}`}
                                value={order.shippingStatus}
                                onChange={(e) =>
                                  onUpdateOrderShipping(order.id, {
                                    shippingStatus: e.target.value as ShippingStatus,
                                  })
                                }
                                className={`rounded border px-1.5 py-0.5 text-[11px] font-medium focus:outline-none ${
                                  order.shippingStatus === ShippingStatus.DELIVERED
                                    ? 'border-[#0D4F43]/30 bg-[#0D4F43]/10 text-[#0D4F43]'
                                    : order.shippingStatus === ShippingStatus.VTP_CREATED
                                      ? 'border-[#1D4ED8]/30 bg-[#EFF6FF] text-[#1E40AF]'
                                      : 'border-[#E4DFD5] bg-[#FAF8F4] text-[#57605E]'
                                }`}
                              >
                                {ALL_SHIPPING_STATUSES.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-[11px] text-[#57605E]">{order.shippingStatus}</span>
                            )}
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[#57605E]">
                            <span className="whitespace-nowrap">
                              Cước:{' '}
                              <span className="font-mono font-medium text-[#1A1F1E] tabular-nums">
                                {formatVND(order.shopShippingCost || 0)}
                              </span>
                            </span>
                            {!order.isCancelled && (
                              <button
                                type="button"
                                onClick={() =>
                                  isEditingThis
                                    ? setEditingOrderId(null)
                                    : handleOpenShippingEdit(order)
                                }
                                aria-label={`Chỉnh sửa vận chuyển đơn ${order.code}`}
                                className="inline-flex items-center gap-0.5 text-[11px] font-medium text-[#0D4F43] hover:underline whitespace-nowrap"
                              >
                                <Edit3 className="h-3 w-3" />
                                Sửa VC
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-2 text-right align-top whitespace-nowrap">
                          <div className="font-mono text-xs font-semibold text-[#1A1F1E] tabular-nums">
                            {formatVND(total)}
                          </div>
                          {(order.discount || 0) > 0 && (
                            <div className="mt-0.5 font-mono text-[11px] text-[#0D4F43] tabular-nums">
                              Giảm: -{formatVND(order.discount || 0)}
                            </div>
                          )}
                          <div
                            className={`mt-0.5 font-mono text-[11px] tabular-nums ${
                              cod > 0 ? 'font-semibold text-[#B45309]' : 'text-[#57605E]'
                            }`}
                          >
                            COD: {formatVND(cod)}
                          </div>
                        </td>

                        <td className="py-3.5 px-2 align-top max-w-[130px]">
                          {order.isCancelled ? (
                            <div>
                              <span className="inline-flex items-center gap-1 rounded bg-[#F3EFE6] px-2 py-1 text-[11px] font-medium text-[#57605E] whitespace-nowrap">
                                <XCircle className="h-3 w-3 shrink-0" />
                                Đã hủy đơn
                              </span>
                              {order.cancelledBy && (
                                <div className="mt-1 text-[10px] leading-snug text-[#57605E]">
                                  Hủy bởi <strong className="text-[#1A1F1E]">{order.cancelledBy}</strong>
                                  {order.cancelledAt ? ` · ${formatAuditTimestamp(order.cancelledAt)}` : ''}
                                </div>
                              )}
                            </div>
                          ) : isPaid ? (
                            <div>
                              <span className="inline-flex items-center gap-1 rounded bg-[#0D4F43]/10 px-2 py-1 text-[11px] font-medium text-[#0D4F43] whitespace-nowrap">
                                <CheckCircle2 className="h-3 w-3 shrink-0" />
                                Đã thanh toán
                              </span>
                              {order.paymentConfirmedBy && (
                                <div className="mt-1 text-[10px] leading-snug text-[#57605E]">
                                  Xác nhận bởi{' '}
                                  <strong className="text-[#1A1F1E]">{order.paymentConfirmedBy}</strong>
                                  {order.paymentConfirmedAt
                                    ? ` · ${formatAuditTimestamp(order.paymentConfirmedAt)}`
                                    : ''}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-[#FEF3C7] px-2 py-1 text-[11px] font-medium text-[#92400E] whitespace-nowrap">
                              <Clock className="h-3 w-3 shrink-0" />
                              Chưa thanh toán
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 pl-2 text-right align-top">
                          <div className="flex flex-col items-end gap-1.5">
                            {!order.isCancelled && !isPaid && (
                              <button
                                type="button"
                                onClick={() => onConfirmPayment(order.id)}
                                className="rounded-md bg-[#0D4F43] px-2 py-1 text-[11px] font-medium text-white transition-colors hover:bg-[#093B32] whitespace-nowrap shrink-0"
                              >
                                Xác nhận đã thanh toán
                              </button>
                            )}
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setFullEditOrder(order)}
                                aria-label={`Sửa đơn ${order.code}`}
                                className="inline-flex items-center gap-1 rounded-md border border-[#E4DFD5] bg-white px-2 py-1 text-[11px] font-medium text-[#1A1F1E] transition-colors hover:bg-[#FAF8F4] whitespace-nowrap shrink-0"
                              >
                                <Edit3 className="h-3 w-3" />
                                Sửa đơn
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(order)}
                                aria-label={`Xóa đơn ${order.code}`}
                                className="inline-flex items-center gap-1 rounded-md border border-[#E4DFD5] bg-white px-2 py-1 text-[11px] font-medium text-[#A63429] transition-colors hover:border-[#A63429]/40 hover:bg-[#A63429]/5 whitespace-nowrap shrink-0"
                              >
                                <Trash2 className="h-3 w-3" />
                                Xóa đơn
                              </button>
                            </div>
                            {!order.isCancelled && (
                              <button
                                type="button"
                                onClick={() => setCancelTarget(order)}
                                aria-label={`Hủy đơn ${order.code}`}
                                className="text-[11px] font-medium text-[#57605E] underline-offset-2 hover:text-[#A63429] hover:underline whitespace-nowrap shrink-0"
                              >
                                Hủy đơn (giữ lịch sử)
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Inline editor row for shipping cost / address / weight */}
                      {isEditingThis && (
                        <tr className="bg-[#FAF8F4]">
                          <td colSpan={9} className="px-4 py-4">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6 sm:items-end">
                              <div className="lg:col-span-2">
                                <label
                                  htmlFor={`edit-addr-${order.id}`}
                                  className="block text-xs font-medium text-[#57605E]"
                                >
                                  Địa chỉ giao hàng
                                </label>
                                <input
                                  id={`edit-addr-${order.id}`}
                                  type="text"
                                  value={editAddress}
                                  onChange={(e) => setEditAddress(e.target.value)}
                                  className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-1.5 text-xs focus:border-[#0D4F43] focus:outline-none"
                                />
                              </div>

                              <div>
                                <label
                                  htmlFor={`edit-method-${order.id}`}
                                  className="block text-xs font-medium text-[#57605E]"
                                >
                                  Hình thức VC
                                </label>
                                <select
                                  id={`edit-method-${order.id}`}
                                  value={editMethod}
                                  onChange={(e) => setEditMethod(e.target.value as ShippingMethod)}
                                  className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-1.5 text-xs focus:border-[#0D4F43] focus:outline-none"
                                >
                                  {ALL_SHIPPING_METHODS.map((m) => (
                                    <option key={m} value={m}>
                                      {m}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label
                                  htmlFor={`edit-cost-${order.id}`}
                                  className="block text-xs font-medium text-[#57605E]"
                                >
                                  Cước VC shop trả (đ)
                                </label>
                                <input
                                  id={`edit-cost-${order.id}`}
                                  type="number"
                                  min={0}
                                  value={editShopCost}
                                  onChange={(e) => setEditShopCost(e.target.value)}
                                  className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-1.5 font-mono text-xs tabular-nums focus:border-[#0D4F43] focus:outline-none"
                                />
                              </div>

                              <div>
                                <label
                                  htmlFor={`edit-payer-${order.id}`}
                                  className="block text-xs font-medium text-[#57605E]"
                                >
                                  Người chi &amp; Gram
                                </label>
                                <div className="mt-1 grid grid-cols-2 gap-1.5">
                                  <select
                                    id={`edit-payer-${order.id}`}
                                    aria-label={`Người ứng chi đơn ${order.code}`}
                                    value={editPayer}
                                    onChange={(e) => setEditPayer(e.target.value)}
                                    className="w-full rounded-lg border border-[#E4DFD5] bg-white px-2 py-1.5 text-xs focus:border-[#0D4F43] focus:outline-none"
                                  >
                                    {DEFAULT_PAYERS.map((p) => (
                                      <option key={p} value={p}>
                                        {p}
                                      </option>
                                    ))}
                                  </select>
                                  <input
                                    type="number"
                                    min={1}
                                    aria-label={`Trọng lượng gram đơn ${order.code}`}
                                    value={editWeight}
                                    onChange={(e) => setEditWeight(e.target.value)}
                                    className="w-full rounded-lg border border-[#E4DFD5] bg-white px-2 py-1.5 font-mono text-xs tabular-nums focus:border-[#0D4F43] focus:outline-none"
                                  />
                                </div>
                              </div>

                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingOrderId(null)}
                                  className="rounded-lg border border-[#E4DFD5] bg-white px-3 py-1.5 text-xs font-medium text-[#57605E] hover:bg-[#F3EFE6]"
                                >
                                  Hủy
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveShippingEdit(order.id)}
                                  className="rounded-lg bg-[#0D4F43] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#093B32] whitespace-nowrap"
                                >
                                  Lưu VC
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmModal
        open={Boolean(cancelTarget)}
        title={`Xác nhận hủy đơn ${cancelTarget?.code ?? ''}?`}
        description="Khi hủy đơn hàng, hệ thống sẽ tự động hoàn lại toàn bộ số lượng sản phẩm vào tồn kho, trừ khỏi doanh thu và xóa khoản chi cước vận chuyển liên kết (nếu có)."
        confirmLabel="Xác nhận hủy đơn"
        onConfirm={() => {
          if (cancelTarget) {
            onCancelOrder(cancelTarget.id);
            setCancelTarget(null);
          }
        }}
        onCancel={() => setCancelTarget(null)}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title={`Xác nhận xóa đơn hàng #${deleteTarget?.code ?? ''}?`}
        description={`Bạn có chắc muốn xóa đơn hàng #${deleteTarget?.code ?? ''} của khách ${deleteTarget?.customerName ?? ''} không? Dữ liệu doanh thu và tồn kho sẽ được tự động hoàn lại.`}
        confirmLabel="Xóa đơn hàng"
        onConfirm={() => {
          if (deleteTarget) {
            onDeleteOrder(deleteTarget.id);
            setSelectedIds((prev) => prev.filter((id) => id !== deleteTarget.id));
            setDeleteTarget(null);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmModal
        open={Boolean(vtpPromptOrderIds && vtpPromptOrderIds.length > 0)}
        title="Đánh dấu trạng thái 'Đã lên đơn VTP'?"
        description={`Bạn có muốn đánh dấu ${vtpPromptOrderIds?.length ?? 0} đơn vừa xuất sang trạng thái "Đã lên đơn VTP" không để tránh xuất trùng ở lần sau?`}
        confirmLabel="Đánh dấu 'Đã lên đơn VTP'"
        cancelLabel="Giữ nguyên"
        tone="primary"
        onConfirm={() => {
          if (vtpPromptOrderIds) {
            onMarkOrdersShippingStatus(vtpPromptOrderIds, ShippingStatus.VTP_CREATED);
            setSelectedIds((prev) => prev.filter((id) => !vtpPromptOrderIds.includes(id)));
            setVtpPromptOrderIds(null);
          }
        }}
        onCancel={() => setVtpPromptOrderIds(null)}
      />

      <OrderEditModal
        open={Boolean(fullEditOrder)}
        order={fullEditOrder}
        state={state}
        actorName={currentUser.name}
        onClose={() => setFullEditOrder(null)}
        onSave={onUpdateOrder}
      />

      <OrderExportModal
        open={exportModalOpen}
        allOrders={state.orders}
        filteredOrders={filteredOrders}
        initialFormat={exportInitialFormat}
        onClose={() => setExportModalOpen(false)}
        onExport={onExportOrdersCustom}
      />

      {onSaveProduct && (
        <ProductModal
          open={quickProductModalOpen}
          editingProduct={null}
          state={state}
          actorName={currentUser.name}
          onClose={() => setQuickProductModalOpen(false)}
          onSave={(input) => {
            const res = onSaveProduct(input);
            if (res.ok && res.product) {
              const created = res.product;
              setBrand(created.brand);
              setFormError(null);
              const preferredSize: SizeOption =
                created.brand === Brand.VAN_MIEN
                  ? 'Freesize'
                  : (['M', 'S', 'L'] as SizeOption[]).find(
                      (s) => (created.initialStock[s] ?? 0) > 0
                    ) ?? 'M';
              setLines((prev) => {
                const emptyIdx = prev.findIndex((l) => !l.productId);
                if (emptyIdx !== -1) {
                  return prev.map((l, i) =>
                    i === emptyIdx
                      ? {
                          ...l,
                          productId: created.id,
                          size: preferredSize,
                          unitPrice: created.sellPrice,
                        }
                      : l
                  );
                }
                return [
                  {
                    key: `line_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                    productId: created.id,
                    size: preferredSize,
                    quantity: 1,
                    unitPrice: created.sellPrice,
                  },
                ];
              });
            }
            return res;
          }}
        />
      )}
    </div>
  );
};

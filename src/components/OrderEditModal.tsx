import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
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
  ShippingMethod,
  ShippingStatus,
  SizeOption,
} from '../types/erp';
import {
  formatVND,
  getAvailableStock,
  getProductActiveSizes,
  OrderDraftInput,
  parseVNDInput,
} from '../utils/finance';

interface EditLine {
  key: string;
  productId: string;
  size: SizeOption;
  quantity: number;
  unitPrice: number;
}

interface OrderEditModalProps {
  open: boolean;
  order: Order | null;
  state: AppState;
  actorName: string;
  onClose: () => void;
  onSave: (
    orderId: string,
    draft: OrderDraftInput
  ) => { ok: true } | { ok: false; error: string };
}

export const OrderEditModal: React.FC<OrderEditModalProps> = ({
  open,
  order,
  state,
  actorName,
  onClose,
  onSave,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [date, setDate] = useState('');
  const [brand, setBrand] = useState<Brand>(Brand.TO_NHA);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>(ShippingMethod.VIETTEL_POST);
  const [shippingStatus, setShippingStatus] = useState<ShippingStatus>(ShippingStatus.NOT_SENT);
  const [shippingFee, setShippingFee] = useState('0');
  const [discount, setDiscount] = useState('');
  const [shopShippingCost, setShopShippingCost] = useState('0');
  const [shippingCostPayer, setShippingCostPayer] = useState<string>(DEFAULT_PAYERS[0]);
  const [weightGrams, setWeightGrams] = useState('500');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(PaymentStatus.UNPAID);
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<EditLine[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !order) return;
    setError(null);
    setDate(order.date);
    setBrand(order.brand);
    setCustomerName(order.customerName);
    setCustomerPhone(order.customerPhone);
    setShippingAddress(order.shippingAddress || '');
    setShippingMethod(order.shippingMethod);
    setShippingStatus(order.shippingStatus);
    setShippingFee(String(order.shippingFee || 0));
    setDiscount(order.discount && order.discount > 0 ? String(order.discount) : '');
    setShopShippingCost(String(order.shopShippingCost || 0));
    setShippingCostPayer(order.shippingCostPayer || DEFAULT_PAYERS[0]);
    setWeightGrams(String(order.weightGrams || 500));
    setPaymentStatus(order.paymentStatus);
    setNote(order.note || '');
    setLines(
      order.items.map((item, idx) => ({
        key: `edit_line_${order.id}_${idx}_${Date.now()}`,
        productId: item.productId,
        size: item.size,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      }))
    );
  }, [open, order]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const ordersWithoutCurrent = useMemo(
    () => (order ? state.orders.filter((o) => o.id !== order.id) : state.orders),
    [state.orders, order]
  );

  // Include active products of selected brand PLUS any product already referenced in the order
  const selectableProducts = useMemo(() => {
    const orderProductIds = new Set(order?.items.map((i) => i.productId) ?? []);
    return state.products.filter(
      (p) => (p.brand === brand && !p.isArchived) || orderProductIds.has(p.id)
    );
  }, [state.products, brand, order]);

  if (!open || !order) return null;

  const handleAddLine = () => {
    const first = selectableProducts[0];
    const defaultSize: SizeOption = brand === Brand.VAN_MIEN ? 'Freesize' : 'M';
    setLines((prev) => [
      ...prev,
      {
        key: `edit_line_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        productId: first?.id ?? '',
        size: defaultSize,
        quantity: 1,
        unitPrice: first?.sellPrice ?? 0,
      },
    ]);
  };

  const handleRemoveLine = (key: string) => {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));
  };

  const handleLineProductChange = (key: string, productId: string) => {
    const product = state.products.find((p) => p.id === productId);
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        if (!product) return { ...l, productId };
        const activeSizes = getProductActiveSizes(product, state.stockImports, ordersWithoutCurrent);
        const nextSize: SizeOption =
          product.brand === Brand.VAN_MIEN
            ? 'Freesize'
            : activeSizes.includes(l.size) && l.size !== 'Freesize'
              ? l.size
              : activeSizes[0] ?? 'M';
        return {
          ...l,
          productId,
          size: nextSize,
          unitPrice: product.sellPrice,
        };
      })
    );
  };

  const handleLineChange = <K extends keyof EditLine>(
    key: string,
    field: K,
    value: EditLine[K]
  ) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  };

  const subtotal = lines.reduce(
    (sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0),
    0
  );
  const parseOptionalDiscount = (raw: string): number => {
    const trimmed = raw.trim();
    if (!trimmed) return 0;
    const parsed = parseVNDInput(trimmed);
    return Number.isNaN(parsed) ? 0 : parsed;
  };
  const discountValue = parseOptionalDiscount(discount);
  const effectiveDiscount = Math.max(0, discountValue);
  const totalAmount = Math.max(0, subtotal + (Number(shippingFee) || 0) - effectiveDiscount);
  const codAmount =
    order.isCancelled || paymentStatus === PaymentStatus.PAID ? 0 : totalAmount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const res = onSave(order.id, {
      date,
      brand,
      customerName,
      customerPhone,
      shippingAddress,
      shippingMethod,
      shippingStatus,
      shippingFee: Number(shippingFee) || 0,
      discount: discountValue,
      shopShippingCost: Number(shopShippingCost) || 0,
      shippingCostPayer,
      weightGrams: Number(weightGrams) || 500,
      paymentStatus,
      note,
      items: lines.map((l) => ({
        productId: l.productId,
        size: l.size,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
      })),
    });

    if (!res.ok) {
      setError(res.error);
      return;
    }
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="order-edit-modal-title"
      className="fixed inset-0 z-50 m-auto w-full max-w-4xl rounded-xl border border-[#E4DFD5] bg-white p-0 text-[#1A1F1E] shadow-xl backdrop:bg-[#1A1F1E]/40"
    >
      <div className="max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-4 border-b border-[#ECE7DD] pb-4">
          <div>
            <h2 id="order-edit-modal-title" className="font-serif text-xl font-semibold text-[#1A1F1E]">
              Chỉnh sửa đơn hàng {order.code}
            </h2>
            <p className="mt-0.5 text-xs text-[#57605E]">
              Người chỉnh sửa: <strong className="text-[#0D4F43]">{actorName}</strong> · Hệ thống sẽ tự động hoàn tồn kho mẫu cũ trước khi trừ số lượng mới và đồng bộ lại cước vận chuyển.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hộp thoại sửa đơn hàng"
            className="rounded-lg p-1.5 text-[#57605E] transition-colors hover:bg-[#F3EFE6] hover:text-[#1A1F1E]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-[#A63429]/30 bg-[#A63429]/5 px-4 py-2.5 text-xs font-medium text-[#A63429]"
            >
              {error}
            </div>
          )}

          {/* Thông tin chung & Khách hàng */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="edit-ord-date" className="block text-xs font-medium text-[#57605E]">
                Ngày đặt
              </label>
              <input
                id="edit-ord-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-sm focus:border-[#0D4F43] focus:outline-none"
                required
              />
            </div>

            <div>
              <label htmlFor="edit-ord-brand" className="block text-xs font-medium text-[#57605E]">
                Nhánh thương hiệu
              </label>
              <select
                id="edit-ord-brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value as Brand)}
                className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-sm focus:border-[#0D4F43] focus:outline-none"
              >
                {ALL_BRANDS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="edit-ord-name" className="block text-xs font-medium text-[#57605E]">
                Tên người nhận
              </label>
              <input
                id="edit-ord-name"
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-sm focus:border-[#0D4F43] focus:outline-none"
                required
              />
            </div>

            <div>
              <label htmlFor="edit-ord-phone" className="block text-xs font-medium text-[#57605E]">
                Số điện thoại
              </label>
              <input
                id="edit-ord-phone"
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-sm focus:border-[#0D4F43] focus:outline-none"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="edit-ord-address" className="block text-xs font-medium text-[#57605E]">
                Địa chỉ giao hàng
              </label>
              <input
                id="edit-ord-address"
                type="text"
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-sm focus:border-[#0D4F43] focus:outline-none"
                required
              />
            </div>

            <div>
              <label htmlFor="edit-ord-ship-method" className="block text-xs font-medium text-[#57605E]">
                Hình thức vận chuyển
              </label>
              <select
                id="edit-ord-ship-method"
                value={shippingMethod}
                onChange={(e) => setShippingMethod(e.target.value as ShippingMethod)}
                className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-sm focus:border-[#0D4F43] focus:outline-none"
              >
                {ALL_SHIPPING_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="edit-ord-ship-status" className="block text-xs font-medium text-[#57605E]">
                Trạng thái gửi hàng
              </label>
              <select
                id="edit-ord-ship-status"
                value={shippingStatus}
                onChange={(e) => setShippingStatus(e.target.value as ShippingStatus)}
                className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-sm focus:border-[#0D4F43] focus:outline-none"
              >
                {ALL_SHIPPING_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Sản phẩm trong đơn */}
          <div className="border-t border-[#ECE7DD] pt-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-[#1A1F1E]">
                Chi tiết sản phẩm ({lines.length})
              </span>
              <button
                type="button"
                onClick={handleAddLine}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4DFD5] bg-[#FAF8F4] px-3 py-1.5 text-xs font-medium text-[#0D4F43] hover:bg-[#F3EFE6] whitespace-nowrap shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm mẫu khác
              </button>
            </div>

            <div className="mt-3 space-y-2.5">
              {lines.map((line, idx) => {
                const available = line.productId
                  ? getAvailableStock(
                      line.productId,
                      line.size,
                      state.products,
                      state.stockImports,
                      ordersWithoutCurrent
                    )
                  : 0;
                const legacyItem = order.items.find((i) => i.productId === line.productId);
                const isKnownProduct = selectableProducts.some((p) => p.id === line.productId);

                const lineTotal = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);

                return (
                  <div
                    key={line.key}
                    className="grid grid-cols-1 gap-3 rounded-lg border border-[#ECE7DD] bg-[#FAF8F4]/70 p-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1.1fr)_80px_120px_145px_34px] lg:items-end"
                  >
                    <div className="sm:col-span-2 lg:col-span-1">
                      <label
                        htmlFor={`edit-line-prd-${line.key}`}
                        className="block text-xs font-medium text-[#57605E]"
                      >
                        Mẫu sản phẩm #{idx + 1}
                      </label>
                      <select
                        id={`edit-line-prd-${line.key}`}
                        value={line.productId}
                        onChange={(e) => handleLineProductChange(line.key, e.target.value)}
                        className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-1.5 text-sm focus:border-[#0D4F43] focus:outline-none"
                      >
                        <option value="">-- Chọn mẫu --</option>
                        {!isKnownProduct && legacyItem && (
                          <option value={legacyItem.productId}>
                            {legacyItem.productCode} — {legacyItem.productName} (Đã xóa khỏi danh mục)
                          </option>
                        )}
                        {selectableProducts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.code} — {p.name} ({formatVND(p.sellPrice)})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor={`edit-line-size-${line.key}`}
                        className="block text-xs font-medium text-[#57605E]"
                      >
                        Size (Khả dụng: <span className="font-mono font-semibold">{available}</span>)
                      </label>
                      <select
                        id={`edit-line-size-${line.key}`}
                        value={line.size}
                        onChange={(e) =>
                          handleLineChange(line.key, 'size', e.target.value as SizeOption)
                        }
                        className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-1.5 text-sm focus:border-[#0D4F43] focus:outline-none"
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
                        htmlFor={`edit-line-qty-${line.key}`}
                        className="block text-xs font-medium text-[#57605E]"
                      >
                        Số lượng
                      </label>
                      <input
                        id={`edit-line-qty-${line.key}`}
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) =>
                          handleLineChange(line.key, 'quantity', Number(e.target.value))
                        }
                        className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-1.5 font-mono text-sm tabular-nums focus:border-[#0D4F43] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`edit-line-price-${line.key}`}
                        className="block text-xs font-medium text-[#57605E]"
                      >
                        Giá bán niêm yết (đ)
                      </label>
                      <input
                        id={`edit-line-price-${line.key}`}
                        type="number"
                        min={0}
                        value={line.unitPrice}
                        onChange={(e) =>
                          handleLineChange(line.key, 'unitPrice', Number(e.target.value))
                        }
                        className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-1.5 font-mono text-sm tabular-nums focus:border-[#0D4F43] focus:outline-none"
                      />
                    </div>

                    <div>
                      <span className="block text-xs font-medium text-[#57605E]">
                        Thành tiền (SL × Giá)
                      </span>
                      <div className="mt-1 w-full rounded-lg border border-[#0D4F43]/25 bg-[#0D4F43]/5 px-2.5 py-1.5 text-right font-mono text-sm font-semibold text-[#0D4F43] tabular-nums">
                        {formatVND(lineTotal)}
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(line.key)}
                        disabled={lines.length === 1}
                        aria-label={`Xóa dòng sản phẩm #${idx + 1}`}
                        className="rounded-lg p-1.5 text-[#57605E] hover:bg-[#A63429]/10 hover:text-[#A63429] disabled:opacity-35"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cước phí, giảm giá, thanh toán & ghi chú */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="edit-ord-ship-fee" className="block text-xs font-medium text-[#57605E]">
                Phí ship khách trả (đ)
              </label>
              <input
                id="edit-ord-ship-fee"
                type="number"
                min={0}
                value={shippingFee}
                onChange={(e) => setShippingFee(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-2 font-mono text-sm tabular-nums focus:border-[#0D4F43] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="edit-ord-discount" className="block text-xs font-medium text-[#57605E]">
                Giảm giá (đ) <span className="font-normal text-[#8A918E]">(Tuỳ chọn)</span>
              </label>
              <input
                id="edit-ord-discount"
                type="text"
                inputMode="numeric"
                placeholder="0 (Nếu có KM)"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-2 font-mono text-sm placeholder:font-sans placeholder:text-xs placeholder:text-[#8A918E] tabular-nums focus:border-[#0D4F43] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="edit-ord-shop-cost" className="block text-xs font-medium text-[#57605E]">
                Cước VC shop trả (đ)
              </label>
              <input
                id="edit-ord-shop-cost"
                type="number"
                min={0}
                value={shopShippingCost}
                onChange={(e) => setShopShippingCost(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-2 font-mono text-sm tabular-nums focus:border-[#0D4F43] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="edit-ord-payer" className="block text-xs font-medium text-[#57605E]">
                Người ứng chi cước
              </label>
              <select
                id="edit-ord-payer"
                value={shippingCostPayer}
                onChange={(e) => setShippingCostPayer(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-2 text-sm focus:border-[#0D4F43] focus:outline-none"
              >
                {DEFAULT_PAYERS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="edit-ord-weight" className="block text-xs font-medium text-[#57605E]">
                Trọng lượng (gram)
              </label>
              <input
                id="edit-ord-weight"
                type="number"
                min={1}
                value={weightGrams}
                onChange={(e) => setWeightGrams(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-2 font-mono text-sm tabular-nums focus:border-[#0D4F43] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="edit-ord-pay-status" className="block text-xs font-medium text-[#57605E]">
                Trạng thái thanh toán
              </label>
              <select
                id="edit-ord-pay-status"
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-2 text-sm focus:border-[#0D4F43] focus:outline-none"
              >
                <option value={PaymentStatus.UNPAID}>Chưa thanh toán</option>
                <option value={PaymentStatus.PAID}>Đã thanh toán</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="edit-ord-note" className="block text-xs font-medium text-[#57605E]">
                Ghi chú
              </label>
              <input
                id="edit-ord-note"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-2 text-sm focus:border-[#0D4F43] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#ECE7DD] pt-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[#57605E]">
              <div>
                Tiền hàng:{' '}
                <span className="font-mono font-medium text-[#1A1F1E] tabular-nums">
                  {formatVND(subtotal)}
                </span>
              </div>
              {effectiveDiscount > 0 && (
                <div>
                  Giảm giá:{' '}
                  <span className="font-mono font-medium text-[#A63429] tabular-nums">
                    -{formatVND(effectiveDiscount)}
                  </span>
                </div>
              )}
              <div>
                Tổng thu đơn:{' '}
                <span className="font-mono text-lg font-semibold text-[#1A1F1E] tabular-nums">
                  {formatVND(totalAmount)}
                </span>
              </div>
              <div>
                Tiền thu hộ (COD):{' '}
                <span
                  className={`font-mono text-lg font-semibold tabular-nums ${
                    codAmount > 0 ? 'text-[#B45309]' : 'text-[#0D4F43]'
                  }`}
                >
                  {formatVND(codAmount)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-[#E4DFD5] bg-white px-4 py-2 text-sm font-medium text-[#1A1F1E] hover:bg-[#FAF8F4] whitespace-nowrap shrink-0"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="rounded-lg bg-[#0D4F43] px-5 py-2 text-sm font-medium text-white hover:bg-[#093B32] whitespace-nowrap shrink-0"
              >
                Lưu cập nhật đơn
              </button>
            </div>
          </div>
        </form>
      </div>
    </dialog>
  );
};

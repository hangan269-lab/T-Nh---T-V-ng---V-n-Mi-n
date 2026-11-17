import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileSpreadsheet, Package, Truck, UserCheck, X } from 'lucide-react';
import { ALL_SHIPPING_METHODS, Order, ShippingMethod } from '../types/erp';
import {
  filterOrdersByShippingMethod,
  formatVND,
  getOrderCOD,
  getOrderTotal,
  ShippingExportFilter,
} from '../utils/finance';

export type OrderExportMode = 'recipients' | 'full';
export type OrderExportFormat = 'xlsx' | 'csv';

interface OrderExportModalProps {
  open: boolean;
  allOrders: Order[];
  filteredOrders: Order[];
  initialFormat?: OrderExportFormat;
  onClose: () => void;
  onExport: (params: {
    orders: Order[];
    shippingFilter: ShippingExportFilter;
    mode: OrderExportMode;
    format: OrderExportFormat;
  }) => void;
}

const SHIPPING_OPTIONS: Array<{
  value: ShippingExportFilter;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    value: 'all',
    label: 'Tất cả hình thức vận chuyển',
    description: 'Xuất gộp toàn bộ đơn đang hoạt động',
    icon: Package,
  },
  {
    value: ShippingMethod.VIETTEL_POST,
    label: ShippingMethod.VIETTEL_POST,
    description: 'Đơn gửi chuyển phát Viettel Post',
    icon: Truck,
  },
  {
    value: ShippingMethod.LOCAL_SHIP,
    label: ShippingMethod.LOCAL_SHIP,
    description: 'Đơn giao nội thành trong ngày',
    icon: Truck,
  },
  {
    value: ShippingMethod.PICKUP,
    label: ShippingMethod.PICKUP,
    description: 'Đơn khách qua studio tự nhận',
    icon: UserCheck,
  },
];

export const OrderExportModal: React.FC<OrderExportModalProps> = ({
  open,
  allOrders,
  filteredOrders,
  initialFormat = 'xlsx',
  onClose,
  onExport,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [shippingFilter, setShippingFilter] = useState<ShippingExportFilter>('all');
  const [exportMode, setExportMode] = useState<OrderExportMode>('recipients');
  const [useTableFilter, setUseTableFilter] = useState<boolean>(true);
  const [includeCancelled, setIncludeCancelled] = useState<boolean>(false);

  const isTableFiltered = filteredOrders.length !== allOrders.length;

  useEffect(() => {
    if (!open) return;
    setShippingFilter('all');
    setExportMode('recipients');
    setUseTableFilter(isTableFiltered);
    setIncludeCancelled(false);
  }, [open, isTableFiltered, initialFormat]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const sourceOrders = useMemo(
    () => (isTableFiltered && useTableFilter ? filteredOrders : allOrders),
    [allOrders, filteredOrders, isTableFiltered, useTableFilter]
  );

  const countsByShipping = useMemo(() => {
    const map: Record<ShippingExportFilter, number> = {
      all: 0,
      [ShippingMethod.VIETTEL_POST]: 0,
      [ShippingMethod.LOCAL_SHIP]: 0,
      [ShippingMethod.PICKUP]: 0,
    };
    for (const opt of ['all', ...ALL_SHIPPING_METHODS] as ShippingExportFilter[]) {
      map[opt] = filterOrdersByShippingMethod(sourceOrders, opt, { includeCancelled }).length;
    }
    return map;
  }, [sourceOrders, includeCancelled]);

  const matchedOrders = useMemo(
    () => filterOrdersByShippingMethod(sourceOrders, shippingFilter, { includeCancelled }),
    [sourceOrders, shippingFilter, includeCancelled]
  );

  const previewOrders = useMemo(() => matchedOrders.slice(0, 5), [matchedOrders]);

  if (!open) return null;

  const handleRunExport = (format: OrderExportFormat) => {
    if (matchedOrders.length === 0) return;
    onExport({
      orders: matchedOrders,
      shippingFilter,
      mode: exportMode,
      format,
    });
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="order-export-modal-title"
      className="fixed inset-0 z-50 m-auto w-[calc(100%-2rem)] max-w-2xl rounded-xl border border-[#E4DFD5] bg-white p-0 text-[#1A1F1E] shadow-xl backdrop:bg-[#1A1F1E]/40"
    >
      <div className="max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-4 border-b border-[#ECE7DD] pb-4">
          <div>
            <h2
              id="order-export-modal-title"
              className="font-serif text-xl font-semibold text-[#1A1F1E]"
            >
              Xuất file danh sách đơn hàng
            </h2>
            <p className="mt-0.5 text-xs text-[#57605E]">
              Chọn hình thức vận chuyển và mẫu thông tin cần xuất ra Excel (.xlsx) hoặc CSV.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hộp thoại xuất đơn hàng"
            className="rounded-lg p-1.5 text-[#57605E] transition-colors hover:bg-[#F3EFE6] hover:text-[#1A1F1E]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-5">
          {/* 1. Chọn hình thức vận chuyển */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                id="export-shipping-label"
                className="text-xs font-semibold text-[#1A1F1E]"
              >
                1. Chọn hình thức vận chuyển
              </span>
              {isTableFiltered && (
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-[#57605E]">
                  <input
                    type="checkbox"
                    checked={useTableFilter}
                    onChange={(e) => setUseTableFilter(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-[#E4DFD5] accent-[#0D4F43]"
                  />
                  Chỉ tính theo bộ lọc đang xem ({filteredOrders.length}/{allOrders.length} đơn)
                </label>
              )}
            </div>

            <div
              role="radiogroup"
              aria-labelledby="export-shipping-label"
              className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2"
            >
              {SHIPPING_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const selected = shippingFilter === opt.value;
                const count = countsByShipping[opt.value];
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setShippingFilter(opt.value)}
                    className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                      selected
                        ? 'border-[#0D4F43] bg-[#0D4F43]/5 ring-1 ring-[#0D4F43]'
                        : 'border-[#E4DFD5] bg-white hover:bg-[#FAF8F4]'
                    }`}
                  >
                    <div
                      className={`mt-0.5 rounded-lg p-2 ${
                        selected
                          ? 'bg-[#0D4F43] text-white'
                          : 'bg-[#F3EFE6] text-[#57605E]'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-sm font-semibold ${
                            selected ? 'text-[#0D4F43]' : 'text-[#1A1F1E]'
                          }`}
                        >
                          {opt.label}
                        </span>
                        <span
                          className={`font-mono text-xs font-semibold tabular-nums ${
                            count > 0 ? 'text-[#0D4F43]' : 'text-[#8A918E]'
                          }`}
                        >
                          {count} đơn
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-[#57605E]">{opt.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Chọn mẫu thông tin xuất */}
          <div>
            <span id="export-mode-label" className="text-xs font-semibold text-[#1A1F1E]">
              2. Thông tin xuất trong file
            </span>
            <div
              role="radiogroup"
              aria-labelledby="export-mode-label"
              className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2"
            >
              <button
                type="button"
                role="radio"
                aria-checked={exportMode === 'recipients'}
                onClick={() => setExportMode('recipients')}
                className={`rounded-xl border p-3.5 text-left transition-colors ${
                  exportMode === 'recipients'
                    ? 'border-[#0D4F43] bg-[#0D4F43]/5 ring-1 ring-[#0D4F43]'
                    : 'border-[#E4DFD5] bg-white hover:bg-[#FAF8F4]'
                }`}
              >
                <div className="text-sm font-semibold text-[#1A1F1E]">
                  Thông tin người nhận (3 cột)
                </div>
                <p className="mt-1 text-[11px] text-[#57605E]">
                  Xuất gọn 3 cột: <strong className="text-[#0D4F43]">Tên người nhận</strong>,{' '}
                  <strong className="text-[#0D4F43]">Số điện thoại</strong>,{' '}
                  <strong className="text-[#0D4F43]">Địa chỉ</strong>.
                </p>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={exportMode === 'full'}
                onClick={() => setExportMode('full')}
                className={`rounded-xl border p-3.5 text-left transition-colors ${
                  exportMode === 'full'
                    ? 'border-[#0D4F43] bg-[#0D4F43]/5 ring-1 ring-[#0D4F43]'
                    : 'border-[#E4DFD5] bg-white hover:bg-[#FAF8F4]'
                }`}
              >
                <div className="text-sm font-semibold text-[#1A1F1E]">
                  Bảng chi tiết đơn hàng đầy đủ
                </div>
                <p className="mt-1 text-[11px] text-[#57605E]">
                  Gồm mã đơn, ngày đặt, sản phẩm, giảm giá, thành tiền, COD, hình thức VC &amp; ghi chú.
                </p>
              </button>
            </div>

            <label className="mt-2.5 inline-flex cursor-pointer items-center gap-2 text-xs text-[#57605E]">
              <input
                type="checkbox"
                checked={includeCancelled}
                onChange={(e) => setIncludeCancelled(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-[#E4DFD5] accent-[#0D4F43]"
              />
              Bao gồm cả đơn đã hủy
            </label>
          </div>

          {/* 3. Xem trước dữ liệu */}
          <div className="rounded-xl border border-[#ECE7DD] bg-[#FAF8F4] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#1A1F1E]">
                Xem trước dữ liệu ({matchedOrders.length} đơn phù hợp)
              </span>
              {matchedOrders.length > 5 && (
                <span className="text-[11px] text-[#57605E]">
                  Hiển thị 5 dòng đầu tiên
                </span>
              )}
            </div>

            {matchedOrders.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-[#E4DFD5] bg-white px-4 py-4 text-center text-xs text-[#57605E]">
                Không có đơn hàng nào thuộc lựa chọn{' '}
                <strong className="text-[#1A1F1E]">
                  {shippingFilter === 'all' ? 'Tất cả hình thức vận chuyển' : shippingFilter}
                </strong>
                . Vui lòng chọn hình thức vận chuyển khác.
              </p>
            ) : exportMode === 'recipients' ? (
              <div className="mt-2.5 overflow-x-auto rounded-lg border border-[#E4DFD5] bg-white">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#ECE7DD] bg-[#FAF8F4] text-[11px] font-semibold text-[#57605E]">
                      <th className="px-3 py-2">Tên người nhận</th>
                      <th className="px-3 py-2">Số điện thoại</th>
                      <th className="px-3 py-2">Địa chỉ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ECE7DD]">
                    {previewOrders.map((o) => (
                      <tr key={o.id}>
                        <td className="px-3 py-2 font-medium text-[#1A1F1E] whitespace-nowrap">
                          {o.customerName}
                        </td>
                        <td className="px-3 py-2 font-mono text-[#1A1F1E] whitespace-nowrap">
                          {o.customerPhone}
                        </td>
                        <td className="px-3 py-2 text-[#57605E]">{o.shippingAddress}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-2.5 overflow-x-auto rounded-lg border border-[#E4DFD5] bg-white">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#ECE7DD] bg-[#FAF8F4] text-[11px] font-semibold text-[#57605E]">
                      <th className="px-3 py-2">Mã đơn</th>
                      <th className="px-3 py-2">Người nhận · SĐT</th>
                      <th className="px-3 py-2">Địa chỉ</th>
                      <th className="px-3 py-2">Hình thức VC</th>
                      <th className="px-3 py-2 text-right">Tổng / COD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ECE7DD]">
                    {previewOrders.map((o) => (
                      <tr key={o.id}>
                        <td className="px-3 py-2 font-mono font-semibold text-[#1A1F1E] whitespace-nowrap">
                          {o.code}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="font-medium text-[#1A1F1E]">{o.customerName}</div>
                          <div className="font-mono text-[11px] text-[#57605E]">
                            {o.customerPhone}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-[#57605E] max-w-[200px] truncate">
                          {o.shippingAddress}
                        </td>
                        <td className="px-3 py-2 text-[#1A1F1E] whitespace-nowrap">
                          {o.shippingMethod}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap">
                          <div className="font-semibold text-[#1A1F1E]">
                            {formatVND(getOrderTotal(o))}
                          </div>
                          <div className="text-[11px] text-[#B45309]">
                            COD: {formatVND(getOrderCOD(o))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5 border-t border-[#ECE7DD] pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#E4DFD5] bg-white px-4 py-2 text-xs font-medium text-[#1A1F1E] transition-colors hover:bg-[#FAF8F4] whitespace-nowrap shrink-0"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={() => handleRunExport('csv')}
            disabled={matchedOrders.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4DFD5] bg-white px-4 py-2 text-xs font-medium text-[#1A1F1E] transition-colors hover:bg-[#FAF8F4] disabled:opacity-45 whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            Xuất file CSV ({matchedOrders.length})
          </button>
          <button
            type="button"
            onClick={() => handleRunExport('xlsx')}
            disabled={matchedOrders.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D4F43] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#093B32] disabled:opacity-45 whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Xuất file Excel (.xlsx) ({matchedOrders.length})
          </button>
        </div>
      </div>
    </dialog>
  );
};

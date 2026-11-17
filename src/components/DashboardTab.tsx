import React from 'react';
import { ArrowRight, CheckCircle2, Clock, Download, FileSpreadsheet, Trash2 } from 'lucide-react';
import { AppState, BRAND_SUBTITLES, PaymentStatus } from '../types/erp';
import {
  computeBrandPnL,
  computeFundSummary,
  computeInventoryRows,
  computeTodayStats,
  formatDateVN,
  formatVND,
  getOrderTotal,
  getTodayISO,
} from '../utils/finance';

interface DashboardTabProps {
  state: AppState;
  isAdmin?: boolean;
  hasAnyData?: boolean;
  onNavigateTab: (tab: 'orders' | 'inventory' | 'finance' | 'budget') => void;
  onConfirmPayment: (orderId: string) => void;
  onExportPnLCSV: () => void;
  onExportFinanceXLSX: () => void;
  onRequestClearSampleData?: () => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  state,
  isAdmin = false,
  hasAnyData = false,
  onNavigateTab,
  onConfirmPayment,
  onExportPnLCSV,
  onExportFinanceXLSX,
  onRequestClearSampleData,
}) => {
  const todayISO = getTodayISO();
  const todayStats = computeTodayStats(state.orders, todayISO);
  const pnl = computeBrandPnL(state.products, state.stockImports, state.orders, state.expenses);
  const fund = computeFundSummary(state.shareholders, state.expenses);
  const lowStockRows = computeInventoryRows(
    state.products,
    state.stockImports,
    state.orders
  ).filter((r) => r.isLowStock);

  return (
    <div className="space-y-8">
      {isAdmin && hasAnyData && onRequestClearSampleData && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E4DFD5] bg-white px-5 py-3.5">
          <div className="text-xs text-[#57605E]">
            {state.isSampleData
              ? 'Hệ thống đang hiển thị dữ liệu mẫu để trải nghiệm.'
              : 'Đang vận hành với dữ liệu thực tế của studio.'}{' '}
            Bạn có thể xuất sao lưu Excel/JSON hoặc reset toàn bộ về 0 bất kỳ lúc nào.
          </div>
          <button
            type="button"
            onClick={onRequestClearSampleData}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#A63429] px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-[#8B2920] whitespace-nowrap shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Xóa toàn bộ dữ liệu mẫu (Reset hệ thống về 0)
          </button>
        </div>
      )}

      {/* Row 1: Thống kê nhanh HÔM NAY + Quỹ tiền mặt */}
      <section aria-labelledby="today-summary-heading" className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Card 1: Đơn hàng & Doanh thu hôm nay */}
        <div className="rounded-xl border border-[#E4DFD5] bg-white p-6 lg:col-span-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#ECE7DD] pb-4">
            <div>
              <h2 id="today-summary-heading" className="font-serif text-xl font-semibold text-[#1A1F1E]">
                Hoạt động hôm nay
              </h2>
              <p className="mt-0.5 text-xs text-[#57605E]">
                Ngày {formatDateVN(todayISO)} · Dữ liệu đồng bộ theo thời gian thực
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('orders')}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0D4F43] hover:underline whitespace-nowrap shrink-0"
            >
              Quản lý đơn hàng
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {/* 3 metrics strip */}
          <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div>
              <div className="text-xs font-medium text-[#57605E]">Đơn hàng hôm nay</div>
              <div className="mt-1.5 font-mono text-2xl font-semibold text-[#1A1F1E] tabular-nums">
                {todayStats.orderCount} đơn
              </div>
              <div className="mt-1 text-xs text-[#57605E]">
                Tổng doanh thu: <span className="font-mono font-medium text-[#1A1F1E] tabular-nums">{formatVND(todayStats.totalRevenue)}</span>
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-[#57605E]">Tiền đã thu thực tế</div>
              <div className="mt-1.5 font-mono text-2xl font-semibold text-[#0D4F43] tabular-nums">
                {formatVND(todayStats.paidRevenue)}
              </div>
              <div className="mt-1 text-xs text-[#0D4F43]">Đã nhận chuyển khoản / tiền mặt</div>
            </div>

            <div>
              <div className="text-xs font-medium text-[#57605E]">Tiền chờ thanh toán</div>
              <div className="mt-1.5 font-mono text-2xl font-semibold text-[#B45309] tabular-nums">
                {formatVND(todayStats.unpaidRevenue)}
              </div>
              <div className="mt-1 text-xs text-[#57605E]">Đơn COD / công nợ trong ngày</div>
            </div>
          </div>

          {/* Danh sách đơn phát sinh trong ngày */}
          <div className="mt-6 border-t border-[#ECE7DD] pt-4">
            <h3 className="text-xs font-semibold tracking-wide text-[#57605E]">
              Chi tiết đơn phát sinh trong ngày ({todayStats.todayOrders.length})
            </h3>
            {todayStats.todayOrders.length === 0 ? (
              <div className="mt-3 rounded-lg bg-[#FAF8F4] px-4 py-5 text-center text-sm text-[#57605E]">
                Chưa có đơn hàng nào phát sinh trong ngày hôm nay.
              </div>
            ) : (
              <div className="mt-3 divide-y divide-[#ECE7DD]">
                {todayStats.todayOrders.map((order) => {
                  const total = getOrderTotal(order);
                  const isPaid = order.paymentStatus === PaymentStatus.PAID;
                  return (
                    <div
                      key={order.id}
                      className={`flex flex-col gap-2 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3 ${
                        order.isCancelled ? 'opacity-55' : ''
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="font-mono text-xs font-semibold text-[#1A1F1E] whitespace-nowrap">
                            {order.code}
                          </span>
                          <span aria-hidden="true" className="text-[#C7C0B3]">·</span>
                          <span className="font-medium text-[#1A1F1E]">
                            {order.customerName}
                          </span>
                          <span aria-hidden="true" className="text-[#C7C0B3]">·</span>
                          <span className="text-xs text-[#57605E] whitespace-nowrap">{order.brand}</span>
                        </div>
                        <div className="mt-0.5 text-xs text-[#57605E]">
                          {order.items
                            .map((i) => `${i.productCode} (${i.size}) x${i.quantity}`)
                            .join(', ')}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 sm:justify-end shrink-0">
                        <span className="font-mono font-semibold text-[#1A1F1E] tabular-nums whitespace-nowrap">
                          {formatVND(total)}
                        </span>
                        {order.isCancelled ? (
                          <span className="rounded bg-[#F3EFE6] px-2 py-1 text-xs font-medium text-[#57605E] whitespace-nowrap">
                            Đã hủy
                          </span>
                        ) : isPaid ? (
                          <span className="inline-flex items-center gap-1 rounded bg-[#0D4F43]/10 px-2 py-1 text-xs font-medium text-[#0D4F43] whitespace-nowrap">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                            Đã thanh toán
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onConfirmPayment(order.id)}
                            aria-label={`Xác nhận đã thanh toán đơn ${order.code}`}
                            className="inline-flex items-center gap-1 rounded border border-[#B45309]/40 bg-[#FEF3C7]/60 px-2.5 py-1 text-xs font-medium text-[#92400E] transition-colors hover:bg-[#FDE68A] whitespace-nowrap shrink-0"
                          >
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            Xác nhận đã thanh toán
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Thẻ Quỹ tiền mặt */}
        <div className="flex flex-col justify-between rounded-xl border border-[#E4DFD5] bg-white p-6 lg:col-span-4">
          <div>
            <div className="flex items-baseline justify-between gap-2 border-b border-[#ECE7DD] pb-4">
              <h2 className="font-serif text-xl font-semibold text-[#1A1F1E]">Quỹ tiền mặt</h2>
              <button
                type="button"
                onClick={() => onNavigateTab('finance')}
                className="text-xs font-medium text-[#0D4F43] hover:underline whitespace-nowrap shrink-0"
              >
                Chi tiết quỹ
              </button>
            </div>

            <dl className="mt-5 space-y-4">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-[#57605E]">Vốn góp ban đầu</dt>
                <dd className="font-mono text-base font-medium text-[#1A1F1E] tabular-nums">
                  {formatVND(fund.totalCapital)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-[#57605E]">Tổng đã chi</dt>
                <dd className="font-mono text-base font-medium text-[#A63429] tabular-nums">
                  -{formatVND(fund.totalSpent)}
                </dd>
              </div>
              <div className="border-t border-[#ECE7DD] pt-4 flex items-baseline justify-between gap-4">
                <dt className="text-sm font-semibold text-[#1A1F1E]">Số dư quỹ hiện tại</dt>
                <dd
                  className={`font-mono text-2xl font-semibold tabular-nums ${
                    fund.currentBalance < 0 ? 'text-[#A63429]' : 'text-[#0D4F43]'
                  }`}
                >
                  {formatVND(fund.currentBalance, { parenthesesForNegative: true })}
                </dd>
              </div>
            </dl>
          </div>

          {/* Cảnh báo tồn kho thấp tóm tắt */}
          <div className="mt-6 border-t border-[#ECE7DD] pt-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#57605E]">
                Cảnh báo tồn kho (&le; 1 sp)
              </span>
              <button
                type="button"
                onClick={() => onNavigateTab('inventory')}
                className="text-xs font-medium text-[#0D4F43] hover:underline whitespace-nowrap shrink-0"
              >
                Xem kho ({lowStockRows.length})
              </button>
            </div>
            {lowStockRows.length === 0 ? (
              <p className="mt-2 text-xs text-[#57605E]">Tất cả các mẫu & size đang đủ tồn kho.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {lowStockRows.slice(0, 3).map((item) => (
                  <li
                    key={item.key}
                    className="flex items-center justify-between gap-2 text-xs text-[#A63429]"
                  >
                    <span className="truncate">
                      {item.productCode} · {item.productName} ({item.size})
                    </span>
                    <span className="font-mono font-semibold shrink-0 tabular-nums">
                      Còn {item.currentStock}
                    </span>
                  </li>
                ))}
                {lowStockRows.length > 3 && (
                  <li className="text-xs text-[#57605E]">
                    và {lowStockRows.length - 3} phân loại khác sắp hết...
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* Row 2: Bảng Tổng hợp Tài chính & Lãi/Lỗ (sheet TỔNG HỢP) */}
      <section
        aria-labelledby="pnl-heading"
        className="rounded-xl border border-[#E4DFD5] bg-white p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#ECE7DD] pb-4">
          <div>
            <h2 id="pnl-heading" className="font-serif text-xl font-semibold text-[#1A1F1E]">
              Bảng Tổng hợp Tài chính & Lãi/Lỗ (P&L)
            </h2>
            <p className="mt-0.5 text-xs text-[#57605E]">
              Lợi nhuận = Tổng giá bán − Tổng giá nhập − Chi phí vận hành (chi phí dùng chung chia đều 3 nhánh; số âm hiển thị màu đỏ trong ngoặc đơn).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onExportFinanceXLSX}
              className="inline-flex items-center gap-2 rounded-lg bg-[#166534] px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-[#14532D] whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Xuất Excel Thu Chi &amp; Tổng hợp
            </button>
            <button
              type="button"
              onClick={onExportPnLCSV}
              className="inline-flex items-center gap-2 rounded-lg border border-[#E4DFD5] bg-white px-3.5 py-2 text-xs font-medium text-[#1A1F1E] transition-colors hover:bg-[#FAF8F4] whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              Xuất CSV Tổng hợp
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#E4DFD5] text-xs font-semibold text-[#57605E]">
                <th className="py-3 pr-4">Nhánh thương hiệu</th>
                <th className="py-3 px-4 text-right">Số đơn</th>
                <th className="py-3 px-4 text-right">Tổng giá nhập</th>
                <th className="py-3 px-4 text-right">Tổng giá bán</th>
                <th className="py-3 px-4 text-right">Chi phí vận hành</th>
                <th className="py-3 pl-4 text-right">Lợi nhuận (Lãi/Lỗ)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECE7DD]">
              {pnl.byBrand.map((row) => (
                <tr key={row.brand} className="transition-colors hover:bg-[#FAF8F4]">
                  <td className="py-3.5 pr-4">
                    <div className="font-medium text-[#1A1F1E]">{row.brand}</div>
                    <div className="text-xs text-[#57605E]">{BRAND_SUBTITLES[row.brand]}</div>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-[#1A1F1E] tabular-nums">
                    {row.activeOrderCount}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-[#1A1F1E] tabular-nums">
                    {formatVND(row.importCost)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-medium text-[#1A1F1E] tabular-nums">
                    {formatVND(row.salesRevenue)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-[#57605E] tabular-nums">
                    {formatVND(row.operatingExpense)}
                  </td>
                  <td
                    className={`py-3.5 pl-4 text-right font-mono font-semibold tabular-nums ${
                      row.profit < 0 ? 'text-[#A63429]' : 'text-[#0D4F43]'
                    }`}
                  >
                    {formatVND(row.profit, { parenthesesForNegative: true })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#1A1F1E]/15 bg-[#F3EFE6]/60 font-semibold">
                <td className="py-3.5 pr-4 text-[#1A1F1E]">Tổng cộng toàn hệ thống</td>
                <td className="py-3.5 px-4 text-right font-mono text-[#1A1F1E] tabular-nums">
                  {pnl.total.activeOrderCount}
                </td>
                <td className="py-3.5 px-4 text-right font-mono text-[#1A1F1E] tabular-nums">
                  {formatVND(pnl.total.importCost)}
                </td>
                <td className="py-3.5 px-4 text-right font-mono text-[#1A1F1E] tabular-nums">
                  {formatVND(pnl.total.salesRevenue)}
                </td>
                <td className="py-3.5 px-4 text-right font-mono text-[#1A1F1E] tabular-nums">
                  {formatVND(pnl.total.operatingExpense)}
                </td>
                <td
                  className={`py-3.5 pl-4 text-right font-mono text-base tabular-nums ${
                    pnl.total.profit < 0 ? 'text-[#A63429]' : 'text-[#0D4F43]'
                  }`}
                >
                  {formatVND(pnl.total.profit, { parenthesesForNegative: true })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
};

import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { AppState, BudgetItem, EXPENSE_CATEGORIES } from '../types/erp';
import {
  computeBudgetSummary,
  computeFundSummary,
  formatVND,
} from '../utils/finance';

interface BudgetTabProps {
  state: AppState;
  onAddBudgetItem: (item: Omit<BudgetItem, 'id'>) => void;
  onDeleteBudgetItem: (id: string) => void;
}

export const BudgetTab: React.FC<BudgetTabProps> = ({
  state,
  onAddBudgetItem,
  onDeleteBudgetItem,
}) => {
  const fund = computeFundSummary(state.shareholders, state.expenses);
  const budget = computeBudgetSummary(state.budgetItems, fund.currentBalance);

  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [detail, setDetail] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(quantity);
    const price = Number(unitPrice);
    if (!detail.trim() || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price < 0) {
      return;
    }
    onAddBudgetItem({
      category,
      detail: detail.trim(),
      quantity: qty,
      estimatedUnitPrice: Math.round(price),
    });
    setDetail('');
    setQuantity('1');
    setUnitPrice('');
  };

  const isShortfall = budget.balanceDifference < 0;

  return (
    <div className="space-y-6">
      {/* Banner đối chiếu Số dư quỹ hiện tại vs Dự trù ngân sách */}
      <section aria-label="Tổng quan dự trù ngân sách" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[#E4DFD5] bg-white p-5">
          <div className="text-xs font-medium text-[#57605E]">
            Số dư quỹ hiện tại (từ Tab Tài chính)
          </div>
          <div
            className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${
              fund.currentBalance < 0 ? 'text-[#A63429]' : 'text-[#0D4F43]'
            }`}
          >
            {formatVND(fund.currentBalance, { parenthesesForNegative: true })}
          </div>
          <div className="mt-1 text-xs text-[#57605E]">
            Vốn {formatVND(fund.totalCapital)} − Đã chi {formatVND(fund.totalSpent)}
          </div>
        </div>

        <div className="rounded-xl border border-[#E4DFD5] bg-white p-5">
          <div className="text-xs font-medium text-[#57605E]">Tổng ngân sách dự trù</div>
          <div className="mt-2 font-mono text-2xl font-semibold text-[#1A1F1E] tabular-nums">
            {formatVND(budget.totalBudget)}
          </div>
          <div className="mt-1 text-xs text-[#57605E]">
            {state.budgetItems.length} hạng mục kế hoạch
          </div>
        </div>

        <div className="rounded-xl border border-[#E4DFD5] bg-white p-5">
          <div className="text-xs font-medium text-[#57605E]">
            Ngân sách cần bổ sung thêm (Quỹ − Dự trù)
          </div>
          <div
            className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${
              isShortfall ? 'text-[#A63429]' : 'text-[#0D4F43]'
            }`}
          >
            {formatVND(budget.balanceDifference, { parenthesesForNegative: true })}
          </div>
          <div className={`mt-1 text-xs font-medium ${isShortfall ? 'text-[#A63429]' : 'text-[#0D4F43]'}`}>
            {isShortfall
              ? `Thiếu hụt: cần góp thêm ${formatVND(budget.additionalNeeded)}`
              : `Đủ ngân sách · Dự phòng còn lại ${formatVND(budget.balanceDifference)}`}
          </div>
        </div>
      </section>

      {/* Bảng lập kế hoạch dự trù */}
      <section aria-labelledby="budget-table-heading" className="rounded-xl border border-[#E4DFD5] bg-white p-6">
        <div className="border-b border-[#ECE7DD] pb-4">
          <h2 id="budget-table-heading" className="font-serif text-xl font-semibold text-[#1A1F1E]">
            Kế hoạch Dự trù Nhập hàng & Marketing
          </h2>
          <p className="mt-0.5 text-xs text-[#57605E]">
            Thành tiền = Số lượng × Đơn giá dự kiến · Tự động đối chiếu với Số dư quỹ hiện tại.
          </p>
        </div>

        {/* Form thêm hạng mục dự trù */}
        <form
          onSubmit={handleAdd}
          className="mt-5 grid grid-cols-1 gap-3 rounded-xl border border-[#ECE7DD] bg-[#FAF8F4] p-4 sm:grid-cols-12 sm:items-end"
        >
          <div className="sm:col-span-3">
            <label htmlFor="bdg-cat" className="block text-xs font-medium text-[#57605E]">
              Hạng mục
            </label>
            <select
              id="bdg-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-sm focus:border-[#0D4F43] focus:outline-none"
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-4">
            <label htmlFor="bdg-detail" className="block text-xs font-medium text-[#57605E]">
              Chi tiết dự trù
            </label>
            <input
              id="bdg-detail"
              type="text"
              placeholder="Ví dụ: May thêm 10 bộ áo dài Tết..."
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-sm focus:border-[#0D4F43] focus:outline-none"
              required
            />
          </div>

          <div className="sm:col-span-1">
            <label htmlFor="bdg-qty" className="block text-xs font-medium text-[#57605E]">
              SL
            </label>
            <input
              id="bdg-qty"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-2 font-mono text-sm tabular-nums focus:border-[#0D4F43] focus:outline-none"
              required
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="bdg-price" className="block text-xs font-medium text-[#57605E]">
              Đơn giá dự kiến
            </label>
            <input
              id="bdg-price"
              type="number"
              min={0}
              step={1000}
              placeholder="750000"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-2 font-mono text-sm tabular-nums focus:border-[#0D4F43] focus:outline-none"
              required
            />
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#0D4F43] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#093B32] whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              Thêm dòng
            </button>
          </div>
        </form>

        {state.budgetItems.length === 0 ? (
          <div className="mt-6 rounded-lg bg-[#FAF8F4] px-6 py-8 text-center text-sm text-[#57605E]">
            Chưa có hạng mục dự trù nào. Thêm dòng kế hoạch ở trên để ước tính ngân sách.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[660px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#E4DFD5] text-xs font-semibold text-[#57605E]">
                  <th className="py-3 pr-3">Hạng mục</th>
                  <th className="py-3 px-3">Chi tiết</th>
                  <th className="py-3 px-3 text-right">Số lượng</th>
                  <th className="py-3 px-3 text-right">Đơn giá dự kiến</th>
                  <th className="py-3 px-3 text-right">Thành tiền</th>
                  <th className="py-3 pl-3 text-right">Xóa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECE7DD]">
                {state.budgetItems.map((item) => {
                  const subtotal = item.quantity * item.estimatedUnitPrice;
                  return (
                    <tr key={item.id} className="hover:bg-[#FAF8F4]">
                      <td className="py-3 pr-3 font-medium text-[#1A1F1E]">{item.category}</td>
                      <td className="py-3 px-3 text-[#1A1F1E]">{item.detail}</td>
                      <td className="py-3 px-3 text-right font-mono text-[#57605E] tabular-nums">
                        {item.quantity}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-[#57605E] tabular-nums whitespace-nowrap">
                        {formatVND(item.estimatedUnitPrice)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-[#1A1F1E] tabular-nums whitespace-nowrap">
                        {formatVND(subtotal)}
                      </td>
                      <td className="py-3 pl-3 text-right">
                        <button
                          type="button"
                          onClick={() => onDeleteBudgetItem(item.id)}
                          aria-label={`Xóa hạng mục ${item.detail}`}
                          className="rounded p-1.5 text-[#57605E] hover:bg-[#A63429]/10 hover:text-[#A63429]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#1A1F1E]/15 bg-[#F3EFE6]/60 font-semibold">
                  <td colSpan={4} className="py-3.5 pr-4 text-[#1A1F1E]">
                    Tổng ngân sách dự trù
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-base text-[#1A1F1E] tabular-nums">
                    {formatVND(budget.totalBudget)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

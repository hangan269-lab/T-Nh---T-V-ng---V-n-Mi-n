import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clock, Plus, Trash2, X } from 'lucide-react';
import {
  ALL_BRANDS,
  AppState,
  DEFAULT_PAYERS,
  EXPENSE_CATEGORIES,
  Expense,
  ExpenseBrandScope,
  ExpenseStatus,
  Shareholder,
} from '../types/erp';
import {
  computeFundSummary,
  formatDateVN,
  formatVND,
  getTodayISO,
} from '../utils/finance';

interface FinanceTabProps {
  state: AppState;
  onAddShareholder: (sh: Omit<Shareholder, 'id'>) => void;
  onDeleteShareholder: (id: string) => void;
  onAddExpense: (exp: Omit<Expense, 'id'>) => void;
  onToggleExpenseStatus: (id: string) => void;
  onDeleteExpense: (id: string) => void;
}

export const FinanceTab: React.FC<FinanceTabProps> = ({
  state,
  onAddShareholder,
  onDeleteShareholder,
  onAddExpense,
  onToggleExpenseStatus,
  onDeleteExpense,
}) => {
  const fund = computeFundSummary(state.shareholders, state.expenses);

  // Shareholder form
  const [showShareholderForm, setShowShareholderForm] = useState(false);
  const [shName, setShName] = useState('');
  const [shContribution, setShContribution] = useState('');
  const [shNote, setShNote] = useState('');

  // Expense form
  const [expDate, setExpDate] = useState(getTodayISO());
  const [expCategory, setExpCategory] = useState<string>(EXPENSE_CATEGORIES[1]);
  const [expBrandScope, setExpBrandScope] = useState<ExpenseBrandScope>('Dùng chung');
  const [expDetail, setExpDetail] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expPaidBy, setExpPaidBy] = useState<string>(DEFAULT_PAYERS[0]);
  const [expReceipt, setExpReceipt] = useState('');
  const [expStatus, setExpStatus] = useState<ExpenseStatus>(ExpenseStatus.PENDING);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | ExpenseStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const filteredExpenses = useMemo(() => {
    return state.expenses.filter((e) => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
      return true;
    });
  }, [state.expenses, statusFilter, categoryFilter]);

  const handleShareholderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(shContribution);
    if (!shName.trim() || !Number.isFinite(amount) || amount <= 0) return;
    onAddShareholder({
      name: shName.trim(),
      contribution: Math.round(amount),
      note: shNote.trim(),
    });
    setShName('');
    setShContribution('');
    setShNote('');
    setShowShareholderForm(false);
  };

  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(expAmount);
    if (!expDetail.trim() || !Number.isFinite(amount) || amount <= 0) return;
    onAddExpense({
      date: expDate,
      category: expCategory,
      brandScope: expBrandScope,
      detail: expDetail.trim(),
      amount: Math.round(amount),
      paidBy: expPaidBy.trim() || DEFAULT_PAYERS[0],
      receiptNote: expReceipt.trim(),
      status: expStatus,
    });
    setExpDetail('');
    setExpAmount('');
    setExpReceipt('');
  };

  return (
    <div className="space-y-8">
      {/* Tóm tắt Quỹ tiền mặt */}
      <section aria-label="Tổng quan quỹ tiền mặt" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[#E4DFD5] bg-white p-5">
          <div className="text-xs font-medium text-[#57605E]">Tổng vốn góp ban đầu</div>
          <div className="mt-2 font-mono text-2xl font-semibold text-[#1A1F1E] tabular-nums">
            {formatVND(fund.totalCapital)}
          </div>
          <div className="mt-1 text-xs text-[#57605E]">
            {state.shareholders.length} cổ đông góp vốn
          </div>
        </div>

        <div className="rounded-xl border border-[#E4DFD5] bg-white p-5">
          <div className="text-xs font-medium text-[#57605E]">Tổng các khoản đã chi</div>
          <div className="mt-2 font-mono text-2xl font-semibold text-[#A63429] tabular-nums">
            {formatVND(fund.totalSpent)}
          </div>
          <div className="mt-1 text-xs text-[#57605E]">
            {state.expenses.length} chứng từ chi
          </div>
        </div>

        <div className="rounded-xl border border-[#E4DFD5] bg-white p-5">
          <div className="text-xs font-medium text-[#57605E]">Số dư quỹ hiện tại</div>
          <div
            className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${
              fund.currentBalance < 0 ? 'text-[#A63429]' : 'text-[#0D4F43]'
            }`}
          >
            {formatVND(fund.currentBalance, { parenthesesForNegative: true })}
          </div>
          <div className="mt-1 text-xs text-[#57605E]">
            Tự động đồng bộ sang tab Tổng quan & Dự trù
          </div>
        </div>
      </section>

      {/* Bảng Vốn góp cổ đông */}
      <section aria-labelledby="shareholders-heading" className="rounded-xl border border-[#E4DFD5] bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#ECE7DD] pb-4">
          <div>
            <h2 id="shareholders-heading" className="font-serif text-xl font-semibold text-[#1A1F1E]">
              Vốn góp cổ đông
            </h2>
            <p className="mt-0.5 text-xs text-[#57605E]">
              Quản lý tỷ lệ góp vốn ban đầu cấu thành Quỹ tiền mặt.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowShareholderForm((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4DFD5] bg-white px-3.5 py-2 text-xs font-medium text-[#1A1F1E] transition-colors hover:bg-[#FAF8F4] whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Thêm cổ đông
          </button>
        </div>

        {showShareholderForm && (
          <form
            onSubmit={handleShareholderSubmit}
            className="mt-4 grid grid-cols-1 gap-3 rounded-lg border border-[#ECE7DD] bg-[#FAF8F4] p-4 sm:grid-cols-4 sm:items-end"
          >
            <div>
              <label htmlFor="sh-name" className="block text-xs font-medium text-[#57605E]">
                Tên cổ đông
              </label>
              <input
                id="sh-name"
                type="text"
                placeholder="Ví dụ: Linh"
                value={shName}
                onChange={(e) => setShName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-sm focus:border-[#0D4F43] focus:outline-none"
                required
              />
            </div>
            <div>
              <label htmlFor="sh-amount" className="block text-xs font-medium text-[#57605E]">
                Số tiền góp (đ)
              </label>
              <input
                id="sh-amount"
                type="number"
                min={1000}
                step={100000}
                placeholder="6000000"
                value={shContribution}
                onChange={(e) => setShContribution(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 font-mono text-sm tabular-nums focus:border-[#0D4F43] focus:outline-none"
                required
              />
            </div>
            <div>
              <label htmlFor="sh-note" className="block text-xs font-medium text-[#57605E]">
                Ghi chú
              </label>
              <input
                id="sh-note"
                type="text"
                placeholder="Cổ đông góp đợt 2..."
                value={shNote}
                onChange={(e) => setShNote(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-sm focus:border-[#0D4F43] focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="flex-1 rounded-lg bg-[#0D4F43] px-4 py-2 text-sm font-medium text-white hover:bg-[#093B32]"
              >
                Lưu
              </button>
              <button
                type="button"
                onClick={() => setShowShareholderForm(false)}
                aria-label="Đóng"
                className="rounded-lg border border-[#E4DFD5] bg-white p-2 text-[#57605E] hover:bg-[#F3EFE6]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </form>
        )}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[540px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#E4DFD5] text-xs font-semibold text-[#57605E]">
                <th className="py-3 pr-4">Cổ đông</th>
                <th className="py-3 px-4">Ghi chú</th>
                <th className="py-3 px-4 text-right">Tỷ lệ</th>
                <th className="py-3 px-4 text-right">Số tiền góp</th>
                <th className="py-3 pl-4 text-right">Xóa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECE7DD]">
              {state.shareholders.map((sh) => {
                const ratio =
                  fund.totalCapital > 0
                    ? ((sh.contribution / fund.totalCapital) * 100).toFixed(1)
                    : '0.0';
                return (
                  <tr key={sh.id} className="hover:bg-[#FAF8F4]">
                    <td className="py-3 pr-4 font-medium text-[#1A1F1E]">{sh.name}</td>
                    <td className="py-3 px-4 text-xs text-[#57605E]">{sh.note || '—'}</td>
                    <td className="py-3 px-4 text-right font-mono text-xs text-[#57605E] tabular-nums">
                      {ratio}%
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-[#1A1F1E] tabular-nums">
                      {formatVND(sh.contribution)}
                    </td>
                    <td className="py-3 pl-4 text-right">
                      <button
                        type="button"
                        onClick={() => onDeleteShareholder(sh.id)}
                        aria-label={`Xóa cổ đông ${sh.name}`}
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
              <tr className="border-t border-[#1A1F1E]/15 bg-[#F3EFE6]/60 font-semibold">
                <td colSpan={3} className="py-3 pr-4 text-[#1A1F1E]">
                  Tổng vốn góp cổ đông
                </td>
                <td className="py-3 px-4 text-right font-mono text-[#0D4F43] tabular-nums">
                  {formatVND(fund.totalCapital)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Form thêm khoản chi + Sổ chi tiết các khoản chi */}
      <section aria-labelledby="expenses-heading" className="rounded-xl border border-[#E4DFD5] bg-white p-6">
        <div className="border-b border-[#ECE7DD] pb-4">
          <h2 id="expenses-heading" className="font-serif text-xl font-semibold text-[#1A1F1E]">
            Sổ chi tiết các khoản chi vận hành
          </h2>
          <p className="mt-0.5 text-xs text-[#57605E]">
            Nhấn trực tiếp vào cột Tình trạng để chuyển nhanh giữa "Chưa" và "Hoàn thiện".
          </p>
        </div>

        {/* Form thêm khoản chi */}
        <form
          onSubmit={handleExpenseSubmit}
          className="mt-5 rounded-xl border border-[#ECE7DD] bg-[#FAF8F4] p-4"
        >
          <div className="text-xs font-semibold text-[#1A1F1E]">Thêm khoản chi mới</div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="exp-date" className="block text-xs font-medium text-[#57605E]">
                Ngày chi
              </label>
              <input
                id="exp-date"
                type="date"
                value={expDate}
                onChange={(e) => setExpDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-sm focus:border-[#0D4F43] focus:outline-none"
                required
              />
            </div>

            <div>
              <label htmlFor="exp-cat" className="block text-xs font-medium text-[#57605E]">
                Hạng mục
              </label>
              <select
                id="exp-cat"
                value={expCategory}
                onChange={(e) => setExpCategory(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-sm focus:border-[#0D4F43] focus:outline-none"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="exp-brand" className="block text-xs font-medium text-[#57605E]">
                Phân bổ nhánh
              </label>
              <select
                id="exp-brand"
                value={expBrandScope}
                onChange={(e) => setExpBrandScope(e.target.value as ExpenseBrandScope)}
                className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-sm focus:border-[#0D4F43] focus:outline-none"
              >
                <option value="Dùng chung">Dùng chung (Chia đều 3 nhánh)</option>
                {ALL_BRANDS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="exp-amount" className="block text-xs font-medium text-[#57605E]">
                Số tiền (đ)
              </label>
              <input
                id="exp-amount"
                type="number"
                min={1000}
                step={1000}
                placeholder="500000"
                value={expAmount}
                onChange={(e) => setExpAmount(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 font-mono text-sm tabular-nums focus:border-[#0D4F43] focus:outline-none"
                required
              />
            </div>

            <div className="lg:col-span-2">
              <label htmlFor="exp-detail" className="block text-xs font-medium text-[#57605E]">
                Chi tiết khoản chi
              </label>
              <input
                id="exp-detail"
                type="text"
                placeholder="Ví dụ: In hộp quà ép kim, chạy Ads..."
                value={expDetail}
                onChange={(e) => setExpDetail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-sm focus:border-[#0D4F43] focus:outline-none"
                required
              />
            </div>

            <div>
              <label htmlFor="exp-payer" className="block text-xs font-medium text-[#57605E]">
                Người ứng chi
              </label>
              <select
                id="exp-payer"
                value={expPaidBy}
                onChange={(e) => setExpPaidBy(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-sm focus:border-[#0D4F43] focus:outline-none"
              >
                {DEFAULT_PAYERS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="exp-status" className="block text-xs font-medium text-[#57605E]">
                Tình trạng
              </label>
              <select
                id="exp-status"
                value={expStatus}
                onChange={(e) => setExpStatus(e.target.value as ExpenseStatus)}
                className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-sm focus:border-[#0D4F43] focus:outline-none"
              >
                <option value={ExpenseStatus.PENDING}>Chưa</option>
                <option value={ExpenseStatus.COMPLETED}>Hoàn thiện</option>
              </select>
            </div>

            <div className="lg:col-span-3">
              <label htmlFor="exp-receipt" className="block text-xs font-medium text-[#57605E]">
                Link hóa đơn / Ghi chú
              </label>
              <input
                id="exp-receipt"
                type="text"
                placeholder="Link ảnh hóa đơn, số chứng từ hoặc ghi chú thêm..."
                value={expReceipt}
                onChange={(e) => setExpReceipt(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-sm focus:border-[#0D4F43] focus:outline-none"
              />
            </div>

            <div className="flex items-end justify-end">
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#0D4F43] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#093B32] whitespace-nowrap"
              >
                <Plus className="h-4 w-4" />
                Ghi nhận khoản chi
              </button>
            </div>
          </div>
        </form>

        {/* Bộ lọc chi phí */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 rounded-lg bg-[#F3EFE6] p-1">
            {(
              [
                { id: 'all', label: 'Tất cả' },
                { id: ExpenseStatus.PENDING, label: 'Chưa hoàn thiện' },
                { id: ExpenseStatus.COMPLETED, label: 'Hoàn thiện' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === f.id
                    ? 'bg-white text-[#1A1F1E] shadow-xs'
                    : 'text-[#57605E] hover:text-[#1A1F1E]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <select
            aria-label="Lọc theo hạng mục chi"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-[#E4DFD5] bg-white px-3 py-1.5 text-xs text-[#1A1F1E] focus:border-[#0D4F43] focus:outline-none"
          >
            <option value="all">Tất cả hạng mục</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Bảng chi phí */}
        {filteredExpenses.length === 0 ? (
          <div className="mt-4 rounded-lg bg-[#FAF8F4] px-6 py-8 text-center text-sm text-[#57605E]">
            Chưa có khoản chi nào phù hợp bộ lọc.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#E4DFD5] text-xs font-semibold text-[#57605E]">
                  <th className="py-3 pr-3">Ngày</th>
                  <th className="py-3 px-3">Hạng mục & Nhánh</th>
                  <th className="py-3 px-3">Chi tiết</th>
                  <th className="py-3 px-3">Người ứng chi</th>
                  <th className="py-3 px-3 text-right">Số tiền</th>
                  <th className="py-3 px-3">Tình trạng</th>
                  <th className="py-3 pl-3 text-right">Xóa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECE7DD]">
                {filteredExpenses.map((exp) => {
                  const isDone = exp.status === ExpenseStatus.COMPLETED;
                  return (
                    <tr key={exp.id} className="hover:bg-[#FAF8F4]">
                      <td className="py-3 pr-3 font-mono text-xs text-[#57605E] tabular-nums">
                        {formatDateVN(exp.date)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-medium text-[#1A1F1E]">{exp.category}</div>
                        <div className="text-xs text-[#57605E]">{exp.brandScope}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-[#1A1F1E]">{exp.detail}</div>
                        {(exp.receiptNote || exp.linkedOrderId) && (
                          <div className="text-xs text-[#57605E]">
                            {exp.receiptNote ? `HĐ: ${exp.receiptNote}` : ''}
                            {exp.linkedOrderId ? ' · Đồng bộ tự động từ Đơn hàng' : ''}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-xs font-medium text-[#1A1F1E]">{exp.paidBy}</td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-[#1A1F1E] tabular-nums whitespace-nowrap">
                        {formatVND(exp.amount)}
                      </td>
                      <td className="py-3 px-3">
                        <button
                          type="button"
                          onClick={() => onToggleExpenseStatus(exp.id)}
                          aria-label={`Đổi tình trạng khoản chi "${exp.detail}"`}
                          className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                            isDone
                              ? 'bg-[#0D4F43]/10 text-[#0D4F43] hover:bg-[#0D4F43]/20'
                              : 'border border-[#B45309]/40 bg-[#FEF3C7]/70 text-[#92400E] hover:bg-[#FDE68A]'
                          }`}
                        >
                          {isDone ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            <Clock className="h-3.5 w-3.5" />
                          )}
                          {exp.status}
                        </button>
                      </td>
                      <td className="py-3 pl-3 text-right">
                        <button
                          type="button"
                          onClick={() => onDeleteExpense(exp.id)}
                          aria-label={`Xóa khoản chi ${exp.detail}`}
                          className="rounded p-1.5 text-[#57605E] hover:bg-[#A63429]/10 hover:text-[#A63429]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

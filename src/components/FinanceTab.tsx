import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clock, Edit3, FileSpreadsheet, Plus, Trash2, X } from 'lucide-react';
import {
  ALL_BRANDS,
  AppState,
  DEFAULT_PAYERS,
  EXPENSE_CATEGORIES,
  Expense,
  ExpenseBrandScope,
  ExpenseStatus,
  Shareholder,
  UserAccount,
} from '../types/erp';
import {
  computeFundSummary,
  ExpenseUpdatePatch,
  formatDateVN,
  formatVND,
  getTodayISO,
} from '../utils/finance';
import { ConfirmModal } from './ConfirmModal';

interface FinanceTabProps {
  state: AppState;
  currentUser: UserAccount;
  onAddShareholder: (sh: Omit<Shareholder, 'id'>) => void;
  onUpdateShareholder: (
    id: string,
    patch: Partial<Pick<Shareholder, 'name' | 'contribution' | 'note'>>
  ) => void;
  onDeleteShareholder: (id: string) => void;
  onAddExpense: (exp: Omit<Expense, 'id' | 'enteredBy'>) => void;
  onUpdateExpense: (id: string, patch: ExpenseUpdatePatch) => void;
  onToggleExpenseStatus: (id: string) => void;
  onDeleteExpense: (id: string) => void;
  onExportFinanceXLSX: () => void;
}

export const FinanceTab: React.FC<FinanceTabProps> = ({
  state,
  currentUser,
  onAddShareholder,
  onUpdateShareholder,
  onDeleteShareholder,
  onAddExpense,
  onUpdateExpense,
  onToggleExpenseStatus,
  onDeleteExpense,
  onExportFinanceXLSX,
}) => {
  const isAdmin = currentUser.role === 'Admin';
  const fund = computeFundSummary(state.shareholders, state.expenses);

  // Shareholder form & inline edit
  const [showShareholderForm, setShowShareholderForm] = useState(false);
  const [shName, setShName] = useState('');
  const [shContribution, setShContribution] = useState('');
  const [shNote, setShNote] = useState('');
  const [editingShId, setEditingShId] = useState<string | null>(null);
  const [editShName, setEditShName] = useState('');
  const [editShContribution, setEditShContribution] = useState('');
  const [editShNote, setEditShNote] = useState('');
  const [deleteShareholderTarget, setDeleteShareholderTarget] = useState<Shareholder | null>(null);

  // Expense form
  const [expDate, setExpDate] = useState(getTodayISO());
  const [expCategory, setExpCategory] = useState<string>(EXPENSE_CATEGORIES[1]);
  const [expBrandScope, setExpBrandScope] = useState<ExpenseBrandScope>('Dùng chung');
  const [expDetail, setExpDetail] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expPaidBy, setExpPaidBy] = useState<string>(DEFAULT_PAYERS[0]);
  const [expReceipt, setExpReceipt] = useState('');
  const [expStatus, setExpStatus] = useState<ExpenseStatus>(ExpenseStatus.PENDING);

  // Expense inline edit & delete confirmation
  const [editingExpId, setEditingExpId] = useState<string | null>(null);
  const [editExpDate, setEditExpDate] = useState('');
  const [editExpCategory, setEditExpCategory] = useState('');
  const [editExpScope, setEditExpScope] = useState<ExpenseBrandScope>('Dùng chung');
  const [editExpDetail, setEditExpDetail] = useState('');
  const [editExpAmount, setEditExpAmount] = useState('');
  const [editExpPaidBy, setEditExpPaidBy] = useState('');
  const [editExpReceipt, setEditExpReceipt] = useState('');
  const [editExpStatus, setEditExpStatus] = useState<ExpenseStatus>(ExpenseStatus.PENDING);
  const [deleteExpenseTarget, setDeleteExpenseTarget] = useState<Expense | null>(null);

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

  const openEditShareholder = (sh: Shareholder) => {
    setEditingShId(sh.id);
    setEditShName(sh.name);
    setEditShContribution(String(sh.contribution));
    setEditShNote(sh.note || '');
  };

  const saveEditShareholder = (id: string) => {
    const amount = Number(editShContribution);
    if (!editShName.trim() || !Number.isFinite(amount) || amount < 0) return;
    onUpdateShareholder(id, {
      name: editShName.trim(),
      contribution: Math.round(amount),
      note: editShNote.trim(),
    });
    setEditingShId(null);
  };

  const openEditExpense = (exp: Expense) => {
    setEditingExpId(exp.id);
    setEditExpDate(exp.date);
    setEditExpCategory(exp.category);
    setEditExpScope(exp.brandScope);
    setEditExpDetail(exp.detail);
    setEditExpAmount(String(exp.amount));
    setEditExpPaidBy(exp.paidBy);
    setEditExpReceipt(exp.receiptNote || '');
    setEditExpStatus(exp.status);
  };

  const saveEditExpense = (id: string) => {
    const amount = Number(editExpAmount);
    if (!editExpDetail.trim() || !Number.isFinite(amount) || amount < 0) return;
    onUpdateExpense(id, {
      date: editExpDate,
      category: editExpCategory,
      brandScope: editExpScope,
      detail: editExpDetail.trim(),
      amount: Math.round(amount),
      paidBy: editExpPaidBy,
      receiptNote: editExpReceipt.trim(),
      status: editExpStatus,
    });
    setEditingExpId(null);
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
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#E4DFD5] text-xs font-semibold text-[#57605E]">
                <th className="py-3 pr-4">Cổ đông</th>
                <th className="py-3 px-4">Ghi chú</th>
                <th className="py-3 px-4 text-right">Tỷ lệ</th>
                <th className="py-3 px-4 text-right">Số tiền góp</th>
                <th className="py-3 pl-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECE7DD]">
              {state.shareholders.map((sh) => {
                const ratio =
                  fund.totalCapital > 0
                    ? ((sh.contribution / fund.totalCapital) * 100).toFixed(1)
                    : '0.0';
                const isEditingSh = editingShId === sh.id;
                return (
                  <React.Fragment key={sh.id}>
                    <tr className="hover:bg-[#FAF8F4]">
                      <td className="py-3 pr-4 font-medium text-[#1A1F1E]">
                        <div>{sh.name}</div>
                        {sh.updatedBy && (
                          <div className="text-[11px] font-normal text-[#57605E]">
                            Cập nhật bởi: {sh.updatedBy}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-[#57605E]">{sh.note || '—'}</td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-[#57605E] tabular-nums">
                        {ratio}%
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-[#1A1F1E] tabular-nums">
                        {formatVND(sh.contribution)}
                      </td>
                      <td className="py-3 pl-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              isEditingSh ? setEditingShId(null) : openEditShareholder(sh)
                            }
                            aria-label={`Sửa vốn góp cổ đông ${sh.name}`}
                            className="inline-flex items-center gap-1 rounded border border-[#E4DFD5] bg-white px-2.5 py-1 text-xs font-medium text-[#1A1F1E] hover:bg-[#FAF8F4]"
                          >
                            <Edit3 className="h-3 w-3" />
                            Sửa
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => setDeleteShareholderTarget(sh)}
                              aria-label={`Xóa vĩnh viễn cổ đông ${sh.name}`}
                              className="rounded p-1.5 text-[#57605E] hover:bg-[#A63429]/10 hover:text-[#A63429]"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isEditingSh && (
                      <tr className="bg-[#FAF8F4]">
                        <td colSpan={5} className="px-4 py-3">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
                            <div>
                              <label
                                htmlFor={`edit-sh-name-${sh.id}`}
                                className="block text-xs font-medium text-[#57605E]"
                              >
                                Tên cổ đông
                              </label>
                              <input
                                id={`edit-sh-name-${sh.id}`}
                                type="text"
                                value={editShName}
                                onChange={(e) => setEditShName(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-1.5 text-xs focus:border-[#0D4F43] focus:outline-none"
                              />
                            </div>
                            <div>
                              <label
                                htmlFor={`edit-sh-amount-${sh.id}`}
                                className="block text-xs font-medium text-[#57605E]"
                              >
                                Số tiền góp (đ)
                              </label>
                              <input
                                id={`edit-sh-amount-${sh.id}`}
                                type="number"
                                min={0}
                                step={100000}
                                value={editShContribution}
                                onChange={(e) => setEditShContribution(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-1.5 font-mono text-xs tabular-nums focus:border-[#0D4F43] focus:outline-none"
                              />
                            </div>
                            <div>
                              <label
                                htmlFor={`edit-sh-note-${sh.id}`}
                                className="block text-xs font-medium text-[#57605E]"
                              >
                                Ghi chú
                              </label>
                              <input
                                id={`edit-sh-note-${sh.id}`}
                                type="text"
                                value={editShNote}
                                onChange={(e) => setEditShNote(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-1.5 text-xs focus:border-[#0D4F43] focus:outline-none"
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingShId(null)}
                                className="rounded-lg border border-[#E4DFD5] bg-white px-3 py-1.5 text-xs font-medium text-[#57605E] hover:bg-[#F3EFE6]"
                              >
                                Hủy
                              </button>
                              <button
                                type="button"
                                onClick={() => saveEditShareholder(sh.id)}
                                className="rounded-lg bg-[#0D4F43] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#093B32]"
                              >
                                Lưu thay đổi
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
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#ECE7DD] pb-4">
          <div>
            <h2 id="expenses-heading" className="font-serif text-xl font-semibold text-[#1A1F1E]">
              Sổ chi tiết các khoản chi vận hành
            </h2>
            <p className="mt-0.5 text-xs text-[#57605E]">
              Nhấn Tình trạng để đổi nhanh "Chưa" / "Hoàn thiện". Mọi thao tác sửa đều lưu vết cũ → mới trong Lịch sử thao tác.
              {!isAdmin && ' (Chỉ Admin mới có quyền xóa vĩnh viễn giao dịch tài chính.)'}
            </p>
          </div>
          <button
            type="button"
            onClick={onExportFinanceXLSX}
            className="inline-flex items-center gap-2 rounded-lg bg-[#166534] px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-[#14532D] whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Xuất Excel Thu Chi &amp; Tổng hợp
          </button>
        </div>

        {/* Form thêm khoản chi */}
        <form
          onSubmit={handleExpenseSubmit}
          className="mt-5 rounded-xl border border-[#ECE7DD] bg-[#FAF8F4] p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#1A1F1E]">Thêm khoản chi mới</span>
            <span className="text-xs text-[#57605E]">
              Người nhập liệu: <strong className="text-[#0D4F43]">{currentUser.name}</strong>
            </span>
          </div>
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
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#E4DFD5] text-xs font-semibold text-[#57605E]">
                  <th className="py-3 pr-3">Ngày</th>
                  <th className="py-3 px-3">Hạng mục &amp; Nhánh</th>
                  <th className="py-3 px-3">Chi tiết</th>
                  <th className="py-3 px-3">Ứng chi &amp; Nhập liệu</th>
                  <th className="py-3 px-3 text-right">Số tiền</th>
                  <th className="py-3 px-3">Tình trạng</th>
                  <th className="py-3 pl-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECE7DD]">
                {filteredExpenses.map((exp) => {
                  const isDone = exp.status === ExpenseStatus.COMPLETED;
                  const isEditingExp = editingExpId === exp.id;
                  return (
                    <React.Fragment key={exp.id}>
                      <tr className="hover:bg-[#FAF8F4]">
                        <td className="py-3 pr-3 font-mono text-xs text-[#57605E] tabular-nums whitespace-nowrap">
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
                        <td className="py-3 px-3 text-xs">
                          <div className="font-medium text-[#1A1F1E]">{exp.paidBy}</div>
                          <div className="text-[11px] text-[#57605E]">
                            Nhập: {exp.enteredBy || 'Hệ thống'}
                            {exp.updatedBy ? ` · Sửa: ${exp.updatedBy}` : ''}
                          </div>
                        </td>
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
                        <td className="py-3 pl-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                isEditingExp ? setEditingExpId(null) : openEditExpense(exp)
                              }
                              aria-label={`Sửa khoản chi ${exp.detail}`}
                              className="inline-flex items-center gap-1 rounded border border-[#E4DFD5] bg-white px-2.5 py-1 text-xs font-medium text-[#1A1F1E] hover:bg-[#FAF8F4]"
                            >
                              <Edit3 className="h-3 w-3" />
                              Sửa
                            </button>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => setDeleteExpenseTarget(exp)}
                                aria-label={`Xóa vĩnh viễn khoản chi ${exp.detail}`}
                                className="rounded p-1.5 text-[#57605E] hover:bg-[#A63429]/10 hover:text-[#A63429]"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {isEditingExp && (
                        <tr className="bg-[#FAF8F4]">
                          <td colSpan={7} className="px-4 py-4">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6 sm:items-end">
                              <div>
                                <label
                                  htmlFor={`edit-exp-date-${exp.id}`}
                                  className="block text-xs font-medium text-[#57605E]"
                                >
                                  Ngày chi
                                </label>
                                <input
                                  id={`edit-exp-date-${exp.id}`}
                                  type="date"
                                  value={editExpDate}
                                  onChange={(e) => setEditExpDate(e.target.value)}
                                  className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-1.5 text-xs focus:border-[#0D4F43] focus:outline-none"
                                />
                              </div>

                              <div>
                                <label
                                  htmlFor={`edit-exp-cat-${exp.id}`}
                                  className="block text-xs font-medium text-[#57605E]"
                                >
                                  Hạng mục
                                </label>
                                <select
                                  id={`edit-exp-cat-${exp.id}`}
                                  value={editExpCategory}
                                  onChange={(e) => setEditExpCategory(e.target.value)}
                                  className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-1.5 text-xs focus:border-[#0D4F43] focus:outline-none"
                                >
                                  {EXPENSE_CATEGORIES.map((c) => (
                                    <option key={c} value={c}>
                                      {c}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label
                                  htmlFor={`edit-exp-scope-${exp.id}`}
                                  className="block text-xs font-medium text-[#57605E]"
                                >
                                  Nhánh
                                </label>
                                <select
                                  id={`edit-exp-scope-${exp.id}`}
                                  value={editExpScope}
                                  onChange={(e) =>
                                    setEditExpScope(e.target.value as ExpenseBrandScope)
                                  }
                                  className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-1.5 text-xs focus:border-[#0D4F43] focus:outline-none"
                                >
                                  <option value="Dùng chung">Dùng chung</option>
                                  {ALL_BRANDS.map((b) => (
                                    <option key={b} value={b}>
                                      {b}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="lg:col-span-2">
                                <label
                                  htmlFor={`edit-exp-detail-${exp.id}`}
                                  className="block text-xs font-medium text-[#57605E]"
                                >
                                  Chi tiết khoản chi
                                </label>
                                <input
                                  id={`edit-exp-detail-${exp.id}`}
                                  type="text"
                                  value={editExpDetail}
                                  onChange={(e) => setEditExpDetail(e.target.value)}
                                  className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-1.5 text-xs focus:border-[#0D4F43] focus:outline-none"
                                />
                              </div>

                              <div>
                                <label
                                  htmlFor={`edit-exp-amount-${exp.id}`}
                                  className="block text-xs font-medium text-[#57605E]"
                                >
                                  Số tiền (đ)
                                </label>
                                <input
                                  id={`edit-exp-amount-${exp.id}`}
                                  type="number"
                                  min={0}
                                  step={1000}
                                  value={editExpAmount}
                                  onChange={(e) => setEditExpAmount(e.target.value)}
                                  className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-1.5 font-mono text-xs tabular-nums focus:border-[#0D4F43] focus:outline-none"
                                />
                              </div>

                              <div>
                                <label
                                  htmlFor={`edit-exp-payer-${exp.id}`}
                                  className="block text-xs font-medium text-[#57605E]"
                                >
                                  Người ứng chi
                                </label>
                                <select
                                  id={`edit-exp-payer-${exp.id}`}
                                  value={editExpPaidBy}
                                  onChange={(e) => setEditExpPaidBy(e.target.value)}
                                  className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-1.5 text-xs focus:border-[#0D4F43] focus:outline-none"
                                >
                                  {DEFAULT_PAYERS.map((p) => (
                                    <option key={p} value={p}>
                                      {p}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="lg:col-span-2">
                                <label
                                  htmlFor={`edit-exp-receipt-${exp.id}`}
                                  className="block text-xs font-medium text-[#57605E]"
                                >
                                  Hóa đơn / Ghi chú
                                </label>
                                <input
                                  id={`edit-exp-receipt-${exp.id}`}
                                  type="text"
                                  value={editExpReceipt}
                                  onChange={(e) => setEditExpReceipt(e.target.value)}
                                  className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-1.5 text-xs focus:border-[#0D4F43] focus:outline-none"
                                />
                              </div>

                              <div>
                                <label
                                  htmlFor={`edit-exp-status-${exp.id}`}
                                  className="block text-xs font-medium text-[#57605E]"
                                >
                                  Tình trạng
                                </label>
                                <select
                                  id={`edit-exp-status-${exp.id}`}
                                  value={editExpStatus}
                                  onChange={(e) => setEditExpStatus(e.target.value as ExpenseStatus)}
                                  className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-1.5 text-xs focus:border-[#0D4F43] focus:outline-none"
                                >
                                  <option value={ExpenseStatus.PENDING}>Chưa</option>
                                  <option value={ExpenseStatus.COMPLETED}>Hoàn thiện</option>
                                </select>
                              </div>

                              <div className="lg:col-span-2 flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingExpId(null)}
                                  className="rounded-lg border border-[#E4DFD5] bg-white px-3 py-1.5 text-xs font-medium text-[#57605E] hover:bg-[#F3EFE6]"
                                >
                                  Hủy
                                </button>
                                <button
                                  type="button"
                                  onClick={() => saveEditExpense(exp.id)}
                                  className="rounded-lg bg-[#0D4F43] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#093B32] whitespace-nowrap"
                                >
                                  Lưu khoản chi
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
        open={Boolean(deleteShareholderTarget)}
        title={`Xác nhận xóa cổ đông ${deleteShareholderTarget?.name ?? ''}?`}
        description={`Bạn có chắc muốn xóa cổ đông "${deleteShareholderTarget?.name ?? ''}" (Vốn góp: ${formatVND(deleteShareholderTarget?.contribution ?? 0)})? Tổng vốn góp và Số dư quỹ hiện tại sẽ được tự động tính lại.`}
        confirmLabel="Xóa cổ đông"
        onConfirm={() => {
          if (deleteShareholderTarget) {
            onDeleteShareholder(deleteShareholderTarget.id);
            setDeleteShareholderTarget(null);
          }
        }}
        onCancel={() => setDeleteShareholderTarget(null)}
      />

      <ConfirmModal
        open={Boolean(deleteExpenseTarget)}
        title="Xác nhận xóa khoản chi?"
        description={`Bạn có chắc muốn xóa vĩnh viễn khoản chi "${deleteExpenseTarget?.detail ?? ''}" (${formatVND(deleteExpenseTarget?.amount ?? 0)})? Số dư Quỹ và P&L sẽ được tự động cập nhật lại.`}
        confirmLabel="Xóa khoản chi"
        onConfirm={() => {
          if (deleteExpenseTarget) {
            onDeleteExpense(deleteExpenseTarget.id);
            setDeleteExpenseTarget(null);
          }
        }}
        onCancel={() => setDeleteExpenseTarget(null)}
      />
    </div>
  );
};

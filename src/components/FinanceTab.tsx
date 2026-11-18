import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit3,
  FileSpreadsheet,
  Plus,
  PlusCircle,
  Receipt,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
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
  parseVNDInput,
} from '../utils/finance';
import { ConfirmModal } from './ConfirmModal';

type FinanceSectionId = 'shareholders' | 'expenses' | 'add_expense';

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
  onOpenAiExcelImport?: () => void;
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
  onOpenAiExcelImport,
}) => {
  const isAdmin = currentUser.role === 'Admin';
  const fund = computeFundSummary(state.shareholders, state.expenses);

  // Collapsed by default: user clicks an icon card to reveal full section content
  const [activeSection, setActiveSection] = useState<FinanceSectionId | null>(null);

  // Shareholder form & inline edit
  const [showShareholderForm, setShowShareholderForm] = useState(false);
  const [shName, setShName] = useState('');
  const [shContribution, setShContribution] = useState('');
  const [shNote, setShNote] = useState('');
  const [shError, setShError] = useState<string | null>(null);
  const [editingShId, setEditingShId] = useState<string | null>(null);
  const [editShName, setEditShName] = useState('');
  const [editShContribution, setEditShContribution] = useState('');
  const [editShNote, setEditShNote] = useState('');
  const [editShError, setEditShError] = useState<string | null>(null);
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
  const [expError, setExpError] = useState<string | null>(null);
  const [expSuccessNote, setExpSuccessNote] = useState<string | null>(null);

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
  const [editExpError, setEditExpError] = useState<string | null>(null);
  const [deleteExpenseTarget, setDeleteExpenseTarget] = useState<Expense | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | ExpenseStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const pendingExpenseCount = useMemo(
    () => state.expenses.filter((e) => e.status === ExpenseStatus.PENDING).length,
    [state.expenses]
  );

  const filteredExpenses = useMemo(() => {
    return state.expenses.filter((e) => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
      return true;
    });
  }, [state.expenses, statusFilter, categoryFilter]);

  const toggleSection = (id: FinanceSectionId) => {
    setExpSuccessNote(null);
    setActiveSection((prev) => (prev === id ? null : id));
  };

  const handleShareholderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShError(null);
    if (!shName.trim()) {
      setShError('Vui lòng nhập tên cổ đông.');
      return;
    }
    const amount = parseVNDInput(shContribution);
    if (!Number.isFinite(amount) || amount <= 0) {
      setShError('Vui lòng nhập số tiền góp hợp lệ lớn hơn 0 đ (ví dụ: 6000000 hoặc 6.000.000).');
      return;
    }
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
    setExpError(null);
    setExpSuccessNote(null);
    if (!expDetail.trim()) {
      setExpError('Vui lòng nhập chi tiết khoản chi.');
      return;
    }
    const amount = parseVNDInput(expAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setExpError('Vui lòng nhập số tiền chi hợp lệ lớn hơn 0 đ.');
      return;
    }
    const roundedAmount = Math.round(amount);
    const trimmedDetail = expDetail.trim();
    onAddExpense({
      date: expDate,
      category: expCategory,
      brandScope: expBrandScope,
      detail: trimmedDetail,
      amount: roundedAmount,
      paidBy: expPaidBy.trim() || DEFAULT_PAYERS[0],
      receiptNote: expReceipt.trim(),
      status: expStatus,
    });
    setExpDetail('');
    setExpAmount('');
    setExpReceipt('');
    setExpSuccessNote(`Đã ghi nhận khoản chi "${trimmedDetail}" (${formatVND(roundedAmount)}).`);
  };

  const openEditShareholder = (sh: Shareholder) => {
    setEditingShId(sh.id);
    setEditShName(sh.name);
    setEditShContribution(String(sh.contribution));
    setEditShNote(sh.note || '');
    setEditShError(null);
  };

  const saveEditShareholder = (id: string) => {
    setEditShError(null);
    if (!editShName.trim()) {
      setEditShError('Tên cổ đông không được để trống.');
      return;
    }
    const amount = parseVNDInput(editShContribution);
    if (!Number.isFinite(amount) || amount < 0) {
      setEditShError('Số tiền góp không hợp lệ.');
      return;
    }
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
    setEditExpError(null);
  };

  const saveEditExpense = (id: string) => {
    setEditExpError(null);
    if (!editExpDetail.trim()) {
      setEditExpError('Chi tiết khoản chi không được để trống.');
      return;
    }
    const amount = parseVNDInput(editExpAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      setEditExpError('Số tiền chi không hợp lệ.');
      return;
    }
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

  const sectionTiles: Array<{
    id: FinanceSectionId;
    title: string;
    meta: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      id: 'shareholders',
      title: 'Vốn góp cổ đông',
      meta: `${state.shareholders.length} cổ đông · ${formatVND(fund.totalCapital)}`,
      icon: Users,
    },
    {
      id: 'expenses',
      title: 'Sổ chi tiết các khoản chi vận hành',
      meta: `${state.expenses.length} chứng từ · ${pendingExpenseCount} chưa xong`,
      icon: Receipt,
    },
    {
      id: 'add_expense',
      title: 'Thêm khoản chi',
      meta: 'Ghi nhận mới · Nhập Excel (AI)',
      icon: PlusCircle,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Tóm tắt Quỹ tiền mặt — luôn hiển thị */}
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
            Tự động đồng bộ sang tab Tổng quan &amp; P&amp;L
          </div>
        </div>
      </section>

      {/* Thanh Icon điều hướng phân mục — bấm vào mới mở nội dung */}
      <section aria-label="Các phân mục tài chính và quỹ">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {sectionTiles.map((tile) => {
            const Icon = tile.icon;
            const isActive = activeSection === tile.id;
            return (
              <button
                key={tile.id}
                type="button"
                aria-pressed={isActive}
                aria-expanded={isActive}
                onClick={() => toggleSection(tile.id)}
                className={`group flex min-h-[68px] w-full items-center gap-3.5 rounded-xl border p-4 text-left transition-colors ${
                  isActive
                    ? 'border-[#0D4F43] bg-[#0D4F43]/[0.06]'
                    : 'border-[#E4DFD5] bg-white hover:bg-[#FAF8F4]'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${
                    isActive
                      ? 'bg-[#0D4F43] text-white'
                      : 'bg-[#F6F2EA] text-[#0D4F43] group-hover:bg-[#ECE6DA]'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm font-semibold leading-snug ${
                      isActive ? 'text-[#0D4F43]' : 'text-[#1A1F1E]'
                    }`}
                  >
                    {tile.title}
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-[11px] text-[#57605E] tabular-nums">
                    {tile.meta}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className={`shrink-0 rounded-lg p-1 ${
                    isActive ? 'text-[#0D4F43]' : 'text-[#8A918E]'
                  }`}
                >
                  {isActive ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Trạng thái gọn mặc định khi chưa chọn Icon */}
      {activeSection === null && (
        <div className="rounded-xl border border-dashed border-[#E4DFD5] bg-white/80 px-5 py-6 text-center text-xs text-[#57605E]">
          Bấm vào một biểu tượng ở trên để mở đầy đủ nội dung <strong>Vốn góp cổ đông</strong>,{' '}
          <strong>Sổ chi tiết các khoản chi vận hành</strong> hoặc <strong>Thêm khoản chi</strong>.
        </div>
      )}

      {/* Mục 1: Vốn góp cổ đông */}
      {activeSection === 'shareholders' && (
        <section aria-labelledby="shareholders-heading" className="rounded-xl border border-[#E4DFD5] bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#ECE7DD] pb-4">
            <div>
              <h2 id="shareholders-heading" className="font-serif text-xl font-semibold text-[#1A1F1E]">
                Vốn góp cổ đông
              </h2>
              <p className="mt-0.5 text-xs text-[#57605E]">
                Quản lý tỷ lệ góp vốn ban đầu cấu thành Quỹ tiền mặt.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShError(null);
                  setShowShareholderForm((v) => !v);
                }}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#0D4F43] px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-[#093B32] whitespace-nowrap shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm cổ đông
              </button>
              <button
                type="button"
                onClick={() => setActiveSection(null)}
                aria-label="Thu gọn Vốn góp cổ đông"
                className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-xs font-medium text-[#57605E] hover:bg-[#FAF8F4] whitespace-nowrap shrink-0"
              >
                <X className="h-3.5 w-3.5" />
                Thu gọn
              </button>
            </div>
          </div>

          {showShareholderForm && (
            <form
              onSubmit={handleShareholderSubmit}
              className="mt-4 space-y-3 rounded-lg border border-[#ECE7DD] bg-[#FAF8F4] p-4"
            >
              {shError && (
                <div
                  role="alert"
                  className="rounded-lg border border-[#A63429]/30 bg-[#A63429]/5 px-3 py-2 text-xs font-medium text-[#A63429]"
                >
                  {shError}
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
                <div>
                  <label htmlFor="sh-name" className="block text-xs font-medium text-[#57605E]">
                    Tên cổ đông
                  </label>
                  <input
                    id="sh-name"
                    type="text"
                    placeholder="Ví dụ: Linh"
                    value={shName}
                    onChange={(e) => {
                      setShName(e.target.value);
                      setShError(null);
                    }}
                    className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-sm focus:border-[#0D4F43] focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="sh-amount" className="block text-xs font-medium text-[#57605E]">
                    Số tiền góp (đ){' '}
                    {Number.isFinite(parseVNDInput(shContribution)) &&
                      parseVNDInput(shContribution) > 0 && (
                        <span className="font-mono text-[#0D4F43]">
                          ({formatVND(parseVNDInput(shContribution))})
                        </span>
                      )}
                  </label>
                  <input
                    id="sh-amount"
                    type="text"
                    inputMode="numeric"
                    placeholder="6000000 hoặc 6.000.000"
                    value={shContribution}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/[^\d.,\s]/g, '');
                      setShContribution(cleaned);
                      setShError(null);
                    }}
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
                    onClick={() => {
                      setShError(null);
                      setShowShareholderForm(false);
                    }}
                    aria-label="Đóng"
                    className="rounded-lg border border-[#E4DFD5] bg-white p-2 text-[#57605E] hover:bg-[#F3EFE6]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
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
                            {editShError && (
                              <div
                                role="alert"
                                className="mb-2 rounded-lg border border-[#A63429]/30 bg-[#A63429]/5 px-3 py-1.5 text-xs font-medium text-[#A63429]"
                              >
                                {editShError}
                              </div>
                            )}
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
                                  onChange={(e) => {
                                    setEditShName(e.target.value);
                                    setEditShError(null);
                                  }}
                                  className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-1.5 text-xs focus:border-[#0D4F43] focus:outline-none"
                                />
                              </div>
                              <div>
                                <label
                                  htmlFor={`edit-sh-amount-${sh.id}`}
                                  className="block text-xs font-medium text-[#57605E]"
                                >
                                  Số tiền góp (đ){' '}
                                  {Number.isFinite(parseVNDInput(editShContribution)) && (
                                    <span className="font-mono text-[#0D4F43]">
                                      ({formatVND(parseVNDInput(editShContribution))})
                                    </span>
                                  )}
                                </label>
                                <input
                                  id={`edit-sh-amount-${sh.id}`}
                                  type="text"
                                  inputMode="numeric"
                                  value={editShContribution}
                                  onChange={(e) => {
                                    setEditShContribution(e.target.value.replace(/[^\d.,\s]/g, ''));
                                    setEditShError(null);
                                  }}
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
      )}

      {/* Mục 2: Sổ chi tiết các khoản chi vận hành */}
      {activeSection === 'expenses' && (
        <section aria-labelledby="expenses-heading" className="rounded-xl border border-[#E4DFD5] bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#ECE7DD] pb-4">
            <div>
              <h2 id="expenses-heading" className="font-serif text-xl font-semibold text-[#1A1F1E]">
                Sổ chi tiết các khoản chi vận hành
              </h2>
              <p className="mt-0.5 text-xs text-[#57605E]">
                Nhấn Tình trạng để đổi nhanh &quot;Chưa&quot; / &quot;Hoàn thiện&quot;. Mọi thao tác sửa đều lưu vết cũ → mới trong Lịch sử thao tác.
                {!isAdmin && ' (Chỉ Admin mới có quyền xóa vĩnh viễn giao dịch tài chính.)'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {onOpenAiExcelImport && (
                <button
                  type="button"
                  onClick={onOpenAiExcelImport}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:from-purple-700 hover:to-indigo-700 whitespace-nowrap shrink-0"
                >
                  <Sparkles className="h-4 w-4" />
                  ✨ Nhập nhanh từ Excel (AI)
                </button>
              )}
              <button
                type="button"
                onClick={onExportFinanceXLSX}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#166534] px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-[#14532D] whitespace-nowrap shrink-0"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Xuất Excel Thu Chi &amp; Tổng hợp
              </button>
              <button
                type="button"
                onClick={() => setActiveSection(null)}
                aria-label="Thu gọn Sổ chi tiết các khoản chi"
                className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-xs font-medium text-[#57605E] hover:bg-[#FAF8F4] whitespace-nowrap shrink-0"
              >
                <X className="h-3.5 w-3.5" />
                Thu gọn
              </button>
            </div>
          </div>

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
              <p>Chưa có khoản chi nào phù hợp bộ lọc.</p>
              <button
                type="button"
                onClick={() => setActiveSection('add_expense')}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#0D4F43] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#093B32]"
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm khoản chi mới
              </button>
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
                              {editExpError && (
                                <div
                                  role="alert"
                                  className="mb-3 rounded-lg border border-[#A63429]/30 bg-[#A63429]/5 px-3 py-1.5 text-xs font-medium text-[#A63429]"
                                >
                                  {editExpError}
                                </div>
                              )}
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
                                    type="text"
                                    inputMode="numeric"
                                    value={editExpAmount}
                                    onChange={(e) => {
                                      setEditExpAmount(e.target.value.replace(/[^\d.,\s]/g, ''));
                                      setEditExpError(null);
                                    }}
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
      )}

      {/* Mục 3: Thêm khoản chi mới */}
      {activeSection === 'add_expense' && (
        <section aria-labelledby="add-expense-heading" className="rounded-xl border border-[#E4DFD5] bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#ECE7DD] pb-4">
            <div>
              <h2 id="add-expense-heading" className="font-serif text-xl font-semibold text-[#1A1F1E]">
                Thêm khoản chi mới
              </h2>
              <p className="mt-0.5 text-xs text-[#57605E]">
                Người nhập liệu: <strong className="text-[#0D4F43]">{currentUser.name}</strong> · Tự động trừ vào Số dư quỹ tiền mặt.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {onOpenAiExcelImport && (
                <button
                  type="button"
                  onClick={onOpenAiExcelImport}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:from-purple-700 hover:to-indigo-700 whitespace-nowrap shrink-0"
                >
                  <Sparkles className="h-4 w-4" />
                  ✨ Nhập nhanh từ Excel (AI)
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveSection(null)}
                aria-label="Thu gọn Thêm khoản chi"
                className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-xs font-medium text-[#57605E] hover:bg-[#FAF8F4] whitespace-nowrap shrink-0"
              >
                <X className="h-3.5 w-3.5" />
                Thu gọn
              </button>
            </div>
          </div>

          <form
            onSubmit={handleExpenseSubmit}
            className="mt-5 rounded-xl border border-[#ECE7DD] bg-[#FAF8F4] p-4 sm:p-5"
          >
            {expError && (
              <div
                role="alert"
                className="mb-4 rounded-lg border border-[#A63429]/30 bg-[#A63429]/5 px-3 py-2 text-xs font-medium text-[#A63429]"
              >
                {expError}
              </div>
            )}
            {expSuccessNote && (
              <div
                role="status"
                className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#0D4F43]/30 bg-[#0D4F43]/10 px-3.5 py-2.5 text-xs font-medium text-[#0D4F43]"
              >
                <span>{expSuccessNote}</span>
                <button
                  type="button"
                  onClick={() => setActiveSection('expenses')}
                  className="underline font-semibold hover:text-[#093B32]"
                >
                  Xem trong Sổ chi tiết →
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
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
                  Số tiền (đ){' '}
                  {Number.isFinite(parseVNDInput(expAmount)) && parseVNDInput(expAmount) > 0 && (
                    <span className="font-mono text-[#0D4F43]">
                      ({formatVND(parseVNDInput(expAmount))})
                    </span>
                  )}
                </label>
                <input
                  id="exp-amount"
                  type="text"
                  inputMode="numeric"
                  placeholder="500000"
                  value={expAmount}
                  onChange={(e) => {
                    setExpAmount(e.target.value.replace(/[^\d.,\s]/g, ''));
                    setExpError(null);
                  }}
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
                  className="inline-flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-lg bg-[#0D4F43] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#093B32] whitespace-nowrap"
                >
                  <Plus className="h-4 w-4" />
                  Ghi nhận khoản chi
                </button>
              </div>
            </div>
          </form>
        </section>
      )}

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

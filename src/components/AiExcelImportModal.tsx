import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  HelpCircle,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  Brand,
  ExpenseBrandScope,
  ExpenseStatus,
  Product,
  ShippingMethod,
  ShippingStatus,
  SizeOption,
} from '../types/erp';
import { formatVND } from '../utils/finance';
import {
  ExtractedExpenseRow,
  ExtractedOrderItemRow,
  ExtractedOrderRow,
  ExtractedProductRow,
  getGeminiApiKey,
  parseExpensesWithGemini,
  parseOrdersWithGemini,
  parseProductsWithGemini,
} from '../utils/gemini';

export type AiImportMode = 'expenses' | 'orders' | 'products';

interface AiExcelImportModalProps {
  open: boolean;
  mode: AiImportMode;
  existingProducts: Product[];
  onClose: () => void;
  onOpenSettings: () => void;
  onSaveExpenses?: (expenses: ExtractedExpenseRow[]) => void;
  onSaveOrders?: (orders: ExtractedOrderRow[]) => void;
  onSaveProducts?: (products: ExtractedProductRow[]) => void;
}

export const AiExcelImportModal: React.FC<AiExcelImportModalProps> = ({
  open,
  mode,
  existingProducts,
  onClose,
  onOpenSettings,
  onSaveExpenses,
  onSaveOrders,
  onSaveProducts,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parsed preview states
  const [parsedExpenses, setParsedExpenses] = useState<ExtractedExpenseRow[]>([]);
  const [parsedOrders, setParsedOrders] = useState<ExtractedOrderRow[]>([]);
  const [parsedProducts, setParsedProducts] = useState<ExtractedProductRow[]>([]);
  const [step, setStep] = useState<'input' | 'preview'>('input');

  if (!open) return null;

  const title =
    mode === 'expenses'
      ? '✨ Nhập nhanh Chi phí từ Excel / Sheets (AI)'
      : mode === 'orders'
      ? '✨ Nhập nhanh Đơn hàng từ Excel / Sheets (AI)'
      : '✨ Nhập nhanh Danh mục Kho & Mẫu từ Excel / Sheets (AI)';

  const subtitle =
    mode === 'expenses'
      ? 'Dán các dòng chi phí cũ hoặc tải file Excel để AI tự động trích xuất Ngày, Hạng mục, Số tiền, Người ứng chi...'
      : mode === 'orders'
      ? 'Dán bảng theo dõi đơn hàng cũ hoặc tải file Excel để AI tự động nhận diện Khách, SĐT, Địa chỉ, Mẫu mã, Size, Số lượng...'
      : 'Dán danh mục mẫu áo dài & trà hoặc tải file Excel để AI bóc tách Mã mẫu, Tên, Giá bán, Giá vốn và Tồn kho từng size...';

  const placeholder =
    mode === 'expenses'
      ? 'Ví dụ dán trực tiếp từ Google Sheets hoặc Excel:\n15/01/2025\tMua vải lụa Tơ Nhã\t2.500.000\tNgân chi\tHoàn thiện\n16/01/2025\tIn hộp bao bì Vân Miên\t1.200.000\tGiang chi\tChưa\n...'
      : mode === 'orders'
      ? 'Ví dụ dán trực tiếp từ Google Sheets hoặc Excel:\nChị Lan\t0912345678\t12 Cầu Giấy HN\tTơ Nhã Hoa Mai size M (1 bộ)\tĐã thanh toán\tViettel Post\nAnh Tuấn\t0987654321\tSố 5 Lê Lợi Huế\tTrà Phổ Nhĩ Vân Miên (2 hộp)\tChưa thanh toán\tShip nội thành\n...'
      : 'Ví dụ dán trực tiếp từ Google Sheets hoặc Excel:\nTN-01\tÁo dài Phủ Tơ Sen Trắng\tTơ Nhã\t450000\t1250000\tS:5\tM:10\tL:4\nVM-01\tHộp Trà Phổ Nhĩ Thượng Hạng\tVân Miên\t180000\t350000\tFS:20\n...';

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          setError('File Excel không có sheet dữ liệu nào.');
          return;
        }
        const worksheet = workbook.Sheets[firstSheetName];
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        if (!csv.trim()) {
          setError('Sheet đầu tiên trong file không có nội dung.');
          return;
        }
        setRawText(csv);
      } catch (err: unknown) {
        setError('Không thể đọc file Excel này. Vui lòng kiểm tra định dạng hoặc copy dán trực tiếp.');
      }
    };
    reader.onerror = () => {
      setError('Lỗi khi đọc file. Vui lòng thử lại.');
    };
    reader.readAsBinaryString(file);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAnalyze = async () => {
    if (!rawText.trim()) {
      setError('Vui lòng dán dữ liệu từ bảng tính hoặc bấm Tải file Excel.');
      return;
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      setError(
        'Chưa tìm thấy Gemini API Key. Vui lòng bấm "Cài đặt" để dán mã khóa miễn phí từ aistudio.google.com hoặc cấu hình biến môi trường VITE_GEMINI_API_KEY.'
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (mode === 'expenses') {
        const rows = await parseExpensesWithGemini(rawText);
        if (rows.length === 0) {
          setError('AI không tìm thấy dòng chi phí nào trong dữ liệu. Vui lòng kiểm tra lại nội dung.');
          setLoading(false);
          return;
        }
        setParsedExpenses(rows);
        setStep('preview');
      } else if (mode === 'orders') {
        const rows = await parseOrdersWithGemini(rawText, existingProducts);
        if (rows.length === 0) {
          setError('AI không tìm thấy đơn hàng nào trong dữ liệu. Vui lòng kiểm tra lại nội dung.');
          setLoading(false);
          return;
        }
        setParsedOrders(rows);
        setStep('preview');
      } else if (mode === 'products') {
        const rows = await parseProductsWithGemini(rawText);
        if (rows.length === 0) {
          setError('AI không tìm thấy sản phẩm nào trong dữ liệu. Vui lòng kiểm tra lại nội dung.');
          setLoading(false);
          return;
        }
        setParsedProducts(rows);
        setStep('preview');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Chưa cấu hình Gemini API Key')) {
        setError(msg);
      } else if (msg.includes('API_KEY_INVALID') || msg.includes('400')) {
        setError('Mã Gemini API Key không hợp lệ. Vui lòng kiểm tra lại trong phần Cài đặt.');
      } else if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
        setError('Đã vượt quá hạn mức truy vấn miễn phí (Quota limit). Vui lòng thử lại sau ít phút.');
      } else {
        setError(`Lỗi xử lý AI: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSave = () => {
    if (mode === 'expenses' && onSaveExpenses) {
      onSaveExpenses(parsedExpenses);
    } else if (mode === 'orders' && onSaveOrders) {
      onSaveOrders(parsedOrders);
    } else if (mode === 'products' && onSaveProducts) {
      onSaveProducts(parsedProducts);
    }
    onClose();
  };

  const removeExpenseRow = (idx: number) => {
    setParsedExpenses((prev) => prev.filter((_, i) => i !== idx));
  };

  const removeOrderRow = (idx: number) => {
    setParsedOrders((prev) => prev.filter((_, i) => i !== idx));
  };

  const removeProductRow = (idx: number) => {
    setParsedProducts((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl border border-[#E4DFD5] bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#ECE7DD] bg-gradient-to-r from-[#FAF8F4] to-[#F3EFE6]/50 p-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
              <Sparkles className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h2 className="font-serif text-lg font-semibold text-[#1A1F1E]">{title}</h2>
              <p className="mt-0.5 text-xs text-[#57605E]">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#57605E] hover:bg-[#E4DFD5]/60 hover:text-[#1A1F1E]"
            aria-label="Đóng modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-[#A63429]/30 bg-[#A63429]/5 p-3.5 text-xs text-[#A63429]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1">
                <p className="font-medium">{error}</p>
                {error.includes('Gemini API Key') && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenSettings();
                    }}
                    className="mt-2 inline-flex items-center gap-1 rounded bg-[#0D4F43] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[#093B32]"
                  >
                    Mở Cài đặt để nhập API Key ngay
                  </button>
                )}
              </div>
            </div>
          )}

          {step === 'input' ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="ai-excel-textarea" className="text-xs font-semibold text-[#1A1F1E]">
                  Dán nội dung từ Google Sheets / Excel vào đây:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#0D4F43]/30 bg-[#0D4F43]/5 px-3 py-1.5 text-xs font-medium text-[#0D4F43] hover:bg-[#0D4F43]/10"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Tải file Excel (.xlsx/.csv)
                  </button>
                  {rawText && (
                    <button
                      type="button"
                      onClick={() => {
                        setRawText('');
                        setError(null);
                      }}
                      className="rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-1.5 text-xs text-[#57605E] hover:bg-[#FAF8F4]"
                    >
                      Xóa
                    </button>
                  )}
                </div>
              </div>

              <textarea
                id="ai-excel-textarea"
                rows={10}
                value={rawText}
                onChange={(e) => {
                  setRawText(e.target.value);
                  setError(null);
                }}
                placeholder={placeholder}
                className="w-full rounded-xl border border-[#E4DFD5] bg-white p-3 font-mono text-xs text-[#1A1F1E] placeholder:text-[#8A918E] focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
              />

              <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-3.5 text-xs text-purple-900">
                <div className="flex items-center gap-1.5 font-medium">
                  <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                  Mẹo sử dụng:
                </div>
                <p className="mt-1 text-[11px] text-purple-700 leading-relaxed">
                  Bạn chỉ cần mở bảng Excel hoặc Google Sheets cũ, dùng chuột bôi đen các dòng dữ liệu (kể cả có tiêu đề hay không), nhấn <strong>Ctrl + C</strong> rồi dán thẳng vào ô trên. AI Gemini 2.5 Flash sẽ tự động nhận diện các cột, chuẩn hóa số tiền và phân loại hạng mục chính xác.
                </p>
              </div>
            </div>
          ) : (
            /* Step: Preview */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                    <CheckCircle2 className="h-3 w-3" />
                    Đã bóc tách thành công
                  </span>
                  <span className="text-xs font-semibold text-[#1A1F1E]">
                    {mode === 'expenses'
                      ? `${parsedExpenses.length} khoản chi`
                      : mode === 'orders'
                      ? `${parsedOrders.length} đơn hàng`
                      : `${parsedProducts.length} mẫu sản phẩm`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setStep('input')}
                  className="text-xs text-[#0D4F43] hover:underline"
                >
                  ← Dán lại dữ liệu khác
                </button>
              </div>

              {/* Preview Table for Expenses */}
              {mode === 'expenses' && (
                <div className="max-h-96 overflow-x-auto rounded-xl border border-[#E4DFD5]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF8F4] text-[#57605E]">
                      <tr className="border-b border-[#E4DFD5]">
                        <th className="py-2.5 px-3">Ngày</th>
                        <th className="py-2.5 px-3">Hạng mục</th>
                        <th className="py-2.5 px-3">Nhánh</th>
                        <th className="py-2.5 px-3">Chi tiết</th>
                        <th className="py-2.5 px-3 text-right">Số tiền</th>
                        <th className="py-2.5 px-3">Người chi</th>
                        <th className="py-2.5 px-3">Tình trạng</th>
                        <th className="py-2.5 px-2 text-center w-8">Xóa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#ECE7DD]">
                      {parsedExpenses.map((exp, idx) => (
                        <tr key={idx} className="hover:bg-[#FAF8F4]/50">
                          <td className="py-2 px-3 whitespace-nowrap font-mono">{exp.date}</td>
                          <td className="py-2 px-3 font-medium text-[#1A1F1E]">{exp.category}</td>
                          <td className="py-2 px-3 whitespace-nowrap">{exp.brandScope}</td>
                          <td className="py-2 px-3 max-w-[200px] truncate" title={exp.detail}>
                            {exp.detail}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-[#0D4F43] whitespace-nowrap">
                            {formatVND(exp.amount)}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">{exp.paidBy}</td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                                exp.status === ExpenseStatus.COMPLETED
                                  ? 'bg-[#0D4F43]/10 text-[#0D4F43]'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {exp.status}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeExpenseRow(idx)}
                              className="rounded p-1 text-[#A63429] hover:bg-red-50"
                              title="Xóa dòng này"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Preview Table for Orders */}
              {mode === 'orders' && (
                <div className="max-h-96 overflow-x-auto rounded-xl border border-[#E4DFD5]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF8F4] text-[#57605E]">
                      <tr className="border-b border-[#E4DFD5]">
                        <th className="py-2.5 px-3">Ngày</th>
                        <th className="py-2.5 px-3">Nhánh</th>
                        <th className="py-2.5 px-3">Khách hàng</th>
                        <th className="py-2.5 px-3">SĐT</th>
                        <th className="py-2.5 px-3">Địa chỉ</th>
                        <th className="py-2.5 px-3">Sản phẩm</th>
                        <th className="py-2.5 px-3">Vận chuyển</th>
                        <th className="py-2.5 px-3">Thanh toán</th>
                        <th className="py-2.5 px-2 text-center w-8">Xóa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#ECE7DD]">
                      {parsedOrders.map((ord, idx) => (
                        <tr key={idx} className="hover:bg-[#FAF8F4]/50">
                          <td className="py-2 px-3 whitespace-nowrap font-mono">{ord.date}</td>
                          <td className="py-2 px-3 whitespace-nowrap font-medium text-[#0D4F43]">{ord.brand}</td>
                          <td className="py-2 px-3 font-semibold text-[#1A1F1E]">{ord.customerName}</td>
                          <td className="py-2 px-3 font-mono text-[#57605E]">{ord.customerPhone}</td>
                          <td className="py-2 px-3 max-w-[150px] truncate" title={ord.shippingAddress}>
                            {ord.shippingAddress || '—'}
                          </td>
                          <td className="py-2 px-3">
                            {ord.items.map((it, i) => (
                              <div key={i} className="text-[11px] whitespace-nowrap">
                                {it.productCodeOrName} (x{it.quantity} - {it.size})
                              </div>
                            ))}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">{ord.shippingMethod}</td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                                ord.paymentStatus === 'Đã thanh toán'
                                  ? 'bg-[#0D4F43]/10 text-[#0D4F43]'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {ord.paymentStatus}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeOrderRow(idx)}
                              className="rounded p-1 text-[#A63429] hover:bg-red-50"
                              title="Xóa đơn này"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Preview Table for Products */}
              {mode === 'products' && (
                <div className="max-h-96 overflow-x-auto rounded-xl border border-[#E4DFD5]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF8F4] text-[#57605E]">
                      <tr className="border-b border-[#E4DFD5]">
                        <th className="py-2.5 px-3">Mã mẫu</th>
                        <th className="py-2.5 px-3">Tên sản phẩm</th>
                        <th className="py-2.5 px-3">Nhánh</th>
                        <th className="py-2.5 px-3 text-right">Giá vốn</th>
                        <th className="py-2.5 px-3 text-right">Giá bán</th>
                        <th className="py-2.5 px-3 text-center">Tồn kho ban đầu</th>
                        <th className="py-2.5 px-2 text-center w-8">Xóa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#ECE7DD]">
                      {parsedProducts.map((prod, idx) => (
                        <tr key={idx} className="hover:bg-[#FAF8F4]/50">
                          <td className="py-2 px-3 font-mono font-semibold text-[#0D4F43]">{prod.code}</td>
                          <td className="py-2 px-3 font-medium text-[#1A1F1E]">{prod.name}</td>
                          <td className="py-2 px-3 whitespace-nowrap">{prod.brand}</td>
                          <td className="py-2 px-3 text-right font-mono text-[#57605E]">
                            {formatVND(prod.costPrice)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-[#1A1F1E]">
                            {formatVND(prod.sellPrice)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="font-mono text-[11px] text-[#57605E]">
                              {Object.entries(prod.initialStock)
                                .map(([sz, q]) => `${sz}:${q}`)
                                .join(' · ') || '0'}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeProductRow(idx)}
                              className="rounded p-1 text-[#A63429] hover:bg-red-50"
                              title="Xóa mẫu này"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ECE7DD] bg-[#FAF8F4] p-4">
          <div className="text-[11px] text-[#57605E]">
            Model AI: <span className="font-mono font-medium text-purple-700">gemini-2.5-flash</span> (Structured Outputs)
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#E4DFD5] bg-white px-3.5 py-2 text-xs font-medium text-[#57605E] hover:bg-[#F3EFE6]"
            >
              Hủy bỏ
            </button>
            {step === 'input' ? (
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={loading || !rawText.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Đang dùng AI đọc và chuẩn hóa dữ liệu...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Phân tích dữ liệu bằng AI</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConfirmSave}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D4F43] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#093B32]"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  Xác nhận lưu tất cả vào hệ thống (
                  {mode === 'expenses'
                    ? parsedExpenses.length
                    : mode === 'orders'
                    ? parsedOrders.length
                    : parsedProducts.length}
                  )
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

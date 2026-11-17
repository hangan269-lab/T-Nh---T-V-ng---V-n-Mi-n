import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  ALL_BRANDS,
  ALL_SIZES,
  AppState,
  Brand,
  Product,
  SizeOption,
} from '../types/erp';
import {
  formatVND,
  getAvailableStock,
  getProductActiveSizes,
  SaveProductInput,
  suggestNextProductCode,
} from '../utils/finance';

interface ProductModalProps {
  open: boolean;
  editingProduct: Product | null;
  state: AppState;
  actorName: string;
  onClose: () => void;
  onSave: (input: SaveProductInput) => { ok: true; hasStockAdjustment?: boolean } | { ok: false; error: string };
}

export const ProductModal: React.FC<ProductModalProps> = ({
  open,
  editingProduct,
  state,
  actorName,
  onClose,
  onSave,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [code, setCode] = useState('');
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState<Brand>(Brand.TO_NHA);
  const [costPrice, setCostPrice] = useState('');
  const [sellPrice, setSellPrice] = useState('');

  // Stock per size: initial stock in Create mode, target current stock in Edit mode
  const [stockBySize, setStockBySize] = useState<Record<SizeOption, string>>({
    S: '0',
    M: '0',
    L: '0',
    Freesize: '0',
  });
  const [baselineCurrentStock, setBaselineCurrentStock] = useState<Record<SizeOption, number>>({
    S: 0,
    M: 0,
    L: 0,
    Freesize: 0,
  });
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setAdjustmentReason('');

    if (editingProduct) {
      setCode(editingProduct.code);
      setCodeManuallyEdited(true);
      setName(editingProduct.name);
      setBrand(editingProduct.brand);
      setCostPrice(String(editingProduct.costPrice));
      setSellPrice(String(editingProduct.sellPrice));

      const nextBaseline: Record<SizeOption, number> = { S: 0, M: 0, L: 0, Freesize: 0 };
      const nextStrings: Record<SizeOption, string> = { S: '0', M: '0', L: '0', Freesize: '0' };
      for (const s of ALL_SIZES) {
        const qty = getAvailableStock(
          editingProduct.id,
          s,
          state.products,
          state.stockImports,
          state.orders
        );
        nextBaseline[s] = qty;
        nextStrings[s] = String(qty);
      }
      setBaselineCurrentStock(nextBaseline);
      setStockBySize(nextStrings);
    } else {
      const defaultBrand = Brand.TO_NHA;
      setBrand(defaultBrand);
      setCode(suggestNextProductCode(defaultBrand, state.products));
      setCodeManuallyEdited(false);
      setName('');
      setCostPrice('');
      setSellPrice('');
      setBaselineCurrentStock({ S: 0, M: 0, L: 0, Freesize: 0 });
      setStockBySize({ S: '0', M: '0', L: '0', Freesize: '0' });
    }
  }, [open, editingProduct, state.products, state.stockImports, state.orders]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  if (!open) return null;

  const isEdit = Boolean(editingProduct);

  const visibleSizes: SizeOption[] = (() => {
    if (!editingProduct) {
      return brand === Brand.VAN_MIEN ? ['Freesize'] : ['S', 'M', 'L'];
    }
    const base: SizeOption[] = brand === Brand.VAN_MIEN ? ['Freesize'] : ['S', 'M', 'L'];
    const active = getProductActiveSizes(editingProduct, state.stockImports, state.orders);
    const merged = new Set<SizeOption>([...base, ...active]);
    return ALL_SIZES.filter((s) => merged.has(s));
  })();

  const hasAnyStockDiff =
    isEdit &&
    visibleSizes.some((s) => (Number(stockBySize[s]) || 0) !== baselineCurrentStock[s]);

  const handleBrandChange = (nextBrand: Brand) => {
    setBrand(nextBrand);
    if (!isEdit && !codeManuallyEdited) {
      setCode(suggestNextProductCode(nextBrand, state.products));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedCode = code.trim();
    const trimmedName = name.trim();
    const cost = Number(costPrice);
    const sell = Number(sellPrice);

    if (!trimmedCode || !trimmedName) {
      setError('Vui lòng nhập đầy đủ Mã mẫu và Tên mẫu sản phẩm.');
      return;
    }
    if (!Number.isFinite(cost) || cost < 0 || !Number.isFinite(sell) || sell < 0) {
      setError('Giá nhập và Giá bán niêm yết phải lớn hơn hoặc bằng 0.');
      return;
    }

    for (const s of visibleSizes) {
      const val = Number(stockBySize[s]);
      if (!Number.isFinite(val) || val < 0) {
        setError(`Số lượng tồn kho của ${s === 'Freesize' ? 'Freesize / Hộp' : `Size ${s}`} không hợp lệ.`);
        return;
      }
    }

    if (editingProduct) {
      const targetCurrentStock: Partial<Record<SizeOption, number>> = {};
      for (const s of visibleSizes) {
        targetCurrentStock[s] = Math.max(0, Math.round(Number(stockBySize[s]) || 0));
      }
      const res = onSave({
        id: editingProduct.id,
        code: trimmedCode,
        name: trimmedName,
        brand,
        costPrice: cost,
        sellPrice: sell,
        initialStock: editingProduct.initialStock,
        targetCurrentStock,
        adjustmentReason: adjustmentReason.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onClose();
      return;
    }

    const initialStock: Partial<Record<SizeOption, number>> = {};
    for (const s of visibleSizes) {
      initialStock[s] = Math.max(0, Math.round(Number(stockBySize[s]) || 0));
    }

    const res = onSave({
      code: trimmedCode,
      name: trimmedName,
      brand,
      costPrice: cost,
      sellPrice: sell,
      initialStock,
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onClose();
  };

  const marginPreview =
    costPrice !== '' && sellPrice !== '' ? (Number(sellPrice) || 0) - (Number(costPrice) || 0) : null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="product-modal-title"
      className="fixed inset-0 z-50 m-auto w-full max-w-2xl rounded-xl border border-[#E4DFD5] bg-white p-0 text-[#1A1F1E] shadow-xl backdrop:bg-[#1A1F1E]/40"
    >
      <div className="max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-4 border-b border-[#ECE7DD] pb-4">
          <div>
            <h2 id="product-modal-title" className="font-serif text-xl font-semibold text-[#1A1F1E]">
              {isEdit ? 'Chỉnh sửa mẫu & Điều chỉnh tồn kho' : 'Thêm mẫu sản phẩm mới'}
            </h2>
            <p className="mt-0.5 text-xs text-[#57605E]">
              Người thao tác: <strong className="text-[#0D4F43]">{actorName}</strong>
              {isEdit
                ? ' · Tên và giá bán mới chỉ áp dụng cho đơn hàng tạo từ bây giờ, không đổi dữ liệu đơn cũ.'
                : ' · Mẫu mới sẽ lập tức xuất hiện trong Kho hàng và danh sách chọn mẫu khi tạo Đơn hàng.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hộp thoại mẫu sản phẩm"
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="prd-modal-brand" className="block text-xs font-medium text-[#57605E]">
                Nhánh thương hiệu
              </label>
              <select
                id="prd-modal-brand"
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
              <label htmlFor="prd-modal-code" className="block text-xs font-medium text-[#57605E]">
                Mã mẫu {!isEdit && <span className="text-[#0D4F43]">(tự gợi ý, có thể sửa)</span>}
              </label>
              <input
                id="prd-modal-code"
                type="text"
                placeholder="Ví dụ: TN-04, TV-03, VM-03"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setCodeManuallyEdited(true);
                }}
                className="mt-1.5 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 font-mono text-sm text-[#1A1F1E] focus:border-[#0D4F43] focus:outline-none"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="prd-modal-name" className="block text-xs font-medium text-[#57605E]">
                Tên mẫu sản phẩm <span className="text-[#A63429]">*</span>
              </label>
              <input
                id="prd-modal-name"
                type="text"
                placeholder="Ví dụ: Áo dài Lụa Sen Hồng / Set Trà Hoa Cúc"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-sm text-[#1A1F1E] focus:border-[#0D4F43] focus:outline-none"
                required
              />
            </div>

            <div>
              <label htmlFor="prd-modal-cost" className="block text-xs font-medium text-[#57605E]">
                Giá nhập mặc định (VNĐ)
              </label>
              <input
                id="prd-modal-cost"
                type="number"
                min={0}
                step={1000}
                placeholder="650000"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 font-mono text-sm text-[#1A1F1E] tabular-nums focus:border-[#0D4F43] focus:outline-none"
                required
              />
            </div>

            <div>
              <label htmlFor="prd-modal-sell" className="block text-xs font-medium text-[#57605E]">
                Giá bán niêm yết (VNĐ)
              </label>
              <input
                id="prd-modal-sell"
                type="number"
                min={0}
                step={1000}
                placeholder="1450000"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 font-mono text-sm text-[#1A1F1E] tabular-nums focus:border-[#0D4F43] focus:outline-none"
                required
              />
              {marginPreview !== null && (
                <p className="mt-1 text-[11px] text-[#57605E]">
                  Biên lãi dự kiến:{' '}
                  <span
                    className={`font-mono font-semibold tabular-nums ${
                      marginPreview < 0 ? 'text-[#A63429]' : 'text-[#0D4F43]'
                    }`}
                  >
                    {formatVND(marginPreview)}
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* Phân loại Size & Tồn kho */}
          <div className="rounded-xl border border-[#ECE7DD] bg-[#FAF8F4] p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-xs font-semibold text-[#1A1F1E]">
                {isEdit
                  ? 'Điều chỉnh trực tiếp tồn kho hiện tại theo Size'
                  : brand === Brand.VAN_MIEN
                    ? 'Phân loại Freesize / Hộp & Tồn kho ban đầu'
                    : 'Phân loại Size (S, M, L) & Tồn kho ban đầu'}
              </h3>
              <span className="text-[11px] text-[#57605E]">
                {isEdit
                  ? 'Sửa trực tiếp khi kiểm kê lệch hoặc hàng lỗi/hỏng'
                  : 'Mặc định bằng 0 nếu chưa nhập hàng'}
              </span>
            </div>

            <div
              className={`mt-3 grid gap-3 ${
                visibleSizes.length === 1
                  ? 'grid-cols-1 sm:max-w-xs'
                  : visibleSizes.length === 3
                    ? 'grid-cols-3'
                    : 'grid-cols-2 sm:grid-cols-4'
              }`}
            >
              {visibleSizes.map((s) => {
                const label = s === 'Freesize' ? 'Freesize / Hộp' : `Size ${s}`;
                const nextNum = Number(stockBySize[s]) || 0;
                const prevNum = baselineCurrentStock[s];
                const diff = nextNum - prevNum;
                return (
                  <div key={s} className="rounded-lg border border-[#E4DFD5] bg-white p-3">
                    <label
                      htmlFor={`prd-modal-stock-${s}`}
                      className="flex items-center justify-between text-xs font-medium text-[#1A1F1E]"
                    >
                      <span>{label}</span>
                      {isEdit && (
                        <span className="font-mono text-[11px] text-[#57605E] tabular-nums">
                          Hiện: {prevNum}
                        </span>
                      )}
                    </label>
                    <input
                      id={`prd-modal-stock-${s}`}
                      type="number"
                      min={0}
                      value={stockBySize[s]}
                      onChange={(e) =>
                        setStockBySize((prev) => ({ ...prev, [s]: e.target.value }))
                      }
                      className="mt-1.5 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-1.5 font-mono text-sm font-semibold text-[#1A1F1E] tabular-nums focus:border-[#0D4F43] focus:outline-none"
                    />
                    {isEdit && diff !== 0 && (
                      <div
                        className={`mt-1 font-mono text-[11px] font-semibold tabular-nums ${
                          diff > 0 ? 'text-[#0D4F43]' : 'text-[#A63429]'
                        }`}
                      >
                        Điều chỉnh: {diff > 0 ? `+${diff}` : diff}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {hasAnyStockDiff && (
              <div className="mt-3">
                <label
                  htmlFor="prd-modal-adj-reason"
                  className="block text-xs font-medium text-[#57605E]"
                >
                  Lý do điều chỉnh tồn kho (ghi vào Lịch sử thao tác)
                </label>
                <input
                  id="prd-modal-adj-reason"
                  type="text"
                  placeholder="Ví dụ: Kiểm kê thực tế cuối tuần / 1 áo bị lỗi đường may..."
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-xs text-[#1A1F1E] focus:border-[#0D4F43] focus:outline-none"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t border-[#ECE7DD] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#E4DFD5] bg-white px-4 py-2 text-xs font-medium text-[#1A1F1E] hover:bg-[#FAF8F4] whitespace-nowrap shrink-0"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#0D4F43] px-5 py-2 text-xs font-medium text-white hover:bg-[#093B32] whitespace-nowrap shrink-0"
            >
              {isEdit ? 'Lưu thay đổi mẫu' : 'Lưu mẫu mới'}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
};

import React, { useMemo, useState } from 'react';
import { AlertTriangle, Edit3, PackagePlus, Plus, X } from 'lucide-react';
import {
  ALL_BRANDS,
  ALL_SIZES,
  AppState,
  Brand,
  Product,
  SizeOption,
  StockImport,
  UserAccount,
} from '../types/erp';
import { computeInventoryRows, formatDateVN, formatVND, getTodayISO } from '../utils/finance';

interface InventoryTabProps {
  state: AppState;
  currentUser: UserAccount;
  onSaveProduct: (product: Omit<Product, 'id'> & { id?: string }) => void;
  onAddStockImport: (
    imp: Omit<StockImport, 'id' | 'enteredBy'>,
    alsoRecordCashExpense: boolean
  ) => void;
}

export const InventoryTab: React.FC<InventoryTabProps> = ({
  state,
  currentUser,
  onSaveProduct,
  onAddStockImport,
}) => {
  const [brandFilter, setBrandFilter] = useState<'all' | Brand>('all');
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [showImportForm, setShowImportForm] = useState(false);

  // Product form state
  const [pCode, setPCode] = useState('');
  const [pName, setPName] = useState('');
  const [pBrand, setPBrand] = useState<Brand>(Brand.TO_NHA);
  const [pCostPrice, setPCostPrice] = useState('');
  const [pSellPrice, setPSellPrice] = useState('');
  const [pInitS, setPInitS] = useState('0');
  const [pInitM, setPInitM] = useState('0');
  const [pInitL, setPInitL] = useState('0');
  const [pInitFreesize, setPInitFreesize] = useState('0');
  const [productError, setProductError] = useState<string | null>(null);

  // Stock import form state
  const [impDate, setImpDate] = useState(getTodayISO());
  const [impProductId, setImpProductId] = useState(state.products[0]?.id ?? '');
  const [impSize, setImpSize] = useState<SizeOption>('M');
  const [impQty, setImpQty] = useState('1');
  const [impUnitCost, setImpUnitCost] = useState(
    state.products[0] ? String(state.products[0].costPrice) : '0'
  );
  const [impNote, setImpNote] = useState('');
  const [alsoRecordExpense, setAlsoRecordExpense] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const inventoryRows = useMemo(() => {
    const rows = computeInventoryRows(state.products, state.stockImports, state.orders);
    if (brandFilter === 'all') return rows;
    return rows.filter((r) => r.brand === brandFilter);
  }, [state.products, state.stockImports, state.orders, brandFilter]);

  const filteredProducts = useMemo(() => {
    if (brandFilter === 'all') return state.products;
    return state.products.filter((p) => p.brand === brandFilter);
  }, [state.products, brandFilter]);

  const lowStockCount = inventoryRows.filter((r) => r.isLowStock).length;

  const openNewProductForm = () => {
    setEditingProductId(null);
    setPCode('');
    setPName('');
    setPBrand(Brand.TO_NHA);
    setPCostPrice('');
    setPSellPrice('');
    setPInitS('1');
    setPInitM('2');
    setPInitL('1');
    setPInitFreesize('0');
    setProductError(null);
    setShowProductForm(true);
    setShowImportForm(false);
  };

  const openEditProductForm = (p: Product) => {
    setEditingProductId(p.id);
    setPCode(p.code);
    setPName(p.name);
    setPBrand(p.brand);
    setPCostPrice(String(p.costPrice));
    setPSellPrice(String(p.sellPrice));
    setPInitS(String(p.initialStock.S ?? 0));
    setPInitM(String(p.initialStock.M ?? 0));
    setPInitL(String(p.initialStock.L ?? 0));
    setPInitFreesize(String(p.initialStock.Freesize ?? 0));
    setProductError(null);
    setShowProductForm(true);
    setShowImportForm(false);
  };

  const openImportModal = (preselectProduct?: Product, preselectSize?: SizeOption) => {
    const target = preselectProduct ?? state.products[0];
    setImpDate(getTodayISO());
    setImpProductId(target?.id ?? '');
    setImpSize(
      preselectSize ?? (target?.brand === Brand.VAN_MIEN ? 'Freesize' : 'M')
    );
    setImpQty('2');
    setImpUnitCost(target ? String(target.costPrice) : '0');
    setImpNote('');
    setImportError(null);
    setShowImportForm(true);
    setShowProductForm(false);
  };

  const handleSaveProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = pCode.trim();
    const name = pName.trim();
    const cost = Number(pCostPrice);
    const sell = Number(pSellPrice);

    if (!code || !name) {
      setProductError('Vui lòng nhập đầy đủ Mã mẫu và Tên mẫu.');
      return;
    }
    if (!Number.isFinite(cost) || cost < 0 || !Number.isFinite(sell) || sell < 0) {
      setProductError('Giá nhập và Giá bán không hợp lệ.');
      return;
    }

    const initialStock: Partial<Record<SizeOption, number>> = {};
    if (pBrand === Brand.VAN_MIEN) {
      initialStock.Freesize = Math.max(0, Number(pInitFreesize) || 0);
      if ((Number(pInitS) || 0) > 0) initialStock.S = Number(pInitS);
      if ((Number(pInitM) || 0) > 0) initialStock.M = Number(pInitM);
      if ((Number(pInitL) || 0) > 0) initialStock.L = Number(pInitL);
    } else {
      initialStock.S = Math.max(0, Number(pInitS) || 0);
      initialStock.M = Math.max(0, Number(pInitM) || 0);
      initialStock.L = Math.max(0, Number(pInitL) || 0);
      if ((Number(pInitFreesize) || 0) > 0) initialStock.Freesize = Number(pInitFreesize);
    }

    onSaveProduct({
      id: editingProductId ?? undefined,
      code,
      name,
      brand: pBrand,
      costPrice: cost,
      sellPrice: sell,
      initialStock,
    });
    setShowProductForm(false);
  };

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(impQty);
    const unitCost = Number(impUnitCost);
    if (!impProductId) {
      setImportError('Vui lòng chọn mẫu sản phẩm.');
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setImportError('Số lượng nhập phải lớn hơn 0.');
      return;
    }
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      setImportError('Đơn giá nhập không hợp lệ.');
      return;
    }

    onAddStockImport(
      {
        date: impDate,
        productId: impProductId,
        size: impSize,
        quantity: qty,
        unitCost,
        note: impNote.trim(),
      },
      alsoRecordExpense
    );
    setShowImportForm(false);
  };

  return (
    <div className="space-y-6">
      {/* Toolbar lọc nhánh & thao tác */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div
          className="flex flex-wrap items-center gap-1 rounded-lg bg-[#F3EFE6] p-1"
          role="group"
          aria-label="Lọc kho theo nhánh"
        >
          <button
            type="button"
            onClick={() => setBrandFilter('all')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              brandFilter === 'all'
                ? 'bg-white text-[#1A1F1E] shadow-xs'
                : 'text-[#57605E] hover:text-[#1A1F1E]'
            }`}
          >
            Tất cả nhánh
          </button>
          {ALL_BRANDS.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBrandFilter(b)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                brandFilter === b
                  ? 'bg-white text-[#1A1F1E] shadow-xs'
                  : 'text-[#57605E] hover:text-[#1A1F1E]'
              }`}
            >
              {b}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={openNewProductForm}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4DFD5] bg-white px-3.5 py-2 text-xs font-medium text-[#1A1F1E] transition-colors hover:bg-[#FAF8F4] whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Thêm mẫu mới
          </button>
          <button
            type="button"
            onClick={() => openImportModal()}
            disabled={state.products.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D4F43] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#093B32] disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <PackagePlus className="h-4 w-4" />
            Nhập kho mới
          </button>
        </div>
      </div>

      {/* Form Thêm / Sửa mẫu */}
      {showProductForm && (
        <section
          aria-labelledby="product-form-heading"
          className="rounded-xl border border-[#0D4F43]/30 bg-white p-6"
        >
          <div className="flex items-center justify-between gap-4 border-b border-[#ECE7DD] pb-4">
            <div>
              <h2 id="product-form-heading" className="font-serif text-xl font-semibold text-[#1A1F1E]">
                {editingProductId ? 'Chỉnh sửa mẫu sản phẩm' : 'Thêm mẫu sản phẩm mới'}
              </h2>
              <p className="mt-0.5 text-xs text-[#57605E]">
                Người thao tác: <strong className="text-[#0D4F43]">{currentUser.name}</strong> · Mọi thay đổi giá hoặc tồn kho đều được lưu vết vào Lịch sử thao tác.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowProductForm(false)}
              aria-label="Đóng biểu mẫu sản phẩm"
              className="rounded-lg p-1.5 text-[#57605E] hover:bg-[#F3EFE6]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSaveProductSubmit} className="mt-5 space-y-4">
            {productError && (
              <div role="alert" className="rounded-lg bg-[#A63429]/10 px-4 py-2.5 text-sm text-[#A63429]">
                {productError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label htmlFor="prd-code" className="block text-xs font-medium text-[#57605E]">
                  Mã mẫu
                </label>
                <input
                  id="prd-code"
                  type="text"
                  placeholder="Ví dụ: TN-03"
                  value={pCode}
                  onChange={(e) => setPCode(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 font-mono text-sm text-[#1A1F1E] focus:border-[#0D4F43] focus:outline-none"
                  required
                />
              </div>

              <div className="lg:col-span-2">
                <label htmlFor="prd-name" className="block text-xs font-medium text-[#57605E]">
                  Tên mẫu sản phẩm
                </label>
                <input
                  id="prd-name"
                  type="text"
                  placeholder="Áo dài Lụa Tơ Tằm"
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-sm text-[#1A1F1E] focus:border-[#0D4F43] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label htmlFor="prd-brand" className="block text-xs font-medium text-[#57605E]">
                  Nhánh thương hiệu
                </label>
                <select
                  id="prd-brand"
                  value={pBrand}
                  onChange={(e) => setPBrand(e.target.value as Brand)}
                  className="mt-1.5 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-sm text-[#1A1F1E] focus:border-[#0D4F43] focus:outline-none"
                >
                  {ALL_BRANDS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="prd-cost" className="block text-xs font-medium text-[#57605E]">
                    Giá nhập (đ)
                  </label>
                  <input
                    id="prd-cost"
                    type="number"
                    min={0}
                    step={1000}
                    value={pCostPrice}
                    onChange={(e) => setPCostPrice(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-2 font-mono text-sm text-[#1A1F1E] tabular-nums focus:border-[#0D4F43] focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="prd-sell" className="block text-xs font-medium text-[#57605E]">
                    Giá bán (đ)
                  </label>
                  <input
                    id="prd-sell"
                    type="number"
                    min={0}
                    step={1000}
                    value={pSellPrice}
                    onChange={(e) => setPSellPrice(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-2 font-mono text-sm text-[#1A1F1E] tabular-nums focus:border-[#0D4F43] focus:outline-none"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-[#ECE7DD] pt-4">
              <div className="text-xs font-medium text-[#57605E]">
                Tồn đầu kỳ theo Size (để 0 nếu chưa có sẵn)
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <label htmlFor="init-s" className="block text-xs text-[#57605E]">
                    Size S
                  </label>
                  <input
                    id="init-s"
                    type="number"
                    min={0}
                    value={pInitS}
                    onChange={(e) => setPInitS(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#E4DFD5] px-3 py-1.5 font-mono text-sm tabular-nums focus:border-[#0D4F43] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="init-m" className="block text-xs text-[#57605E]">
                    Size M
                  </label>
                  <input
                    id="init-m"
                    type="number"
                    min={0}
                    value={pInitM}
                    onChange={(e) => setPInitM(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#E4DFD5] px-3 py-1.5 font-mono text-sm tabular-nums focus:border-[#0D4F43] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="init-l" className="block text-xs text-[#57605E]">
                    Size L
                  </label>
                  <input
                    id="init-l"
                    type="number"
                    min={0}
                    value={pInitL}
                    onChange={(e) => setPInitL(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#E4DFD5] px-3 py-1.5 font-mono text-sm tabular-nums focus:border-[#0D4F43] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="init-fs" className="block text-xs text-[#57605E]">
                    Freesize
                  </label>
                  <input
                    id="init-fs"
                    type="number"
                    min={0}
                    value={pInitFreesize}
                    onChange={(e) => setPInitFreesize(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#E4DFD5] px-3 py-1.5 font-mono text-sm tabular-nums focus:border-[#0D4F43] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowProductForm(false)}
                className="rounded-lg border border-[#E4DFD5] bg-white px-4 py-2 text-sm font-medium text-[#1A1F1E] hover:bg-[#FAF8F4]"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="rounded-lg bg-[#0D4F43] px-5 py-2 text-sm font-medium text-white hover:bg-[#093B32]"
              >
                {editingProductId ? 'Cập nhật mẫu' : 'Lưu mẫu mới'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Form Nhập kho mới */}
      {showImportForm && (
        <section
          aria-labelledby="stock-import-heading"
          className="rounded-xl border border-[#0D4F43]/30 bg-white p-6"
        >
          <div className="flex items-center justify-between gap-4 border-b border-[#ECE7DD] pb-4">
            <div>
              <h2 id="stock-import-heading" className="font-serif text-xl font-semibold text-[#1A1F1E]">
                Nhập kho mới
              </h2>
              <p className="mt-0.5 text-xs text-[#57605E]">
                Người nhập liệu: <strong className="text-[#0D4F43]">{currentUser.name}</strong> · Số lượng và đơn giá nhập tự động cộng vào Tồn kho và Tổng giá nhập.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowImportForm(false)}
              aria-label="Đóng biểu mẫu nhập kho"
              className="rounded-lg p-1.5 text-[#57605E] hover:bg-[#F3EFE6]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleImportSubmit} className="mt-5 space-y-4">
            {importError && (
              <div role="alert" className="rounded-lg bg-[#A63429]/10 px-4 py-2.5 text-sm text-[#A63429]">
                {importError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label htmlFor="imp-date" className="block text-xs font-medium text-[#57605E]">
                  Ngày nhập
                </label>
                <input
                  id="imp-date"
                  type="date"
                  value={impDate}
                  onChange={(e) => setImpDate(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-sm text-[#1A1F1E] focus:border-[#0D4F43] focus:outline-none"
                  required
                />
              </div>

              <div className="lg:col-span-2">
                <label htmlFor="imp-product" className="block text-xs font-medium text-[#57605E]">
                  Chọn mẫu sản phẩm
                </label>
                <select
                  id="imp-product"
                  value={impProductId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setImpProductId(id);
                    const p = state.products.find((item) => item.id === id);
                    if (p) {
                      setImpUnitCost(String(p.costPrice));
                      if (p.brand === Brand.VAN_MIEN) setImpSize('Freesize');
                    }
                  }}
                  className="mt-1.5 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-sm text-[#1A1F1E] focus:border-[#0D4F43] focus:outline-none"
                >
                  {state.products.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.brand}] {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="imp-size" className="block text-xs font-medium text-[#57605E]">
                  Size / Phân loại
                </label>
                <select
                  id="imp-size"
                  value={impSize}
                  onChange={(e) => setImpSize(e.target.value as SizeOption)}
                  className="mt-1.5 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-sm text-[#1A1F1E] focus:border-[#0D4F43] focus:outline-none"
                >
                  {ALL_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="imp-qty" className="block text-xs font-medium text-[#57605E]">
                    Số lượng
                  </label>
                  <input
                    id="imp-qty"
                    type="number"
                    min={1}
                    value={impQty}
                    onChange={(e) => setImpQty(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-[#E4DFD5] px-2.5 py-2 font-mono text-sm tabular-nums focus:border-[#0D4F43] focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="imp-cost" className="block text-xs font-medium text-[#57605E]">
                    Đơn giá nhập
                  </label>
                  <input
                    id="imp-cost"
                    type="number"
                    min={0}
                    step={1000}
                    value={impUnitCost}
                    onChange={(e) => setImpUnitCost(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-[#E4DFD5] px-2.5 py-2 font-mono text-sm tabular-nums focus:border-[#0D4F43] focus:outline-none"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-center">
              <div>
                <label htmlFor="imp-note" className="block text-xs font-medium text-[#57605E]">
                  Ghi chú nhập hàng
                </label>
                <input
                  id="imp-note"
                  type="text"
                  placeholder="Xưởng may, lô trà..."
                  value={impNote}
                  onChange={(e) => setImpNote(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#E4DFD5] px-3 py-2 text-sm focus:border-[#0D4F43] focus:outline-none"
                />
              </div>

              <label className="mt-4 flex items-center gap-2.5 text-sm text-[#1A1F1E] cursor-pointer">
                <input
                  type="checkbox"
                  checked={alsoRecordExpense}
                  onChange={(e) => setAlsoRecordExpense(e.target.checked)}
                  className="h-4 w-4 rounded border-[#E4DFD5] accent-[#0D4F43]"
                />
                <span>Đồng thời ghi khoản chi "Nhập hàng" vào Quỹ tiền mặt</span>
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#ECE7DD] pt-4">
              <div className="text-sm text-[#57605E]">
                Thành tiền phiếu nhập:{' '}
                <span className="font-mono text-base font-semibold text-[#1A1F1E] tabular-nums">
                  {formatVND((Number(impQty) || 0) * (Number(impUnitCost) || 0))}
                </span>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowImportForm(false)}
                  className="rounded-lg border border-[#E4DFD5] bg-white px-4 py-2 text-sm font-medium text-[#1A1F1E] hover:bg-[#FAF8F4]"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#0D4F43] px-5 py-2 text-sm font-medium text-white hover:bg-[#093B32]"
                >
                  Xác nhận nhập kho
                </button>
              </div>
            </div>
          </form>
        </section>
      )}

      {/* Bảng 1: Theo dõi Nhập - Xuất - Tồn chi tiết theo Size */}
      <section aria-labelledby="inventory-ledger-heading" className="rounded-xl border border-[#E4DFD5] bg-white p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-[#ECE7DD] pb-4">
          <div>
            <h2 id="inventory-ledger-heading" className="font-serif text-xl font-semibold text-[#1A1F1E]">
              Bảng theo dõi Tồn kho theo Size (Nhập - Xuất - Tồn)
            </h2>
            <p className="mt-0.5 text-xs text-[#57605E]">
              Tự động tổng hợp từ Tồn đầu kỳ, Phiếu nhập kho và Đơn bán hàng ·{' '}
              <span className={lowStockCount > 0 ? 'font-semibold text-[#A63429]' : ''}>
                {lowStockCount} phân loại sắp hết (&le; 1 sp)
              </span>
            </p>
          </div>
        </div>

        {inventoryRows.length === 0 ? (
          <div className="mt-6 rounded-lg bg-[#FAF8F4] px-6 py-10 text-center">
            <p className="text-sm font-medium text-[#1A1F1E]">Chưa có dữ liệu tồn kho</p>
            <p className="mt-1 text-xs text-[#57605E]">
              Hãy thêm mẫu sản phẩm mới để bắt đầu theo dõi nhập xuất tồn theo size.
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#E4DFD5] text-xs font-semibold text-[#57605E]">
                  <th className="py-3 pr-3">Mã / Tên mẫu</th>
                  <th className="py-3 px-3">Nhánh</th>
                  <th className="py-3 px-3 text-center">Size</th>
                  <th className="py-3 px-3 text-right">Tồn đầu kỳ</th>
                  <th className="py-3 px-3 text-right">Tổng nhập</th>
                  <th className="py-3 px-3 text-right">Tổng bán</th>
                  <th className="py-3 px-3 text-right">Tồn hiện tại</th>
                  <th className="py-3 pl-3 text-right">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECE7DD]">
                {inventoryRows.map((row) => (
                  <tr
                    key={row.key}
                    className={`transition-colors hover:bg-[#FAF8F4] ${
                      row.isLowStock ? 'bg-[#A63429]/[0.03]' : ''
                    }`}
                  >
                    <td className="py-3 pr-3">
                      <span className="font-mono text-xs font-semibold text-[#1A1F1E]">
                        {row.productCode}
                      </span>{' '}
                      <span className="text-[#1A1F1E]">{row.productName}</span>
                    </td>
                    <td className="py-3 px-3 text-xs text-[#57605E]">{row.brand}</td>
                    <td className="py-3 px-3 text-center font-mono text-xs font-semibold text-[#1A1F1E]">
                      {row.size}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-[#57605E] tabular-nums">
                      {row.initialStock}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-[#0D4F43] tabular-nums">
                      +{row.totalImported}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-[#57605E] tabular-nums">
                      -{row.totalSold}
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-mono text-base font-semibold tabular-nums ${
                        row.isLowStock ? 'text-[#A63429]' : 'text-[#1A1F1E]'
                      }`}
                    >
                      {row.currentStock}
                    </td>
                    <td className="py-3 pl-3 text-right">
                      {row.isLowStock ? (
                        <span className="inline-flex items-center gap-1 rounded bg-[#A63429]/10 px-2 py-1 text-xs font-semibold text-[#A63429]">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {row.currentStock <= 0 ? 'Hết hàng' : 'Sắp hết'}
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-[#0D4F43]">Còn hàng</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Bảng 2: Danh mục mẫu & Giá niêm yết */}
      <section aria-labelledby="catalog-heading" className="rounded-xl border border-[#E4DFD5] bg-white p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-[#ECE7DD] pb-4">
          <div>
            <h2 id="catalog-heading" className="font-serif text-xl font-semibold text-[#1A1F1E]">
              Danh mục mẫu sản phẩm ({filteredProducts.length})
            </h2>
            <p className="mt-0.5 text-xs text-[#57605E]">
              Quản lý mã mẫu, giá nhập vốn và giá bán niêm yết theo từng nhánh thương hiệu.
            </p>
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="mt-6 rounded-lg bg-[#FAF8F4] px-6 py-8 text-center text-sm text-[#57605E]">
            Chưa có mẫu sản phẩm nào. Nhấn "Thêm mẫu mới" ở trên để khởi tạo danh mục.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#E4DFD5] text-xs font-semibold text-[#57605E]">
                  <th className="py-3 pr-3">Mã mẫu</th>
                  <th className="py-3 px-3">Tên mẫu</th>
                  <th className="py-3 px-3">Nhánh</th>
                  <th className="py-3 px-3 text-right">Giá nhập</th>
                  <th className="py-3 px-3 text-right">Giá bán niêm yết</th>
                  <th className="py-3 pl-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECE7DD]">
                {filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-[#FAF8F4]">
                    <td className="py-3 pr-3 font-mono text-xs font-semibold text-[#1A1F1E]">
                      {p.code}
                    </td>
                    <td className="py-3 px-3 font-medium text-[#1A1F1E]">{p.name}</td>
                    <td className="py-3 px-3 text-xs text-[#57605E]">{p.brand}</td>
                    <td className="py-3 px-3 text-right font-mono text-[#57605E] tabular-nums">
                      {formatVND(p.costPrice)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-[#1A1F1E] tabular-nums">
                      {formatVND(p.sellPrice)}
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditProductForm(p)}
                          aria-label={`Sửa mẫu ${p.code}`}
                          className="inline-flex items-center gap-1 rounded-md border border-[#E4DFD5] bg-white px-2.5 py-1 text-xs font-medium text-[#1A1F1E] hover:bg-[#FAF8F4]"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => openImportModal(p)}
                          className="rounded-md bg-[#0D4F43]/10 px-2.5 py-1 text-xs font-medium text-[#0D4F43] hover:bg-[#0D4F43]/20"
                        >
                          Nhập thêm
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Lịch sử nhập kho gần đây */}
        {state.stockImports.length > 0 && (
          <div className="mt-8 border-t border-[#ECE7DD] pt-5">
            <h3 className="text-xs font-semibold text-[#57605E]">
              Lịch sử phiếu nhập kho gần đây ({state.stockImports.length})
            </h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-xs">
                <thead>
                  <tr className="border-b border-[#ECE7DD] text-[#57605E]">
                    <th className="py-2 pr-3">Ngày nhập</th>
                    <th className="py-2 px-3">Người nhập</th>
                    <th className="py-2 px-3">Mẫu sản phẩm</th>
                    <th className="py-2 px-3 text-center">Size</th>
                    <th className="py-2 px-3 text-right">SL</th>
                    <th className="py-2 px-3 text-right">Đơn giá nhập</th>
                    <th className="py-2 pl-3 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECE7DD]">
                  {state.stockImports.slice(0, 8).map((imp) => {
                    const prd = state.products.find((p) => p.id === imp.productId);
                    return (
                      <tr key={imp.id}>
                        <td className="py-2 pr-3 font-mono text-[#57605E]">
                          {formatDateVN(imp.date)}
                        </td>
                        <td className="py-2 px-3 font-medium text-[#1A1F1E]">
                          {imp.enteredBy || 'Hệ thống'}
                        </td>
                        <td className="py-2 px-3 text-[#1A1F1E]">
                          {prd ? `${prd.code} — ${prd.name}` : imp.productId}
                          {imp.note && <span className="ml-2 text-[#57605E]">({imp.note})</span>}
                        </td>
                        <td className="py-2 px-3 text-center font-mono">{imp.size}</td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-[#0D4F43] tabular-nums">
                          +{imp.quantity}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-[#57605E] tabular-nums">
                          {formatVND(imp.unitCost)}
                        </td>
                        <td className="py-2 pl-3 text-right font-mono font-medium text-[#1A1F1E] tabular-nums">
                          {formatVND(imp.quantity * imp.unitCost)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

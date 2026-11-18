import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  ChevronDown,
  ChevronUp,
  Edit3,
  LayoutGrid,
  PackagePlus,
  Plus,
  PlusCircle,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
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
import {
  computeInventoryRows,
  formatDateVN,
  formatVND,
  getAvailableStock,
  getProductActiveSizes,
  getTodayISO,
  SaveProductInput,
  suggestNextProductCode,
} from '../utils/finance';
import { ConfirmModal } from './ConfirmModal';
import { DeleteProductModal } from './DeleteProductModal';
import { ProductModal } from './ProductModal';

type InventorySectionId = 'catalog' | 'ledger' | 'import_stock' | 'add_product';

interface InventoryTabProps {
  state: AppState;
  currentUser: UserAccount;
  onSaveProduct: (
    product: SaveProductInput
  ) => { ok: true; hasStockAdjustment?: boolean } | { ok: false; error: string };
  onArchiveProduct: (productId: string, archive: boolean) => void;
  onDeleteProduct: (productId: string) => void;
  onAddStockImport: (
    imp: Omit<StockImport, 'id' | 'enteredBy'>,
    alsoRecordCashExpense: boolean
  ) => void;
  onUpdateStockImport: (
    importId: string,
    patch: Omit<StockImport, 'id' | 'enteredBy'>
  ) => { ok: true } | { ok: false; error: string };
  onDeleteStockImport: (importId: string) => void;
  onOpenAiExcelImport?: () => void;
}

export const InventoryTab: React.FC<InventoryTabProps> = ({
  state,
  currentUser,
  onSaveProduct,
  onArchiveProduct,
  onDeleteProduct,
  onAddStockImport,
  onUpdateStockImport,
  onDeleteStockImport,
  onOpenAiExcelImport,
}) => {
  const isAdmin = currentUser.role === 'Admin';
  const [brandFilter, setBrandFilter] = useState<'all' | Brand>('all');

  // Collapsed by default: user clicks an icon card to open its full content
  const [activeSection, setActiveSection] = useState<InventorySectionId | null>(null);

  // Edit product modal & Safe delete modal
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const activeProducts = useMemo(
    () => state.products.filter((p) => !p.isArchived),
    [state.products]
  );

  // Inline Add Product form state (inside 'add_product' icon section)
  const [newProdBrand, setNewProdBrand] = useState<Brand>(Brand.TO_NHA);
  const [newProdCode, setNewProdCode] = useState(() =>
    suggestNextProductCode(Brand.TO_NHA, state.products)
  );
  const [newProdCodeEdited, setNewProdCodeEdited] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdCost, setNewProdCost] = useState('');
  const [newProdSell, setNewProdSell] = useState('');
  const [newProdStock, setNewProdStock] = useState<Record<SizeOption, string>>({
    S: '0',
    M: '0',
    L: '0',
    Freesize: '0',
  });
  const [newProdError, setNewProdError] = useState<string | null>(null);
  const [newProdSuccess, setNewProdSuccess] = useState<string | null>(null);

  // Inline Stock Import form state (inside 'import_stock' icon section)
  const [impDate, setImpDate] = useState(getTodayISO());
  const [impProductId, setImpProductId] = useState(activeProducts[0]?.id ?? '');
  const [impSize, setImpSize] = useState<SizeOption>('M');
  const [impQty, setImpQty] = useState('2');
  const [impUnitCost, setImpUnitCost] = useState(
    activeProducts[0] ? String(activeProducts[0].costPrice) : '0'
  );
  const [impNote, setImpNote] = useState('');
  const [alsoRecordExpense, setAlsoRecordExpense] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  // Stock import inline edit & delete confirmation
  const [editingImpId, setEditingImpId] = useState<string | null>(null);
  const [editImpDate, setEditImpDate] = useState('');
  const [editImpProductId, setEditImpProductId] = useState('');
  const [editImpSize, setEditImpSize] = useState<SizeOption>('M');
  const [editImpQty, setEditImpQty] = useState('1');
  const [editImpCost, setEditImpCost] = useState('0');
  const [editImpNote, setEditImpNote] = useState('');
  const [editImpError, setEditImpError] = useState<string | null>(null);
  const [deleteImportTarget, setDeleteImportTarget] = useState<StockImport | null>(null);

  const inventoryRows = useMemo(() => {
    const rows = computeInventoryRows(state.products, state.stockImports, state.orders);
    if (brandFilter === 'all') return rows;
    return rows.filter((r) => r.brand === brandFilter);
  }, [state.products, state.stockImports, state.orders, brandFilter]);

  const filteredProducts = useMemo(() => {
    if (brandFilter === 'all') return state.products;
    return state.products.filter((p) => p.brand === brandFilter);
  }, [state.products, brandFilter]);

  const lowStockCount = inventoryRows.filter((r) => !r.isArchived && r.isLowStock).length;

  const newProductVisibleSizes: SizeOption[] =
    newProdBrand === Brand.VAN_MIEN ? ['Freesize'] : ['S', 'M', 'L'];

  const newProductMargin =
    newProdCost !== '' && newProdSell !== ''
      ? (Number(newProdSell) || 0) - (Number(newProdCost) || 0)
      : null;

  const toggleSection = (id: InventorySectionId) => {
    setImportError(null);
    setImportSuccess(null);
    setNewProdError(null);
    setNewProdSuccess(null);

    if (id === 'import_stock' && activeSection !== 'import_stock') {
      const target =
        activeProducts.find((p) => p.id === impProductId) ?? activeProducts[0];
      setImpDate(getTodayISO());
      if (target) {
        setImpProductId(target.id);
        setImpUnitCost(String(target.costPrice));
        setImpSize(target.brand === Brand.VAN_MIEN ? 'Freesize' : 'M');
      }
    }

    if (id === 'add_product' && activeSection !== 'add_product') {
      if (!newProdCodeEdited) {
        setNewProdCode(suggestNextProductCode(newProdBrand, state.products));
      }
    }

    setActiveSection((prev) => (prev === id ? null : id));
  };

  const openEditProductModal = (p: Product) => {
    setEditingProduct(p);
    setProductModalOpen(true);
  };

  const openImportForProduct = (preselectProduct: Product, preselectSize?: SizeOption) => {
    setImpDate(getTodayISO());
    setImpProductId(preselectProduct.id);
    setImpSize(
      preselectSize ?? (preselectProduct.brand === Brand.VAN_MIEN ? 'Freesize' : 'M')
    );
    setImpQty('2');
    setImpUnitCost(String(preselectProduct.costPrice));
    setImpNote('');
    setImportError(null);
    setImportSuccess(null);
    setActiveSection('import_stock');
  };

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setImportError(null);
    setImportSuccess(null);
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

    const targetProduct = activeProducts.find((p) => p.id === impProductId);
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
    setImpNote('');
    setImpQty('2');
    setImportSuccess(
      `Đã nhập kho +${qty} ${targetProduct ? `${targetProduct.code} (${impSize})` : impSize}.`
    );
  };

  const handleNewProductBrandChange = (nextBrand: Brand) => {
    setNewProdBrand(nextBrand);
    if (!newProdCodeEdited) {
      setNewProdCode(suggestNextProductCode(nextBrand, state.products));
    }
  };

  const handleNewProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setNewProdError(null);
    setNewProdSuccess(null);

    const trimmedCode = newProdCode.trim();
    const trimmedName = newProdName.trim();
    const cost = Number(newProdCost);
    const sell = Number(newProdSell);

    if (!trimmedCode || !trimmedName) {
      setNewProdError('Vui lòng nhập đầy đủ Mã mẫu và Tên mẫu sản phẩm.');
      return;
    }
    if (!Number.isFinite(cost) || cost < 0 || !Number.isFinite(sell) || sell < 0) {
      setNewProdError('Giá nhập và Giá bán niêm yết phải lớn hơn hoặc bằng 0.');
      return;
    }

    for (const s of newProductVisibleSizes) {
      const val = Number(newProdStock[s]);
      if (!Number.isFinite(val) || val < 0) {
        setNewProdError(
          `Số lượng tồn kho của ${s === 'Freesize' ? 'Freesize / Hộp' : `Size ${s}`} không hợp lệ.`
        );
        return;
      }
    }

    const initialStock: Partial<Record<SizeOption, number>> = {};
    for (const s of newProductVisibleSizes) {
      initialStock[s] = Math.max(0, Math.round(Number(newProdStock[s]) || 0));
    }

    const res = onSaveProduct({
      code: trimmedCode,
      name: trimmedName,
      brand: newProdBrand,
      costPrice: cost,
      sellPrice: sell,
      initialStock,
    });
    if (!res.ok) {
      setNewProdError(res.error);
      return;
    }

    setNewProdName('');
    setNewProdCost('');
    setNewProdSell('');
    setNewProdStock({ S: '0', M: '0', L: '0', Freesize: '0' });
    setNewProdCodeEdited(false);
    setNewProdCode(
      suggestNextProductCode(newProdBrand, [
        ...state.products,
        {
          id: 'tmp_next',
          code: trimmedCode,
          name: trimmedName,
          brand: newProdBrand,
          costPrice: cost,
          sellPrice: sell,
          initialStock,
          stockAdjustments: {},
        },
      ])
    );
    setNewProdSuccess(`Đã lưu mẫu mới ${trimmedCode} — ${trimmedName}.`);
  };

  const openEditStockImport = (imp: StockImport) => {
    setEditingImpId(imp.id);
    setEditImpDate(imp.date);
    setEditImpProductId(imp.productId);
    setEditImpSize(imp.size);
    setEditImpQty(String(imp.quantity));
    setEditImpCost(String(imp.unitCost));
    setEditImpNote(imp.note || '');
    setEditImpError(null);
  };

  const saveEditStockImport = (importId: string) => {
    setEditImpError(null);
    const res = onUpdateStockImport(importId, {
      date: editImpDate,
      productId: editImpProductId,
      size: editImpSize,
      quantity: Number(editImpQty),
      unitCost: Number(editImpCost),
      note: editImpNote.trim(),
    });
    if (!res.ok) {
      setEditImpError(res.error);
      return;
    }
    setEditingImpId(null);
  };

  const sectionTiles: Array<{
    id: InventorySectionId;
    title: string;
    meta: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      id: 'catalog',
      title: 'Danh mục mẫu sản phẩm',
      meta: `${filteredProducts.length} mẫu`,
      icon: LayoutGrid,
    },
    {
      id: 'ledger',
      title: 'Bảng theo dõi Tồn kho theo Size (Nhập - Xuất - Tồn)',
      meta: `${inventoryRows.length} dòng · ${lowStockCount} sắp hết`,
      icon: Boxes,
    },
    {
      id: 'import_stock',
      title: 'Nhập kho mới',
      meta: `${state.stockImports.length} phiếu · Excel (AI)`,
      icon: PackagePlus,
    },
    {
      id: 'add_product',
      title: 'Thêm mẫu mới',
      meta: 'Tạo mẫu · Excel (AI)',
      icon: PlusCircle,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Toolbar lọc nhánh toàn cục */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div
          className="flex flex-wrap items-center gap-1 rounded-lg bg-[#F3EFE6] p-1"
          role="group"
          aria-label="Lọc kho theo nhánh"
        >
          <button
            type="button"
            aria-pressed={brandFilter === 'all'}
            onClick={() => setBrandFilter('all')}
            className={`rounded-md px-3 py-1.5 text-xs whitespace-nowrap shrink-0 ${
              brandFilter === 'all'
                ? 'bg-white font-semibold text-[#0D4F43] shadow-xs border border-[#E4DFD5]'
                : 'font-medium text-[#57605E] hover:text-[#1A1F1E] border border-transparent'
            }`}
          >
            Tất cả nhánh
          </button>
          {ALL_BRANDS.map((b) => (
            <button
              key={b}
              type="button"
              aria-pressed={brandFilter === b}
              onClick={() => setBrandFilter(b)}
              className={`rounded-md px-3 py-1.5 text-xs whitespace-nowrap shrink-0 ${
                brandFilter === b
                  ? 'bg-white font-semibold text-[#0D4F43] shadow-xs border border-[#E4DFD5]'
                  : 'font-medium text-[#57605E] hover:text-[#1A1F1E] border border-transparent'
              }`}
            >
              {b}
            </button>
          ))}
        </div>

        <span className="text-xs text-[#57605E] tabular-nums">
          {filteredProducts.length} mẫu · {lowStockCount} phân loại sắp hết
        </span>
      </div>

      {/* Thanh Icon 4 phân mục — bấm vào mới mở đầy đủ nội dung */}
      <section aria-label="Các phân mục kho hàng và mẫu">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
                className={`group flex min-h-[76px] w-full flex-col justify-between gap-2.5 rounded-xl border p-3.5 sm:p-4 text-left transition-colors ${
                  isActive
                    ? 'border-[#0D4F43] bg-[#0D4F43]/[0.06]'
                    : 'border-[#E4DFD5] bg-white hover:bg-[#FAF8F4]'
                }`}
              >
                <div className="flex w-full items-start justify-between gap-2">
                  <span
                    aria-hidden="true"
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                      isActive
                        ? 'bg-[#0D4F43] text-white'
                        : 'bg-[#F6F2EA] text-[#0D4F43] group-hover:bg-[#ECE6DA]'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span
                    aria-hidden="true"
                    className={`rounded-lg p-1 ${
                      isActive ? 'text-[#0D4F43]' : 'text-[#8A918E]'
                    }`}
                  >
                    {isActive ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </span>
                </div>
                <div>
                  <span
                    className={`block text-xs sm:text-sm font-semibold leading-snug ${
                      isActive ? 'text-[#0D4F43]' : 'text-[#1A1F1E]'
                    }`}
                  >
                    {tile.title}
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-[11px] text-[#57605E] tabular-nums">
                    {tile.meta}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Trạng thái gọn mặc định khi chưa chọn Icon */}
      {activeSection === null && (
        <div className="rounded-xl border border-dashed border-[#E4DFD5] bg-white/80 px-5 py-6 text-center text-xs text-[#57605E]">
          Bấm vào một biểu tượng ở trên để mở <strong>Danh mục mẫu sản phẩm</strong>,{' '}
          <strong>Bảng theo dõi Tồn kho theo Size</strong>, <strong>Nhập kho mới</strong> hoặc{' '}
          <strong>Thêm mẫu mới</strong>.
        </div>
      )}

      {/* Mục 1: Danh mục mẫu sản phẩm */}
      {activeSection === 'catalog' && (
        <section aria-labelledby="catalog-heading" className="rounded-xl border border-[#E4DFD5] bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#ECE7DD] pb-4">
            <div>
              <h2 id="catalog-heading" className="font-serif text-xl font-semibold text-[#1A1F1E]">
                Danh mục mẫu sản phẩm ({filteredProducts.length})
              </h2>
              <p className="mt-0.5 text-xs text-[#57605E]">
                Quản lý mã mẫu, giá nhập/bán, điều chỉnh tồn kho thực tế và trạng thái kinh doanh từng mẫu.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveSection(null)}
              aria-label="Thu gọn Danh mục mẫu sản phẩm"
              className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-xs font-medium text-[#57605E] hover:bg-[#FAF8F4] whitespace-nowrap shrink-0"
            >
              <X className="h-3.5 w-3.5" />
              Thu gọn
            </button>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="mt-6 rounded-lg bg-[#FAF8F4] px-6 py-8 text-center text-sm text-[#57605E]">
              <p>Chưa có mẫu sản phẩm nào.</p>
              <button
                type="button"
                onClick={() => setActiveSection('add_product')}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#0D4F43] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#093B32]"
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm mẫu mới
              </button>
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[#E4DFD5] text-xs font-semibold text-[#57605E]">
                    <th className="py-3 pr-3">Mã mẫu</th>
                    <th className="py-3 px-3">Tên mẫu</th>
                    <th className="py-3 px-3">Nhánh</th>
                    <th className="py-3 px-3 text-right">Tổng đã nhập</th>
                    <th className="py-3 px-3">Tồn hiện tại theo Size</th>
                    <th className="py-3 px-3 text-right">Giá nhập</th>
                    <th className="py-3 px-3 text-right">Giá bán niêm yết</th>
                    <th className="py-3 pl-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECE7DD]">
                  {filteredProducts.map((p) => {
                    const initialTotal = ALL_SIZES.reduce(
                      (sum, s) => sum + (p.initialStock[s] ?? 0),
                      0
                    );
                    const importTotal = state.stockImports
                      .filter((imp) => imp.productId === p.id)
                      .reduce((sum, imp) => sum + imp.quantity, 0);
                    const totalImported = initialTotal + importTotal;

                    const sizes = getProductActiveSizes(p, state.stockImports, state.orders);
                    const stockSummary = sizes
                      .map(
                        (s) =>
                          `${s === 'Freesize' ? 'Freesize' : s}:${getAvailableStock(
                            p.id,
                            s,
                            state.products,
                            state.stockImports,
                            state.orders
                          )}`
                      )
                      .join(' · ');

                    return (
                      <tr
                        key={p.id}
                        className={`hover:bg-[#FAF8F4] ${p.isArchived ? 'opacity-65 bg-[#FAF8F4]/50' : ''}`}
                      >
                        <td className="py-3 pr-3 font-mono text-xs font-semibold text-[#1A1F1E] whitespace-nowrap">
                          {p.code}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-[#1A1F1E]">
                            {p.name}
                            {p.isArchived && (
                              <span className="ml-2 text-xs font-medium text-[#B45309]">
                                · Ngừng kinh doanh
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-xs text-[#57605E] whitespace-nowrap">
                          {p.brand}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-semibold text-[#0D4F43] tabular-nums whitespace-nowrap">
                          {totalImported} sp
                        </td>
                        <td className="py-3 px-3 font-mono text-xs text-[#57605E] tabular-nums whitespace-nowrap">
                          {stockSummary}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-[#57605E] tabular-nums whitespace-nowrap">
                          {formatVND(p.costPrice)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-semibold text-[#1A1F1E] tabular-nums whitespace-nowrap">
                          {formatVND(p.sellPrice)}
                        </td>
                        <td className="py-3 pl-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditProductModal(p)}
                              aria-label={`Sửa mẫu ${p.code}`}
                              className="inline-flex items-center gap-1 rounded-md border border-[#E4DFD5] bg-white px-2.5 py-1 text-xs font-medium text-[#1A1F1E] hover:bg-[#FAF8F4] whitespace-nowrap shrink-0"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              Sửa mẫu
                            </button>

                            {!p.isArchived ? (
                              <button
                                type="button"
                                onClick={() => openImportForProduct(p)}
                                className="rounded-md bg-[#0D4F43]/10 px-2.5 py-1 text-xs font-medium text-[#0D4F43] hover:bg-[#0D4F43]/20 whitespace-nowrap shrink-0"
                              >
                                Nhập thêm
                              </button>
                            ) : (
                              isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => onArchiveProduct(p.id, false)}
                                  className="inline-flex items-center gap-1 rounded-md border border-[#0D4F43]/30 bg-white px-2.5 py-1 text-xs font-medium text-[#0D4F43] hover:bg-[#0D4F43]/5 whitespace-nowrap shrink-0"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                  Mở bán lại
                                </button>
                              )
                            )}

                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(p)}
                                aria-label={`Xóa mẫu ${p.code}`}
                                className="inline-flex items-center gap-1 rounded-md border border-[#E4DFD5] bg-white px-2 py-1 text-xs font-medium text-[#A63429] hover:border-[#A63429]/40 hover:bg-[#A63429]/5 whitespace-nowrap shrink-0"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Xóa mẫu
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Mục 2: Bảng theo dõi Tồn kho theo Size (Nhập - Xuất - Tồn) */}
      {activeSection === 'ledger' && (
        <section aria-labelledby="inventory-ledger-heading" className="rounded-xl border border-[#E4DFD5] bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#ECE7DD] pb-4">
            <div>
              <h2 id="inventory-ledger-heading" className="font-serif text-xl font-semibold text-[#1A1F1E]">
                Bảng theo dõi Tồn kho theo Size (Nhập - Xuất - Tồn)
              </h2>
              <p className="mt-0.5 text-xs text-[#57605E]">
                Tự động tổng hợp từ Tồn đầu kỳ, Phiếu nhập kho, Đơn bán hàng và Điều chỉnh kiểm kê ·{' '}
                <span className={lowStockCount > 0 ? 'font-semibold text-[#A63429]' : ''}>
                  {lowStockCount} phân loại sắp hết (&le; 1 sp)
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveSection(null)}
              aria-label="Thu gọn Bảng theo dõi Tồn kho"
              className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-xs font-medium text-[#57605E] hover:bg-[#FAF8F4] whitespace-nowrap shrink-0"
            >
              <X className="h-3.5 w-3.5" />
              Thu gọn
            </button>
          </div>

          {inventoryRows.length === 0 ? (
            <div className="mt-6 rounded-lg bg-[#FAF8F4] px-6 py-10 text-center">
              <p className="text-sm font-medium text-[#1A1F1E]">Chưa có dữ liệu tồn kho</p>
              <p className="mt-1 text-xs text-[#57605E]">
                Hãy thêm mẫu sản phẩm mới để bắt đầu theo dõi nhập xuất tồn theo size.
              </p>
              <button
                type="button"
                onClick={() => setActiveSection('add_product')}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#0D4F43] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#093B32]"
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm mẫu mới
              </button>
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[840px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[#E4DFD5] text-xs font-semibold text-[#57605E]">
                    <th className="py-3 pr-3">Mã / Tên mẫu</th>
                    <th className="py-3 px-3">Nhánh</th>
                    <th className="py-3 px-3 text-center">Size</th>
                    <th className="py-3 px-3 text-right">Tồn đầu kỳ</th>
                    <th className="py-3 px-3 text-right">Tổng nhập</th>
                    <th className="py-3 px-3 text-right">Tổng bán</th>
                    <th className="py-3 px-3 text-right">Điều chỉnh</th>
                    <th className="py-3 px-3 text-right">Tồn hiện tại</th>
                    <th className="py-3 pl-3 text-right">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECE7DD]">
                  {inventoryRows.map((row) => (
                    <tr
                      key={row.key}
                      className={`transition-colors hover:bg-[#FAF8F4] ${
                        row.isArchived
                          ? 'opacity-60'
                          : row.isLowStock
                            ? 'bg-[#A63429]/[0.03]'
                            : ''
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
                        className={`py-3 px-3 text-right font-mono tabular-nums ${
                          row.adjustment > 0
                            ? 'text-[#0D4F43]'
                            : row.adjustment < 0
                              ? 'text-[#A63429]'
                              : 'text-[#8A918E]'
                        }`}
                      >
                        {row.adjustment > 0
                          ? `+${row.adjustment}`
                          : row.adjustment < 0
                            ? row.adjustment
                            : '0'}
                      </td>
                      <td
                        className={`py-3 px-3 text-right font-mono text-base font-semibold tabular-nums ${
                          row.isLowStock && !row.isArchived ? 'text-[#A63429]' : 'text-[#1A1F1E]'
                        }`}
                      >
                        {row.currentStock}
                      </td>
                      <td className="py-3 pl-3 text-right whitespace-nowrap">
                        {row.isArchived ? (
                          <span className="text-xs font-medium text-[#B45309]">Ngừng bán</span>
                        ) : row.isLowStock ? (
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

          {/* Lịch sử nhập kho gần đây */}
          {state.stockImports.length > 0 && (
            <div className="mt-8 border-t border-[#ECE7DD] pt-5">
              <h3 className="text-xs font-semibold text-[#57605E]">
                Lịch sử phiếu nhập kho ({state.stockImports.length})
              </h3>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[780px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#ECE7DD] text-[#57605E]">
                      <th className="py-2 pr-3">Ngày nhập</th>
                      <th className="py-2 px-3">Người nhập</th>
                      <th className="py-2 px-3">Mẫu sản phẩm</th>
                      <th className="py-2 px-3 text-center">Size</th>
                      <th className="py-2 px-3 text-right">SL</th>
                      <th className="py-2 px-3 text-right">Đơn giá nhập</th>
                      <th className="py-2 px-3 text-right">Thành tiền</th>
                      <th className="py-2 pl-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ECE7DD]">
                    {state.stockImports.map((imp) => {
                      const prd = state.products.find((p) => p.id === imp.productId);
                      const isEditingImp = editingImpId === imp.id;
                      return (
                        <React.Fragment key={imp.id}>
                          <tr className="hover:bg-[#FAF8F4]">
                            <td className="py-2.5 pr-3 font-mono text-[#57605E] whitespace-nowrap">
                              {formatDateVN(imp.date)}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-[#1A1F1E] whitespace-nowrap">
                              {imp.enteredBy || 'Hệ thống'}
                            </td>
                            <td className="py-2.5 px-3 text-[#1A1F1E]">
                              {prd ? `${prd.code} — ${prd.name}` : imp.productId}
                              {imp.note && <span className="ml-2 text-[#57605E]">({imp.note})</span>}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono">{imp.size}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-[#0D4F43] tabular-nums">
                              +{imp.quantity}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-[#57605E] tabular-nums whitespace-nowrap">
                              {formatVND(imp.unitCost)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-medium text-[#1A1F1E] tabular-nums whitespace-nowrap">
                              {formatVND(imp.quantity * imp.unitCost)}
                            </td>
                            <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    isEditingImp ? setEditingImpId(null) : openEditStockImport(imp)
                                  }
                                  aria-label={`Sửa phiếu nhập ${prd?.code ?? imp.id}`}
                                  className="inline-flex items-center gap-1 rounded border border-[#E4DFD5] bg-white px-2 py-1 text-xs font-medium text-[#1A1F1E] hover:bg-[#FAF8F4]"
                                >
                                  <Edit3 className="h-3 w-3" />
                                  Sửa
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteImportTarget(imp)}
                                  aria-label={`Xóa phiếu nhập ${prd?.code ?? imp.id}`}
                                  className="inline-flex items-center gap-1 rounded border border-[#E4DFD5] bg-white px-2 py-1 text-xs font-medium text-[#A63429] hover:border-[#A63429]/40 hover:bg-[#A63429]/5"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  Xóa
                                </button>
                              </div>
                            </td>
                          </tr>

                          {isEditingImp && (
                            <tr className="bg-[#FAF8F4]">
                              <td colSpan={8} className="px-4 py-3">
                                {editImpError && (
                                  <div role="alert" className="mb-2 text-xs font-medium text-[#A63429]">
                                    {editImpError}
                                  </div>
                                )}
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7 sm:items-end">
                                  <div>
                                    <label
                                      htmlFor={`edit-imp-date-${imp.id}`}
                                      className="block text-[11px] font-medium text-[#57605E]"
                                    >
                                      Ngày nhập
                                    </label>
                                    <input
                                      id={`edit-imp-date-${imp.id}`}
                                      type="date"
                                      value={editImpDate}
                                      onChange={(e) => setEditImpDate(e.target.value)}
                                      className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-1.5 text-xs focus:border-[#0D4F43] focus:outline-none"
                                    />
                                  </div>

                                  <div className="lg:col-span-2">
                                    <label
                                      htmlFor={`edit-imp-prd-${imp.id}`}
                                      className="block text-[11px] font-medium text-[#57605E]"
                                    >
                                      Mẫu sản phẩm
                                    </label>
                                    <select
                                      id={`edit-imp-prd-${imp.id}`}
                                      value={editImpProductId}
                                      onChange={(e) => setEditImpProductId(e.target.value)}
                                      className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-1.5 text-xs focus:border-[#0D4F43] focus:outline-none"
                                    >
                                      {state.products.map((p) => (
                                        <option key={p.id} value={p.id}>
                                          {p.code} — {p.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <label
                                      htmlFor={`edit-imp-size-${imp.id}`}
                                      className="block text-[11px] font-medium text-[#57605E]"
                                    >
                                      Size
                                    </label>
                                    <select
                                      id={`edit-imp-size-${imp.id}`}
                                      value={editImpSize}
                                      onChange={(e) => setEditImpSize(e.target.value as SizeOption)}
                                      className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-1.5 text-xs focus:border-[#0D4F43] focus:outline-none"
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
                                      htmlFor={`edit-imp-qty-${imp.id}`}
                                      className="block text-[11px] font-medium text-[#57605E]"
                                    >
                                      Số lượng
                                    </label>
                                    <input
                                      id={`edit-imp-qty-${imp.id}`}
                                      type="number"
                                      min={1}
                                      value={editImpQty}
                                      onChange={(e) => setEditImpQty(e.target.value)}
                                      className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-1.5 font-mono text-xs tabular-nums focus:border-[#0D4F43] focus:outline-none"
                                    />
                                  </div>

                                  <div>
                                    <label
                                      htmlFor={`edit-imp-cost-${imp.id}`}
                                      className="block text-[11px] font-medium text-[#57605E]"
                                    >
                                      Đơn giá nhập (đ)
                                    </label>
                                    <input
                                      id={`edit-imp-cost-${imp.id}`}
                                      type="number"
                                      min={0}
                                      value={editImpCost}
                                      onChange={(e) => setEditImpCost(e.target.value)}
                                      className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-1.5 font-mono text-xs tabular-nums focus:border-[#0D4F43] focus:outline-none"
                                    />
                                  </div>

                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setEditingImpId(null)}
                                      className="rounded-lg border border-[#E4DFD5] bg-white px-3 py-1.5 text-xs font-medium text-[#57605E] hover:bg-[#F3EFE6]"
                                    >
                                      Hủy
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => saveEditStockImport(imp.id)}
                                      className="rounded-lg bg-[#0D4F43] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#093B32] whitespace-nowrap"
                                    >
                                      Lưu phiếu
                                    </button>
                                  </div>
                                </div>
                                <div className="mt-2">
                                  <label
                                    htmlFor={`edit-imp-note-${imp.id}`}
                                    className="block text-[11px] font-medium text-[#57605E]"
                                  >
                                    Ghi chú nhập hàng
                                  </label>
                                  <input
                                    id={`edit-imp-note-${imp.id}`}
                                    type="text"
                                    value={editImpNote}
                                    onChange={(e) => setEditImpNote(e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-1.5 text-xs focus:border-[#0D4F43] focus:outline-none"
                                  />
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
            </div>
          )}
        </section>
      )}

      {/* Mục 3: Nhập kho mới (kèm Nhập nhanh từ Excel AI bên trong) */}
      {activeSection === 'import_stock' && (
        <section
          aria-labelledby="stock-import-heading"
          className="rounded-xl border border-[#E4DFD5] bg-white p-5 sm:p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#ECE7DD] pb-4">
            <div>
              <h2 id="stock-import-heading" className="font-serif text-xl font-semibold text-[#1A1F1E]">
                Nhập kho mới
              </h2>
              <p className="mt-0.5 text-xs text-[#57605E]">
                Người nhập liệu: <strong className="text-[#0D4F43]">{currentUser.name}</strong> · Số lượng và đơn giá nhập tự động cộng vào Tồn kho và Tổng giá nhập.
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
                  <span>✨ Nhập nhanh từ Excel (AI)</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveSection(null)}
                aria-label="Thu gọn Nhập kho mới"
                className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-xs font-medium text-[#57605E] hover:bg-[#FAF8F4] whitespace-nowrap shrink-0"
              >
                <X className="h-3.5 w-3.5" />
                Thu gọn
              </button>
            </div>
          </div>

          {activeProducts.length === 0 ? (
            <div className="mt-5 rounded-lg bg-[#FAF8F4] px-6 py-8 text-center text-sm text-[#57605E]">
              <p>Chưa có mẫu sản phẩm đang bán nào để tạo phiếu nhập kho.</p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveSection('add_product')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D4F43] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#093B32]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Thêm mẫu mới trước
                </button>
                {onOpenAiExcelImport && (
                  <button
                    type="button"
                    onClick={onOpenAiExcelImport}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:from-purple-700 hover:to-indigo-700"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    ✨ Nhập nhanh từ Excel (AI)
                  </button>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleImportSubmit} className="mt-5 space-y-4">
              {importError && (
                <div role="alert" className="rounded-lg bg-[#A63429]/10 px-4 py-2.5 text-sm text-[#A63429]">
                  {importError}
                </div>
              )}
              {importSuccess && (
                <div
                  role="status"
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#0D4F43]/30 bg-[#0D4F43]/10 px-4 py-2.5 text-xs font-medium text-[#0D4F43]"
                >
                  <span>{importSuccess}</span>
                  <button
                    type="button"
                    onClick={() => setActiveSection('ledger')}
                    className="font-semibold underline hover:text-[#093B32]"
                  >
                    Xem Bảng Tồn kho →
                  </button>
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
                      const p = activeProducts.find((item) => item.id === id);
                      if (p) {
                        setImpUnitCost(String(p.costPrice));
                        if (p.brand === Brand.VAN_MIEN) setImpSize('Freesize');
                      }
                    }}
                    className="mt-1.5 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-sm text-[#1A1F1E] focus:border-[#0D4F43] focus:outline-none"
                  >
                    {activeProducts.map((p) => (
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
                  <span>Đồng thời ghi khoản chi &quot;Nhập hàng&quot; vào Quỹ tiền mặt</span>
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
                    onClick={() => setActiveSection(null)}
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
          )}
        </section>
      )}

      {/* Mục 4: Thêm mẫu mới (kèm Nhập nhanh từ Excel AI bên trong) */}
      {activeSection === 'add_product' && (
        <section
          aria-labelledby="add-product-heading"
          className="rounded-xl border border-[#E4DFD5] bg-white p-5 sm:p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#ECE7DD] pb-4">
            <div>
              <h2 id="add-product-heading" className="font-serif text-xl font-semibold text-[#1A1F1E]">
                Thêm mẫu sản phẩm mới
              </h2>
              <p className="mt-0.5 text-xs text-[#57605E]">
                Người thao tác: <strong className="text-[#0D4F43]">{currentUser.name}</strong> · Mẫu mới sẽ lập tức xuất hiện trong Kho hàng và danh sách chọn mẫu khi tạo Đơn hàng.
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
                  <span>✨ Nhập nhanh từ Excel (AI)</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveSection(null)}
                aria-label="Thu gọn Thêm mẫu mới"
                className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-xs font-medium text-[#57605E] hover:bg-[#FAF8F4] whitespace-nowrap shrink-0"
              >
                <X className="h-3.5 w-3.5" />
                Thu gọn
              </button>
            </div>
          </div>

          <form onSubmit={handleNewProductSubmit} className="mt-5 space-y-5">
            {newProdError && (
              <div
                role="alert"
                className="rounded-lg border border-[#A63429]/30 bg-[#A63429]/5 px-4 py-2.5 text-xs font-medium text-[#A63429]"
              >
                {newProdError}
              </div>
            )}
            {newProdSuccess && (
              <div
                role="status"
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#0D4F43]/30 bg-[#0D4F43]/10 px-4 py-2.5 text-xs font-medium text-[#0D4F43]"
              >
                <span>{newProdSuccess}</span>
                <button
                  type="button"
                  onClick={() => setActiveSection('catalog')}
                  className="font-semibold underline hover:text-[#093B32]"
                >
                  Xem Danh mục mẫu →
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="prd-inline-brand" className="block text-xs font-medium text-[#57605E]">
                  Nhánh thương hiệu
                </label>
                <select
                  id="prd-inline-brand"
                  value={newProdBrand}
                  onChange={(e) => handleNewProductBrandChange(e.target.value as Brand)}
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
                <label htmlFor="prd-inline-code" className="block text-xs font-medium text-[#57605E]">
                  Mã mẫu <span className="text-[#0D4F43]">(tự gợi ý, có thể sửa)</span>
                </label>
                <input
                  id="prd-inline-code"
                  type="text"
                  placeholder="Ví dụ: TN-04, TV-03, VM-03"
                  value={newProdCode}
                  onChange={(e) => {
                    setNewProdCode(e.target.value);
                    setNewProdCodeEdited(true);
                  }}
                  className="mt-1.5 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 font-mono text-sm text-[#1A1F1E] focus:border-[#0D4F43] focus:outline-none"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="prd-inline-name" className="block text-xs font-medium text-[#57605E]">
                  Tên mẫu sản phẩm <span className="text-[#A63429]">*</span>
                </label>
                <input
                  id="prd-inline-name"
                  type="text"
                  placeholder="Ví dụ: Áo dài Lụa Sen Hồng / Set Trà Hoa Cúc"
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-sm text-[#1A1F1E] focus:border-[#0D4F43] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label htmlFor="prd-inline-cost" className="block text-xs font-medium text-[#57605E]">
                  Giá nhập mặc định (VNĐ)
                </label>
                <input
                  id="prd-inline-cost"
                  type="number"
                  min={0}
                  placeholder="650000"
                  value={newProdCost}
                  onChange={(e) => setNewProdCost(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 font-mono text-sm text-[#1A1F1E] tabular-nums focus:border-[#0D4F43] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label htmlFor="prd-inline-sell" className="block text-xs font-medium text-[#57605E]">
                  Giá bán niêm yết (VNĐ)
                </label>
                <input
                  id="prd-inline-sell"
                  type="number"
                  min={0}
                  placeholder="1450000"
                  value={newProdSell}
                  onChange={(e) => setNewProdSell(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 font-mono text-sm text-[#1A1F1E] tabular-nums focus:border-[#0D4F43] focus:outline-none"
                  required
                />
                {newProductMargin !== null && (
                  <p className="mt-1 text-[11px] text-[#57605E]">
                    Biên lãi dự kiến:{' '}
                    <span
                      className={`font-mono font-semibold tabular-nums ${
                        newProductMargin < 0 ? 'text-[#A63429]' : 'text-[#0D4F43]'
                      }`}
                    >
                      {formatVND(newProductMargin)}
                    </span>
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-[#ECE7DD] bg-[#FAF8F4] p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-xs font-semibold text-[#1A1F1E]">
                  {newProdBrand === Brand.VAN_MIEN
                    ? 'Phân loại Freesize / Hộp & Tồn kho ban đầu'
                    : 'Phân loại Size (S, M, L) & Tồn kho ban đầu'}
                </h3>
                <span className="text-[11px] text-[#57605E]">
                  Mặc định bằng 0 nếu chưa nhập hàng
                </span>
              </div>

              <div
                className={`mt-3 grid gap-3 ${
                  newProductVisibleSizes.length === 1
                    ? 'grid-cols-1 sm:max-w-xs'
                    : 'grid-cols-3'
                }`}
              >
                {newProductVisibleSizes.map((s) => {
                  const label = s === 'Freesize' ? 'Freesize / Hộp' : `Size ${s}`;
                  return (
                    <div key={s} className="rounded-lg border border-[#E4DFD5] bg-white p-3">
                      <label
                        htmlFor={`prd-inline-stock-${s}`}
                        className="block text-xs font-medium text-[#1A1F1E]"
                      >
                        {label}
                      </label>
                      <input
                        id={`prd-inline-stock-${s}`}
                        type="number"
                        min={0}
                        value={newProdStock[s]}
                        onChange={(e) =>
                          setNewProdStock((prev) => ({ ...prev, [s]: e.target.value }))
                        }
                        className="mt-1.5 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-1.5 font-mono text-sm font-semibold text-[#1A1F1E] tabular-nums focus:border-[#0D4F43] focus:outline-none"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-[#ECE7DD] pt-4">
              <button
                type="button"
                onClick={() => setActiveSection(null)}
                className="rounded-lg border border-[#E4DFD5] bg-white px-4 py-2 text-xs font-medium text-[#1A1F1E] hover:bg-[#FAF8F4] whitespace-nowrap shrink-0"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D4F43] px-5 py-2 text-xs font-medium text-white hover:bg-[#093B32] whitespace-nowrap shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                Lưu mẫu mới
              </button>
            </div>
          </form>
        </section>
      )}

      <ProductModal
        open={productModalOpen}
        editingProduct={editingProduct}
        state={state}
        actorName={currentUser.name}
        onClose={() => setProductModalOpen(false)}
        onSave={onSaveProduct}
      />

      <DeleteProductModal
        product={deleteTarget}
        orders={state.orders}
        onClose={() => setDeleteTarget(null)}
        onArchive={(id) => onArchiveProduct(id, true)}
        onPermanentDelete={onDeleteProduct}
      />

      <ConfirmModal
        open={Boolean(deleteImportTarget)}
        title="Xác nhận xóa phiếu nhập kho?"
        description="Khi xóa phiếu nhập kho này, tồn kho hiện tại, Tổng giá nhập P&L và khoản chi 'Nhập hàng' liên kết (nếu có) sẽ được tự động cập nhật lại."
        confirmLabel="Xóa phiếu nhập"
        onConfirm={() => {
          if (deleteImportTarget) {
            onDeleteStockImport(deleteImportTarget.id);
            setDeleteImportTarget(null);
          }
        }}
        onCancel={() => setDeleteImportTarget(null)}
      />
    </div>
  );
};

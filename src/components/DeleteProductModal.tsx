import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Archive, Trash2, X } from 'lucide-react';
import { Order, Product } from '../types/erp';
import { hasProductOrderHistory } from '../utils/finance';

interface DeleteProductModalProps {
  product: Product | null;
  orders: Order[];
  onClose: () => void;
  onArchive: (productId: string) => void;
  onPermanentDelete: (productId: string) => void;
}

export const DeleteProductModal: React.FC<DeleteProductModalProps> = ({
  product,
  orders,
  onClose,
  onArchive,
  onPermanentDelete,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (product && !dialog.open) {
      dialog.showModal();
    } else if (!product && dialog.open) {
      dialog.close();
    }
  }, [product]);

  if (!product) return null;

  const history = hasProductOrderHistory(product.id, orders);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="delete-product-title"
      className="fixed inset-0 z-50 m-auto w-full max-w-lg rounded-xl border border-[#E4DFD5] bg-white p-0 text-[#1A1F1E] shadow-xl backdrop:bg-[#1A1F1E]/40"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#A63429]/10 text-[#A63429]">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 id="delete-product-title" className="font-serif text-lg font-semibold text-[#1A1F1E]">
                Xác nhận xóa mẫu sản phẩm
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-[#57605E]">
                Bạn có chắc chắn muốn xóa mẫu{' '}
                <strong className="text-[#1A1F1E]">
                  {product.code} — {product.name}
                </strong>{' '}
                khỏi danh mục kho hàng không?
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hộp thoại xóa mẫu"
            className="rounded-lg p-1.5 text-[#57605E] hover:bg-[#F3EFE6]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {history.hasOrders ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-lg border border-[#B45309]/30 bg-[#FEF3C7]/60 p-3.5 text-xs leading-relaxed text-[#92400E]">
              <strong>Cảnh báo dữ liệu lịch sử:</strong> Mẫu này đã từng phát sinh trong{' '}
              <strong>{history.orderCount}</strong> đơn hàng trước đây. Bạn có thể chọn{' '}
              <strong>Ngừng kinh doanh</strong> để ẩn khỏi form tạo đơn mới nhưng vẫn giữ nguyên số
              liệu báo cáo cũ, hoặc xóa hoàn toàn khỏi danh mục.
            </div>

            <div className="space-y-2">
              {!product.isArchived && (
                <button
                  type="button"
                  onClick={() => {
                    onArchive(product.id);
                    onClose();
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-[#0D4F43] bg-[#0D4F43]/5 px-4 py-3 text-left transition-colors hover:bg-[#0D4F43]/10"
                >
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0D4F43]">
                      <Archive className="h-3.5 w-3.5" />
                      Ngừng kinh doanh (Khuyên dùng)
                    </div>
                    <div className="mt-0.5 text-[11px] text-[#57605E]">
                      Ẩn khỏi form tạo đơn mới nhưng vẫn giữ lại toàn bộ số liệu báo cáo cũ.
                    </div>
                  </div>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  onPermanentDelete(product.id);
                  onClose();
                }}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-[#A63429]/35 bg-white px-4 py-3 text-left transition-colors hover:bg-[#A63429]/5"
              >
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#A63429]">
                    <Trash2 className="h-3.5 w-3.5" />
                    Xóa hoàn toàn khỏi danh mục
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#57605E]">
                    Xóa mẫu khỏi danh sách kho (doanh thu các đơn hàng đã chốt vẫn được bảo toàn).
                  </div>
                </div>
              </button>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-[#E4DFD5] bg-white px-4 py-2 text-xs font-medium text-[#1A1F1E] hover:bg-[#FAF8F4]"
              >
                Hủy bỏ
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#E4DFD5] bg-white px-4 py-2 text-xs font-medium text-[#1A1F1E] hover:bg-[#FAF8F4]"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={() => {
                onPermanentDelete(product.id);
                onClose();
              }}
              className="rounded-lg bg-[#A63429] px-4 py-2 text-xs font-medium text-white hover:bg-[#8B2920]"
            >
              Xóa khỏi danh mục
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
};

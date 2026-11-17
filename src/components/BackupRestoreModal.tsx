import React, { useEffect, useRef, useState } from 'react';
import { ArchiveRestore, Download, RotateCcw, ShieldCheck, X } from 'lucide-react';
import { AppBackupSnapshot } from '../types/erp';
import { formatAuditTimestamp } from '../utils/finance';

interface BackupRestoreModalProps {
  open: boolean;
  backups: AppBackupSnapshot[];
  onClose: () => void;
  onRestoreBackup: (backupId: string) => void;
  onDownloadBackupJSON: (backup: AppBackupSnapshot) => void;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  open,
  backups,
  onClose,
  onRestoreBackup,
  onDownloadBackupJSON,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirmTarget, setConfirmTarget] = useState<AppBackupSnapshot | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setConfirmTarget(null);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="backup-restore-modal-title"
      className="fixed inset-0 z-50 m-auto w-full max-w-3xl rounded-xl border border-[#E4DFD5] bg-white p-0 text-[#1A1F1E] shadow-xl backdrop:bg-[#1A1F1E]/40"
    >
      <div className="max-h-[88vh] overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-4 border-b border-[#ECE7DD] pb-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0D4F43]/10 text-[#0D4F43]">
              <ArchiveRestore className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="backup-restore-modal-title"
                className="font-serif text-xl font-semibold text-[#1A1F1E]"
              >
                Bản sao lưu tự động trước khi xóa ({backups.length})
              </h2>
              <p className="mt-0.5 text-xs text-[#57605E]">
                Mỗi lần xóa đơn hàng, mẫu sản phẩm, phiếu nhập kho, cổ đông, khoản chi hoặc tài khoản, hệ thống tự động lưu lại bản cũ toàn bộ dữ liệu lên Cloud để khôi phục bất kỳ lúc nào.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng danh sách bản sao lưu"
            className="rounded-lg p-1.5 text-[#57605E] transition-colors hover:bg-[#F3EFE6] hover:text-[#1A1F1E]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {confirmTarget && (
          <div
            role="alertdialog"
            aria-label="Xác nhận khôi phục bản sao lưu"
            className="mt-4 rounded-xl border border-[#0D4F43]/30 bg-[#0D4F43]/[0.06] p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0D4F43]">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  Xác nhận khôi phục dữ liệu cũ?
                </div>
                <p className="mt-1 text-xs text-[#1A1F1E]">
                  Khôi phục về bản lưu lúc{' '}
                  <strong className="font-mono">
                    {formatAuditTimestamp(confirmTarget.createdAt)}
                  </strong>{' '}
                  ({confirmTarget.action} · {confirmTarget.summary.ordersCount} đơn,{' '}
                  {confirmTarget.summary.productsCount} mẫu,{' '}
                  {confirmTarget.summary.expensesCount} khoản chi). Trạng thái hiện tại cũng sẽ được tự động sao lưu trước khi ghi đè.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setConfirmTarget(null)}
                  className="rounded-lg border border-[#E4DFD5] bg-white px-3 py-1.5 text-xs font-medium text-[#1A1F1E] hover:bg-[#FAF8F4]"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onRestoreBackup(confirmTarget.id);
                    setConfirmTarget(null);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D4F43] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#093B32]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Xác nhận khôi phục
                </button>
              </div>
            </div>
          </div>
        )}

        {backups.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-[#E4DFD5] bg-[#FAF8F4] px-6 py-10 text-center">
            <ArchiveRestore className="mx-auto h-7 w-7 text-[#8A918E]" />
            <p className="mt-2.5 text-sm font-medium text-[#1A1F1E]">
              Chưa có bản sao lưu tự động nào
            </p>
            <p className="mt-1 text-xs text-[#57605E]">
              Khi có bất kỳ thao tác xóa thông tin nào trên hệ thống, bản dữ liệu cũ sẽ xuất hiện tại đây.
            </p>
          </div>
        ) : (
          <ul className="mt-5 divide-y divide-[#ECE7DD]">
            {backups.map((bak) => (
              <li
                key={bak.id}
                className="flex flex-col gap-3 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono font-semibold text-[#57605E] tabular-nums">
                      {formatAuditTimestamp(bak.createdAt)}
                    </span>
                    <span className="rounded bg-[#F3EFE6] px-2 py-0.5 font-medium text-[#1A1F1E]">
                      {bak.category}
                    </span>
                    <span className="font-semibold text-[#0D4F43]">{bak.actorName}</span>
                  </div>
                  <div className="mt-1 text-sm font-medium text-[#1A1F1E]">{bak.action}</div>
                  <p className="mt-0.5 text-xs text-[#57605E]">{bak.detail}</p>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-[#57605E] tabular-nums">
                    <span>{bak.summary.ordersCount} đơn hàng</span>
                    <span>{bak.summary.productsCount} mẫu</span>
                    <span>{bak.summary.stockImportsCount} nhập kho</span>
                    <span>{bak.summary.shareholdersCount} cổ đông</span>
                    <span>{bak.summary.expensesCount} khoản chi</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onDownloadBackupJSON(bak)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4DFD5] bg-white px-3 py-1.5 text-xs font-medium text-[#1A1F1E] transition-colors hover:bg-[#FAF8F4] whitespace-nowrap"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Tải JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmTarget(bak)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D4F43] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#093B32] whitespace-nowrap"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Khôi phục bản này
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </dialog>
  );
};

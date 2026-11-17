import React, { useMemo, useState } from 'react';
import { ArchiveRestore, Download, History, RotateCcw, Search } from 'lucide-react';
import { AppBackupSnapshot, AppState, AuditCategory } from '../types/erp';
import { formatAuditTimestamp } from '../utils/finance';
import { ConfirmModal } from './ConfirmModal';

interface AuditLogTabProps {
  state: AppState;
  onRestoreBackup?: (backupId: string) => void;
  onDownloadBackupJSON?: (backup: AppBackupSnapshot) => void;
}

const CATEGORIES: Array<'all' | AuditCategory> = [
  'all',
  'Đơn hàng',
  'Tài chính',
  'Kho hàng',
  'Tài khoản',
  'Hệ thống',
];

export const AuditLogTab: React.FC<AuditLogTabProps> = ({
  state,
  onRestoreBackup,
  onDownloadBackupJSON,
}) => {
  const [memberFilter, setMemberFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | AuditCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [restoreTarget, setRestoreTarget] = useState<AppBackupSnapshot | null>(null);

  const actorOptions = useMemo(() => {
    const names = new Set<string>(state.accounts.map((a) => a.name));
    for (const log of state.auditLogs) {
      if (log.actorName) names.add(log.actorName);
    }
    return Array.from(names);
  }, [state.accounts, state.auditLogs]);

  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return state.auditLogs.filter((log) => {
      if (memberFilter !== 'all' && log.actorName !== memberFilter) return false;
      if (categoryFilter !== 'all' && log.category !== categoryFilter) return false;
      if (q) {
        const matchDetail = log.detail.toLowerCase().includes(q);
        const matchAction = log.action.toLowerCase().includes(q);
        const matchActor = log.actorName.toLowerCase().includes(q);
        if (!matchDetail && !matchAction && !matchActor) return false;
      }
      return true;
    });
  }, [state.auditLogs, memberFilter, categoryFilter, searchQuery]);

  const backups = state.backups ?? [];

  return (
    <div className="space-y-6">
      {/* Bản sao lưu tự động trước khi xóa */}
      <section
        aria-labelledby="auto-backups-heading"
        className="rounded-xl border border-[#E4DFD5] bg-white p-6"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-[#ECE7DD] pb-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0D4F43]/10 text-[#0D4F43]">
              <ArchiveRestore className="h-4 w-4" />
            </div>
            <div>
              <h2 id="auto-backups-heading" className="font-serif text-xl font-semibold text-[#1A1F1E]">
                Bản sao lưu tự động trước khi xóa ({backups.length})
              </h2>
              <p className="mt-0.5 text-xs text-[#57605E]">
                Hệ thống tự động lưu lại bản dữ liệu cũ mỗi khi xóa đơn hàng, mẫu sản phẩm, phiếu nhập kho, cổ đông, khoản chi hoặc tài khoản để bạn dễ dàng khôi phục khi cần.
              </p>
            </div>
          </div>
        </div>

        {backups.length === 0 ? (
          <div className="mt-4 rounded-lg bg-[#FAF8F4] px-5 py-6 text-center text-xs text-[#57605E]">
            Chưa có bản sao lưu trước khi xóa nào. Mỗi thao tác xóa sau này sẽ tự động tạo một bản dự phòng tại đây.
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-[#ECE7DD]">
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
                    <span className="font-medium text-[#1A1F1E]">{bak.action}</span>
                  </div>
                  <p className="mt-1 text-xs text-[#57605E]">{bak.detail}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-[#57605E] tabular-nums">
                    <span>{bak.summary.ordersCount} đơn hàng</span>
                    <span>{bak.summary.productsCount} mẫu</span>
                    <span>{bak.summary.stockImportsCount} nhập kho</span>
                    <span>{bak.summary.shareholdersCount} cổ đông</span>
                    <span>{bak.summary.expensesCount} khoản chi</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {onDownloadBackupJSON && (
                    <button
                      type="button"
                      onClick={() => onDownloadBackupJSON(bak)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4DFD5] bg-white px-3 py-1.5 text-xs font-medium text-[#1A1F1E] transition-colors hover:bg-[#FAF8F4] whitespace-nowrap"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Tải JSON
                    </button>
                  )}
                  {onRestoreBackup && (
                    <button
                      type="button"
                      onClick={() => setRestoreTarget(bak)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D4F43] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#093B32] whitespace-nowrap"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Khôi phục bản này
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="audit-log-heading"
        className="rounded-xl border border-[#E4DFD5] bg-white p-6"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-[#ECE7DD] pb-4">
          <div>
            <h2 id="audit-log-heading" className="font-serif text-xl font-semibold text-[#1A1F1E]">
              Lịch sử thao tác &amp; Kiểm soát chỉnh sửa (Audit Log)
            </h2>
            <p className="mt-0.5 text-xs text-[#57605E]">
              Tự động ghi nhận toàn bộ hoạt động tạo đơn, xác nhận thanh toán, nhập kho và chỉnh sửa tài chính theo thời gian thực ({filteredLogs.length} / {state.auditLogs.length} bản ghi).
            </p>
          </div>
        </div>

        {/* Filter bar */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Category filter */}
            <div
              className="flex flex-wrap items-center gap-1 rounded-lg bg-[#F3EFE6] p-1"
              role="group"
              aria-label="Lọc nhật ký theo loại thao tác"
            >
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={categoryFilter === cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`rounded-md px-3 py-1.5 text-xs whitespace-nowrap shrink-0 ${
                    categoryFilter === cat
                      ? 'bg-white font-semibold text-[#0D4F43] shadow-xs border border-[#E4DFD5]'
                      : 'font-medium text-[#57605E] hover:text-[#1A1F1E] border border-transparent'
                  }`}
                >
                  {cat === 'all' ? 'Tất cả' : cat}
                </button>
              ))}
            </div>

            {/* Member filter */}
            <select
              aria-label="Lọc nhật ký theo thành viên"
              value={memberFilter}
              onChange={(e) => setMemberFilter(e.target.value)}
              className="rounded-lg border border-[#E4DFD5] bg-white px-3 py-1.5 text-xs font-medium text-[#1A1F1E] focus:border-[#0D4F43] focus:outline-none"
            >
              <option value="all">Tất cả thành viên</option>
              {actorOptions.map((name) => (
                <option key={name} value={name}>
                  Thành viên: {name}
                </option>
              ))}
            </select>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#57605E]" />
            <input
              type="search"
              aria-label="Tìm kiếm trong nhật ký"
              placeholder="Tìm mã đơn, tên khách, nội dung..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-[#E4DFD5] bg-[#FAF8F4] py-2 pl-9 pr-3 text-xs text-[#1A1F1E] placeholder:text-[#8A918E] focus:border-[#0D4F43] focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        {/* Timeline list */}
        {filteredLogs.length === 0 ? (
          <div className="mt-6 rounded-lg bg-[#FAF8F4] px-6 py-10 text-center">
            <History className="mx-auto h-6 w-6 text-[#8A918E]" />
            <p className="mt-2 text-sm font-medium text-[#1A1F1E]">
              Chưa có lịch sử thao tác nào khớp bộ lọc
            </p>
            <p className="mt-1 text-xs text-[#57605E]">
              Thử đổi bộ lọc thành viên hoặc loại thao tác để xem các ghi nhận trước đó.
            </p>
          </div>
        ) : (
          <ol className="mt-6 divide-y divide-[#ECE7DD]">
            {filteredLogs.map((log) => (
              <li key={log.id} className="py-3.5 first:pt-0 last:pb-0">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <div className="min-w-0 flex-1 text-sm text-[#1A1F1E]">
                    <span className="font-mono text-xs font-semibold text-[#57605E] tabular-nums">
                      {formatAuditTimestamp(log.timestamp)}
                    </span>
                    <span aria-hidden="true" className="mx-2 text-[#C7C0B3]">
                      -
                    </span>
                    <span className="font-semibold text-[#0D4F43]">{log.actorName}</span>
                    <span aria-hidden="true" className="mx-2 text-[#C7C0B3]">
                      -
                    </span>
                    <span className="font-medium text-[#1A1F1E]">{log.action}</span>
                    <span aria-hidden="true" className="mx-2 text-[#C7C0B3]">
                      -
                    </span>
                    <span className="text-[#1A1F1E]">{log.detail}</span>
                  </div>

                  <span className="text-xs font-medium text-[#57605E] whitespace-nowrap shrink-0">
                    {log.category}
                  </span>
                </div>

                {(log.oldValue || log.newValue) && (
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#57605E]">
                    {log.oldValue && (
                      <span>
                        Giá trị cũ:{' '}
                        <span className="font-mono text-[#A63429]">{log.oldValue}</span>
                      </span>
                    )}
                    {log.oldValue && log.newValue && (
                      <span aria-hidden="true" className="text-[#C7C0B3]">
                        →
                      </span>
                    )}
                    {log.newValue && (
                      <span>
                        Giá trị mới:{' '}
                        <span className="font-mono font-medium text-[#0D4F43]">{log.newValue}</span>
                      </span>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <ConfirmModal
        open={Boolean(restoreTarget)}
        title="Khôi phục dữ liệu từ bản sao lưu?"
        description={
          restoreTarget
            ? `Hệ thống sẽ khôi phục toàn bộ dữ liệu về thời điểm ${formatAuditTimestamp(restoreTarget.createdAt)} (${restoreTarget.action}: ${restoreTarget.summary.ordersCount} đơn hàng, ${restoreTarget.summary.productsCount} mẫu, ${restoreTarget.summary.expensesCount} khoản chi). Dữ liệu hiện tại cũng sẽ được tự động sao lưu trước khi khôi phục.`
            : ''
        }
        confirmLabel="Xác nhận khôi phục"
        tone="primary"
        onConfirm={() => {
          if (restoreTarget && onRestoreBackup) {
            onRestoreBackup(restoreTarget.id);
          }
          setRestoreTarget(null);
        }}
        onCancel={() => setRestoreTarget(null)}
      />
    </div>
  );
};

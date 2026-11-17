import React, { useMemo, useState } from 'react';
import { History, Search } from 'lucide-react';
import { AppState, AuditCategory } from '../types/erp';
import { formatAuditTimestamp } from '../utils/finance';

interface AuditLogTabProps {
  state: AppState;
}

const CATEGORIES: Array<'all' | AuditCategory> = [
  'all',
  'Đơn hàng',
  'Tài chính',
  'Kho hàng',
  'Tài khoản',
];

export const AuditLogTab: React.FC<AuditLogTabProps> = ({ state }) => {
  const [memberFilter, setMemberFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | AuditCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

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

  return (
    <div className="space-y-6">
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
    </div>
  );
};

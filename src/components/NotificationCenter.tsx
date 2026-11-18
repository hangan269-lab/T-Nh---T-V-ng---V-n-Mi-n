import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  BellOff,
  BellRing,
  Boxes,
  CheckCheck,
  Download,
  Share2,
  ShoppingBag,
  Sparkles,
  Volume2,
  VolumeX,
  Wallet,
} from 'lucide-react';
import { BrowserNotificationPermission, notificationTypeToTab } from '../hooks/usePWA';
import { AppNotification, NotificationType } from '../types/erp';
import { formatAuditTimestamp } from '../utils/finance';

interface NotificationCenterProps {
  notifications: AppNotification[];
  currentUserId: string;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onMarkRead: (notificationId: string) => void;
  onMarkAllRead: () => void;
  onNavigateTab: (tab: 'dashboard' | 'orders' | 'inventory' | 'finance') => void;
  notificationPermission: BrowserNotificationPermission;
  isIOS: boolean;
  isInstalled: boolean;
  canInstallPrompt: boolean;
  onRequestPermission: () => Promise<BrowserNotificationPermission>;
  onInstallApp: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  onSendTestNotification: () => void;
}

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case 'order':
      return { Icon: ShoppingBag, bg: 'bg-[#0D4F43]/10 text-[#0D4F43]' };
    case 'finance':
      return { Icon: Wallet, bg: 'bg-amber-50 text-amber-700' };
    case 'inventory':
      return { Icon: Boxes, bg: 'bg-blue-50 text-blue-700' };
    case 'system':
    default:
      return { Icon: Sparkles, bg: 'bg-purple-50 text-purple-700' };
  }
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  currentUserId,
  soundEnabled,
  onToggleSound,
  onMarkRead,
  onMarkAllRead,
  onNavigateTab,
  notificationPermission,
  isIOS,
  isInstalled,
  canInstallPrompt,
  onRequestPermission,
  onInstallApp,
  onSendTestNotification,
}) => {
  const [open, setOpen] = useState(false);
  const [permFeedback, setPermFeedback] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.reduce((count, n) => {
    const readBy = Array.isArray(n.readBy) ? n.readBy : [];
    return readBy.includes(currentUserId) ? count : count + 1;
  }, 0);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const handleEnablePush = async () => {
    setPermFeedback(null);
    const res = await onRequestPermission();
    if (res === 'granted') {
      setPermFeedback('Đã bật thông báo trên thiết bị này!');
      onSendTestNotification();
    } else if (res === 'denied') {
      setPermFeedback('Trình duyệt đang chặn quyền thông báo. Vui lòng mở Cài đặt trình duyệt để cho phép lại.');
    } else if (res === 'unsupported') {
      setPermFeedback('Trình duyệt này chưa hỗ trợ thông báo đẩy.');
    }
  };

  const recentNotifications = notifications.slice(0, 40);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Trung tâm thông báo (${unreadCount} chưa đọc)`}
        aria-expanded={open}
        title="Thông báo thời gian thực"
        className={`relative inline-flex items-center justify-center rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
          open
            ? 'border-[#0D4F43] bg-[#0D4F43]/10 text-[#0D4F43]'
            : 'border-[#E4DFD5] bg-white text-[#1A1F1E] hover:bg-[#FAF8F4]'
        }`}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span
            aria-label={`${unreadCount} thông báo chưa đọc`}
            className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#A63429] px-1 text-[10px] font-bold leading-none text-white shadow-xs ring-2 ring-[#FAF8F4]"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Danh sách thông báo"
          className="fixed inset-x-3 top-16 z-40 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[400px] overflow-hidden rounded-xl border border-[#E4DFD5] bg-white shadow-xl"
        >
          {/* Drawer Header */}
          <div className="flex items-center justify-between gap-2 border-b border-[#ECE7DD] bg-[#FAF8F4] px-4 py-3">
            <div className="flex items-center gap-2">
              <BellRing className="h-4 w-4 text-[#0D4F43]" />
              <span className="font-serif text-sm font-semibold text-[#1A1F1E]">
                Thông báo nhóm
              </span>
              {unreadCount > 0 && (
                <span className="rounded bg-[#A63429]/10 px-1.5 py-0.5 text-[11px] font-semibold text-[#A63429]">
                  {unreadCount} mới
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleSound}
                title={soundEnabled ? 'Tắt âm thanh ting thông báo' : 'Bật âm thanh ting thông báo'}
                aria-label={soundEnabled ? 'Tắt âm thanh thông báo' : 'Bật âm thanh thông báo'}
                className="inline-flex items-center gap-1 rounded-md border border-[#E4DFD5] bg-white px-2 py-1 text-[11px] font-medium text-[#57605E] hover:text-[#1A1F1E]"
              >
                {soundEnabled ? (
                  <>
                    <Volume2 className="h-3.5 w-3.5 text-[#0D4F43]" />
                    <span className="hidden sm:inline">Tiếng</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="h-3.5 w-3.5 text-[#8A918E]" />
                    <span className="hidden sm:inline">Tắt tiếng</span>
                  </>
                )}
              </button>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={onMarkAllRead}
                  className="inline-flex items-center gap-1 rounded-md border border-[#0D4F43]/25 bg-[#0D4F43]/5 px-2 py-1 text-[11px] font-medium text-[#0D4F43] hover:bg-[#0D4F43]/10"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Đánh dấu tất cả đã đọc
                </button>
              )}
            </div>
          </div>

          {/* Push Permission + iPhone / PWA Guide Bar */}
          <div className="border-b border-[#ECE7DD] bg-white px-4 py-2.5 space-y-2">
            {notificationPermission === 'granted' ? (
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 font-medium text-[#0D4F43]">
                  <span className="h-2 w-2 rounded-full bg-[#0D4F43]" />
                  Đã bật thông báo trên thiết bị này
                </span>
                <button
                  type="button"
                  onClick={onSendTestNotification}
                  className="rounded border border-[#E4DFD5] bg-[#FAF8F4] px-2 py-0.5 text-[11px] font-medium text-[#1A1F1E] hover:bg-[#F3EFE6]"
                >
                  Thử chuông
                </button>
              </div>
            ) : notificationPermission === 'denied' ? (
              <div className="flex items-start gap-2 rounded-lg border border-[#A63429]/25 bg-[#A63429]/5 px-2.5 py-2 text-[11px] text-[#A63429]">
                <BellOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Quyền thông báo đang bị chặn trên trình duyệt. Hãy bật lại trong Cài đặt trang web để nhận tin nổi trên điện thoại.
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleEnablePush}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#0D4F43] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#093B32]"
              >
                <span>🔔 Bật thông báo trên điện thoại này</span>
              </button>
            )}

            {permFeedback && (
              <p className="text-[11px] font-medium text-[#0D4F43]">{permFeedback}</p>
            )}

            {isIOS && !isInstalled && (
              <div className="flex items-start gap-2 rounded-lg border border-[#ECE7DD] bg-[#FAF8F4] px-2.5 py-2 text-[11px] leading-relaxed text-[#57605E]">
                <Share2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0D4F43]" />
                <span>
                  <strong>Trên iPhone:</strong> Hãy bấm <strong>Chia sẻ</strong> →{' '}
                  <strong>Thêm vào MH chính</strong> trước, sau đó mở app từ màn hình chính để bật thông báo.
                </span>
              </div>
            )}

            {canInstallPrompt && (
              <button
                type="button"
                onClick={() => void onInstallApp()}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#0D4F43]/30 bg-[#0D4F43]/5 px-3 py-1.5 text-xs font-medium text-[#0D4F43] hover:bg-[#0D4F43]/10"
              >
                <Download className="h-3.5 w-3.5" />
                Cài Nhã Vương Miên ra màn hình chính
              </button>
            )}
          </div>

          {/* Notification Items List */}
          <div className="max-h-[56vh] overflow-y-auto divide-y divide-[#ECE7DD]">
            {recentNotifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell className="mx-auto h-7 w-7 text-[#8A918E]/60" />
                <p className="mt-2 text-xs font-medium text-[#57605E]">
                  Chưa có thông báo hoạt động nào.
                </p>
                <p className="mt-0.5 text-[11px] text-[#8A918E]">
                  Mọi thay đổi về đơn hàng, nhập kho hay thu chi sẽ hiện ngay tại đây.
                </p>
              </div>
            ) : (
              recentNotifications.map((item) => {
                const readBy = Array.isArray(item.readBy) ? item.readBy : [];
                const isUnread = !readBy.includes(currentUserId);
                const { Icon, bg } = getNotificationIcon(item.type);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onMarkRead(item.id);
                      onNavigateTab(notificationTypeToTab(item.type));
                      setOpen(false);
                    }}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[#FAF8F4] ${
                      isUnread ? 'bg-[#0D4F43]/[0.04]' : 'bg-white'
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${bg}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`truncate text-xs ${
                            isUnread
                              ? 'font-semibold text-[#1A1F1E]'
                              : 'font-medium text-[#57605E]'
                          }`}
                        >
                          {item.title}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-[#8A918E]">
                          {formatAuditTimestamp(item.createdAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs leading-snug text-[#1A1F1E]">
                        {item.message}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-[#57605E]">
                        <span>Thực hiện: {item.actorName}</span>
                        {isUnread && (
                          <span className="inline-flex items-center gap-1 font-semibold text-[#0D4F43]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#0D4F43]" />
                            Chưa đọc
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

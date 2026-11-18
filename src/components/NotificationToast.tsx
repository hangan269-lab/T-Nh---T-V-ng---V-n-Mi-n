import React from 'react';
import { Boxes, ShoppingBag, Sparkles, Wallet, X } from 'lucide-react';
import { notificationTypeToTab } from '../hooks/usePWA';
import { AppNotification, NotificationType } from '../types/erp';

interface NotificationToastProps {
  items: AppNotification[];
  onDismiss: (id: string) => void;
  onSelect: (item: AppNotification, tab: 'dashboard' | 'orders' | 'inventory' | 'finance') => void;
}

function getToastAccent(type: NotificationType) {
  switch (type) {
    case 'order':
      return { Icon: ShoppingBag, badge: 'bg-[#0D4F43] text-white' };
    case 'finance':
      return { Icon: Wallet, badge: 'bg-amber-600 text-white' };
    case 'inventory':
      return { Icon: Boxes, badge: 'bg-blue-600 text-white' };
    case 'system':
    default:
      return { Icon: Sparkles, badge: 'bg-purple-600 text-white' };
  }
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  items,
  onDismiss,
  onSelect,
}) => {
  if (items.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2.5 pointer-events-none"
    >
      {items.map((item) => {
        const { Icon, badge } = getToastAccent(item.type);
        const tab = notificationTypeToTab(item.type);
        return (
          <div
            key={item.id}
            role="status"
            className="pointer-events-auto flex items-start gap-3 rounded-xl border border-[#E4DFD5] bg-white p-3.5 shadow-lg ring-1 ring-black/5 transition-all"
          >
            <button
              type="button"
              onClick={() => onSelect(item, tab)}
              className="flex min-w-0 flex-1 items-start gap-3 text-left"
            >
              <div
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${badge}`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-[#1A1F1E] truncate">
                  {item.title}
                </div>
                <p className="mt-0.5 text-xs leading-snug text-[#57605E]">
                  {item.message}
                </p>
                <span className="mt-1 inline-block text-[10px] font-medium text-[#0D4F43]">
                  Bấm để xem chi tiết →
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onDismiss(item.id)}
              aria-label="Đóng thông báo nổi"
              className="rounded-md p-1 text-[#8A918E] hover:bg-[#FAF8F4] hover:text-[#1A1F1E]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

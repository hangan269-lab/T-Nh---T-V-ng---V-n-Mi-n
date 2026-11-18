import { useCallback, useEffect, useState } from 'react';
import { NotificationType } from '../types/erp';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type BrowserNotificationPermission = NotificationPermission | 'unsupported';

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    nav.standalone === true
  );
}

function detectIOS(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  const isAppleTouchDevice =
    /iphone|ipad|ipod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return isAppleTouchDevice;
}

function readNotificationPermission(): BrowserNotificationPermission {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported';
  }
  return Notification.permission;
}

export function notificationTypeToTab(
  type: NotificationType
): 'dashboard' | 'orders' | 'inventory' | 'finance' {
  switch (type) {
    case 'order':
      return 'orders';
    case 'inventory':
      return 'inventory';
    case 'finance':
      return 'finance';
    case 'system':
    default:
      return 'dashboard';
  }
}

export function usePWA(options?: {
  onNotificationNavigate?: (tab: 'dashboard' | 'orders' | 'inventory' | 'finance') => void;
}) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(detectStandalone);
  const [isIOS] = useState<boolean>(detectIOS);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [notificationPermission, setNotificationPermission] =
    useState<BrowserNotificationPermission>(readNotificationPermission);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    const syncPermission = () => {
      setIsInstalled(detectStandalone());
      setNotificationPermission(readNotificationPermission());
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', syncPermission);

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayChange = () => setIsInstalled(detectStandalone());
    mediaQuery.addEventListener?.('change', handleDisplayChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', syncPermission);
      mediaQuery.removeEventListener?.('change', handleDisplayChange);
    };
  }, []);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const onSwMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; tab?: string } | null;
      if (data?.type === 'NOTIFICATION_CLICK' && data.tab && options?.onNotificationNavigate) {
        if (
          data.tab === 'dashboard' ||
          data.tab === 'orders' ||
          data.tab === 'inventory' ||
          data.tab === 'finance'
        ) {
          options.onNotificationNavigate(data.tab);
        }
      }
    };
    navigator.serviceWorker.addEventListener('message', onSwMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onSwMessage);
  }, [options]);

  const installApp = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredPrompt) return 'unavailable';
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
    return outcome;
  }, [deferredPrompt]);

  const requestNotificationPermission = useCallback(async (): Promise<BrowserNotificationPermission> => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') {
      setNotificationPermission('unsupported');
      return 'unsupported';
    }
    try {
      const result = await Notification.requestPermission();
      setNotificationPermission(result);
      return result;
    } catch {
      const current = readNotificationPermission();
      setNotificationPermission(current);
      return current;
    }
  }, []);

  const showSystemNotification = useCallback(
    async (
      title: string,
      message: string,
      opts?: { tag?: string; tab?: 'dashboard' | 'orders' | 'inventory' | 'finance' }
    ): Promise<boolean> => {
      if (typeof window === 'undefined' || typeof Notification === 'undefined') {
        return false;
      }
      if (Notification.permission !== 'granted') {
        return false;
      }

      const payload: NotificationOptions & { vibrate?: number[] } = {
        body: message,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200],
        tag: opts?.tag,
        data: {
          url: '/',
          tab: opts?.tab ?? 'dashboard',
        },
      };

      try {
        if ('serviceWorker' in navigator) {
          const reg = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 1500)),
          ]);
          if (reg && typeof reg.showNotification === 'function') {
            await reg.showNotification(title, payload);
            return true;
          }
        }
        new Notification(title, payload);
        return true;
      } catch {
        try {
          new Notification(title, {
            body: message,
            icon: '/icon-192.png',
          });
          return true;
        } catch {
          return false;
        }
      }
    },
    []
  );

  return {
    canInstallPrompt: Boolean(deferredPrompt) && !isInstalled,
    isInstalled,
    isIOS,
    isOnline,
    notificationPermission,
    installApp,
    requestNotificationPermission,
    showSystemNotification,
  };
}

import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  BellOff,
  Crown,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  Flower,
  Gem,
  KeyRound,
  Leaf,
  Loader2,
  RotateCcw,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  UserPlus,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { getDefaultPinForAccount } from '../data/seedData';
import diamondAppAvatar from '../assets/images/diamond_moss_icon_1795003396124.jpg';
import { BrowserNotificationPermission } from '../hooks/usePWA';
import { UserAccount, UserRole } from '../types/erp';
import {
  getGeminiApiKey,
  getGeminiKeySource,
  saveGeminiApiKey,
  testGeminiConnection,
} from '../utils/gemini';

interface AccountSettingsModalProps {
  open: boolean;
  currentUser: UserAccount;
  accounts: UserAccount[];
  hasSystemData?: boolean;
  onClose: () => void;
  onChangePin: (
    targetUserId: string,
    newPin: string,
    currentPinForSelf?: string
  ) => { ok: true } | { ok: false; error: string };
  onCreateAccount: (input: {
    name: string;
    username: string;
    role: UserRole;
    pin: string;
  }) => { ok: true } | { ok: false; error: string };
  onUpdateAccount: (
    targetUserId: string,
    input: { name: string; username: string; role: UserRole; pin?: string }
  ) => { ok: true } | { ok: false; error: string };
  onDeleteAccount: (targetUserId: string) => { ok: true } | { ok: false; error: string };
  onRequestResetSystem?: () => void;
  appIcon?: string;
  onChangeAppIcon?: (icon: string) => void;
  notificationPermission?: BrowserNotificationPermission;
  isIOS?: boolean;
  isInstalled?: boolean;
  canInstallPrompt?: boolean;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  onRequestNotificationPermission?: () => Promise<BrowserNotificationPermission>;
  onInstallApp?: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  onSendTestNotification?: () => void;
}

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  open,
  currentUser,
  accounts,
  hasSystemData = true,
  onClose,
  onChangePin,
  onCreateAccount,
  onUpdateAccount,
  onDeleteAccount,
  onRequestResetSystem,
  appIcon = 'DiamondMoss',
  onChangeAppIcon,
  notificationPermission = 'default',
  isIOS = false,
  isInstalled = false,
  canInstallPrompt = false,
  soundEnabled = true,
  onToggleSound,
  onRequestNotificationPermission,
  onInstallApp,
  onSendTestNotification,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Gemini API Key config
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [keySource, setKeySource] = useState<'custom' | 'env' | 'none'>('none');
  const [apiTesting, setApiTesting] = useState(false);
  const [apiTestStatus, setApiTestStatus] = useState<string | null>(null);
  const [apiMsg, setApiMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pushMsg, setPushMsg] = useState<string | null>(null);

  // Change own PIN
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinMsg, setPinMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Admin: create account
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('Thành viên');
  const [newAccPin, setNewAccPin] = useState('');
  const [accMsg, setAccMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Admin: reset member PIN
  const [resetTargetId, setResetTargetId] = useState<string | null>(null);
  const [resetPinVal, setResetPinVal] = useState('');

  // Admin: edit & delete account
  const [editAccId, setEditAccId] = useState<string | null>(null);
  const [editAccName, setEditAccName] = useState('');
  const [editAccUsername, setEditAccUsername] = useState('');
  const [editAccRole, setEditAccRole] = useState<UserRole>('Thành viên');
  const [editAccPin, setEditAccPin] = useState('');
  const [deleteAccTarget, setDeleteAccTarget] = useState<UserAccount | null>(null);

  useEffect(() => {
    if (open) {
      const currentKey = getGeminiApiKey();
      setApiKeyInput(currentKey);
      setKeySource(getGeminiKeySource());
      setApiMsg(null);
    }
  }, [open]);

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

  const isAdmin = currentUser.role === 'Admin';
  const adminCount = accounts.filter((a) => a.role === 'Admin').length;

  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    setApiMsg(null);
    saveGeminiApiKey(apiKeyInput.trim());
    setKeySource(getGeminiKeySource());
    setApiMsg({
      type: 'success',
      text: apiKeyInput.trim()
        ? 'Đã lưu Gemini API Key thành công vào trình duyệt của bạn.'
        : 'Đã xóa API Key lưu tạm. Hệ thống sẽ dùng biến môi trường (nếu có).',
    });
  };

  const handleTestApiKey = async () => {
    setApiMsg(null);
    setApiTesting(true);
    setApiTestStatus('Đang kiểm tra kết nối Gemini 3.8 Flash...');
    try {
      const result = await testGeminiConnection(apiKeyInput.trim() || undefined, {
        onStatusChange: (status) => {
          setApiTestStatus(status.message);
        },
      });
      if (result.ok) {
        setApiMsg({ type: 'success', text: result.message });
      } else {
        setApiMsg({ type: 'error', text: result.error });
      }
    } finally {
      setApiTesting(false);
      setApiTestStatus(null);
    }
  };

  const handleOwnPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPinMsg(null);
    if (newPin.trim() !== confirmPin.trim()) {
      setPinMsg({ type: 'error', text: 'Mã PIN mới nhập lại không khớp.' });
      return;
    }
    const res = onChangePin(currentUser.id, newPin, currentPin);
    if (!res.ok) {
      setPinMsg({ type: 'error', text: res.error });
      return;
    }
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setPinMsg({ type: 'success', text: 'Đã cập nhật mã PIN mới của bạn và đồng bộ lên Firestore.' });
  };

  const handleCreateAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAccMsg(null);
    const res = onCreateAccount({
      name: newName,
      username: newUsername,
      role: newRole,
      pin: newAccPin,
    });
    if (!res.ok) {
      setAccMsg({ type: 'error', text: res.error });
      return;
    }
    setNewName('');
    setNewUsername('');
    setNewRole('Thành viên');
    setNewAccPin('');
    setAccMsg({ type: 'success', text: 'Đã tạo tài khoản thành viên mới và đồng bộ Firestore.' });
  };

  const handleAdminResetPin = (targetId: string) => {
    setAccMsg(null);
    const res = onChangePin(targetId, resetPinVal);
    if (!res.ok) {
      setAccMsg({ type: 'error', text: res.error });
      return;
    }
    setResetTargetId(null);
    setResetPinVal('');
    setAccMsg({ type: 'success', text: 'Đã đặt lại mã PIN mới cho thành viên.' });
  };

  const handleResetToDefaultPin = (acc: UserAccount) => {
    setAccMsg(null);
    const defaultPin = getDefaultPinForAccount(acc);
    const res = onChangePin(acc.id, defaultPin);
    if (!res.ok) {
      setAccMsg({ type: 'error', text: res.error });
      return;
    }
    setResetTargetId(null);
    setResetPinVal('');
    setAccMsg({
      type: 'success',
      text: `Đã đặt lại mã PIN của ${acc.name} về mặc định (${defaultPin}).`,
    });
  };

  const openEditAccount = (acc: UserAccount) => {
    setAccMsg(null);
    setResetTargetId(null);
    setDeleteAccTarget(null);
    setEditAccId(acc.id);
    setEditAccName(acc.name);
    setEditAccUsername(acc.username);
    setEditAccRole(acc.role);
    setEditAccPin('');
  };

  const handleSaveEditAccount = (targetId: string) => {
    setAccMsg(null);
    const res = onUpdateAccount(targetId, {
      name: editAccName,
      username: editAccUsername,
      role: editAccRole,
      pin: editAccPin || undefined,
    });
    if (!res.ok) {
      setAccMsg({ type: 'error', text: res.error });
      return;
    }
    setEditAccId(null);
    setEditAccPin('');
    setAccMsg({ type: 'success', text: 'Đã cập nhật thông tin tài khoản thành viên.' });
  };

  const handleConfirmDeleteAccount = () => {
    if (!deleteAccTarget) return;
    setAccMsg(null);
    const res = onDeleteAccount(deleteAccTarget.id);
    if (!res.ok) {
      setAccMsg({ type: 'error', text: res.error });
      setDeleteAccTarget(null);
      return;
    }
    setDeleteAccTarget(null);
    setAccMsg({ type: 'success', text: 'Đã xóa tài khoản thành viên khỏi hệ thống.' });
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="account-settings-title"
      className="fixed inset-0 z-50 m-auto w-full max-w-2xl rounded-xl border border-[#E4DFD5] bg-white p-0 text-[#1A1F1E] shadow-xl backdrop:bg-[#1A1F1E]/40"
    >
      <div className="max-h-[88vh] overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-4 border-b border-[#ECE7DD] pb-4">
          <div>
            <h2 id="account-settings-title" className="font-serif text-xl font-semibold text-[#1A1F1E]">
              Cài đặt tài khoản &amp; Mã PIN
            </h2>
            <p className="mt-0.5 text-xs text-[#57605E]">
              Đang đăng nhập: <strong className="text-[#1A1F1E]">{currentUser.name}</strong> ·{' '}
              {currentUser.role === 'Admin' ? 'Admin / Quản lý' : 'Thành viên'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cài đặt tài khoản"
            className="rounded-lg p-1.5 text-[#57605E] transition-colors hover:bg-[#F3EFE6] hover:text-[#1A1F1E]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Section 1: Đổi mật khẩu / mã PIN cá nhân */}
        <section className="mt-5">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[#1A1F1E]">
            <KeyRound className="h-4 w-4 text-[#0D4F43]" />
            Đổi mã PIN 4 số của bạn
          </h3>

          {pinMsg && (
            <div
              role="status"
              className={`mt-3 rounded-lg border px-3 py-2 text-xs font-medium ${
                pinMsg.type === 'error'
                  ? 'border-[#A63429]/30 bg-[#A63429]/5 text-[#A63429]'
                  : 'border-[#0D4F43]/30 bg-[#0D4F43]/10 text-[#0D4F43]'
              }`}
            >
              {pinMsg.text}
            </div>
          )}

          <form onSubmit={handleOwnPinSubmit} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="self-pin-current" className="block text-xs font-medium text-[#57605E]">
                Mã PIN hiện tại
              </label>
              <input
                id="self-pin-current"
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="••••"
                className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 font-mono text-sm focus:border-[#0D4F43] focus:outline-none"
                required
              />
            </div>
            <div>
              <label htmlFor="self-pin-new" className="block text-xs font-medium text-[#57605E]">
                Mã PIN mới (4 số)
              </label>
              <input
                id="self-pin-new"
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="Ví dụ: 5678"
                className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 font-mono text-sm focus:border-[#0D4F43] focus:outline-none"
                required
              />
            </div>
            <div>
              <label htmlFor="self-pin-confirm" className="block text-xs font-medium text-[#57605E]">
                Nhập lại mã PIN mới
              </label>
              <input
                id="self-pin-confirm"
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="••••"
                className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 font-mono text-sm focus:border-[#0D4F43] focus:outline-none"
                required
              />
            </div>
            <div className="sm:col-span-3 flex justify-end">
              <button
                type="submit"
                className="rounded-lg bg-[#0D4F43] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#093B32]"
              >
                Lưu mã PIN mới
              </button>
            </div>
          </form>
        </section>

        {/* Section 1B: Thông báo thời gian thực & Cài đặt PWA trên điện thoại */}
        <section className="mt-6 border-t border-[#ECE7DD] pt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[#1A1F1E]">
                <Bell className="h-4 w-4 text-[#0D4F43]" />
                Thông báo điện thoại &amp; Cài đặt App (PWA)
              </h3>
              <p className="mt-0.5 text-xs text-[#57605E]">
                Nhận thông báo nổi ngay khi Ngân, Giang, Hoa, Phương hoặc Linh tạo đơn, nhập kho hay thêm khoản chi.
              </p>
            </div>

            {onToggleSound && (
              <button
                type="button"
                onClick={onToggleSound}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4DFD5] bg-[#FAF8F4] px-2.5 py-1.5 text-xs font-medium text-[#1A1F1E] hover:bg-[#F3EFE6]"
              >
                {soundEnabled ? (
                  <>
                    <Volume2 className="h-3.5 w-3.5 text-[#0D4F43]" />
                    <span>Âm thanh ting: Bật</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="h-3.5 w-3.5 text-[#8A918E]" />
                    <span>Âm thanh ting: Tắt</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="mt-3 space-y-2.5 rounded-xl border border-[#ECE7DD] bg-[#FAF8F4] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {notificationPermission === 'granted' ? (
                <>
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#0D4F43]">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#0D4F43]" />
                    Đã bật thông báo trên thiết bị này
                  </span>
                  {onSendTestNotification && (
                    <button
                      type="button"
                      onClick={() => {
                        onSendTestNotification();
                        setPushMsg('Đã gửi một thông báo thử tới thiết bị này.');
                      }}
                      className="rounded-lg border border-[#E4DFD5] bg-white px-3 py-1.5 text-xs font-medium text-[#1A1F1E] hover:bg-[#F3EFE6]"
                    >
                      Gửi thông báo thử
                    </button>
                  )}
                </>
              ) : notificationPermission === 'denied' ? (
                <div className="flex items-start gap-2 text-xs text-[#A63429]">
                  <BellOff className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Thông báo đang bị chặn trên trình duyệt này. Vui lòng mở Cài đặt trình duyệt / Điện thoại và chuyển quyền Thông báo sang Cho phép.
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    if (!onRequestNotificationPermission) return;
                    setPushMsg(null);
                    const result = await onRequestNotificationPermission();
                    if (result === 'granted') {
                      setPushMsg('Đã bật thông báo trên điện thoại này thành công!');
                      onSendTestNotification?.();
                    } else if (result === 'denied') {
                      setPushMsg('Bạn đã từ chối quyền thông báo. Có thể bật lại trong Cài đặt trình duyệt.');
                    } else if (result === 'unsupported') {
                      setPushMsg('Trình duyệt hiện tại chưa hỗ trợ Web Notification.');
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#0D4F43] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#093B32]"
                >
                  <span>🔔 Bật thông báo trên điện thoại này</span>
                </button>
              )}
            </div>

            {pushMsg && (
              <p className="text-xs font-medium text-[#0D4F43]">{pushMsg}</p>
            )}

            {isIOS && !isInstalled && (
              <div className="flex items-start gap-2 rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-xs leading-relaxed text-[#57605E]">
                <Share2 className="mt-0.5 h-4 w-4 shrink-0 text-[#0D4F43]" />
                <span>
                  <strong>Trên iPhone:</strong> Hãy bấm <strong>Chia sẻ</strong> →{' '}
                  <strong>Thêm vào MH chính</strong> trước, sau đó mở app từ màn hình chính để bật thông báo.
                </span>
              </div>
            )}

            {canInstallPrompt && onInstallApp && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#ECE7DD] pt-2.5">
                <span className="text-xs text-[#57605E]">
                  Cài ứng dụng như App riêng để chạy toàn màn hình và nhận thông báo nhanh hơn.
                </span>
                <button
                  type="button"
                  onClick={() => void onInstallApp()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#0D4F43]/30 bg-white px-3 py-1.5 text-xs font-semibold text-[#0D4F43] hover:bg-[#0D4F43]/5"
                >
                  <Download className="h-3.5 w-3.5" />
                  Thêm vào màn hình chính
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Section 2: Tùy chỉnh Icon & Cấu hình Gemini API (Admin only) */}
        {isAdmin && (
          <>
            {/* 2A: Icon đại diện cho app */}
            {onChangeAppIcon && (
              <section className="mt-6 border-t border-[#ECE7DD] pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-[#1A1F1E]">
                      <img
                        src={diamondAppAvatar}
                        alt="Biểu tượng Nhã Vương Miên"
                        referrerPolicy="no-referrer"
                        className="h-5 w-5 rounded-md border border-[#C99A4B]/50 bg-[#2C4832] object-cover"
                      />
                      Biểu tượng đại diện ứng dụng
                    </h3>
                    <p className="mt-0.5 text-xs text-[#57605E]">
                      Chọn hình đại diện đồng bộ với tiêu đề thanh điều hướng của xưởng.
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    { id: 'DiamondMoss', label: 'Kim cương vàng đồng', isBrandAvatar: true },
                    { id: 'Flower', label: 'Bông hoa', icon: Flower },
                    { id: 'Crown', label: 'Vương miện', icon: Crown },
                    { id: 'Gem', label: 'Viên ngọc', icon: Gem },
                    { id: 'Leaf', label: 'Chiếc lá', icon: Leaf },
                    { id: 'Star', label: 'Ngôi sao', icon: Star },
                  ].map((item) => {
                    const effectiveIcon = !appIcon || appIcon === 'Sparkles' ? 'DiamondMoss' : appIcon;
                    const isSelected = effectiveIcon === item.id;
                    const IconComp = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onChangeAppIcon(item.id)}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                          isSelected
                            ? 'border-[#0D4F43] bg-[#0D4F43]/10 text-[#0D4F43] font-semibold ring-1 ring-[#0D4F43]'
                            : 'border-[#E4DFD5] bg-white text-[#57605E] hover:bg-[#FAF8F4]'
                        }`}
                      >
                        {item.isBrandAvatar ? (
                          <img
                            src={diamondAppAvatar}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="h-4 w-4 rounded-sm border border-[#C99A4B]/50 bg-[#2C4832] object-cover"
                          />
                        ) : (
                          IconComp && <IconComp className="h-4 w-4" />
                        )}
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 2B: Cấu hình Gemini API Key */}
            <section className="mt-6 border-t border-[#ECE7DD] pt-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[#1A1F1E]">
                    <Sparkles className="h-4 w-4 text-purple-600" />
                    Cấu hình Trợ lý Gemini AI (Nhập liệu thông minh)
                  </h3>
                  <p className="mt-0.5 text-xs text-[#57605E]">
                    Ưu tiên model <strong className="font-mono text-purple-700">gemini-3.8-flash</strong> (tự động thử lại &amp; dự phòng qua <span className="font-mono">gemini-3.0-flash</span>, <span className="font-mono">gemini-2.5-flash-lite</span> khi bận/404).
                  </p>
                </div>
                <div>
                  {keySource === 'env' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-700 border border-blue-200">
                      Đang dùng biến Vercel (VITE_GEMINI_API_KEY)
                    </span>
                  )}
                  {keySource === 'custom' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-medium text-purple-700 border border-purple-200">
                      Lưu tạm trên trình duyệt
                    </span>
                  )}
                  {keySource === 'none' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 border border-amber-200">
                      Chưa cấu hình
                    </span>
                  )}
                </div>
              </div>

              {apiTesting && apiTestStatus && (
                <div
                  role="status"
                  className="mt-3 flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-medium text-purple-900"
                >
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-purple-600" />
                  <span>{apiTestStatus}</span>
                </div>
              )}

              {apiMsg && !apiTesting && (
                <div
                  role="status"
                  className={`mt-3 rounded-lg border px-3 py-2 text-xs font-medium ${
                    apiMsg.type === 'error'
                      ? 'border-[#A63429]/30 bg-[#A63429]/5 text-[#A63429]'
                      : 'border-purple-300 bg-purple-50 text-purple-800'
                  }`}
                >
                  {apiMsg.text}
                </div>
              )}

              <form onSubmit={handleSaveApiKey} className="mt-3 space-y-2">
                <div>
                  <label htmlFor="gemini-api-key" className="block text-xs font-medium text-[#57605E]">
                    Gemini API Key
                  </label>
                  <div className="relative mt-1 flex items-center">
                    <input
                      id="gemini-api-key"
                      type={showApiKey ? 'text' : 'password'}
                      placeholder="AIzaSy..."
                      value={apiKeyInput}
                      onChange={(e) => {
                        setApiKeyInput(e.target.value);
                        setApiMsg(null);
                      }}
                      className="w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 pr-10 font-mono text-xs focus:border-purple-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey((v) => !v)}
                      className="absolute right-2.5 p-1 text-[#8A918E] hover:text-[#1A1F1E]"
                      aria-label={showApiKey ? 'Ẩn mã khóa' : 'Hiện mã khóa'}
                    >
                      {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      className="rounded-lg bg-purple-600 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-purple-700"
                    >
                      Lưu API Key
                    </button>
                    <button
                      type="button"
                      onClick={handleTestApiKey}
                      disabled={apiTesting}
                      className="rounded-lg border border-[#E4DFD5] bg-white px-3 py-1.5 text-xs font-medium text-[#1A1F1E] hover:bg-[#FAF8F4] disabled:opacity-50"
                    >
                      {apiTesting ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}
                    </button>
                  </div>
                  <a
                    href="https://aistudio.google.com"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-[11px] text-purple-700 hover:underline"
                  >
                    <span>Lấy API key miễn phí tại aistudio.google.com</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                {/* Hướng dẫn ngắn */}
                <div className="mt-2 rounded-lg bg-[#FAF8F4] border border-[#ECE7DD] p-2.5 text-[11px] text-[#57605E]">
                  <strong>Hướng dẫn lấy key miễn phí trong 1 phút:</strong>
                  <ol className="mt-1 list-decimal list-inside space-y-0.5 text-[10.5px]">
                    <li>Truy cập <code className="bg-white px-1 py-0.5 rounded border border-[#E4DFD5]">aistudio.google.com</code> và đăng nhập tài khoản Google.</li>
                    <li>Bấm vào nút <strong>"Get API key"</strong> ở menu bên trái → Chọn <strong>"Create API key"</strong>.</li>
                    <li>Sao chép mã khóa (bắt đầu bằng <code>AIzaSy...</code>) rồi dán vào ô trên và bấm "Lưu API Key".</li>
                  </ol>
                </div>
              </form>
            </section>
          </>
        )}

        {/* Section 3: Quản lý tài khoản (Admin only) */}
        {isAdmin && (
          <section className="mt-6 border-t border-[#ECE7DD] pt-6">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[#1A1F1E]">
              <ShieldCheck className="h-4 w-4 text-[#0D4F43]" />
              Quản lý tài khoản team &amp; Đặt lại PIN (Quyền Admin)
            </h3>

            {accMsg && (
              <div
                role="status"
                className={`mt-3 rounded-lg border px-3 py-2 text-xs font-medium ${
                  accMsg.type === 'error'
                    ? 'border-[#A63429]/30 bg-[#A63429]/5 text-[#A63429]'
                    : 'border-[#0D4F43]/30 bg-[#0D4F43]/10 text-[#0D4F43]'
                }`}
              >
                {accMsg.text}
              </div>
            )}

            {deleteAccTarget && (
              <div
                role="alertdialog"
                aria-label="Xác nhận xóa tài khoản"
                className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#A63429]/30 bg-[#A63429]/5 px-3.5 py-2.5 text-xs"
              >
                <span className="font-medium text-[#A63429]">
                  Xác nhận xóa vĩnh viễn tài khoản <strong>{deleteAccTarget.name}</strong> ({deleteAccTarget.username})?
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDeleteAccTarget(null)}
                    className="rounded border border-[#E4DFD5] bg-white px-2.5 py-1 text-xs font-medium text-[#1A1F1E]"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDeleteAccount}
                    className="rounded bg-[#A63429] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#8B2920]"
                  >
                    Xác nhận xóa
                  </button>
                </div>
              </div>
            )}

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E4DFD5] font-semibold text-[#57605E]">
                    <th className="py-2 pr-3">Thành viên</th>
                    <th className="py-2 px-3">Tên đăng nhập</th>
                    <th className="py-2 px-3">Vai trò</th>
                    <th className="py-2 pl-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECE7DD]">
                  {accounts.map((acc) => {
                    const isSelf = acc.id === currentUser.id;
                    const isLastAdmin = acc.role === 'Admin' && adminCount <= 1;
                    const cannotDelete = isSelf || isLastAdmin;
                    const isEditingThis = editAccId === acc.id;
                    const defaultPin = getDefaultPinForAccount(acc);
                    return (
                      <React.Fragment key={acc.id}>
                        <tr>
                          <td className="py-2.5 pr-3 font-medium text-[#1A1F1E]">
                            {acc.name}
                            {isSelf && (
                              <span className="ml-1.5 text-[11px] font-normal text-[#0D4F43]">
                                (Bạn)
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[#57605E]">{acc.username}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={
                                acc.role === 'Admin'
                                  ? 'font-semibold text-[#0D4F43]'
                                  : 'text-[#57605E]'
                              }
                            >
                              {acc.role}
                            </span>
                          </td>
                          <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                            {resetTargetId === acc.id ? (
                              <div className="inline-flex items-center gap-1.5">
                                <input
                                  type="password"
                                  inputMode="numeric"
                                  maxLength={4}
                                  aria-label={`Mã PIN mới cho ${acc.name}`}
                                  placeholder="PIN 4 số"
                                  value={resetPinVal}
                                  onChange={(e) =>
                                    setResetPinVal(e.target.value.replace(/\D/g, '').slice(0, 4))
                                  }
                                  className="w-24 rounded border border-[#E4DFD5] px-2 py-1 font-mono text-xs focus:border-[#0D4F43] focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleAdminResetPin(acc.id)}
                                  className="rounded bg-[#0D4F43] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#093B32]"
                                >
                                  Lưu
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setResetTargetId(null);
                                    setResetPinVal('');
                                  }}
                                  className="rounded border border-[#E4DFD5] px-2 py-1 text-xs text-[#57605E]"
                                >
                                  Hủy
                                </button>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    isEditingThis ? setEditAccId(null) : openEditAccount(acc)
                                  }
                                  aria-label={`Sửa tài khoản ${acc.name}`}
                                  className="inline-flex items-center gap-1 rounded border border-[#E4DFD5] bg-white px-2 py-1 text-xs font-medium text-[#1A1F1E] hover:bg-[#FAF8F4]"
                                >
                                  <Edit3 className="h-3 w-3" />
                                  Sửa
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditAccId(null);
                                    setResetTargetId(acc.id);
                                    setResetPinVal('');
                                  }}
                                  className="rounded border border-[#E4DFD5] bg-white px-2 py-1 text-xs font-medium text-[#1A1F1E] hover:bg-[#FAF8F4]"
                                >
                                  Đổi PIN
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleResetToDefaultPin(acc)}
                                  title={`Đặt lại về PIN mặc định (${defaultPin})`}
                                  className="inline-flex items-center gap-1 rounded border border-[#E4DFD5] bg-white px-2 py-1 text-xs font-medium text-[#0D4F43] hover:bg-[#0D4F43]/5"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                  PIN mặc định ({defaultPin})
                                </button>
                                <button
                                  type="button"
                                  disabled={cannotDelete}
                                  onClick={() => setDeleteAccTarget(acc)}
                                  aria-label={`Xóa tài khoản ${acc.name}`}
                                  title={
                                    isSelf
                                      ? 'Không thể tự xóa tài khoản đang đăng nhập'
                                      : isLastAdmin
                                        ? 'Cần giữ ít nhất 1 Admin'
                                        : `Xóa tài khoản ${acc.name}`
                                  }
                                  className="rounded border border-[#E4DFD5] bg-white p-1 text-[#A63429] hover:border-[#A63429]/40 hover:bg-[#A63429]/5 disabled:opacity-30"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>

                        {isEditingThis && (
                          <tr className="bg-[#FAF8F4]">
                            <td colSpan={4} className="px-3 py-3">
                              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-4 sm:items-end">
                                <div>
                                  <label
                                    htmlFor={`edit-acc-name-${acc.id}`}
                                    className="block text-[11px] font-medium text-[#57605E]"
                                  >
                                    Tên hiển thị
                                  </label>
                                  <input
                                    id={`edit-acc-name-${acc.id}`}
                                    type="text"
                                    value={editAccName}
                                    onChange={(e) => setEditAccName(e.target.value)}
                                    className="mt-1 w-full rounded border border-[#E4DFD5] bg-white px-2 py-1.5 text-xs focus:border-[#0D4F43] focus:outline-none"
                                  />
                                </div>
                                <div>
                                  <label
                                    htmlFor={`edit-acc-user-${acc.id}`}
                                    className="block text-[11px] font-medium text-[#57605E]"
                                  >
                                    Tên đăng nhập
                                  </label>
                                  <input
                                    id={`edit-acc-user-${acc.id}`}
                                    type="text"
                                    value={editAccUsername}
                                    onChange={(e) => setEditAccUsername(e.target.value)}
                                    className="mt-1 w-full rounded border border-[#E4DFD5] bg-white px-2 py-1.5 font-mono text-xs focus:border-[#0D4F43] focus:outline-none"
                                  />
                                </div>
                                <div>
                                  <label
                                    htmlFor={`edit-acc-role-${acc.id}`}
                                    className="block text-[11px] font-medium text-[#57605E]"
                                  >
                                    Vai trò
                                  </label>
                                  <select
                                    id={`edit-acc-role-${acc.id}`}
                                    value={editAccRole}
                                    onChange={(e) => setEditAccRole(e.target.value as UserRole)}
                                    className="mt-1 w-full rounded border border-[#E4DFD5] bg-white px-2 py-1.5 text-xs focus:border-[#0D4F43] focus:outline-none"
                                  >
                                    <option value="Thành viên">Thành viên</option>
                                    <option value="Admin">Admin</option>
                                  </select>
                                </div>
                                <div>
                                  <label
                                    htmlFor={`edit-acc-pin-${acc.id}`}
                                    className="block text-[11px] font-medium text-[#57605E]"
                                  >
                                    PIN mới (tùy chọn)
                                  </label>
                                  <input
                                    id={`edit-acc-pin-${acc.id}`}
                                    type="password"
                                    inputMode="numeric"
                                    maxLength={4}
                                    placeholder="Giữ nguyên nếu trống"
                                    value={editAccPin}
                                    onChange={(e) =>
                                      setEditAccPin(e.target.value.replace(/\D/g, '').slice(0, 4))
                                    }
                                    className="mt-1 w-full rounded border border-[#E4DFD5] bg-white px-2 py-1.5 font-mono text-xs focus:border-[#0D4F43] focus:outline-none"
                                  />
                                </div>
                              </div>
                              <div className="mt-2.5 flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditAccId(null)}
                                  className="rounded border border-[#E4DFD5] bg-white px-2.5 py-1 text-xs font-medium text-[#57605E]"
                                >
                                  Hủy
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditAccount(acc.id)}
                                  className="rounded bg-[#0D4F43] px-3 py-1 text-xs font-medium text-white hover:bg-[#093B32]"
                                >
                                  Lưu tài khoản
                                </button>
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

            <form
              onSubmit={handleCreateAccountSubmit}
              className="mt-4 rounded-xl border border-[#ECE7DD] bg-[#FAF8F4] p-4"
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1A1F1E]">
                <UserPlus className="h-3.5 w-3.5 text-[#0D4F43]" />
                Tạo tài khoản thành viên mới
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div>
                  <label htmlFor="new-acc-name" className="block text-xs font-medium text-[#57605E]">
                    Tên thành viên
                  </label>
                  <input
                    id="new-acc-name"
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ví dụ: Minh"
                    className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-1.5 text-xs focus:border-[#0D4F43] focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="new-acc-user" className="block text-xs font-medium text-[#57605E]">
                    Tên đăng nhập
                  </label>
                  <input
                    id="new-acc-user"
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Ví dụ: minh"
                    className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-1.5 font-mono text-xs focus:border-[#0D4F43] focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="new-acc-role" className="block text-xs font-medium text-[#57605E]">
                    Vai trò
                  </label>
                  <select
                    id="new-acc-role"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-1.5 text-xs focus:border-[#0D4F43] focus:outline-none"
                  >
                    <option value="Thành viên">Thành viên</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="new-acc-pin" className="block text-xs font-medium text-[#57605E]">
                    Mã PIN 4 số
                  </label>
                  <input
                    id="new-acc-pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={newAccPin}
                    onChange={(e) => setNewAccPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="6666"
                    className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-2.5 py-1.5 font-mono text-xs focus:border-[#0D4F43] focus:outline-none"
                    required
                  />
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="submit"
                  className="rounded-lg bg-[#0D4F43] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#093B32]"
                >
                  Thêm tài khoản
                </button>
              </div>
            </form>

            {onRequestResetSystem && hasSystemData && (
              <div className="mt-6 border-t border-[#ECE7DD] pt-5">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#A63429]/25 bg-[#A63429]/[0.04] p-4">
                  <div>
                    <div className="text-xs font-semibold text-[#A63429]">
                      Reset dữ liệu hệ thống
                    </div>
                    <p className="mt-0.5 text-[11px] text-[#57605E]">
                      Đặt toàn bộ đơn hàng, tồn kho, cổ đông, chi phí về 0 (hệ thống tự động lưu bản sao lưu trước khi reset và giữ nguyên tài khoản team).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onRequestResetSystem();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#A63429] px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-[#8B2920] whitespace-nowrap shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Reset dữ liệu về 0
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </dialog>
  );
};

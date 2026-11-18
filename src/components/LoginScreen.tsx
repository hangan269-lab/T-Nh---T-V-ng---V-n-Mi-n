import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Cloud,
  KeyRound,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { UserAccount } from '../types/erp';

interface LoginScreenProps {
  accounts: UserAccount[];
  firestoreLoading: boolean;
  startupError?: string | null;
  onRetryStartup?: () => void;
  onLogin: (identifier: string, pin: string) => { ok: true } | { ok: false; error: string };
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  accounts,
  firestoreLoading,
  startupError,
  onRetryStartup,
  onLogin,
}) => {
  const [selectedId, setSelectedId] = useState<string>(accounts[0]?.id ?? 'acc_ngan');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const pinInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (accounts.length > 0 && !accounts.some((a) => a.id === selectedId)) {
      setSelectedId(accounts[0].id);
    }
  }, [accounts, selectedId]);

  const selectedAccount = accounts.find((a) => a.id === selectedId) ?? accounts[0] ?? null;

  const handleSelectAccount = (account: UserAccount) => {
    setSelectedId(account.id);
    setPin('');
    setError(null);
    window.setTimeout(() => {
      pinInputRef.current?.focus();
    }, 0);
  };

  const attemptLogin = (candidatePin: string) => {
    if (!selectedAccount) return;
    const res = onLogin(selectedAccount.username, candidatePin);
    if (!res.ok) {
      setError(res.error);
      setPin('');
      window.setTimeout(() => {
        pinInputRef.current?.focus();
      }, 0);
    }
  };

  const handlePinChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    setPin(digits);
    setError(null);
    if (digits.length === 4 && selectedAccount) {
      attemptLogin(digits);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    attemptLogin(pin);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF8F4] px-4 py-10 text-[#1A1F1E]">
      <div className="grid w-full max-w-4xl grid-cols-1 overflow-hidden rounded-2xl border border-[#E4DFD5] bg-white lg:grid-cols-12">
        {/* Left column: Brand & Studio Context */}
        <div className="flex flex-col justify-between border-b border-[#ECE7DD] bg-[#F6F2EA] p-8 lg:col-span-5 lg:border-b-0 lg:border-r">
          <div>
            <div className="font-serif text-2xl font-bold tracking-tight text-[#1A1F1E]">
              Tơ Nhã · Tơ Vương
            </div>
            <div className="mt-1 text-sm font-medium text-[#0D4F43]">&amp; Vân Miên Studio</div>
            <p className="mt-6 text-sm leading-relaxed text-[#57605E]">
              Hệ thống quản lý bán hàng, tồn kho, tài chính và lịch sử thao tác đồng bộ thời gian thực trên Cloud Firestore cho đội ngũ 5 thành viên.
            </p>
          </div>

          <div className="mt-8 space-y-3 border-t border-[#E4DFD5] pt-6 text-xs text-[#57605E]">
            <div className="flex items-start gap-2.5">
              <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-[#0D4F43]" />
              <span>
                Đồng bộ đa thiết bị thời gian thực qua <strong className="text-[#1A1F1E]">Firebase Firestore</strong> (Đơn hàng, Kho, Nhập kho, Thu Chi, Quỹ, Nhật ký).
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#0D4F43]" />
              <span>
                Tự động ghi nhận <strong className="text-[#1A1F1E]">Người tạo đơn</strong>,{' '}
                <strong className="text-[#1A1F1E]">Người sửa/xóa</strong> và{' '}
                <strong className="text-[#1A1F1E]">Người xác nhận thanh toán</strong>.
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#0D4F43]" />
              <span>
                Đăng nhập nhanh bằng thẻ thành viên và <strong className="text-[#1A1F1E]">Mã PIN 4 số</strong>; tự động giữ phiên đăng nhập trên trình duyệt.
              </span>
            </div>
          </div>
        </div>

        {/* Right column: 5-Member Selector + Auto-Submit 4-Digit PIN */}
        <div className="p-8 lg:col-span-7">
          {firestoreLoading ? (
            <div className="flex min-h-[340px] flex-col items-center justify-center text-center">
              <Loader2 className="h-7 w-7 animate-spin text-[#0D4F43]" />
              <p className="mt-3 text-sm font-medium text-[#1A1F1E]">
                Đang xác thực kết nối bảo mật &amp; đồng bộ dữ liệu từ Cloud Firestore...
              </p>
              <p className="mt-1 text-xs text-[#57605E]">
                Vui lòng chờ trong giây lát.
              </p>
            </div>
          ) : startupError ? (
            <div className="flex min-h-[340px] flex-col items-center justify-center text-center">
              <div className="rounded-xl bg-[#A63429]/10 p-3 text-[#A63429]">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h1 className="mt-4 font-serif text-xl font-semibold text-[#1A1F1E]">
                Không thể kết nối Firebase
              </h1>
              <p
                role="alert"
                className="mt-2 max-w-md text-sm leading-relaxed text-[#57605E]"
              >
                {startupError}
              </p>
              {onRetryStartup && (
                <button
                  type="button"
                  onClick={onRetryStartup}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#0D4F43] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#093B32]"
                >
                  <RefreshCw className="h-4 w-4" />
                  Thử lại
                </button>
              )}
            </div>
          ) : (
            <>
              <h1 className="font-serif text-2xl font-semibold text-[#1A1F1E]">
                Chọn thành viên đăng nhập
              </h1>
              <p className="mt-1 text-sm text-[#57605E]">
                Bấm vào tên của bạn rồi nhập mã PIN 4 số — hệ thống sẽ tự động mở khóa ngay sau chữ số thứ 4.
              </p>

              {/* 5 Member Avatar Cards */}
              <div
                role="group"
                aria-label="Danh sách thành viên studio"
                className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3"
              >
                {accounts.map((acc) => {
                  const isSelected = selectedAccount?.id === acc.id;
                  const initial = acc.name.trim().charAt(0).toUpperCase() || '?';
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => handleSelectAccount(acc)}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                        isSelected
                          ? 'border-[#0D4F43] bg-[#0D4F43]/[0.06] text-[#0D4F43]'
                          : 'border-[#E4DFD5] bg-white text-[#1A1F1E] hover:bg-[#FAF8F4]'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-serif text-base font-bold ${
                          isSelected
                            ? 'bg-[#0D4F43] text-white'
                            : 'bg-[#EFEAE0] text-[#1A1F1E]'
                        }`}
                      >
                        {initial}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{acc.name}</span>
                        <span className="block truncate text-[11px] text-[#57605E]">
                          {acc.role === 'Admin' ? 'Admin' : 'Thành viên'}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                {selectedAccount && (
                  <div className="flex items-center justify-between rounded-xl border border-[#E4DFD5] bg-[#FAF8F4] px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0D4F43] font-serif text-sm font-bold text-white">
                        {selectedAccount.name.trim().charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <div className="text-sm font-semibold text-[#1A1F1E]">
                          {selectedAccount.name}
                        </div>
                        <div className="text-xs text-[#57605E]">
                          {selectedAccount.role === 'Admin' ? 'Admin / Quản lý' : 'Thành viên'} · @{selectedAccount.username}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-[#0D4F43]">Đang chọn</span>
                  </div>
                )}

                {error && (
                  <div
                    role="alert"
                    className="rounded-lg border border-[#A63429]/30 bg-[#A63429]/5 px-4 py-2.5 text-sm font-medium text-[#A63429]"
                  >
                    {error}
                  </div>
                )}

                <div>
                  <label htmlFor="login-pin" className="block text-xs font-medium text-[#57605E]">
                    Nhập mã PIN 4 số
                  </label>
                  <div className="relative mt-1.5">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#57605E]" />
                    <input
                      ref={pinInputRef}
                      id="login-pin"
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      autoFocus
                      autoComplete="one-time-code"
                      value={pin}
                      onChange={(e) => handlePinChange(e.target.value)}
                      placeholder="••••"
                      className="w-full rounded-xl border border-[#E4DFD5] bg-white py-3 pl-10 pr-4 text-center font-mono text-xl tracking-[0.6em] text-[#1A1F1E] focus:border-[#0D4F43] focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0D4F43] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#093B32]"
                >
                  <KeyRound className="h-4 w-4" />
                  Đăng nhập{selectedAccount ? ` với tên ${selectedAccount.name}` : ''}
                </button>

                <p className="text-xs leading-relaxed text-[#57605E]">
                  Mã PIN khởi tạo mặc định: <span className="font-mono font-medium text-[#1A1F1E]">Ngân (1111)</span>,{' '}
                  <span className="font-mono font-medium text-[#1A1F1E]">Giang (2222)</span>,{' '}
                  <span className="font-mono font-medium text-[#1A1F1E]">Hoa (3333)</span>,{' '}
                  <span className="font-mono font-medium text-[#1A1F1E]">Phương (4444)</span>,{' '}
                  <span className="font-mono font-medium text-[#1A1F1E]">Linh (5555)</span>. Có thể đổi PIN riêng hoặc nhờ Admin đặt lại trong mục Cài đặt.
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

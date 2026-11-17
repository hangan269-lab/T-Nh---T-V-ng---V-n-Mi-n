import React, { useEffect, useRef, useState } from 'react';
import { KeyRound, ShieldCheck, UserPlus, X } from 'lucide-react';
import { UserAccount, UserRole } from '../types/erp';

interface AccountSettingsModalProps {
  open: boolean;
  currentUser: UserAccount;
  accounts: UserAccount[];
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
}

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  open,
  currentUser,
  accounts,
  onClose,
  onChangePin,
  onCreateAccount,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

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
    setPinMsg({ type: 'success', text: 'Đã cập nhật mã PIN mới của bạn.' });
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
    setAccMsg({ type: 'success', text: 'Đã tạo tài khoản thành viên mới.' });
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
    setAccMsg({ type: 'success', text: 'Đã đặt lại mã PIN cho thành viên.' });
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
              Cài đặt tài khoản &amp; Bảo mật
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
            Đổi mã PIN / Mật khẩu của bạn
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
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value)}
                placeholder="••••"
                className="mt-1 w-full rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 font-mono text-sm focus:border-[#0D4F43] focus:outline-none"
                required
              />
            </div>
            <div>
              <label htmlFor="self-pin-new" className="block text-xs font-medium text-[#57605E]">
                Mã PIN mới (từ 4 ký tự)
              </label>
              <input
                id="self-pin-new"
                type="password"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
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
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
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

        {/* Section 2: Quản lý tài khoản (Admin only) */}
        {isAdmin && (
          <section className="mt-6 border-t border-[#ECE7DD] pt-6">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[#1A1F1E]">
              <ShieldCheck className="h-4 w-4 text-[#0D4F43]" />
              Quản lý tài khoản team (Quyền Admin)
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

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E4DFD5] font-semibold text-[#57605E]">
                    <th className="py-2 pr-3">Thành viên</th>
                    <th className="py-2 px-3">Tên đăng nhập</th>
                    <th className="py-2 px-3">Vai trò</th>
                    <th className="py-2 pl-3 text-right">Đặt lại mã PIN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECE7DD]">
                  {accounts.map((acc) => (
                    <tr key={acc.id}>
                      <td className="py-2.5 pr-3 font-medium text-[#1A1F1E]">{acc.name}</td>
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
                      <td className="py-2.5 pl-3 text-right">
                        {resetTargetId === acc.id ? (
                          <div className="inline-flex items-center gap-1.5">
                            <input
                              type="password"
                              aria-label={`Mã PIN mới cho ${acc.name}`}
                              placeholder="PIN mới"
                              value={resetPinVal}
                              onChange={(e) => setResetPinVal(e.target.value)}
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
                          <button
                            type="button"
                            onClick={() => {
                              setResetTargetId(acc.id);
                              setResetPinVal('');
                            }}
                            className="rounded border border-[#E4DFD5] bg-white px-2.5 py-1 text-xs font-medium text-[#1A1F1E] hover:bg-[#FAF8F4]"
                          >
                            Đổi PIN
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
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
                    value={newAccPin}
                    onChange={(e) => setNewAccPin(e.target.value)}
                    placeholder="1234"
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
          </section>
        )}
      </div>
    </dialog>
  );
};

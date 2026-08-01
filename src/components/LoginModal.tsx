import React, { useState } from 'react';
import { UserSession } from '../types';
import { ShieldCheck, User, Lock, X, CheckCircle2, AlertCircle } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: UserSession) => void;
  currentUser: UserSession | null;
}

export default function LoginModal({ isOpen, onClose, onLoginSuccess, currentUser }: LoginModalProps) {
  const [activeTab, setActiveTab] = useState<'guest' | 'admin'>('guest');
  const [guestName, setGuestName] = useState(currentUser?.role === 'guest' ? currentUser.name : '');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleGuestLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'guest',
          name: guestName.trim() || 'Cán bộ Khách'
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        onLoginSuccess(data.user);
        onClose();
      } else {
        setErrorMsg(data.error || 'Đăng nhập không thành công.');
      }
    } catch (err: any) {
      setErrorMsg('Không thể kết nối đến máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'admin',
          password
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        onLoginSuccess(data.user);
        setPassword('');
        onClose();
      } else {
        setErrorMsg(data.error || 'Mật khẩu sai. Vui lòng thử lại.');
      }
    } catch (err: any) {
      setErrorMsg('Lỗi kết nối máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-xl shadow-2xl border border-slate-200 overflow-hidden font-sans relative">
        
        {/* Header */}
        <div className="bg-brand-primary text-white p-5 text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-300 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="inline-flex p-2.5 bg-amber-400/20 text-amber-300 rounded-full mb-2">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold uppercase tracking-wide">Đăng nhập tài khoản hệ thống</h3>
          <p className="text-xs text-slate-200 mt-1">
            Hệ thống Tra cứu & Quản lý Văn bản Pháp quy NHNN
          </p>
        </div>

        {/* Current user badge if already logged in */}
        {currentUser && (
          <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-500">Tài khoản hiện tại:</span>
            <span className="font-bold text-slate-800 flex items-center">
              {currentUser.role === 'admin' ? (
                <ShieldCheck className="h-3.5 w-3.5 text-amber-600 mr-1" />
              ) : (
                <User className="h-3.5 w-3.5 text-blue-600 mr-1" />
              )}
              {currentUser.name} ({currentUser.role === 'admin' ? 'Admin' : 'Khách'})
            </span>
          </div>
        )}

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 p-1">
          <button
            type="button"
            onClick={() => { setActiveTab('guest'); setErrorMsg(''); }}
            className={`flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center space-x-1.5 ${
              activeTab === 'guest'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="h-4 w-4 text-blue-600" />
            <span>Tài khoản Khách</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('admin'); setErrorMsg(''); }}
            className={`flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center space-x-1.5 ${
              activeTab === 'admin'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Lock className="h-4 w-4 text-amber-600" />
            <span>Tài khoản Admin</span>
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5">
          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {activeTab === 'guest' ? (
            <form onSubmit={handleGuestLogin} className="space-y-4">
              <div className="bg-blue-50/70 border border-blue-100 rounded-lg p-3 text-xs text-blue-800 space-y-1">
                <p className="font-bold flex items-center">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-blue-600" />
                  Đăng nhập Khách không cần mật khẩu
                </p>
                <p className="text-[11px] text-blue-700 leading-relaxed">
                  Tài khoản Khách được phép tra cứu, xem và đề xuất thêm, sửa, xóa văn bản hoặc thư mục. Các hành vi chỉnh sửa sẽ gửi yêu cầu phê duyệt đến Admin.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Họ và tên cán bộ / Tên tài khoản
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="VD: Nguyễn Văn A (Cán bộ Giám sát)"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-brand-primary focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-brand-primary text-white text-xs font-bold rounded-md hover:bg-brand-secondary transition-colors shadow-sm disabled:opacity-50"
              >
                {loading ? 'Đang xác thực...' : 'Vào hệ thống dưới dạng Khách'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="bg-amber-50/70 border border-amber-100 rounded-lg p-3 text-xs text-amber-900 space-y-1">
                <p className="font-bold flex items-center">
                  <ShieldCheck className="h-3.5 w-3.5 mr-1.5 text-amber-600" />
                  Quyền Quản trị viên (Admin)
                </p>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Admin có quyền trực tiếp phê duyệt, chỉnh sửa hệ thống và duyệt các yêu cầu thay đổi từ khách. Mật khẩu mặc định: <code className="bg-amber-100 px-1 rounded font-mono font-bold">admin123</code>.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mật khẩu Quản trị (Admin Password)
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu Admin..."
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-amber-600 text-white text-xs font-bold rounded-md hover:bg-amber-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {loading ? 'Đang xác thực...' : 'Đăng nhập Quản trị viên'}
              </button>
            </form>
          )}
        </div>

        <div className="bg-slate-50 p-3 text-center border-t border-slate-200">
          <p className="text-[11px] text-slate-500">
            Cơ quan Thanh tra Ngân hàng Nhà nước • Khu vực 9
          </p>
        </div>
      </div>
    </div>
  );
}

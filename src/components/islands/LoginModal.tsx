import { useState, useEffect, useCallback } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../../lib/queryClient';

type Step = 'phone' | 'otp';

// Dev-only quick-login accounts (same set as the /auth/login page). All use OTP 123456.
const DEV_ACCOUNTS: { role: string; accounts: { name: string; phone: string; icon: string }[] }[] = [
  { role: 'Customers', accounts: [
    { name: 'Dev Customer', phone: '8888888888', icon: '👤' },
    { name: 'Arjun Kumar',  phone: '9000000001', icon: '👤' },
    { name: 'Priya Sharma', phone: '9000000002', icon: '👤' },
    { name: 'Rahul Verma',  phone: '9000000003', icon: '👤' },
  ]},
  { role: 'Vendors', accounts: [
    { name: 'Dev Vendor',  phone: '9999999999', icon: '🏪' },
    { name: 'Sneha Reddy', phone: '9000000004', icon: '🏪' },
    { name: 'Vikram Iyer', phone: '9000000005', icon: '🏪' },
    { name: 'Kiran Naidu', phone: '9000000007', icon: '🏪' },
    { name: 'Divya Mehta', phone: '9000000008', icon: '🏪' },
  ]},
  { role: 'Admins', accounts: [
    { name: 'Dev Admin',  phone: '7000000001', icon: '🛡️' },
    { name: 'Dev Master', phone: '7000000002', icon: '🛡️' },
  ]},
];

function LoginModalInner() {
  const [open, setOpen]       = useState(false);
  const [step, setStep]       = useState<Step>('phone');
  const [phone, setPhone]     = useState('');
  const [cc, setCc]           = useState('+91');
  const [otp, setOtp]         = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [resendSecs, setResendSecs] = useState(0);

  // Listen for global trigger from any island
  useEffect(() => {
    const show = () => { setOpen(true); setStep('phone'); setPhone(''); setOtp(''); setError(''); };
    window.addEventListener('ns:require-login', show);
    return () => window.removeEventListener('ns:require-login', show);
  }, []);

  // Resend countdown
  useEffect(() => {
    if (resendSecs <= 0) return;
    const t = setTimeout(() => setResendSecs(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendSecs]);

  const close = useCallback(() => {
    setOpen(false);
    setStep('phone');
    setPhone('');
    setOtp('');
    setError('');
    setLoading(false);
  }, []);

  const sendOtp = useCallback(async (overridePhone?: string) => {
    const digits = (overridePhone ?? phone).trim().replace(/\D/g, '');
    if (digits.length !== 10) { setError('Enter a valid 10-digit mobile number'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/auth/otp/send/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: `${cc}${digits}`, is_signup: false }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.detail ?? d.message ?? Object.values(d).flat().join(' ') ?? 'Failed to send OTP');
      setStep('otp');
      setResendSecs(30);
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [phone, cc]);

  // Dev quick-login: fill the number, pre-fill the fixed dev OTP, and send.
  const devLogin = useCallback((num: string) => {
    setError('');
    setPhone(num);
    setOtp('123456');
    sendOtp(num);
  }, [sendOtp]);

  const verifyOtp = useCallback(async () => {
    const digits = phone.trim().replace(/\D/g, '');
    if (otp.length < 4) { setError('Enter the OTP'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/auth/otp/verify/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: `${cc}${digits}`, otp }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail ?? data.message ?? 'Invalid OTP');

      localStorage.setItem('ns_access',  data.access);
      localStorage.setItem('ns_refresh', data.refresh);
      const raw  = data.user ?? {};
      const role = raw.role ?? '';
      const isAdmin = role === 'admin' || role === 'master_admin';
      const normalizedUser = {
        ...raw, ui_mode: role, role,
        is_vendor: role === 'vendor',
        is_admin: isAdmin,
        avatar_url: raw.avatar ?? '',
      };
      localStorage.setItem('ns_user', JSON.stringify(normalizedUser));

      if (!isAdmin && (data.is_new || !role)) {
        window.location.href = '/auth/role-select';
        return;
      }
      if (isAdmin) { window.location.href = '/admin/dashboard'; return; }
      if (role === 'vendor') { window.location.href = '/vendor/dashboard'; return; }

      // Customer login success — reload so all islands pick up the new auth state
      window.location.reload();
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [phone, cc, otp, close]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center"
      onClick={e => { if (e.target === e.currentTarget) close(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Sheet */}
      <div className="relative w-full sm:max-w-md bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl p-6 pb-8 sm:pb-6 animate-slide-up">

        {/* Close button */}
        <button onClick={close}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-gray-500 text-lg">
          ×
        </button>

        {step === 'phone' ? (
          <>
            <div className="mb-5">
              <h2 className="text-xl font-black text-navy">Sign in to continue</h2>
              <p className="text-sm text-gray-400 mt-1">Enter your mobile number to get an OTP</p>
            </div>

            <div className="flex gap-2 mb-3">
              <span className="input w-16 shrink-0 bg-gray-50 text-sm font-semibold text-gray-700 flex items-center justify-center">
                +91
              </span>
              <input
                type="tel" inputMode="numeric" placeholder="9876543210"
                value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                onKeyDown={e => e.key === 'Enter' && sendOtp()}
                className="input flex-1 text-base font-medium tracking-wide"
                maxLength={10}
                autoFocus
              />
            </div>

            {error && <p className="text-red-600 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mb-3">{error}</p>}

            <button onClick={() => sendOtp()} disabled={loading}
              className="btn-primary w-full py-3 text-base mt-1 flex items-center justify-center gap-2">
              {loading ? <><span className="spinner w-4 h-4" />Sending OTP…</> : 'Get OTP'}
            </button>

            <p className="text-center text-xs text-gray-400 mt-4">
              New here?{' '}
              <a href="/auth/signup" className="text-navy font-semibold hover:underline">Create account</a>
            </p>

            {import.meta.env.DEV && (
              <div className="mt-5 border-t border-dashed border-gray-200 pt-4">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">🧪 Dev Test Accounts</p>
                <p className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 mb-2">
                  Tap any account — OTP <strong>123456</strong> is pre-filled.
                </p>
                <div className="max-h-44 overflow-y-auto space-y-2 pr-1">
                  {DEV_ACCOUNTS.map(group => (
                    <div key={group.role}>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{group.role}</p>
                      <div className="grid grid-cols-2 gap-1.5 mt-1">
                        {group.accounts.map(a => (
                          <button key={a.phone} type="button" onClick={() => devLogin(a.phone)}
                            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-gray-100 hover:border-navy hover:bg-navy/5 transition-colors text-left">
                            <span className="text-sm shrink-0">{a.icon}</span>
                            <span className="min-w-0">
                              <span className="block text-[11px] font-semibold text-navy truncate">{a.name}</span>
                              <span className="block text-[10px] text-gray-400">+91 {a.phone}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="mb-5">
              <button onClick={() => { setStep('phone'); setOtp(''); setError(''); }}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-navy mb-3 transition-colors">
                ← Back
              </button>
              <h2 className="text-xl font-black text-navy">Enter OTP</h2>
              <p className="text-sm text-gray-400 mt-1">
                Sent to {cc} {phone}
              </p>
            </div>

            <input
              type="tel" inputMode="numeric" placeholder="123456" maxLength={6}
              value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => e.key === 'Enter' && verifyOtp()}
              className="input w-full text-2xl font-black tracking-[0.5em] text-center mb-3"
              autoFocus
            />

            {error && <p className="text-red-600 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mb-3">{error}</p>}

            <button onClick={verifyOtp} disabled={loading}
              className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2">
              {loading ? <><span className="spinner w-4 h-4" />Verifying…</> : 'Verify & Sign In'}
            </button>

            <button onClick={() => { if (resendSecs > 0) return; setStep('phone'); setOtp(''); setError(''); sendOtp(); }}
              disabled={resendSecs > 0}
              className="w-full mt-3 text-sm text-center text-gray-400 hover:text-navy disabled:hover:text-gray-400 disabled:cursor-default transition-colors">
              {resendSecs > 0 ? `Resend OTP in ${resendSecs}s` : 'Resend OTP'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function LoginModal() {
  return (
    <QueryClientProvider client={queryClient}>
      <LoginModalInner />
    </QueryClientProvider>
  );
}

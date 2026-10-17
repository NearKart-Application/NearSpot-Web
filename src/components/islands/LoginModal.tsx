import { useState, useEffect, useCallback } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../../lib/queryClient';

type Step = 'phone' | 'otp';

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

  const sendOtp = useCallback(async () => {
    const digits = phone.trim().replace(/\D/g, '');
    if (digits.length < 6 || digits.length > 13) { setError('Enter a valid phone number'); return; }
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

      // Customer login success — close modal and notify islands to retry their action
      close();
      window.dispatchEvent(new CustomEvent('ns:login-success', { detail: { user: normalizedUser } }));
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
              <select value={cc} onChange={e => setCc(e.target.value)}
                className="input w-24 shrink-0 bg-gray-50 text-sm font-semibold text-gray-700 cursor-pointer">
                {['+91','+1','+44','+61','+971','+966','+65','+60'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                type="tel" inputMode="numeric" placeholder="9876543210"
                value={phone} onChange={e => setPhone(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendOtp()}
                className="input flex-1 text-base font-medium tracking-wide"
                autoFocus
              />
            </div>

            {error && <p className="text-red-600 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mb-3">{error}</p>}

            <button onClick={sendOtp} disabled={loading}
              className="btn-primary w-full py-3 text-base mt-1 flex items-center justify-center gap-2">
              {loading ? <><span className="spinner w-4 h-4" />Sending OTP…</> : 'Get OTP'}
            </button>

            <p className="text-center text-xs text-gray-400 mt-4">
              New here?{' '}
              <a href="/auth/signup" className="text-navy font-semibold hover:underline">Create account</a>
            </p>
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

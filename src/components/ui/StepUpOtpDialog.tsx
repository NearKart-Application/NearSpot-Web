import { useState, useEffect, useRef } from 'react';
import { auth } from '../../lib/auth';
import { Button } from './button';

interface Props {
  action:      string;              // e.g. "add a staff member", "remove staff"
  onVerified:  () => void;          // called when OTP is confirmed
  onCancel:    () => void;
}

export function StepUpOtpDialog({ action, onVerified, onCancel }: Props) {
  const [otp, setOtp]           = useState(['', '', '', '', '', '']);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [sent, setSent]         = useState(false);
  const [sending, setSending]   = useState(false);
  const [countdown, setCountdown] = useState(0);
  const inputRefs               = useRef<(HTMLInputElement | null)[]>([]);

  const user       = auth.user();
  const phone      = (user as any)?.phone_number ?? '';
  // Mask phone: show last 4 digits only
  const maskedPhone = phone ? `+91 ****${phone.slice(-4)}` : 'your registered number';

  // Auto-send OTP on mount
  useEffect(() => { sendOtp(); }, []);

  async function sendOtp() {
    setSending(true);
    setError('');
    try {
      // Re-uses the existing OTP send endpoint
      const res = await fetch('/api/v1/auth/otp/send/', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ phone_number: phone, is_signup: false }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.detail ?? d.message ?? 'Failed to send OTP');
      setSent(true);
      startCountdown();
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      setError(err.message ?? 'Failed to send OTP');
    } finally {
      setSending(false);
    }
  }

  function startCountdown() {
    setCountdown(30);
    const id = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(id); return 0; }
        return c - 1;
      });
    }, 1000);
  }

  function handleInput(idx: number, val: string) {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next  = [...otp];
    next[idx]   = digit;
    setOtp(next);
    if (digit && idx < 5) inputRefs.current[idx + 1]?.focus();
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[idx]) inputRefs.current[idx - 1]?.focus();
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next   = [...otp];
    digits.split('').forEach((d, i) => { next[i] = d; });
    setOtp(next);
    inputRefs.current[Math.min(digits.length, 5)]?.focus();
  }

  async function verify() {
    const code = otp.join('');
    if (code.length !== 6) return;
    setLoading(true);
    setError('');
    try {
      // Backend: POST /auth/step-up/verify/ → { verified: true }
      // This endpoint validates OTP without issuing new tokens.
      const res = await fetch('/api/v1/auth/step-up/verify/', {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('ns_access')}`,
        },
        body: JSON.stringify({ phone_number: phone, otp: code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail ?? data.message ?? 'Invalid OTP — try again');
      onVerified();
    } catch (err: any) {
      setError(err.message ?? 'Verification failed');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  const otpComplete = otp.join('').length === 6;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
         onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-navy/8 flex items-center justify-center text-lg">🔐</div>
            <div>
              <h3 className="font-bold text-navy text-sm">Verify Identity</h3>
              <p className="text-xs text-gray-400">To {action}</p>
            </div>
          </div>
          <button onClick={onCancel}
                  className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-xs hover:bg-gray-200 transition-colors">
            ✕
          </button>
        </div>

        {/* Info */}
        <p className="text-xs text-gray-500 mb-5 bg-gray-50 rounded-xl px-4 py-3 leading-relaxed">
          {sent
            ? <>OTP sent to <strong className="text-navy">{maskedPhone}</strong>. Enter it below to confirm this action.</>
            : sending
              ? 'Sending OTP…'
              : 'Preparing to send OTP…'}
        </p>

        {/* OTP boxes */}
        <div className="flex gap-2 justify-center mb-4" onPaste={handlePaste}>
          {otp.map((d, i) => (
            <input
              key={i}
              ref={el => { inputRefs.current[i] = el; }}
              type="text" inputMode="numeric" maxLength={1}
              value={d}
              onChange={e => handleInput(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              disabled={!sent || loading}
              className="w-11 h-13 text-center text-lg font-bold border-2 border-gray-200 rounded-xl focus:border-navy focus:outline-none transition bg-gray-50 focus:bg-white disabled:opacity-40"
              style={{ height: '52px' }}
            />
          ))}
        </div>

        {error && (
          <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-4">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="space-y-2">
          <Button onClick={verify} disabled={!otpComplete || loading || !sent}
                  className="w-full py-2.5 text-sm font-bold">
            {loading ? 'Verifying…' : 'Confirm'}
          </Button>
          <div className="flex items-center justify-between">
            <button onClick={onCancel}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors py-1">
              Cancel
            </button>
            <button onClick={sendOtp}
                    disabled={countdown > 0 || sending}
                    className="text-xs text-navy font-semibold hover:underline disabled:text-gray-400 disabled:no-underline transition-colors py-1">
              {countdown > 0 ? `Resend in ${countdown}s` : sending ? 'Sending…' : 'Resend OTP'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

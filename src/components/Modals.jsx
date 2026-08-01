import { useState, useEffect } from 'react';
import { X, ShieldCheck, Bookmark, ExternalLink } from 'lucide-react';
import { initials } from '../lib/matching';
import { inputCls, btn3D } from '../lib/styles';
import { Field, GoogleMark, LevelBadge, DomainBadge, FreshBadge, SalaryText } from './atoms';

export function JobDetailModal({ job, saved, onToggleSave, onClose, currentUser, onRequestAuth, dark }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!job) return null;
  const panelBg = dark ? 'bg-slate-900' : 'bg-white';
  const borderCol = dark ? 'border-slate-800' : 'border-slate-100';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div className={`modal-pop-3d w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto shadow-[0_40px_80px_-20px_rgba(0,0,0,0.5)] ${panelBg}`} onClick={(e) => e.stopPropagation()}>
        <div className={`sticky top-0 ${panelBg} border-b px-6 py-4 flex items-start justify-between gap-4 z-10 ${borderCol}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={`h-12 w-12 shrink-0 rounded-xl text-white flex items-center justify-center text-[11px] font-bold font-display ${dark ? 'bg-slate-700' : 'bg-slate-900'}`}>{initials(job.company)}</div>
            <div className="min-w-0">
              <div className={`text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{job.company}</div>
              <h2 className={`font-display font-bold text-lg leading-snug ${dark ? 'text-slate-50' : 'text-slate-900'}`}>{job.role}</h2>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className={`shrink-0 transition-transform active:scale-75 ${dark ? 'text-slate-500 hover:text-slate-200' : 'text-slate-400 hover:text-slate-700'}`}><X size={20} /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="flex flex-wrap gap-1.5">
            <LevelBadge level={job.level} dark={dark} />
            <DomainBadge isIT={job.isIT} dark={dark} />
            <FreshBadge daysAgo={job.daysAgo} dark={dark} />
          </div>

          <div className={`grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm border rounded-xl p-4 ${dark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
            <div><div className={`text-xs mb-0.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Location</div><div className={dark ? 'font-medium text-slate-200' : 'font-medium text-slate-800'}>{job.city}</div></div>
            <div><div className={`text-xs mb-0.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Experience</div><div className={dark ? 'font-medium text-slate-200' : 'font-medium text-slate-800'}>{job.experience}</div></div>
            <div><div className={`text-xs mb-0.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Indicative CTC</div><div className={dark ? 'font-medium text-slate-200' : 'font-medium text-slate-800'}><SalaryText job={job} dark={dark} /></div></div>
            <div><div className={`text-xs mb-0.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Employment type</div><div className={dark ? 'font-medium text-slate-200' : 'font-medium text-slate-800'}>{job.employmentType}</div></div>
          </div>

          <div>
            <h3 className={`text-sm font-semibold mb-2 ${dark ? 'text-slate-100' : 'text-slate-900'}`}>What you'll do</h3>
            <ul className="space-y-2">
              {job.description.map((line, i) => {
                const idx = line.indexOf(':');
                const label = idx > -1 && idx < 40 ? line.slice(0, idx) : '';
                const rest = label ? line.slice(idx + 1) : line;
                return (
                  <li key={i} className={`text-sm leading-relaxed flex gap-2 ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
                    <span className={dark ? 'text-emerald-400 mt-1' : 'text-emerald-600 mt-1'}>•</span>
                    <span>{label && <strong className={dark ? 'text-slate-200' : 'text-slate-800'}>{label}:</strong>}{rest}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <h3 className={`text-sm font-semibold mb-1 ${dark ? 'text-slate-100' : 'text-slate-900'}`}>Skills & tools you should know</h3>
            <p className={`text-xs mb-2 ${dark ? 'text-slate-500' : 'text-slate-500'}`}>This role expects hands-on familiarity with:</p>
            <div className="flex flex-wrap gap-1.5">
              {job.skills.length ? job.skills.map((s) => <span key={s} className={`text-xs font-medium px-2.5 py-1 rounded-full border ${dark ? 'bg-indigo-500/10 text-indigo-400 border-indigo-800' : 'bg-indigo-50 text-indigo-700 border-indigo-100'}`}>{s}</span>) : <span className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Not specified — see the official listing.</span>}
            </div>
          </div>

          <p className={`text-xs border-t pt-4 ${dark ? 'text-slate-500 border-slate-800' : 'text-slate-400 border-slate-100'}`}>{job.salary ? `Indicative pay band — confirm the exact figure on ${job.company}'s official listing before you accept anything.` : `${job.company} hasn't disclosed a salary figure for this role — ask about it during the process.`}</p>
        </div>

        <div className={`sticky bottom-0 ${panelBg} border-t px-6 py-4 flex items-center gap-3 ${borderCol}`}>
          <button onClick={onToggleSave} className={`h-11 px-4 rounded-xl border font-medium text-sm flex items-center gap-2 shrink-0 transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ${saved ? (dark ? 'border-emerald-700 text-emerald-400 bg-emerald-500/10' : 'border-emerald-300 text-emerald-700 bg-emerald-50') : (dark ? 'border-slate-700 text-slate-400 hover:border-slate-600' : 'border-slate-200 text-slate-600 hover:border-slate-300')}`}>
            <Bookmark size={16} fill={saved ? 'currentColor' : 'none'} /> <span className="hidden sm:inline">{saved ? 'Saved' : 'Save role'}</span>
          </button>
          {currentUser ? (
            <a href={job.link} target="_blank" rel="noopener noreferrer" className={`flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 ${btn3D(dark)}`}>
              Apply on {job.company}'s official site <ExternalLink size={15} />
            </a>
          ) : (
            <button onClick={onRequestAuth} className={`flex-1 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm ${btn3D(dark, 'indigo')}`}>
              Log in or sign up to apply
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function AuthModal({ open, onClose, onSendOtp, onVerifyOtp, onGoogle, error, onOpenTC, dark }) {
  const [step, setStep] = useState('email');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!open) {
      setStep('email');
      setName('');
      setEmail('');
      setCode('');
      setBusy(false);
      setCooldown(0);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  if (!open) return null;
  const panelBg = dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';

  const submitEmail = async (e) => {
    e.preventDefault();
    setBusy(true);
    const res = await onSendOtp(name, email);
    setBusy(false);
    if (!res.ok) return;
    setStep('otp');
    setCooldown(30);
  };

  const resend = async () => {
    if (cooldown > 0 || busy) return;
    setBusy(true);
    const res = await onSendOtp(name, email);
    setBusy(false);
    if (res.ok) setCooldown(30);
  };

  const submitOtp = async (e) => {
    e.preventDefault();
    setBusy(true);
    await onVerifyOtp(email, code);
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div className={`modal-pop-3d w-full max-w-md border rounded-2xl shadow-[0_40px_80px_-20px_rgba(0,0,0,0.5)] p-6 max-h-[90vh] overflow-y-auto ${panelBg}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className={`font-display text-xl font-bold ${dark ? 'text-slate-50' : 'text-slate-900'}`}>{step === 'email' ? 'Log in or sign up' : 'Enter the code'}</h2>
          <button onClick={onClose} aria-label="Close" className={`transition-transform active:scale-75 ${dark ? 'text-slate-500 hover:text-slate-200' : 'text-slate-400 hover:text-slate-700'}`}><X size={20} /></button>
        </div>

        {step === 'email' ? (
          <>
            <p className={`text-sm mb-5 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Free to join — you'll need an account to apply to any role.</p>

            {error && <div className={`mb-4 text-sm rounded-lg px-3 py-2 border ${dark ? 'text-red-300 bg-red-500/10 border-red-900' : 'text-red-700 bg-red-50 border-red-200'}`}>{error}</div>}

            <button
              type="button"
              onClick={onGoogle}
              className={`w-full h-11 rounded-lg border font-semibold text-sm flex items-center justify-center gap-2 mb-4 transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] ${dark ? 'border-slate-700 text-slate-200 hover:border-slate-600' : 'border-slate-300 text-slate-700 hover:border-slate-400'}`}
            >
              <GoogleMark /> Continue with Google
            </button>
            <div className={`flex items-center gap-3 mb-4 text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
              <div className={`flex-1 h-px ${dark ? 'bg-slate-800' : 'bg-slate-200'}`} />
              <span>or use your email</span>
              <div className={`flex-1 h-px ${dark ? 'bg-slate-800' : 'bg-slate-200'}`} />
            </div>

            <form className="space-y-3" onSubmit={submitEmail}>
              <Field label="Full name (optional)" dark={dark}><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls(dark)} placeholder="Priya Sharma" /></Field>
              <Field label="Email" dark={dark}><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls(dark)} placeholder="priya@example.com" /></Field>
              <p className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                We'll email you a one-time code — no password needed. By continuing you agree to the{' '}
                <button type="button" onClick={onOpenTC} className={dark ? 'text-emerald-400 underline underline-offset-2' : 'text-emerald-700 underline underline-offset-2'}>Terms & Conditions</button>, including storage of your email.
              </p>
              <button type="submit" disabled={busy} className={`w-full h-11 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 mt-2 disabled:opacity-60 disabled:translate-y-0 disabled:shadow-none ${btn3D(dark)}`}>{busy ? 'Sending code…' : 'Send verification code'}</button>
            </form>
          </>
        ) : (
          <>
            <p className={`text-sm mb-4 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>We sent a code to <strong className={dark ? 'text-slate-200' : 'text-slate-800'}>{email}</strong>.</p>
            {error && <div className={`mb-4 text-sm rounded-lg px-3 py-2 border ${dark ? 'text-red-300 bg-red-500/10 border-red-900' : 'text-red-700 bg-red-50 border-red-200'}`}>{error}</div>}
            <form className="space-y-3" onSubmit={submitOtp}>
              <Field label="Verification code" dark={dark}>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className={inputCls(dark) + ' tracking-[0.4em] text-center text-lg font-semibold'}
                  placeholder="••••••"
                  maxLength={8}
                />
              </Field>
              <button type="submit" disabled={busy} className={`w-full h-11 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60 disabled:translate-y-0 disabled:shadow-none ${btn3D(dark)}`}>{busy ? 'Verifying…' : 'Verify & continue'}</button>
              <div className="flex items-center justify-between text-xs pt-1">
                <button type="button" onClick={() => setStep('email')} className={dark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}>Change email</button>
                <button type="button" onClick={resend} disabled={cooldown > 0 || busy} className={`disabled:opacity-50 ${dark ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-700 hover:text-emerald-800'}`}>{cooldown > 0 ? `Resend code (${cooldown}s)` : 'Resend code'}</button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}


export function PhoneGateModal({ open, name, phoneDraft, setPhoneDraft, phoneError, phoneBusy, onSubmit, dark }) {
  // Intentionally has NO close button, no backdrop-click-to-close, and no
  // Escape handler — adding a phone number is mandatory before the rest of
  // the site is usable, per product requirement #7.
  if (!open) return null;
  const panelBg = dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
      <div className={`modal-pop-3d w-full max-w-md border rounded-2xl shadow-[0_40px_80px_-20px_rgba(0,0,0,0.5)] p-6 ${panelBg}`}>
        <h2 className={`font-display text-xl font-bold mb-1 ${dark ? 'text-slate-50' : 'text-slate-900'}`}>One last thing{name ? `, ${name.split(' ')[0]}` : ''}</h2>
        <p className={`text-sm mb-5 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Add your mobile number so employers and CareerBanyan can reach you about roles. This is required once, and takes a second.</p>
        <form className="space-y-3" onSubmit={onSubmit}>
          <Field label="Mobile number" dark={dark}>
            <input
              type="tel"
              inputMode="numeric"
              autoFocus
              value={phoneDraft}
              onChange={(e) => setPhoneDraft(e.target.value.replace(/[^\d+\s-]/g, ''))}
              placeholder="98765 43210"
              className={inputCls(dark)}
            />
          </Field>
          {phoneError && <div className={`text-sm rounded-lg px-3 py-2 border ${dark ? 'text-red-300 bg-red-500/10 border-red-900' : 'text-red-700 bg-red-50 border-red-200'}`}>{phoneError}</div>}
          <button type="submit" disabled={phoneBusy} className={`w-full h-11 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60 disabled:translate-y-0 disabled:shadow-none ${btn3D(dark)}`}>
            {phoneBusy ? 'Saving…' : 'Continue'}
          </button>
          <p className={`text-xs text-center ${dark ? 'text-slate-500' : 'text-slate-400'}`}>We'll never share your number without your consent.</p>
        </form>
      </div>
    </div>
  );
}


export function TCModal({ onClose, dark }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const panelBg = dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
  const strong = dark ? 'text-slate-100' : 'text-slate-900';
  const body = dark ? 'text-slate-400' : 'text-slate-600';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div className={`modal-pop-3d w-full max-w-lg border rounded-2xl shadow-[0_40px_80px_-20px_rgba(0,0,0,0.5)] p-6 max-h-[85vh] overflow-y-auto ${panelBg}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className={`font-display text-xl font-bold flex items-center gap-2 ${strong}`}><ShieldCheck size={20} className="text-emerald-600" /> Terms & Conditions</h2>
          <button onClick={onClose} className={`transition-transform active:scale-75 ${dark ? 'text-slate-500 hover:text-slate-200' : 'text-slate-400 hover:text-slate-700'}`} aria-label="Close"><X size={20} /></button>
        </div>
        <div className={`space-y-4 text-sm leading-relaxed ${body}`}>
          <p><strong className={strong}>Your data.</strong> When you create an account, your email address is stored so we can manage your login, personalize job recommendations against your saved skills, and send you relevant job alerts and application updates.</p>
          <p><strong className={strong}>Applying requires an account.</strong> "Apply" links to an employer's official site only unlock once you're signed in — this keeps your saved roles and applications together in one place.</p>
          <p><strong className={strong}>No fee, ever.</strong> This board never charges job seekers to browse, save, or apply to a listing. Treat any recruiter who asks you for money as fraudulent.</p>
          <p><strong className={strong}>Where "Apply" goes.</strong> Every listing links out to the employer's own official careers page. Applications, interviews and offers happen on that employer's site — we don't collect or see your application.</p>
          <p><strong className={strong}>Missing salary.</strong> Some employers don't disclose pay upfront. We show those roles anyway, labelled "Not disclosed," instead of hiding them.</p>
          <p><strong className={strong}>Your control.</strong> You can update your saved skills any time from Profile. To delete your account and stored data, use the "Delete my account & data" button on the Profile page — this deletes your account immediately and cannot be undone.</p>
          <p><strong className={strong}>Job data.</strong> Listings are pulled from public job-search data sources and refreshed daily. We link to each employer's own site for the actual application — we don't run the hiring process ourselves.</p>
        </div>
      </div>
    </div>
  );
}


export function ConfirmModal({ open, title, body, confirmLabel, onConfirm, onCancel, dark, busy, danger = true }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;
  const panelBg = dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onCancel}>
      <div className={`modal-pop-3d w-full max-w-sm border rounded-2xl shadow-[0_40px_80px_-20px_rgba(0,0,0,0.5)] p-6 ${panelBg}`} onClick={(e) => e.stopPropagation()}>
        <h2 className={`font-display text-lg font-bold mb-2 ${dark ? 'text-slate-100' : 'text-slate-900'}`}>{title}</h2>
        <p className={`text-sm mb-6 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{body}</p>
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            disabled={busy}
            className={`flex-1 h-10 rounded-lg border text-sm font-medium transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 disabled:opacity-60 ${dark ? 'border-slate-700 text-slate-300 hover:border-slate-600' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`flex-1 h-10 rounded-lg text-white text-sm font-semibold disabled:opacity-60 ${danger ? `bg-red-600 hover:bg-red-700 ${btn3D(dark, 'red')}` : `bg-emerald-600 hover:bg-emerald-700 ${btn3D(dark)}`}`}
          >
            {busy ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}


export function JobNotFoundModal({ onClose, dark }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const panelBg = dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div className={`modal-pop-3d w-full max-w-md border rounded-2xl shadow-[0_40px_80px_-20px_rgba(0,0,0,0.5)] p-6 text-center ${panelBg}`} onClick={(e) => e.stopPropagation()}>
        <h2 className={`font-display text-lg font-bold mb-2 ${dark ? 'text-slate-100' : 'text-slate-900'}`}>This role isn't available anymore</h2>
        <p className={`text-sm mb-5 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>It may have been filled or removed by the employer.</p>
        <button onClick={onClose} className={`h-10 px-5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 ${btn3D(dark)}`}>Browse other roles</button>
      </div>
    </div>
  );
}

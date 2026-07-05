import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Search, MapPin, Bookmark, LogOut, X, Menu, ExternalLink, Sparkles, ShieldCheck, Leaf, Sun, Moon, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from './supabaseClient';

function initials(name) {
  const clean = (name || '').replace(/\(.*?\)/g, '').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '??';
  if (words.length === 1) return words[0].slice(0, 4).toUpperCase();
  return words.map((w) => w[0]).join('').slice(0, 4).toUpperCase();
}

function matchScore(job, tokens) {
  let score = 0;
  const role = job.role.toLowerCase();
  const category = (job.category || '').toLowerCase();
  const skillsLower = (job.skills || []).map((s) => s.toLowerCase());
  tokens.forEach((t) => {
    if (skillsLower.some((s) => s.includes(t) || t.includes(s))) score += 2;
    if (role.includes(t)) score += 3;
    if (category.includes(t)) score += 1;
  });
  return score;
}

const inputCls = (dark) => `w-full h-10 px-3 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${dark ? 'bg-slate-900 border-slate-700 text-slate-50 placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'}`;
const selectCls = (dark) => `h-11 px-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 md:w-48 ${dark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-700'}`;

/* ---------------------------- small presentational bits ---------------------------- */

function NavBtn({ active, onClick, children, dark }) {
  const cls = active ? (dark ? 'text-emerald-400 bg-emerald-500/10' : 'text-emerald-700 bg-emerald-50') : (dark ? 'text-slate-400 hover:text-slate-100' : 'text-slate-500 hover:text-slate-800');
  return <button onClick={onClick} className={`px-3 py-2 rounded-lg text-sm font-medium transition ${cls}`}>{children}</button>;
}

function StatTile({ value, label, dark }) {
  return (
    <div className={`rounded-xl border px-4 py-3 shadow-sm min-w-[110px] ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
      <div className={`font-display text-2xl sm:text-3xl font-extrabold leading-none ${dark ? 'text-emerald-400' : 'text-emerald-700'}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-slate-500 mt-1">{label}</div>
    </div>
  );
}

function LevelBadge({ level, dark }) {
  const map = dark
    ? { fresher: 'text-emerald-400 border-emerald-800 bg-emerald-500/10', experienced: 'text-indigo-400 border-indigo-800 bg-indigo-500/10', both: 'text-slate-400 border-slate-700 bg-slate-800' }
    : { fresher: 'text-emerald-700 border-emerald-200 bg-emerald-50', experienced: 'text-indigo-700 border-indigo-200 bg-indigo-50', both: 'text-slate-600 border-slate-300 bg-slate-100' };
  const label = level === 'fresher' ? 'Fresher friendly' : level === 'experienced' ? 'Experienced' : 'All levels';
  return <span className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-1 rounded-full border whitespace-nowrap ${map[level] || map.both}`}>{label}</span>;
}

function DomainBadge({ isIT, dark }) {
  const cls = isIT
    ? (dark ? 'border-blue-800 bg-blue-500/10 text-blue-400' : 'border-blue-200 bg-blue-50 text-blue-700')
    : (dark ? 'border-slate-700 bg-slate-800 text-slate-400' : 'border-slate-300 bg-slate-100 text-slate-600');
  return <span className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-1 rounded-full border whitespace-nowrap ${cls}`}>{isIT ? 'IT' : 'Non-IT'}</span>;
}

function FreshBadge({ daysAgo, dark }) {
  const label = daysAgo === 0 ? 'New today' : daysAgo === 1 ? '1 day ago' : `${daysAgo} days ago`;
  const hot = daysAgo <= 1;
  const cls = hot
    ? (dark ? 'text-amber-400 border-amber-800 bg-amber-500/10' : 'text-amber-700 border-amber-200 bg-amber-50')
    : (dark ? 'text-slate-500 border-slate-700 bg-slate-800/50' : 'text-slate-500 border-slate-200 bg-slate-50');
  return <span className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-1 rounded-full border whitespace-nowrap ${cls}`}>{label}</span>;
}

function Field({ label, children, dark }) {
  return (
    <label className="block">
      <span className={`block text-xs mb-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</span>
      {children}
    </label>
  );
}

function SalaryText({ job, dark, emphasis }) {
  if (job.salary) return <span className={emphasis ? (dark ? 'font-medium text-slate-200' : 'font-medium text-slate-700') : ''}>{job.salary}</span>;
  return <span className={`italic ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Not disclosed by employer</span>;
}

function JobCard({ job, saved, onToggleSave, onOpen, currentUser, onRequestAuth, highlight, dark }) {
  const cardCls = dark
    ? (highlight ? 'border-emerald-800 bg-emerald-500/5' : 'border-slate-800 bg-slate-900 hover:border-slate-700')
    : (highlight ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 bg-white hover:border-slate-300');

  return (
    <div onClick={onOpen} className={`h-full cursor-pointer rounded-2xl border p-5 shadow-sm hover:shadow-md transition flex flex-col gap-3 fade-in ${cardCls}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`h-11 w-11 shrink-0 rounded-xl text-white flex items-center justify-center text-[11px] font-bold font-display ${dark ? 'bg-slate-700' : 'bg-slate-900'}`}>{initials(job.company)}</div>
          <div className="min-w-0">
            <div className={`text-xs truncate ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{job.company}</div>
            <h3 className={`font-display font-bold leading-snug line-clamp-2 ${dark ? 'text-slate-50' : 'text-slate-900'}`}>{job.role}</h3>
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSave(); }}
          aria-label={saved ? 'Remove from saved roles' : 'Save this role'}
          className={`h-9 w-9 shrink-0 flex items-center justify-center rounded-lg border transition ${saved ? (dark ? 'border-emerald-700 text-emerald-400 bg-emerald-500/10' : 'border-emerald-300 text-emerald-600 bg-emerald-50') : (dark ? 'border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-600' : 'border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300')}`}
        >
          <Bookmark size={16} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <LevelBadge level={job.level} dark={dark} />
        <DomainBadge isIT={job.isIT} dark={dark} />
        <FreshBadge daysAgo={job.daysAgo} dark={dark} />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        <span className="flex items-center gap-1"><MapPin size={12} />{job.city}</span>
        <span>{job.experience}</span>
        <SalaryText job={job} dark={dark} emphasis />
      </div>

      <p className={`text-sm line-clamp-2 ${dark ? 'text-slate-400' : 'text-slate-600'}`}>{job.description[0]}</p>

      <div className="flex flex-wrap gap-1.5">
        {job.skills.slice(0, 4).map((s) => <span key={s} className={`text-[11px] px-2 py-1 rounded-full border ${dark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{s}</span>)}
        {job.skills.length > 4 && <span className={`text-[11px] px-2 py-1 rounded-full ${dark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-500'}`}>+{job.skills.length - 4} more</span>}
      </div>

      <div className={`pt-2 mt-auto border-t flex items-center justify-between ${dark ? 'border-slate-800' : 'border-slate-100'}`}>
        <span className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Tap for full description</span>
        {currentUser ? (
          <a href={job.link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className={`text-sm font-semibold flex items-center gap-1 ${dark ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-700 hover:text-emerald-800'}`}>
            Apply <ExternalLink size={13} />
          </a>
        ) : (
          <button onClick={(e) => { e.stopPropagation(); onRequestAuth(); }} className={`text-sm font-semibold ${dark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-700 hover:text-indigo-800'}`}>
            Log in to apply
          </button>
        )}
      </div>
    </div>
  );
}

function Carousel({ items, renderItem, dark }) {
  const scrollerRef = useRef(null);
  const scrollBy = (dir) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(340, el.clientWidth * 0.85), behavior: 'smooth' });
  };
  const arrowCls = dark ? 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50';
  return (
    <div className="relative">
      <div ref={scrollerRef} className="no-scrollbar flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth">
        {items.map((item, i) => (
          <div key={i} className="snap-start shrink-0 w-[260px] sm:w-[300px]">
            {renderItem(item)}
          </div>
        ))}
      </div>
      <button onClick={() => scrollBy(-1)} aria-label="Scroll left" className={`hidden sm:flex absolute -left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full items-center justify-center border shadow-sm ${arrowCls}`}>
        <ChevronLeft size={16} />
      </button>
      <button onClick={() => scrollBy(1)} aria-label="Scroll right" className={`hidden sm:flex absolute -right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full items-center justify-center border shadow-sm ${arrowCls}`}>
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

function JobDetailModal({ job, saved, onToggleSave, onClose, currentUser, onRequestAuth, dark }) {
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
      <div className={`w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto ${panelBg}`} onClick={(e) => e.stopPropagation()}>
        <div className={`sticky top-0 ${panelBg} border-b px-6 py-4 flex items-start justify-between gap-4 z-10 ${borderCol}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={`h-12 w-12 shrink-0 rounded-xl text-white flex items-center justify-center text-[11px] font-bold font-display ${dark ? 'bg-slate-700' : 'bg-slate-900'}`}>{initials(job.company)}</div>
            <div className="min-w-0">
              <div className={`text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{job.company}</div>
              <h2 className={`font-display font-bold text-lg leading-snug ${dark ? 'text-slate-50' : 'text-slate-900'}`}>{job.role}</h2>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className={`shrink-0 ${dark ? 'text-slate-500 hover:text-slate-200' : 'text-slate-400 hover:text-slate-700'}`}><X size={20} /></button>
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
          <button onClick={onToggleSave} className={`h-11 px-4 rounded-xl border font-medium text-sm flex items-center gap-2 shrink-0 ${saved ? (dark ? 'border-emerald-700 text-emerald-400 bg-emerald-500/10' : 'border-emerald-300 text-emerald-700 bg-emerald-50') : (dark ? 'border-slate-700 text-slate-400 hover:border-slate-600' : 'border-slate-200 text-slate-600 hover:border-slate-300')}`}>
            <Bookmark size={16} fill={saved ? 'currentColor' : 'none'} /> <span className="hidden sm:inline">{saved ? 'Saved' : 'Save role'}</span>
          </button>
          {currentUser ? (
            <a href={job.link} target="_blank" rel="noopener noreferrer" className="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2">
              Apply on {job.company}'s official site <ExternalLink size={15} />
            </a>
          ) : (
            <button onClick={onRequestAuth} className="flex-1 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm">
              Log in or sign up to apply
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AuthModal({ mode, onClose, onSwitch, onSignup, onLogin, error, onOpenTC, dark }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', password: '', confirm: '', agree: false });
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm({ name: '', email: '', phone: '', address: '', password: '', confirm: '', agree: false });
    setLoginForm({ email: '', password: '' });
    setBusy(false);
  }, [mode]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!mode) return null;
  const isSignup = mode === 'signup';
  const panelBg = dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';

  const submitSignup = async (e) => { e.preventDefault(); setBusy(true); await onSignup(form); setBusy(false); };
  const submitLogin = async (e) => { e.preventDefault(); setBusy(true); await onLogin(loginForm); setBusy(false); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div className={`w-full max-w-md border rounded-2xl shadow-xl p-6 max-h-[90vh] overflow-y-auto ${panelBg}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className={`font-display text-xl font-bold ${dark ? 'text-slate-50' : 'text-slate-900'}`}>{isSignup ? 'Create your account' : 'Log in'}</h2>
          <button onClick={onClose} aria-label="Close" className={dark ? 'text-slate-500 hover:text-slate-200' : 'text-slate-400 hover:text-slate-700'}><X size={20} /></button>
        </div>
        <p className={`text-sm mb-5 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{isSignup ? "Free to join — you'll need an account to apply to any role." : 'Welcome back — pick up your saved roles and matches.'}</p>

        {error && <div className={`mb-4 text-sm rounded-lg px-3 py-2 border ${dark ? 'text-red-300 bg-red-500/10 border-red-900' : 'text-red-700 bg-red-50 border-red-200'}`}>{error}</div>}

        {isSignup ? (
          <form className="space-y-3" onSubmit={submitSignup}>
            <Field label="Full name" dark={dark}><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls(dark)} placeholder="Priya Sharma" /></Field>
            <Field label="Email" dark={dark}><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls(dark)} placeholder="priya@example.com" /></Field>
            <Field label="Mobile number" dark={dark}><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls(dark)} placeholder="98765 43210" /></Field>
            <Field label="Address" dark={dark}><textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputCls(dark) + ' resize-none'} rows={2} placeholder="City, State" /></Field>
            <Field label="Password" dark={dark}><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputCls(dark)} placeholder="At least 6 characters" /></Field>
            <Field label="Confirm password" dark={dark}><input type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} className={inputCls(dark)} placeholder="Re-enter password" /></Field>
            <label className={`flex items-start gap-2 text-xs pt-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
              <input type="checkbox" checked={form.agree} onChange={(e) => setForm({ ...form, agree: e.target.checked })} className="mt-0.5" />
              <span>I agree to the <button type="button" onClick={onOpenTC} className={dark ? 'text-emerald-400 underline underline-offset-2' : 'text-emerald-700 underline underline-offset-2'}>Terms & Conditions</button>, including storage of my email, phone number and address.</span>
            </label>
            <button type="submit" disabled={busy} className="w-full h-11 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition mt-2 disabled:opacity-60">{busy ? 'Creating account…' : 'Create account'}</button>
          </form>
        ) : (
          <form className="space-y-3" onSubmit={submitLogin}>
            <Field label="Email" dark={dark}><input type="email" value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} className={inputCls(dark)} placeholder="priya@example.com" /></Field>
            <Field label="Password" dark={dark}><input type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} className={inputCls(dark)} placeholder="Your password" /></Field>
            <button type="submit" disabled={busy} className="w-full h-11 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition mt-2 disabled:opacity-60">{busy ? 'Logging in…' : 'Log in'}</button>
          </form>
        )}

        <p className={`text-sm mt-4 text-center ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
          {isSignup ? 'Already have an account? ' : 'New here? '}
          <button onClick={onSwitch} className={`font-medium hover:underline ${dark ? 'text-emerald-400' : 'text-emerald-700'}`}>{isSignup ? 'Log in' : 'Create one free'}</button>
        </p>
      </div>
    </div>
  );
}

function TCModal({ onClose, dark }) {
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
      <div className={`w-full max-w-lg border rounded-2xl shadow-xl p-6 max-h-[85vh] overflow-y-auto ${panelBg}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className={`font-display text-xl font-bold flex items-center gap-2 ${strong}`}><ShieldCheck size={20} className="text-emerald-600" /> Terms & Conditions</h2>
          <button onClick={onClose} className={dark ? 'text-slate-500 hover:text-slate-200' : 'text-slate-400 hover:text-slate-700'} aria-label="Close"><X size={20} /></button>
        </div>
        <div className={`space-y-4 text-sm leading-relaxed ${body}`}>
          <p><strong className={strong}>Your data.</strong> When you create an account, your email address, mobile number and address are stored so we can manage your login, personalize job recommendations against your saved skills, and send you relevant job alerts and application updates.</p>
          <p><strong className={strong}>Applying requires an account.</strong> "Apply" links to an employer's official site only unlock once you're signed in — this keeps your saved roles and applications together in one place.</p>
          <p><strong className={strong}>No fee, ever.</strong> This board never charges job seekers to browse, save, or apply to a listing. Treat any recruiter who asks you for money as fraudulent.</p>
          <p><strong className={strong}>Where "Apply" goes.</strong> Every listing links out to the employer's own official careers page. Applications, interviews and offers happen on that employer's site — we don't collect or see your application.</p>
          <p><strong className={strong}>Missing salary.</strong> Some employers don't disclose pay upfront. We show those roles anyway, labelled "Not disclosed," instead of hiding them.</p>
          <p><strong className={strong}>Your control.</strong> You can update your saved skills any time from Profile. To delete your account and stored data, use the request on the Profile page — we process deletion requests manually and will confirm by email.</p>
          <p><strong className={strong}>Job data.</strong> Listings are pulled from public job-search data sources and refreshed daily. We link to each employer's own site for the actual application — we don't run the hiring process ourselves.</p>
        </div>
      </div>
    </div>
  );
}

function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-xl fade-in">
      {message}
    </div>
  );
}

/* ---------------------------------- main app ---------------------------------- */

export default function App() {
  const [authLoaded, setAuthLoaded] = useState(false);
  const [session, setSession] = useState(null);

  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);

  const [page, setPage] = useState('home');
  const [authModal, setAuthModal] = useState(null);
  const [authError, setAuthError] = useState('');
  const [showTC, setShowTC] = useState(false);
  const [showBanner, setShowBanner] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState(null);
  const [openJobId, setOpenJobId] = useState(null);
  const [skillsDraft, setSkillsDraft] = useState('');
  const [draftFilters, setDraftFilters] = useState({ level: 'all', domain: 'all', q: '', loc: 'All Locations', cat: 'All Categories' });
  const [filters, setFilters] = useState({ level: 'all', domain: 'all', q: '', loc: 'All Locations', cat: 'All Categories' });
  const applyFilters = () => setFilters(draftFilters);
  const clearFilters = () => {
    const reset = { level: 'all', domain: 'all', q: '', loc: 'All Locations', cat: 'All Categories' };
    setDraftFilters(reset);
    setFilters(reset);
  };
  const toastTimer = useRef(null);

  const [theme, setThemeState] = useState(() => {
    try { return localStorage.getItem('cb-theme') || 'light'; } catch (e) { return 'light'; }
  });
  const dark = theme === 'dark';
  const toggleTheme = () => {
    const next = dark ? 'light' : 'dark';
    setThemeState(next);
    try { localStorage.setItem('cb-theme', next); } catch (e) { /* ignore */ }
  };

  // --- auth session ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoaded(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // --- live jobs from Supabase ---
  useEffect(() => {
    supabase
      .from('jobs')
      .select('*')
      .eq('is_active', true)
      .order('posted_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) { console.error('Failed to load jobs:', error.message); setJobsLoading(false); return; }
        const mapped = (data || []).map((d) => ({
          id: d.id,
          company: d.company,
          role: d.role,
          level: d.level,
          isIT: d.is_it,
          city: d.city,
          category: d.category,
          experience: d.experience || 'See official listing',
          salary: d.salary,
          employmentType: d.employment_type || 'Full-time',
          skills: d.skills || [],
          description: d.description && d.description.length ? d.description : ['See the official listing for full details.'],
          daysAgo: Math.max(0, Math.floor((Date.now() - new Date(d.posted_at).getTime()) / 86400000)),
          link: d.link,
        }));
        setJobs(mapped);
        setJobsLoading(false);
      });
  }, []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const currentUser = useMemo(() => {
    if (!session) return null;
    const meta = session.user.user_metadata || {};
    return {
      id: session.user.id,
      email: session.user.email,
      name: meta.name || session.user.email.split('@')[0],
      phone: meta.phone || '',
      address: meta.address || '',
      skills: meta.skills || '',
      savedJobIds: meta.saved_job_ids || [],
    };
  }, [session]);

  useEffect(() => {
    if (!currentUser && (page === 'saved' || page === 'profile')) setPage('home');
  }, [currentUser, page]);

  useEffect(() => {
    setSkillsDraft(currentUser ? currentUser.skills : '');
  }, [currentUser && currentUser.id]);

  const requestAuth = () => { setAuthError(''); setAuthModal('signup'); };

  const goHome = () => {
    setPage('home');
    clearFilters();
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSignup = async (form) => {
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    const phone = form.phone.trim();
    const address = form.address.trim();
    const { password, confirm, agree } = form;

    if (!name || !email || !phone || !address || !password) return setAuthError('Please fill in every field.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setAuthError('Enter a valid email address.');
    if (!/^(\+91[-\s]?)?[6-9]\d{9}$/.test(phone.replace(/\s+/g, ''))) return setAuthError('Enter a valid 10-digit Indian mobile number.');
    if (password.length < 6) return setAuthError('Password should be at least 6 characters.');
    if (password !== confirm) return setAuthError("Passwords don't match.");
    if (!agree) return setAuthError('Please accept the Terms & Conditions to continue.');

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, phone, address, skills: '', saved_job_ids: [] } },
    });
    if (error) return setAuthError(error.message);

    setAuthError('');
    setAuthModal(null);
    showToast(`Welcome, ${name.split(' ')[0]}! Your account is ready.`);
  };

  const handleLogin = async (form) => {
    const email = form.email.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithPassword({ email, password: form.password });
    if (error) return setAuthError('We could not log you in — check your email and password.');
    setAuthError('');
    setAuthModal(null);
    showToast('Welcome back!');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setPage('home');
    showToast('Logged out.');
  };

  const toggleSave = async (jobId) => {
    if (!currentUser) { requestAuth(); showToast('Create a free account to save roles.'); return; }
    const has = currentUser.savedJobIds.includes(jobId);
    const nextSaved = has ? currentUser.savedJobIds.filter((id) => id !== jobId) : [...currentUser.savedJobIds, jobId];
    const { data, error } = await supabase.auth.updateUser({ data: { ...session.user.user_metadata, saved_job_ids: nextSaved } });
    if (error) { console.error('toggleSave failed:', error.message); showToast('Could not save — try again.'); return; }
    setSession((prev) => (prev ? { ...prev, user: data.user } : prev));
    showToast(has ? 'Removed from saved roles.' : 'Saved to your list.');
  };

  const updateSkills = async (text) => {
    if (!currentUser) return;
    const { data, error } = await supabase.auth.updateUser({ data: { ...session.user.user_metadata, skills: text } });
    if (error) { console.error('updateSkills failed:', error.message); showToast('Could not update — try again.'); return; }
    setSession((prev) => (prev ? { ...prev, user: data.user } : prev));
    showToast('Preferences updated — recommendations refreshed.');
  };

  const deleteAccount = async () => {
    if (!session) return;
    try {
      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error('deleteAccount failed:', json.error || res.status);
        showToast(json.error || 'Could not delete your account — try again.');
        return;
      }
      await supabase.auth.signOut();
      setPage('home');
      showToast('Your account and data have been deleted.');
    } catch (err) {
      console.error('deleteAccount failed:', err);
      showToast('Could not reach the server — try again in a moment.');
    }
  };

  const LOCATIONS = useMemo(() => Array.from(new Set(jobs.map((j) => j.city))).sort(), [jobs]);
  const CATEGORIES = useMemo(() => Array.from(new Set(jobs.map((j) => j.category))).sort(), [jobs]);
  const COMPANIES = useMemo(() => Array.from(new Set(jobs.map((j) => j.company))), [jobs]);

  const filteredJobs = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return jobs.filter((job) => {
      if (filters.level !== 'all' && job.level !== filters.level && job.level !== 'both') return false;
      if (filters.domain === 'it' && !job.isIT) return false;
      if (filters.domain === 'nonit' && job.isIT) return false;
      if (filters.loc !== 'All Locations' && job.city !== filters.loc) return false;
      if (filters.cat !== 'All Categories' && job.category !== filters.cat) return false;
      if (q) {
        const tokens = q.split(/[\s,]+/).filter(Boolean);
        const hay = `${job.company} ${job.role} ${job.category} ${job.city} ${job.skills.join(' ')}`.toLowerCase();
        const matchesAll = tokens.every((t) => hay.includes(t));
        if (!matchesAll) return false;
      }
      return true;
    }).sort((a, b) => a.daysAgo - b.daysAgo);
  }, [filters, jobs]);

  const recommended = useMemo(() => {
    if (!currentUser || !currentUser.skills || !currentUser.skills.trim()) return [];
    const tokens = currentUser.skills.toLowerCase().split(/[,\n]/).map((s) => s.trim()).filter((s) => s.length > 1);
    if (!tokens.length) return [];
    const scored = jobs.map((job) => ({ job, score: matchScore(job, tokens) })).filter((x) => x.score > 0);
    scored.sort((a, b) => b.score - a.score || a.job.daysAgo - b.job.daysAgo);
    return scored.slice(0, 6).map((x) => x.job);
  }, [currentUser, jobs]);

  const openJob = openJobId ? jobs.find((j) => j.id === openJobId) : null;

  if (!authLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-body">
        <div className="text-emerald-700 text-sm font-medium">Loading CareerBanyan…</div>
      </div>
    );
  }

  const jobCardProps = (job, highlight) => ({
    job, highlight, dark,
    saved: !!currentUser && currentUser.savedJobIds.includes(job.id),
    onToggleSave: () => toggleSave(job.id),
    onOpen: () => setOpenJobId(job.id),
    currentUser,
    onRequestAuth: requestAuth,
  });

  return (
    <div className={`min-h-screen font-body ${dark ? 'bg-slate-950 text-slate-50' : 'bg-slate-50 text-slate-900'}`}>
      {/* nav */}
      <div className={`border-b sticky top-0 z-40 backdrop-blur ${dark ? 'bg-slate-950/95 border-slate-800' : 'bg-white/95 border-slate-200'}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <button onClick={goHome} className="flex items-center gap-2 shrink-0">
            <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center"><Leaf size={18} /></div>
            <span className={`font-display font-extrabold text-lg tracking-tight hidden sm:inline ${dark ? 'text-slate-50' : 'text-slate-900'}`}>Career<span className="text-emerald-600">Banyan</span></span>
          </button>

          <nav className="hidden md:flex items-center gap-1">
            {currentUser && <NavBtn active={page === 'saved'} onClick={() => setPage('saved')} dark={dark}>Saved ({currentUser.savedJobIds.length})</NavBtn>}
            {currentUser && <NavBtn active={page === 'profile'} onClick={() => setPage('profile')} dark={dark}>Profile</NavBtn>}
          </nav>

          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} className={`h-9 w-9 flex items-center justify-center rounded-lg border transition ${dark ? 'border-slate-700 text-amber-400 hover:border-slate-600' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            {currentUser ? (
              <>
                <span className={`hidden sm:inline text-sm ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Hi, {currentUser.name.split(' ')[0]}</span>
                <button onClick={handleLogout} className={`text-sm h-9 px-3 rounded-lg border flex items-center gap-1.5 ${dark ? 'border-slate-700 text-slate-300 hover:border-slate-600' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}><LogOut size={14} /> <span className="hidden sm:inline">Log out</span></button>
              </>
            ) : (
              <>
                <button onClick={() => { setAuthError(''); setAuthModal('login'); }} className={`text-sm h-9 px-3 rounded-lg border ${dark ? 'border-slate-700 text-slate-300 hover:border-slate-600' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>Log in</button>
                <button onClick={() => { setAuthError(''); setAuthModal('signup'); }} className="text-sm h-9 px-3 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700">Sign up free</button>
              </>
            )}
            <button className={`md:hidden h-9 w-9 flex items-center justify-center rounded-lg border ${dark ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-600'}`} onClick={() => setMobileNav((v) => !v)} aria-label="Menu"><Menu size={16} /></button>
          </div>
        </div>
        {mobileNav && (
          <div className={`md:hidden border-t px-4 py-3 flex flex-col gap-1 ${dark ? 'border-slate-800' : 'border-slate-200'}`}>
            {currentUser && <NavBtn active={page === 'saved'} onClick={() => { setPage('saved'); setMobileNav(false); }} dark={dark}>Saved ({currentUser.savedJobIds.length})</NavBtn>}
            {currentUser && <NavBtn active={page === 'profile'} onClick={() => { setPage('profile'); setMobileNav(false); }} dark={dark}>Profile</NavBtn>}
          </div>
        )}
      </div>

      {showBanner && (
        <div className={dark ? 'bg-indigo-500/10 border-b border-indigo-900' : 'bg-indigo-50 border-b border-indigo-100'}>
          <div className={`max-w-6xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between gap-3 text-xs sm:text-sm font-medium ${dark ? 'text-indigo-300' : 'text-indigo-800'}`}>
            <span>Live listings, synced daily. Sign in to unlock Apply — it's always free.</span>
            <button onClick={() => setShowBanner(false)} aria-label="Dismiss" className="shrink-0"><X size={14} /></button>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {page === 'home' && (
          <>
            <section className={`mb-8 rounded-3xl border p-6 sm:p-8 bg-gradient-to-br ${dark ? 'from-emerald-500/5 via-slate-950 to-indigo-500/5 border-slate-800' : 'from-emerald-50 via-white to-indigo-50 border-slate-200'}`}>
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-6">
                <div>
                  <div className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-2">Fresher & experienced roles · Across India</div>
                  <h1 className={`font-display text-3xl sm:text-4xl font-extrabold leading-tight max-w-xl ${dark ? 'text-slate-50' : 'text-slate-900'}`}>New roles land here first. Yours could be next.</h1>
                  <p className={`mt-2 max-w-lg text-sm sm:text-base ${dark ? 'text-slate-400' : 'text-slate-600'}`}>Freshers to veterans, IT to everything else — filter it your way, then jump straight to the company's own site and apply. Always free.</p>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-1 lg:pb-0">
                  <StatTile value={jobs.length} label="Live roles" dark={dark} />
                  <StatTile value={jobs.filter((j) => j.daysAgo === 0).length} label="New today" dark={dark} />
                  <StatTile value={COMPANIES.length} label="Employers" dark={dark} />
                </div>
              </div>

              <div className={`border rounded-2xl p-3 sm:p-4 shadow-sm ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${dark ? 'text-slate-500' : 'text-slate-400'}`} />
                    <input
                      value={draftFilters.q}
                      onChange={(e) => setDraftFilters((f) => ({ ...f, q: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') applyFilters(); }}
                      placeholder="Search role, company or skill…"
                      className={inputCls(dark) + ' h-11 pl-9 pr-3 rounded-xl'}
                    />
                  </div>
                  <select value={draftFilters.loc} onChange={(e) => setDraftFilters((f) => ({ ...f, loc: e.target.value }))} className={selectCls(dark)}>
                    <option>All Locations</option>
                    {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
                  </select>
                  <select value={draftFilters.cat} onChange={(e) => setDraftFilters((f) => ({ ...f, cat: e.target.value }))} className={selectCls(dark)}>
                    <option>All Categories</option>
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                  <button onClick={applyFilters} className="h-11 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shrink-0 flex items-center justify-center gap-2">
                    <Search size={15} /> Search
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className={`rounded-xl border p-3 ${dark ? 'border-slate-800 bg-slate-800/30' : 'border-slate-100 bg-slate-50'}`}>
                    <div className={`text-[11px] uppercase tracking-wide font-semibold mb-2 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Role type</div>
                    <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                      {[['all', 'All roles'], ['it', 'IT roles'], ['nonit', 'Non-IT roles']].map(([val, label]) => (
                        <button key={val} onClick={() => setDraftFilters((f) => ({ ...f, domain: val }))} className={`shrink-0 h-9 px-4 rounded-full text-sm font-medium border transition ${draftFilters.domain === val ? 'bg-emerald-600 text-white border-emerald-600' : (dark ? 'border-slate-700 text-slate-300 hover:border-slate-600' : 'border-slate-200 text-slate-600 hover:border-slate-300')}`}>{label}</button>
                      ))}
                    </div>
                  </div>
                  <div className={`rounded-xl border p-3 ${dark ? 'border-slate-800 bg-slate-800/30' : 'border-slate-100 bg-slate-50'}`}>
                    <div className={`text-[11px] uppercase tracking-wide font-semibold mb-2 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Experience level</div>
                    <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                      {[['all', 'All levels'], ['fresher', 'Freshers'], ['experienced', 'Experienced']].map(([val, label]) => (
                        <button key={val} onClick={() => setDraftFilters((f) => ({ ...f, level: val }))} className={`shrink-0 h-9 px-4 rounded-full text-sm font-medium border transition ${draftFilters.level === val ? 'bg-emerald-600 text-white border-emerald-600' : (dark ? 'border-slate-700 text-slate-300 hover:border-slate-600' : 'border-slate-200 text-slate-600 hover:border-slate-300')}`}>{label}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {jobsLoading ? (
              <div className={`text-center py-16 border border-dashed rounded-2xl ${dark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'}`}>
                <p className={dark ? 'text-slate-300' : 'text-slate-600'}>Loading roles…</p>
              </div>
            ) : jobs.length === 0 ? (
              <div className={`text-center py-16 border border-dashed rounded-2xl ${dark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'}`}>
                <p className={dark ? 'text-slate-200 font-medium' : 'text-slate-700 font-medium'}>No roles yet.</p>
                <p className={`text-sm mt-1 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>The daily sync hasn't populated any jobs yet — trigger it manually from your GitHub repo's Actions tab, then refresh this page.</p>
              </div>
            ) : (
              <>
                {recommended.length > 0 && (
                  <section className="mb-8">
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <Sparkles size={16} className="text-emerald-600" />
                      <h2 className={`font-display font-bold text-lg ${dark ? 'text-slate-100' : 'text-slate-900'}`}>Matched for you</h2>
                      <span className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-500'}`}>based on the skills saved in your profile</span>
                    </div>
                    <Carousel dark={dark} items={recommended} renderItem={(job) => <JobCard {...jobCardProps(job, true)} />} />
                  </section>
                )}
                {currentUser && recommended.length === 0 && (
                  <div className={`mb-8 border rounded-xl px-4 py-3 text-sm ${dark ? 'border-slate-800 bg-slate-900 text-slate-400' : 'border-slate-200 bg-white text-slate-500'}`}>
                    Add a few skills in <button onClick={() => setPage('profile')} className={dark ? 'text-emerald-400 underline underline-offset-2' : 'text-emerald-700 underline underline-offset-2'}>your profile</button> and we'll match roles to you here.
                  </div>
                )}

                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className={`font-display font-bold text-lg ${dark ? 'text-slate-100' : 'text-slate-900'}`}>
                      {filters.domain === 'it' ? 'IT roles' : filters.domain === 'nonit' ? 'Non-IT roles' : 'All roles'} <span className={`font-normal text-sm ${dark ? 'text-slate-500' : 'text-slate-400'}`}>({filteredJobs.length})</span>
                    </h2>
                    <span className={`text-xs hidden sm:inline ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Sorted by newest first</span>
                  </div>
                  {filteredJobs.length === 0 ? (
                    <div className={`text-center py-16 border border-dashed rounded-2xl ${dark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'}`}>
                      <p className={dark ? 'text-slate-200 font-medium' : 'text-slate-700 font-medium'}>No roles match these filters yet.</p>
                      <p className={`text-sm mt-1 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Try clearing a filter, or check back after the next sync.</p>
                      <button onClick={clearFilters} className={`mt-4 h-9 px-4 rounded-lg border text-sm ${dark ? 'border-slate-700 text-slate-300 hover:border-slate-600' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>Clear filters</button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredJobs.map((job) => <JobCard key={job.id} {...jobCardProps(job, false)} />)}
                    </div>
                  )}
                </section>
              </>
            )}

            {!currentUser && (
              <div className={`mt-8 border rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${dark ? 'border-emerald-800 bg-emerald-500/5' : 'border-emerald-200 bg-emerald-50'}`}>
                <div>
                  <div className={`font-display font-bold text-base ${dark ? 'text-slate-100' : 'text-slate-900'}`}>Get roles matched to you</div>
                  <div className={`text-sm mt-1 ${dark ? 'text-slate-400' : 'text-slate-600'}`}>Create a free account to unlock Apply, save roles, and see picks based on your skills.</div>
                </div>
                <button onClick={() => { setAuthError(''); setAuthModal('signup'); }} className="h-10 px-5 rounded-lg bg-emerald-600 text-white font-semibold shrink-0 hover:bg-emerald-700">Sign up free</button>
              </div>
            )}
          </>
        )}

        {page === 'saved' && currentUser && (
          <section>
            <h1 className={`font-display text-2xl font-bold mb-1 ${dark ? 'text-slate-100' : 'text-slate-900'}`}>Saved roles</h1>
            <p className={`text-sm mb-6 ${dark ? 'text-slate-500' : 'text-slate-500'}`}>Roles you've bookmarked to apply to later.</p>
            {(() => {
              const savedJobs = jobs.filter((j) => currentUser.savedJobIds.includes(j.id)).sort((a, b) => a.daysAgo - b.daysAgo);
              if (savedJobs.length === 0) {
                return (
                  <div className={`text-center py-16 border border-dashed rounded-2xl ${dark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'}`}>
                    <p className={dark ? 'text-slate-200 font-medium' : 'text-slate-700 font-medium'}>You haven't saved any roles yet.</p>
                    <p className={`text-sm mt-1 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Tap the bookmark icon on a listing to keep it here.</p>
                    <button onClick={() => setPage('home')} className="mt-4 h-9 px-4 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700">Browse roles</button>
                  </div>
                );
              }
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {savedJobs.map((job) => <JobCard key={job.id} {...jobCardProps(job, false)} />)}
                </div>
              );
            })()}
          </section>
        )}

        {page === 'profile' && currentUser && (
          <section className="max-w-2xl">
            <h1 className={`font-display text-2xl font-bold mb-1 ${dark ? 'text-slate-100' : 'text-slate-900'}`}>Your profile</h1>
            <p className={`text-sm mb-6 ${dark ? 'text-slate-500' : 'text-slate-500'}`}>This is what we use to personalize your matches and keep your account secure.</p>

            <div className={`border rounded-2xl p-5 mb-6 shadow-sm ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h2 className={`font-semibold text-sm mb-3 ${dark ? 'text-slate-200' : 'text-slate-800'}`}>Account details</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div><dt className={`text-xs mb-0.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Name</dt><dd className={dark ? 'text-slate-200' : 'text-slate-800'}>{currentUser.name}</dd></div>
                <div><dt className={`text-xs mb-0.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Email</dt><dd className={dark ? 'text-slate-200' : 'text-slate-800'}>{currentUser.email}</dd></div>
                <div><dt className={`text-xs mb-0.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Mobile</dt><dd className={dark ? 'text-slate-200' : 'text-slate-800'}>{currentUser.phone}</dd></div>
                <div><dt className={`text-xs mb-0.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Address</dt><dd className={dark ? 'text-slate-200' : 'text-slate-800'}>{currentUser.address}</dd></div>
              </dl>
            </div>

            <div className={`border rounded-2xl p-5 mb-6 shadow-sm ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h2 className={`font-semibold text-sm mb-1 ${dark ? 'text-slate-200' : 'text-slate-800'}`}>Skills & interests</h2>
              <p className={`text-xs mb-3 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Add a few comma-separated skills or the kind of role you want — we use this to sort "Matched for you" on Home.</p>
              <textarea value={skillsDraft} onChange={(e) => setSkillsDraft(e.target.value)} rows={3} placeholder="e.g. java, sql, customer support, banking, fresher" className={inputCls(dark) + ' py-2.5 resize-none'} />
              <button onClick={() => updateSkills(skillsDraft)} className="mt-3 h-10 px-4 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700">Save preferences</button>
            </div>

            <div className={`border rounded-2xl p-5 ${dark ? 'border-red-900/50 bg-red-500/5' : 'border-red-200 bg-red-50'}`}>
              <h2 className={`font-semibold text-sm mb-1 ${dark ? 'text-red-400' : 'text-red-700'}`}>Delete account</h2>
              <p className={`text-xs mb-3 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Permanently deletes your login, saved roles and preferences. This cannot be undone.</p>
              <button onClick={() => { if (window.confirm("Delete your account and all data? This can't be undone.")) deleteAccount(); }} className={`h-9 px-4 rounded-lg border text-sm ${dark ? 'border-red-800 text-red-400 hover:bg-red-500/10' : 'border-red-300 text-red-700 hover:bg-red-100'}`}>Delete my account & data</button>
            </div>
          </section>
        )}
      </main>

      <footer className={`border-t mt-12 ${dark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-white'}`}>
        <div className={`max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
          <div>
            <span className={`font-display font-bold ${dark ? 'text-slate-300' : 'text-slate-700'}`}>Career<span className="text-emerald-600">Banyan</span></span>
            <p className="mt-1 max-w-md">Listings sync daily from public job-search data. Apply requires a free account. This board never charges job seekers a fee.</p>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setShowTC(true)} className={dark ? 'hover:text-slate-300' : 'hover:text-slate-600'}>Terms & Conditions</button>
          </div>
        </div>
      </footer>

      <JobDetailModal
        job={openJob}
        saved={!!currentUser && !!openJob && currentUser.savedJobIds.includes(openJob.id)}
        onToggleSave={() => openJob && toggleSave(openJob.id)}
        onClose={() => setOpenJobId(null)}
        currentUser={currentUser}
        onRequestAuth={requestAuth}
        dark={dark}
      />

      <AuthModal
        mode={authModal}
        onClose={() => { setAuthModal(null); setAuthError(''); }}
        onSwitch={() => { setAuthError(''); setAuthModal((m) => (m === 'signup' ? 'login' : 'signup')); }}
        onSignup={handleSignup}
        onLogin={handleLogin}
        error={authError}
        onOpenTC={() => setShowTC(true)}
        dark={dark}
      />
      {showTC && <TCModal onClose={() => setShowTC(false)} dark={dark} />}
      <Toast message={toast} />
    </div>
  );
}

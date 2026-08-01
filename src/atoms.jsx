// Small, self-contained presentational pieces reused across the app.
import { card3D } from '../lib/styles';

export function NavBtn({ active, onClick, children, dark }) {
  const cls = active ? (dark ? 'text-emerald-400 bg-emerald-500/10' : 'text-emerald-700 bg-emerald-50') : (dark ? 'text-slate-400 hover:text-slate-100' : 'text-slate-500 hover:text-slate-800');
  return <button onClick={onClick} className={`px-3 py-2 rounded-lg text-sm font-medium transition ${cls}`}>{children}</button>;
}

export function StatTile({ value, label, dark }) {
  return (
    <div className={card3D(dark, 'rounded-xl px-3 py-3 sm:px-4 min-w-0')}>
      <div className={`font-display text-xl sm:text-2xl md:text-3xl font-extrabold leading-none ${dark ? 'text-emerald-400' : 'text-emerald-700'}`}>{value}</div>
      <div className="text-[10px] sm:text-[11px] uppercase tracking-wide text-slate-500 mt-1">{label}</div>
    </div>
  );
}

export function LevelBadge({ level, dark }) {
  const map = dark
    ? { fresher: 'text-emerald-400 border-emerald-800 bg-emerald-500/10', experienced: 'text-indigo-400 border-indigo-800 bg-indigo-500/10', both: 'text-slate-400 border-slate-700 bg-slate-800' }
    : { fresher: 'text-emerald-700 border-emerald-200 bg-emerald-50', experienced: 'text-indigo-700 border-indigo-200 bg-indigo-50', both: 'text-slate-600 border-slate-300 bg-slate-100' };
  const label = level === 'fresher' ? 'Fresher friendly' : level === 'experienced' ? 'Experienced' : 'All levels';
  return <span className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-1 rounded-full border whitespace-nowrap ${map[level] || map.both}`}>{label}</span>;
}

export function DomainBadge({ isIT, dark }) {
  const cls = isIT
    ? (dark ? 'border-blue-800 bg-blue-500/10 text-blue-400' : 'border-blue-200 bg-blue-50 text-blue-700')
    : (dark ? 'border-slate-700 bg-slate-800 text-slate-400' : 'border-slate-300 bg-slate-100 text-slate-600');
  return <span className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-1 rounded-full border whitespace-nowrap ${cls}`}>{isIT ? 'IT' : 'Non-IT'}</span>;
}

export function FreshBadge({ daysAgo, dark }) {
  const label = daysAgo === 0 ? 'New today' : daysAgo === 1 ? '1 day ago' : `${daysAgo} days ago`;
  const hot = daysAgo <= 1;
  const cls = hot
    ? (dark ? 'text-amber-400 border-amber-800 bg-amber-500/10' : 'text-amber-700 border-amber-200 bg-amber-50')
    : (dark ? 'text-slate-500 border-slate-700 bg-slate-800/50' : 'text-slate-500 border-slate-200 bg-slate-50');
  return <span className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-1 rounded-full border whitespace-nowrap ${cls}`}>{label}</span>;
}

export function Field({ label, children, dark }) {
  return (
    <label className="block">
      <span className={`block text-xs mb-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</span>
      {children}
    </label>
  );
}

export function SalaryText({ job, dark, emphasis }) {
  if (job.salary) return <span className={emphasis ? (dark ? 'font-medium text-slate-200' : 'font-medium text-slate-700') : ''}>{job.salary}</span>;
  return <span className={`italic ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Not disclosed by employer</span>;
}

export function Toggle({ checked, onChange, dark, label }) {
  // Fixed pixel geometry (not Tailwind spacing classes) so the thumb is
  // mathematically guaranteed to stay inside the track at every screen size.
  const TRACK_W = 48;
  const TRACK_H = 28;
  const THUMB = 22;
  const MARGIN = 3;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      style={{ width: TRACK_W, height: TRACK_H, padding: 0 }}
      className={`shrink-0 relative rounded-full border-none transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${checked ? 'bg-emerald-600' : (dark ? 'bg-slate-700' : 'bg-slate-300')}`}
    >
      <span
        className="absolute rounded-full bg-white shadow transition-transform duration-200"
        style={{
          top: MARGIN,
          left: MARGIN,
          width: THUMB,
          height: THUMB,
          transform: `translateX(${checked ? TRACK_W - THUMB - MARGIN * 2 : 0}px)`,
        }}
      />
    </button>
  );
}


export function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.9 2.4 30.3 0 24 0 14.6 0 6.4 5.4 2.5 13.2l7.8 6.1C12.3 13.3 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.9 7.2l7.5 5.9c4.4-4 6.9-10 6.9-17.6z" />
      <path fill="#FBBC05" d="M10.3 19.3a14.5 14.5 0 0 0 0 9.4l-7.8 6.1a24 24 0 0 1 0-21.6z" />
      <path fill="#34A853" d="M24 48c6.3 0 11.6-2.1 15.5-5.6l-7.5-5.9c-2.1 1.4-4.8 2.3-8 2.3-6.4 0-11.7-3.8-13.7-9.6l-7.8 6.1C6.4 42.6 14.6 48 24 48z" />
    </svg>
  );
}


export function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-[0_20px_40px_-12px_rgba(0,0,0,0.5)] fade-in">
      {message}
    </div>
  );
}

/* ---------------------------------- main app ---------------------------------- */


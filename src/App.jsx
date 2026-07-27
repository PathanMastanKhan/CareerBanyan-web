import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Search, MapPin, Bookmark, LogOut, X, Menu, ExternalLink, Sparkles, ShieldCheck, Leaf, Sun, Moon, ChevronLeft, ChevronRight, Plus, Code2, Cpu, Wrench, Building2, FlaskConical, Briefcase, BadgeCheck, Bell } from 'lucide-react';
import { supabase } from './supabaseClient';

const SITE_URL = 'https://careerbanyan.vercel.app'; // TODO: update to your real domain

function setJobMeta(job) {
  if (!job) return;
  document.title = `${job.role} at ${job.company} — CareerBanyan`;
  const desc = `${job.role} at ${job.company} in ${job.city}. ${job.experience}. Apply free on CareerBanyan.`;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', desc);
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute('href', `${SITE_URL}/job/${job.id}`);
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', `${job.role} at ${job.company}`);
  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute('content', desc);
}

function resetMeta() {
  document.title = 'CareerBanyan — Jobs for India';
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', 'Fresher and experienced job listings across India, updated daily.');
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute('href', `${SITE_URL}/`);
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', 'CareerBanyan — Jobs for India');
  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute('content', 'Fresher and experienced job listings across India, updated daily.');
}

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

const card3D = (dark, extra = '') =>
  `${extra} border transition-all duration-300 ease-out will-change-transform ` +
  (dark
    ? 'border-slate-800 bg-slate-900 shadow-[0_1px_1px_rgba(0,0,0,0.4),0_10px_20px_-8px_rgba(0,0,0,0.55),0_28px_44px_-18px_rgba(0,0,0,0.65)] hover:shadow-[0_2px_2px_rgba(0,0,0,0.5),0_18px_30px_-8px_rgba(0,0,0,0.6),0_40px_64px_-18px_rgba(0,0,0,0.7)]'
    : 'border-slate-200 bg-white shadow-[0_1px_1px_rgba(15,23,42,0.04),0_10px_20px_-8px_rgba(15,23,42,0.12),0_28px_44px_-18px_rgba(15,23,42,0.16)] hover:shadow-[0_2px_2px_rgba(15,23,42,0.05),0_18px_30px_-8px_rgba(15,23,42,0.16),0_40px_64px_-18px_rgba(15,23,42,0.2)]') +
  ' hover:-translate-y-1';

const btn3D = (dark, tone = 'emerald') => {
  const edge = {
    emerald: 'shadow-[0_4px_0_0_rgba(4,120,87,1),0_8px_14px_-4px_rgba(4,120,87,0.45)] active:shadow-[0_1px_0_0_rgba(4,120,87,1),0_2px_4px_-1px_rgba(4,120,87,0.4)]',
    indigo: 'shadow-[0_4px_0_0_rgba(67,56,202,1),0_8px_14px_-4px_rgba(67,56,202,0.45)] active:shadow-[0_1px_0_0_rgba(67,56,202,1),0_2px_4px_-1px_rgba(67,56,202,0.4)]',
    red: 'shadow-[0_4px_0_0_rgba(153,27,27,1),0_8px_14px_-4px_rgba(153,27,27,0.4)] active:shadow-[0_1px_0_0_rgba(153,27,27,1),0_2px_4px_-1px_rgba(153,27,27,0.35)]',
    slate: dark
      ? 'shadow-[0_4px_0_0_rgba(30,41,59,1),0_8px_14px_-4px_rgba(0,0,0,0.5)] active:shadow-[0_1px_0_0_rgba(30,41,59,1),0_2px_4px_-1px_rgba(0,0,0,0.4)]'
      : 'shadow-[0_4px_0_0_rgba(203,213,225,1),0_8px_14px_-4px_rgba(15,23,42,0.15)] active:shadow-[0_1px_0_0_rgba(203,213,225,1),0_2px_4px_-1px_rgba(15,23,42,0.1)]',
  }[tone];
  return `transition-all duration-150 ${edge} hover:-translate-y-0.5 active:translate-y-1`;
};

function NavBtn({ active, onClick, children, dark }) {
  const cls = active ? (dark ? 'text-emerald-400 bg-emerald-500/10' : 'text-emerald-700 bg-emerald-50') : (dark ? 'text-slate-400 hover:text-slate-100' : 'text-slate-500 hover:text-slate-800');
  return <button onClick={onClick} className={`px-3 py-2 rounded-lg text-sm font-medium transition ${cls}`}>{children}</button>;
}

function StatTile({ value, label, dark }) {
  return (
    <div className={card3D(dark, 'rounded-xl px-4 py-3 min-w-[110px]')}>
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

function useTilt() {
  const ref = useRef(null);
  const [tiltStyle, setTiltStyle] = useState({});
  const enabledRef = useRef(true);

  useEffect(() => {
    try {
      const hoverOk = window.matchMedia('(hover: hover)').matches;
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      enabledRef.current = hoverOk && !reduceMotion;
    } catch (e) {
      enabledRef.current = false;
    }
  }, []);

  const onMouseMove = (e) => {
    if (!enabledRef.current || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rotateY = (x - 0.5) * 8;
    const rotateX = (0.5 - y) * 8;
    setTiltStyle({
      transform: `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`,
      transition: 'transform 0.05s linear, box-shadow 0.2s ease',
    });
  };

  const onMouseLeave = () => {
    if (!enabledRef.current) return;
    setTiltStyle({
      transform: 'perspective(800px) rotateX(0deg) rotateY(0deg) translateY(0px)',
      transition: 'transform 0.35s ease, box-shadow 0.2s ease',
    });
  };

  return { ref, tiltStyle, onMouseMove, onMouseLeave };
}

function JobOrbit({ dark }) {
  const branches = [
    { Icon: Code2, label: 'CSE / IT' },
    { Icon: Cpu, label: 'ECE' },
    { Icon: Wrench, label: 'Mechanical' },
    { Icon: Building2, label: 'Civil' },
    { Icon: FlaskConical, label: 'Chemical' },
    { Icon: Briefcase, label: 'Non-IT' },
  ];
  const size = 236;
  const radius = 100;

  return (
    <div aria-hidden="true" className="relative shrink-0" style={{ width: size, height: size }}>
      <div className={`orbit-floor absolute inset-0 rounded-full ${dark ? 'text-slate-800' : 'text-slate-200'}`} style={{ opacity: 0.6 }} />
      <div className="orbit-ring absolute inset-0">
        {branches.map(({ Icon, label }, i) => {
          const angle = (360 / branches.length) * i;
          return (
            <div key={label} className="absolute inset-0" style={{ transform: `rotate(${angle}deg)` }}>
              <div className="absolute left-1/2 top-0" style={{ transform: `translate(-50%, ${size / 2 - radius}px)` }}>
                <div style={{ transform: `rotate(${-angle}deg)` }}>
                  <div className="orbit-icon-counter">
                    <div title={label} className={`h-11 w-11 rounded-xl border shadow-md flex items-center justify-center ${dark ? 'bg-slate-900 border-slate-700 text-emerald-400' : 'bg-white border-slate-200 text-emerald-600'}`}>
                      <Icon size={19} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className={`hub-pulse h-16 w-16 rounded-full flex items-center justify-center ring-4 ${dark ? 'bg-gradient-to-br from-emerald-500 to-emerald-700 ring-slate-950' : 'bg-gradient-to-br from-emerald-400 to-emerald-600 ring-white'}`}>
          <Leaf size={26} className="text-white" />
        </div>
      </div>
      <div className={`float-card absolute -top-1 left-1/2 -translate-x-1/2 rounded-xl border shadow-lg px-3 py-1.5 text-[11px] font-semibold flex items-center gap-1.5 whitespace-nowrap ${dark ? 'bg-slate-900 border-slate-700 text-emerald-400' : 'bg-white border-slate-200 text-emerald-700'}`}>
        <BadgeCheck size={13} /> Verified listings
      </div>
      <div className={`float-card float-card-delay absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-xl border shadow-lg px-3 py-1.5 text-[11px] font-semibold flex items-center gap-1.5 whitespace-nowrap ${dark ? 'bg-slate-900 border-slate-700 text-amber-400' : 'bg-white border-slate-200 text-amber-700'}`}>
        <Bell size={13} /> New role synced
      </div>
    </div>
  );
}

function JobCard({ job, saved, onToggleSave, onOpen, currentUser, onRequestAuth, highlight, dark }) {
  const tilt = useTilt();

  return (
    <div
      ref={tilt.ref}
      onClick={onOpen}
      onMouseMove={tilt.onMouseMove}
      onMouseLeave={tilt.onMouseLeave}
      style={tilt.tiltStyle}
      className={card3D(dark, `h-full cursor-pointer rounded-2xl p-5 flex flex-col gap-3 fade-in ${highlight ? (dark ? 'ring-1 ring-emerald-800' : 'ring-1 ring-emerald-300') : ''}`)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`h-11 w-11 shrink-0 rounded-xl text-white flex items-center justify-center text-[11px] font-bold font-display shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_3px_6px_rgba(0,0,0,0.25)] ${dark ? 'bg-slate-700' : 'bg-slate-900'}`}>{initials(job.company)}</div>
          <div className="min-w-0">
            <div className={`text-xs truncate ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{job.company}</div>
            <h3 className={`font-display font-bold leading-snug line-clamp-2 ${dark ? 'text-slate-50' : 'text-slate-900'}`}>{job.role}</h3>
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSave(); }}
          aria-label={saved ? 'Remove from saved roles' : 'Save this role'}
          className={`h-9 w-9 shrink-0 flex items-center justify-center rounded-lg border transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-90 ${saved ? (dark ? 'border-emerald-700 text-emerald-400 bg-emerald-500/10' : 'border-emerald-300 text-emerald-600 bg-emerald-50') : (dark ? 'border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-600' : 'border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300')}`}
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
      <button onClick={() => scrollBy(-1)} aria-label="Scroll left" className={`hidden sm:flex absolute -left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full items-center justify-center border shadow-[0_4px_10px_-2px_rgba(15,23,42,0.25)] transition-transform duration-150 hover:scale-110 active:scale-90 ${arrowCls}`}>
        <ChevronLeft size={16} />
      </button>
      <button onClick={() => scrollBy(1)} aria-label="Scroll right" className={`hidden sm:flex absolute -right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full items-center justify-center border shadow-[0_4px_10px_-2px_rgba(15,23,42,0.25)] transition-transform duration-150 hover:scale-110 active:scale-90 ${arrowCls}`}>
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

function AuthModal({ mode, onClose, onSwitch, onSignup, onLogin, onGoogle, error, onOpenTC, dark }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', agree: false });
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm({ name: '', email: '', password: '', confirm: '', agree: false });
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
      <div className={`modal-pop-3d w-full max-w-md border rounded-2xl shadow-[0_40px_80px_-20px_rgba(0,0,0,0.5)] p-6 max-h-[90vh] overflow-y-auto ${panelBg}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className={`font-display text-xl font-bold ${dark ? 'text-slate-50' : 'text-slate-900'}`}>{isSignup ? 'Create your account' : 'Log in'}</h2>
          <button onClick={onClose} aria-label="Close" className={`transition-transform active:scale-75 ${dark ? 'text-slate-500 hover:text-slate-200' : 'text-slate-400 hover:text-slate-700'}`}><X size={20} /></button>
        </div>
        <p className={`text-sm mb-5 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{isSignup ? "Free to join — you'll need an account to apply to any role." : 'Welcome back — pick up your saved roles and matches.'}</p>

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

        {isSignup ? (
          <form className="space-y-3" onSubmit={submitSignup}>
            <Field label="Full name" dark={dark}><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls(dark)} placeholder="Priya Sharma" /></Field>
            <Field label="Email" dark={dark}><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls(dark)} placeholder="priya@example.com" /></Field>
            <Field label="Password" dark={dark}><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputCls(dark)} placeholder="At least 6 characters" /></Field>
            <Field label="Confirm password" dark={dark}><input type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} className={inputCls(dark)} placeholder="Re-enter password" /></Field>
            <p className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>We'll verify your mobile number by SMS right after this step.</p>
            <label className={`flex items-start gap-2 text-xs pt-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
              <input type="checkbox" checked={form.agree} onChange={(e) => setForm({ ...form, agree: e.target.checked })} className="mt-0.5" />
              <span>I agree to the <button type="button" onClick={onOpenTC} className={dark ? 'text-emerald-400 underline underline-offset-2' : 'text-emerald-700 underline underline-offset-2'}>Terms & Conditions</button>, including storage of my email, phone number and address.</span>
            </label>
            <button type="submit" disabled={busy} className={`w-full h-11 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 mt-2 disabled:opacity-60 disabled:translate-y-0 disabled:shadow-none ${btn3D(dark)}`}>{busy ? 'Creating account…' : 'Create account'}</button>
          </form>
        ) : (
          <form className="space-y-3" onSubmit={submitLogin}>
            <Field label="Email" dark={dark}><input type="email" value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} className={inputCls(dark)} placeholder="priya@example.com" /></Field>
            <Field label="Password" dark={dark}><input type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} className={inputCls(dark)} placeholder="Your password" /></Field>
            <button type="submit" disabled={busy} className={`w-full h-11 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 mt-2 disabled:opacity-60 disabled:translate-y-0 disabled:shadow-none ${btn3D(dark)}`}>{busy ? 'Logging in…' : 'Log in'}</button>
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
      <div className={`modal-pop-3d w-full max-w-lg border rounded-2xl shadow-[0_40px_80px_-20px_rgba(0,0,0,0.5)] p-6 max-h-[85vh] overflow-y-auto ${panelBg}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className={`font-display text-xl font-bold flex items-center gap-2 ${strong}`}><ShieldCheck size={20} className="text-emerald-600" /> Terms & Conditions</h2>
          <button onClick={onClose} className={`transition-transform active:scale-75 ${dark ? 'text-slate-500 hover:text-slate-200' : 'text-slate-400 hover:text-slate-700'}`} aria-label="Close"><X size={20} /></button>
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

function PrivacyModal({ onClose, dark }) {
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
          <h2 className={`font-display text-xl font-bold ${strong}`}>Privacy Policy</h2>
          <button onClick={onClose} className={`transition-transform active:scale-75 ${dark ? 'text-slate-500 hover:text-slate-200' : 'text-slate-400 hover:text-slate-700'}`} aria-label="Close"><X size={20} /></button>
        </div>
        <div className={`space-y-4 text-sm leading-relaxed ${body}`}>
          <p><strong className={strong}>What we collect.</strong> When you create an account: your name, email address, mobile number, and address. When you use the site: the skills you add to your profile and the roles you save.</p>
          <p><strong className={strong}>Why we collect it.</strong> Email and mobile number are used for login and account security (SMS verification). If you turn on email alerts, we use your saved skills to match and email you about new roles. Address and skills are used to personalize job matches. We do not sell or share this data with third parties for advertising.</p>
          <p><strong className={strong}>Where it's stored.</strong> Your data is stored securely with Supabase, our database provider.</p>
          <p><strong className={strong}>How long we keep it.</strong> We retain your data as long as your account is active. If you delete your account, your login, saved roles, and profile data are permanently removed.</p>
          <p><strong className={strong}>Your rights.</strong> Under India's Digital Personal Data Protection Act, you have the right to access, correct, or request deletion of your personal data. You can update your skills anytime from Profile, turn email alerts off anytime, and request full account deletion from the same page.</p>
          <p><strong className={strong}>Contact.</strong> For any data-related request or question, reach out via the contact details on our site.</p>
          <p className="text-xs opacity-75">Last updated: {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>
    </div>
  );
}

function SkillsInput({ skills, onChange, dark }) {
  const [draft, setDraft] = useState('');

  const addSkill = () => {
    const val = draft.trim();
    if (!val) return;
    if (skills.some((s) => s.toLowerCase() === val.toLowerCase())) { setDraft(''); return; }
    onChange([...skills, val]);
    setDraft('');
  };
  const removeSkill = (val) => onChange(skills.filter((s) => s !== val));

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-3 min-h-[28px]">
        {skills.length === 0 && <span className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>No skills added yet — add a few below.</span>}
        {skills.map((s) => (
          <span key={s} className={`flex items-center gap-1.5 text-xs font-medium pl-2.5 pr-1.5 py-1 rounded-full border ${dark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-800' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
            {s}
            <button type="button" onClick={() => removeSkill(s)} aria-label={`Remove ${s}`} className="hover:opacity-70 transition-transform active:scale-75">
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
          placeholder="e.g. Java — press Enter or tap Add"
          className={inputCls(dark)}
        />
        <button type="button" onClick={addSkill} className={`h-10 px-4 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 flex items-center gap-1 shrink-0 ${btn3D(dark)}`}>
          <Plus size={14} /> Add
        </button>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.9 2.4 30.3 0 24 0 14.6 0 6.4 5.4 2.5 13.2l7.8 6.1C12.3 13.3 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.9 7.2l7.5 5.9c4.4-4 6.9-10 6.9-17.6z" />
      <path fill="#FBBC05" d="M10.3 19.3a14.5 14.5 0 0 0 0 9.4l-7.8 6.1a24 24 0 0 1 0-21.6z" />
      <path fill="#34A853" d="M24 48c6.3 0 11.6-2.1 15.5-5.6l-7.5-5.9c-2.1 1.4-4.8 2.3-8 2.3-6.4 0-11.7-3.8-13.7-9.6l-7.8 6.1C6.4 42.6 14.6 48 24 48z" />
    </svg>
  );
}

function CompleteProfileModal({ initialPhone, initialAddress, onSendOtp, onVerifyOtp, onOpenTC, dark }) {
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState(initialPhone || '');
  const [address, setAddress] = useState(initialAddress || '');
  const [agree, setAgree] = useState(false);
  const [code, setCode] = useState('');
  const [e164, setE164] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const submitPhone = async (e) => {
    e.preventDefault();
    const cleanAddress = address.trim();
    if (!cleanAddress) return setError('Please add your address.');
    if (!agree) return setError('Please accept the Terms & Conditions to continue.');
    setError('');
    setBusy(true);
    const res = await onSendOtp(phone);
    setBusy(false);
    if (!res.ok) return setError(res.message);
    setE164(res.e164);
    setCode('');
    setCooldown(30);
    setStep('otp');
  };

  const resend = async () => {
    if (cooldown > 0 || busy) return;
    setError('');
    setBusy(true);
    const res = await onSendOtp(phone);
    setBusy(false);
    if (!res.ok) return setError(res.message);
    setCooldown(30);
  };

  const submitOtp = async (e) => {
    e.preventDefault();
    if (!/^\d{4,8}$/.test(code.trim())) return setError('Enter the code exactly as you received it.');
    setError('');
    setBusy(true);
    const res = await onVerifyOtp(e164, code, address);
    setBusy(false);
    if (!res.ok) return setError(res.message);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
      <div className={`modal-pop-3d w-full max-w-md border rounded-2xl shadow-[0_40px_80px_-20px_rgba(0,0,0,0.5)] p-6 ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        {step === 'phone' ? (
          <>
            <h2 className={`font-display text-xl font-bold mb-1 ${dark ? 'text-slate-50' : 'text-slate-900'}`}>Verify your mobile number</h2>
            <p className={`text-sm mb-4 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>We text a one-time code to confirm this number is really yours before it goes on your account.</p>
            {error && <div className={`mb-4 text-sm rounded-lg px-3 py-2 border ${dark ? 'text-red-300 bg-red-500/10 border-red-900' : 'text-red-700 bg-red-50 border-red-200'}`}>{error}</div>}
            <form className="space-y-3" onSubmit={submitPhone}>
              <Field label="Mobile number" dark={dark}><input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls(dark)} placeholder="98765 43210" /></Field>
              <Field label="Address" dark={dark}><textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className={inputCls(dark) + ' resize-none'} placeholder="City, State" /></Field>
              <label className={`flex items-start gap-2 text-xs pt-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" />
                <span>I agree to the <button type="button" onClick={onOpenTC} className={dark ? 'text-emerald-400 underline underline-offset-2' : 'text-emerald-700 underline underline-offset-2'}>Terms & Conditions</button>, including storage of my email, phone number and address.</span>
              </label>
              <button type="submit" disabled={busy} className={`w-full h-11 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60 disabled:translate-y-0 disabled:shadow-none ${btn3D(dark)}`}>{busy ? 'Sending code…' : 'Send verification code'}</button>
            </form>
          </>
        ) : (
          <>
            <h2 className={`font-display text-xl font-bold mb-1 ${dark ? 'text-slate-50' : 'text-slate-900'}`}>Enter the code</h2>
            <p className={`text-sm mb-4 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>We sent a code by SMS to <strong className={dark ? 'text-slate-200' : 'text-slate-800'}>{e164}</strong>.</p>
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
                <button type="button" onClick={() => { setStep('phone'); setError(''); }} className={dark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}>Change number</button>
                <button type="button" onClick={resend} disabled={cooldown > 0 || busy} className={`disabled:opacity-50 ${dark ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-700 hover:text-emerald-800'}`}>{cooldown > 0 ? `Resend code (${cooldown}s)` : 'Resend code'}</button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-[0_20px_40px_-12px_rgba(0,0,0,0.5)] fade-in">
      {message}
    </div>
  );
}

export default function App() {
  const [authLoaded, setAuthLoaded] = useState(false);
  const [session, setSession] = useState(null);

  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);

  const [page, setPage] = useState('home');
  const [authModal, setAuthModal] = useState(null);
  const [authError, setAuthError] = useState('');
  const [showTC, setShowTC] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showBanner, setShowBanner] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState(null);
  const [openJobId, setOpenJobId] = useState(null);
  const [visibleCount, setVisibleCount] = useState(20);
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

  useEffect(() => {
    const cutoff = new Date(Date.now() - 45 * 86400000).toISOString();
    supabase
      .from('jobs')
      .select('*')
      .eq('is_active', true)
      .gte('posted_at', cutoff)
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

  useEffect(() => {
    const match = window.location.pathname.match(/^\/job\/([^/]+)$/);
    if (match) setOpenJobId(match[1]);
    const onPopState = () => {
      const m = window.location.pathname.match(/^\/job\/([^/]+)$/);
      setOpenJobId(m ? m[1] : null);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 8000);
  }, []);

  const currentUser = useMemo(() => {
    if (!session) return null;
    const meta = session.user.user_metadata || {};
    let skillsArr = meta.skills;
    if (!Array.isArray(skillsArr)) {
      skillsArr = typeof skillsArr === 'string' && skillsArr.trim()
        ? skillsArr.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
        : [];
    }
    return {
      id: session.user.id,
      email: session.user.email || '',
      name: meta.name || (session.user.email ? session.user.email.split('@')[0] : 'there'),
      phone: meta.phone || '',
      phoneVerified: !!meta.phone_verified,
      address: meta.address || '',
      skills: skillsArr,
      savedJobIds: meta.saved_job_ids || [],
      alertsEnabled: !!meta.alerts_enabled,
    };
  }, [session]);

  const needsProfileCompletion = !!currentUser && !currentUser.phoneVerified;

  useEffect(() => {
    if (!currentUser && (page === 'saved' || page === 'profile')) setPage('home');
  }, [currentUser, page]);

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
    const { password, confirm, agree } = form;

    if (!name || !email || !password) return setAuthError('Please fill in every field.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setAuthError('Enter a valid email address.');
    if (password.length < 6) return setAuthError('Password should be at least 6 characters.');
    if (password !== confirm) return setAuthError("Passwords don't match.");
    if (!agree) return setAuthError('Please accept the Terms & Conditions to continue.');

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, skills: [], saved_job_ids: [] } },
    });
    if (error) return setAuthError(error.message);

    setAuthError('');
    setAuthModal(null);
    showToast(`Welcome, ${name.split(' ')[0]}! Now let's verify your mobile number.`);
  };

  const handleLogin = async (form) => {
    const email = form.email.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithPassword({ email, password: form.password });
    if (error) return setAuthError('We could not log you in — check your email and password.');
    setAuthError('');
    setAuthModal(null);
    showToast('Welcome back!');
  };

  const signInWithGoogle = async () => {
    setAuthError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) setAuthError(error.message);
  };

  const toE164 = (raw) => {
    const digits = raw.replace(/\D/g, '').replace(/^91/, '');
    return `+91${digits}`;
  };

  const sendPhoneOtp = async (phone) => {
    const cleanPhone = phone.trim();
    if (!/^(\+91[-\s]?)?[6-9]\d{9}$/.test(cleanPhone.replace(/\s+/g, ''))) {
      return { ok: false, message: 'Enter a valid 10-digit Indian mobile number.' };
    }
    const e164 = toE164(cleanPhone);
    const { error } = await supabase.auth.updateUser({ phone: e164 });
    if (error) return { ok: false, message: error.message };
    return { ok: true, e164 };
  };

  const verifyPhoneOtp = async (e164, code, address) => {
    const { error: verifyError } = await supabase.auth.verifyOtp({ phone: e164, token: code.trim(), type: 'phone_change' });
    if (verifyError) return { ok: false, message: 'That code is incorrect or expired — try again or resend it.' };

    const meta = session.user.user_metadata || {};
    const { data, error } = await supabase.auth.updateUser({
      data: { ...meta, phone: e164, address: address.trim(), phone_verified: true, name: meta.name || (session.user.email || '').split('@')[0] },
    });
    if (error) return { ok: false, message: 'Verified, but saving your profile failed — try again.' };
    setSession((prev) => (prev ? { ...prev, user: data.user } : prev));
    showToast('Mobile number verified — you\'re all set.');
    return { ok: true };
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

  const updateSkills = async (skillsArray) => {
    if (!currentUser) return;
    const { data, error } = await supabase.auth.updateUser({ data: { ...session.user.user_metadata, skills: skillsArray } });
    if (error) { console.error('updateSkills failed:', error.message); showToast('Could not update — try again.'); return; }
    setSession((prev) => (prev ? { ...prev, user: data.user } : prev));
    showToast('Preferences updated — recommendations refreshed.');
  };

  const updateAlertsEnabled = async (enabled) => {
    if (!currentUser) return;
    const { data, error } = await supabase.auth.updateUser({ data: { ...session.user.user_metadata, alerts_enabled: enabled } });
    if (error) { console.error('updateAlertsEnabled failed:', error.message); showToast('Could not update — try again.'); return; }
    setSession((prev) => (prev ? { ...prev, user: data.user } : prev));
    showToast(enabled ? 'Email alerts turned on.' : 'Email alerts turned off.');
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
        console.error('deleteAccount failed:', json.error || res.status, json.debug || '');
        const debugText = json.debug ? ` [hasUrl: ${json.debug.hasUrl}, hasServiceKey: ${json.debug.hasServiceKey}]` : '';
        showToast((json.error || 'Could not delete your account — try again.') + debugText);
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

  useEffect(() => { setVisibleCount(20); }, [filters]);

  const recommended = useMemo(() => {
    if (!currentUser || !currentUser.skills || currentUser.skills.length === 0) return [];
    const tokens = currentUser.skills.map((s) => s.toLowerCase().trim()).filter((s) => s.length > 1);
    if (!tokens.length) return [];
    const scored = jobs.map((job) => ({ job, score: matchScore(job, tokens) })).filter((x) => x.score > 0);
    scored.sort((a, b) => b.score - a.score || a.job.daysAgo - b.job.daysAgo);
    return scored.slice(0, 6).map((x) => x.job);
  }, [currentUser, jobs]);

  const openJob = openJobId ? jobs.find((j) => j.id === openJobId) : null;

  useEffect(() => {
    if (openJob) setJobMeta(openJob);
    else resetMeta();
  }, [openJob]);

  const openJobById = (id) => {
    setOpenJobId(id);
    window.history.pushState({}, '', `/job/${id}`);
  };
  const closeJob = () => {
    setOpenJobId(null);
    window.history.pushState({}, '', '/');
  };

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
    onOpen: () => openJobById(job.id),
    currentUser,
    onRequestAuth: requestAuth,
  });

  return (
    <div className={`min-h-screen font-body ${dark ? 'bg-slate-950 text-slate-50' : 'bg-slate-50 text-slate-900'}`}>
      <div className={`border-b sticky top-0 z-40 backdrop-blur shadow-[0_2px_2px_rgba(0,0,0,0.03),0_8px_20px_-10px_rgba(15,23,42,0.15)] ${dark ? 'bg-slate-950/95 border-slate-800' : 'bg-white/95 border-slate-200'}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <button onClick={goHome} className="flex items-center gap-2 shrink-0 transition-transform hover:-translate-y-0.5 active:translate-y-0 active:scale-95">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_10px_rgba(4,120,87,0.4)]"><Leaf size={18} /></div>
            <span className={`font-display font-extrabold text-lg tracking-tight hidden sm:inline ${dark ? 'text-slate-50' : 'text-slate-900'}`}>Career<span className="text-emerald-600">Banyan</span></span>
          </button>

          <nav className="hidden md:flex items-center gap-1">
            {currentUser && <NavBtn active={page === 'saved'} onClick={() => setPage('saved')} dark={dark}>Saved ({currentUser.savedJobIds.length})</NavBtn>}
            {currentUser && <NavBtn active={page === 'profile'} onClick={() => setPage('profile')} dark={dark}>Profile</NavBtn>}
          </nav>

          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} className={`h-9 w-9 flex items-center justify-center rounded-lg border transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-90 ${dark ? 'border-slate-700 text-amber-400 hover:border-slate-600' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            {currentUser ? (
              <>
                <span className={`hidden sm:inline text-sm ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Hi, {currentUser.name.split(' ')[0]}</span>
                <button onClick={handleLogout} className={`text-sm h-9 px-3 rounded-lg border flex items-center gap-1.5 transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ${dark ? 'border-slate-700 text-slate-300 hover:border-slate-600' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}><LogOut size={14} /> <span className="hidden sm:inline">Log out</span></button>
              </>
            ) : (
              <>
                <button onClick={() => { setAuthError(''); setAuthModal('login'); }} className={`text-sm h-9 px-3 rounded-lg border transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ${dark ? 'border-slate-700 text-slate-300 hover:border-slate-600' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>Log in</button>
                <button onClick={() => { setAuthError(''); setAuthModal('signup'); }} className={`text-sm h-9 px-3 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 ${btn3D(dark)}`}>Sign up free</button>
              </>
            )}
            <button className={`md:hidden h-9 w-9 flex items-center justify-center rounded-lg border transition-all duration-150 active:scale-90 ${dark ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-600'}`} onClick={() => setMobileNav((v) => !v)} aria-label="Menu"><Menu size={16} /></button>
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
            <button onClick={() => setShowBanner(false)} aria-label="Dismiss" className="shrink-0 transition-transform active:scale-75"><X size={14} /></button>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {page === 'home' && (
          <>
            <section className={`relative overflow-hidden mb-8 rounded-3xl border p-6 sm:p-8 bg-gradient-to-br shadow-[0_1px_1px_rgba(0,0,0,0.03),0_20px_50px_-24px_rgba(15,23,42,0.35)] ${dark ? 'from-emerald-500/5 via-slate-950 to-indigo-500/5 border-slate-800' : 'from-emerald-50 via-white to-indigo-50 border-slate-200'}`}>
              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-6">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-2">Fresher & experienced roles · Across India</div>
                  <h1 className={`font-display text-3xl sm:text-4xl font-extrabold leading-tight max-w-xl ${dark ? 'text-slate-50' : 'text-slate-900'}`}>New roles land here first. Yours could be next.</h1>
                  <p className={`mt-2 max-w-lg text-sm sm:text-base ${dark ? 'text-slate-400' : 'text-slate-600'}`}>Freshers to veterans, IT to everything else — filter it your way, then jump straight to the company's own site and apply. Always free.</p>
                </div>
                <div className="hidden lg:flex shrink-0 justify-center">
                  <JobOrbit dark={dark} />
                </div>
              </div>

              <div className="relative z-10 flex gap-3 overflow-x-auto pb-1 mb-6">
                <StatTile value={jobs.length} label="Live roles" dark={dark} />
                <StatTile value={jobs.filter((j) => j.daysAgo === 0).length} label="New today" dark={dark} />
                <StatTile value={COMPANIES.length} label="Employers" dark={dark} />
              </div>

              <div className={card3D(dark, 'relative z-10 rounded-2xl p-3 sm:p-4')}>
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
                  <button onClick={applyFilters} className={`h-11 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shrink-0 flex items-center justify-center gap-2 ${btn3D(dark)}`}>
                    <Search size={15} /> Search
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className={`rounded-xl border p-3 shadow-[inset_0_1px_3px_rgba(0,0,0,0.06)] ${dark ? 'border-slate-800 bg-slate-800/30' : 'border-slate-100 bg-slate-50'}`}>
                    <div className={`text-[11px] uppercase tracking-wide font-semibold mb-2 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Role type</div>
                    <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                      {[['all', 'All roles'], ['it', 'IT roles'], ['nonit', 'Non-IT roles']].map(([val, label]) => (
                        <button key={val} onClick={() => setDraftFilters((f) => ({ ...f, domain: val }))} className={`shrink-0 h-9 px-4 rounded-full text-sm font-medium border transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ${draftFilters.domain === val ? 'bg-emerald-600 text-white border-emerald-600 shadow-[0_3px_0_0_rgba(4,120,87,1)]' : (dark ? 'border-slate-700 text-slate-300 hover:border-slate-600' : 'border-slate-200 text-slate-600 hover:border-slate-300')}`}>{label}</button>
                      ))}
                    </div>
                  </div>
                  <div className={`rounded-xl border p-3 shadow-[inset_0_1px_3px_rgba(0,0,0,0.06)] ${dark ? 'border-slate-800 bg-slate-800/30' : 'border-slate-100 bg-slate-50'}`}>
                    <div className={`text-[11px] uppercase tracking-wide font-semibold mb-2 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Experience level</div>
                    <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                      {[['all', 'All levels'], ['fresher', 'Freshers'], ['experienced', 'Experienced']].map(([val, label]) => (
                        <button key={val} onClick={() => setDraftFilters((f) => ({ ...f, level: val }))} className={`shrink-0 h-9 px-4 rounded-full text-sm font-medium border transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ${draftFilters.level === val ? 'bg-emerald-600 text-white border-emerald-600 shadow-[0_3px_0_0_rgba(4,120,87,1)]' : (dark ? 'border-slate-700 text-slate-300 hover:border-slate-600' : 'border-slate-200 text-slate-600 hover:border-slate-300')}`}>{label}</button>
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
                      <button onClick={clearFilters} className={`mt-4 h-9 px-4 rounded-lg border text-sm transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ${dark ? 'border-slate-700 text-slate-300 hover:border-slate-600' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>Clear filters</button>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredJobs.slice(0, visibleCount).map((job) => <JobCard key={job.id} {...jobCardProps(job, false)} />)}
                      </div>
                      {visibleCount < filteredJobs.length && (
                        <div className="flex justify-center mt-6">
                          <button
                            onClick={() => setVisibleCount((v) => v + 20)}
                            className={`h-11 px-6 rounded-xl border font-medium text-sm transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ${dark ? 'border-slate-700 text-slate-300 hover:border-slate-600' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                          >
                            Load more roles ({filteredJobs.length - visibleCount} remaining)
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </section>
              </>
            )}

            {!currentUser && (
              <div className={`mt-8 border rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all duration-300 hover:-translate-y-1 ${dark ? 'border-emerald-800 bg-emerald-500/5 shadow-[0_10px_30px_-14px_rgba(16,185,129,0.35)] hover:shadow-[0_18px_40px_-14px_rgba(16,185,129,0.45)]' : 'border-emerald-200 bg-emerald-50 shadow-[0_10px_30px_-14px_rgba(16,185,129,0.3)] hover:shadow-[0_18px_40px_-14px_rgba(16,185,129,0.4)]'}`}>
                <div>
                  <div className={`font-display font-bold text-base ${dark ? 'text-slate-100' : 'text-slate-900'}`}>Get roles matched to you</div>
                  <div className={`text-sm mt-1 ${dark ? 'text-slate-400' : 'text-slate-600'}`}>Create a free account to unlock Apply, save roles, and see picks based on your skills.</div>
                </div>
                <button onClick={() => { setAuthError(''); setAuthModal('signup'); }} className={`h-10 px-5 rounded-lg bg-emerald-600 text-white font-semibold shrink-0 hover:bg-emerald-700 ${btn3D(dark)}`}>Sign up free</button>
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
                    <button onClick={() => setPage('home')} className={`mt-4 h-9 px-4 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 ${btn3D(dark)}`}>Browse roles</button>
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

            <div className={card3D(dark, 'rounded-2xl p-5 mb-6')}>
              <h2 className={`font-semibold text-sm mb-3 ${dark ? 'text-slate-200' : 'text-slate-800'}`}>Account details</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div><dt className={`text-xs mb-0.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Name</dt><dd className={dark ? 'text-slate-200' : 'text-slate-800'}>{currentUser.name}</dd></div>
                <div><dt className={`text-xs mb-0.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Email</dt><dd className={dark ? 'text-slate-200' : 'text-slate-800'}>{currentUser.email}</dd></div>
                <div><dt className={`text-xs mb-0.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Mobile</dt><dd className={dark ? 'text-slate-200' : 'text-slate-800'}>{currentUser.phone}</dd></div>
                <div><dt className={`text-xs mb-0.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Address</dt><dd className={dark ? 'text-slate-200' : 'text-slate-800'}>{currentUser.address}</dd></div>
              </dl>
            </div>

            <div className={card3D(dark, 'rounded-2xl p-5 mb-6')}>
              <h2 className={`font-semibold text-sm mb-1 ${dark ? 'text-slate-200' : 'text-slate-800'}`}>Skills & interests</h2>
              <p className={`text-xs mb-3 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Add each skill one at a time — we use these to sort "Matched for you" on Home. Changes save automatically.</p>
              <SkillsInput skills={currentUser.skills} onChange={updateSkills} dark={dark} />
            </div>

            <div className={card3D(dark, 'rounded-2xl p-5 mb-6')}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className={`font-semibold text-sm mb-1 ${dark ? 'text-slate-200' : 'text-slate-800'}`}>Email alerts</h2>
                  <p className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Get an email when new roles match the skills you've saved above.</p>
                </div>
                <button
                  onClick={() => updateAlertsEnabled(!currentUser.alertsEnabled)}
                  role="switch"
                  aria-checked={currentUser.alertsEnabled}
                  className={`shrink-0 h-7 w-12 rounded-full border transition-colors duration-150 relative ${currentUser.alertsEnabled ? 'bg-emerald-600 border-emerald-600' : (dark ? 'bg-slate-800 border-slate-700' : 'bg-slate-200 border-slate-300')}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-150 ${currentUser.alertsEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>

            <div className={`border rounded-2xl p-5 shadow-[0_10px_24px_-14px_rgba(153,27,27,0.3)] ${dark ? 'border-red-900/50 bg-red-500/5' : 'border-red-200 bg-red-50'}`}>
              <h2 className={`font-semibold text-sm mb-1 ${dark ? 'text-red-400' : 'text-red-700'}`}>Delete account</h2>
              <p className={`text-xs mb-3 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Permanently deletes your login, saved roles and preferences. This cannot be undone.</p>
              <button onClick={() => { if (window.confirm("Delete your account and all data? This can't be undone.")) deleteAccount(); }} className={`h-9 px-4 rounded-lg border text-sm transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ${dark ? 'border-red-800 text-red-400 hover:bg-red-500/10' : 'border-red-300 text-red-700 hover:bg-red-100'}`}>Delete my account & data</button>
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
            <button onClick={() => setShowPrivacy(true)} className={dark ? 'hover:text-slate-300' : 'hover:text-slate-600'}>Privacy Policy</button>
          </div>
        </div>
      </footer>

      <JobDetailModal
        job={openJob}
        saved={!!currentUser && !!openJob && currentUser.savedJobIds.includes(openJob.id)}
        onToggleSave={() => openJob && toggleSave(openJob.id)}
        onClose={closeJob}
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
        onGoogle={signInWithGoogle}
        error={authError}
        onOpenTC={() => setShowTC(true)}
        dark={dark}
      />
      {needsProfileCompletion && (
        <CompleteProfileModal
          initialPhone={currentUser.phone}
          initialAddress={currentUser.address}
          onSendOtp={sendPhoneOtp}
          onVerifyOtp={verifyPhoneOtp}
          onOpenTC={() => setShowTC(true)}
          dark={dark}
        />
      )}
      {showTC && <TCModal onClose={() => setShowTC(false)} dark={dark} />}
      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} dark={dark} />}
      <Toast message={toast} />
    </div>
  );
}

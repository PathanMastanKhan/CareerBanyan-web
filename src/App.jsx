import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Search, MapPin, Bookmark, LogOut, X, Menu, ExternalLink, Sparkles, ShieldCheck, Leaf, Sun, Moon, ChevronLeft, ChevronRight, Plus, Code2, Cpu, Wrench, Building2, FlaskConical, Briefcase, BadgeCheck, Bell, SlidersHorizontal, GraduationCap, RotateCcw } from 'lucide-react';
import { supabase } from './supabaseClient';

// Tracks which email GoogleConfirmModal has already auto-sent a code for
// in this page session — survives React StrictMode's dev-only double-mount
// since it lives on the module, not inside the component.
let googleOtpAutoSent = null;

function initials(name) {
  const clean = (name || '').replace(/\(.*?\)/g, '').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '??';
  if (words.length === 1) return words[0].slice(0, 4).toUpperCase();
  return words.map((w) => w[0]).join('').slice(0, 4).toUpperCase();
}

// Major fields of study Indian students commonly pursue, shown as Category
// filter options even before any live job in that field exists — merged
// with whatever categories are actually present in the data (see CATEGORIES
// memo further down).
const EDUCATION_CATEGORIES = [
  'Computer Science (CSE)',
  'Information Technology (IT)',
  'Electronics & Communication (ECE)',
  'Electrical & Electronics (EEE)',
  'Mechanical Engineering',
  'Civil Engineering',
  'Chemical Engineering',
  'AI & Machine Learning',
  'Data Science',
  'BBA / Business Administration',
  'MBA / Management',
  'B.Com / Commerce',
  'BA / Arts & Humanities',
  'B.Sc / Science',
  'B.Pharmacy / Pharmacy',
  'Law (LLB / LLM)',
  'Medical (MBBS / BDS)',
  'Nursing',
  'B.Ed / Teaching',
  'Hotel Management',
  'CA / CS / CMA',
  'Diploma / ITI',
  'Other',
];

// Lets a search for a common abbreviation also match its full name, and
// vice versa — e.g. searching "mba" also finds "management", "law" also
// finds "llb".
const CATEGORY_ALIASES = [
  ['cse', 'computer science', 'software'],
  ['it', 'information technology'],
  ['ece', 'electronics', 'electronics and communication'],
  ['eee', 'electrical'],
  ['mech', 'mechanical'],
  ['civil'],
  ['chemical', 'chem'],
  ['ai', 'ml', 'artificial intelligence', 'machine learning'],
  ['data science', 'data analytics'],
  ['bba', 'business administration'],
  ['mba', 'management'],
  ['bcom', 'b.com', 'commerce'],
  ['ba', 'arts', 'humanities'],
  ['bsc', 'b.sc', 'science'],
  ['bpharm', 'b.pharmacy', 'pharmacy', 'pharma'],
  ['law', 'llb', 'llm', 'legal'],
  ['mbbs', 'bds', 'medical', 'doctor'],
  ['nursing', 'nurse'],
  ['bed', 'b.ed', 'teaching', 'teacher'],
  ['hotel management', 'hospitality'],
  ['ca', 'cs', 'cma', 'chartered accountant'],
  ['diploma', 'iti'],
];

function expandCategoryTokens(tokens) {
  const expanded = new Set(tokens);
  tokens.forEach((t) => {
    CATEGORY_ALIASES.forEach((group) => {
      if (group.some((alias) => alias === t || alias.includes(t) || t.includes(alias))) {
        group.forEach((alias) => expanded.add(alias));
      }
    });
  });
  return Array.from(expanded);
}

// Derives a friendly "posted via" label from the job's own link, since the
// database doesn't store a separate source field — the domain already
// tells us which platform (or the employer's own site) it came from.
const KNOWN_JOB_SOURCES = [
  ['linkedin.', 'LinkedIn'],
  ['naukri.', 'Naukri'],
  ['indeed.', 'Indeed'],
  ['monster', 'Monster'],
  ['glassdoor.', 'Glassdoor'],
  ['shine.com', 'Shine'],
  ['foundit.', 'foundit'],
  ['instahyre.', 'Instahyre'],
  ['wellfound.', 'Wellfound'],
  ['angel.co', 'Wellfound'],
  ['internshala.', 'Internshala'],
  ['timesjobs.', 'TimesJobs'],
  ['iimjobs.', 'iimjobs'],
  ['adzuna.', 'Adzuna'],
];

function jobSourceLabel(link) {
  if (!link) return null;
  try {
    const host = new URL(link).hostname.replace(/^www\./, '').toLowerCase();
    const known = KNOWN_JOB_SOURCES.find(([needle]) => host.includes(needle));
    if (known) return known[1];
    // Falls back to the employer's own domain — e.g. "wipro.com" → "Wipro".
    const root = host.split('.').slice(0, -1).join('.') || host;
    const name = root.split('.').pop() || root;
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch (e) {
    return null;
  }
}

function matchScore(job, rawTokens) {
  let score = 0;
  const tokens = expandCategoryTokens(rawTokens);
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

const inputCls = (dark) => `w-full h-10 px-3 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${dark ? 'bg-slate-900 border-slate-700 text-slate-50 placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'}`;
const selectCls = (dark) => `h-11 px-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 md:w-48 ${dark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-700'}`;
const selectClsFull = (dark) => `w-full h-11 px-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${dark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-700'}`;
const filterLabelCls = (dark) => `block text-[11px] uppercase tracking-wide font-semibold mb-1.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`;

// ---- Site-wide 3D language --------------------------------------------
// Every raised surface (cards, panels, modals) uses the same layered
// shadow + hover-lift so depth reads consistently across the whole page,
// not just in one hero. Every solid button behaves like a physical 3D
// key: a coloured "edge" beneath it that the button presses into on click.
const card3D = (dark, extra = '') =>
  `${extra} border transition-all duration-300 ease-out will-change-transform ` +
  (dark
    ? 'border-slate-800 bg-slate-900 shadow-[0_1px_1px_rgba(0,0,0,0.4),0_10px_20px_-8px_rgba(0,0,0,0.55),0_28px_44px_-18px_rgba(0,0,0,0.65)] hover:shadow-[0_2px_2px_rgba(0,0,0,0.5),0_18px_30px_-8px_rgba(0,0,0,0.6),0_40px_64px_-18px_rgba(0,0,0,0.7)]'
    : 'border-slate-200 bg-white shadow-[0_1px_1px_rgba(15,23,42,0.04),0_10px_20px_-8px_rgba(15,23,42,0.12),0_28px_44px_-18px_rgba(15,23,42,0.16)] hover:shadow-[0_2px_2px_rgba(15,23,42,0.05),0_18px_30px_-8px_rgba(15,23,42,0.16),0_40px_64px_-18px_rgba(15,23,42,0.2)]') +
  ' hover:-translate-y-1';

const btn3D = (dark, tone = 'blue') => {
  const edge = {
    blue: 'shadow-[0_4px_0_0_rgba(29,78,216,1),0_8px_14px_-4px_rgba(29,78,216,0.45)] active:shadow-[0_1px_0_0_rgba(29,78,216,1),0_2px_4px_-1px_rgba(29,78,216,0.4)]',
    indigo: 'shadow-[0_4px_0_0_rgba(67,56,202,1),0_8px_14px_-4px_rgba(67,56,202,0.45)] active:shadow-[0_1px_0_0_rgba(67,56,202,1),0_2px_4px_-1px_rgba(67,56,202,0.4)]',
    red: 'shadow-[0_4px_0_0_rgba(153,27,27,1),0_8px_14px_-4px_rgba(153,27,27,0.4)] active:shadow-[0_1px_0_0_rgba(153,27,27,1),0_2px_4px_-1px_rgba(153,27,27,0.35)]',
    slate: dark
      ? 'shadow-[0_4px_0_0_rgba(30,41,59,1),0_8px_14px_-4px_rgba(0,0,0,0.5)] active:shadow-[0_1px_0_0_rgba(30,41,59,1),0_2px_4px_-1px_rgba(0,0,0,0.4)]'
      : 'shadow-[0_4px_0_0_rgba(203,213,225,1),0_8px_14px_-4px_rgba(15,23,42,0.15)] active:shadow-[0_1px_0_0_rgba(203,213,225,1),0_2px_4px_-1px_rgba(15,23,42,0.1)]',
  }[tone];
  return `transition-all duration-150 ${edge} hover:-translate-y-0.5 active:translate-y-1`;
};
// -------------------------------------------------------------------------

/* ---------------------------- small presentational bits ---------------------------- */

function NavBtn({ active, onClick, children, dark }) {
  const cls = active ? (dark ? 'text-blue-400 bg-blue-500/10' : 'text-blue-700 bg-blue-50') : (dark ? 'text-slate-400 hover:text-slate-100' : 'text-slate-500 hover:text-slate-800');
  return <button onClick={onClick} className={`px-3 py-2 rounded-lg text-sm font-medium transition ${cls}`}>{children}</button>;
}

function StatTile({ value, label, dark }) {
  return (
    <div className={card3D(dark, 'rounded-xl px-2.5 py-3 sm:px-4 sm:py-4 min-w-0 flex flex-col items-center justify-center text-center')}>
      <div className={`font-display text-lg sm:text-2xl md:text-3xl font-extrabold leading-none truncate ${dark ? 'text-blue-400' : 'text-blue-700'}`}>{value}</div>
      <div className="text-[9px] sm:text-[11px] uppercase tracking-wide text-slate-500 mt-1 truncate">{label}</div>
    </div>
  );
}

function LevelBadge({ level, dark }) {
  const map = dark
    ? { fresher: 'text-blue-400 border-blue-800 bg-blue-500/10', experienced: 'text-indigo-400 border-indigo-800 bg-indigo-500/10', both: 'text-slate-400 border-slate-700 bg-slate-800' }
    : { fresher: 'text-blue-700 border-blue-200 bg-blue-50', experienced: 'text-indigo-700 border-indigo-200 bg-indigo-50', both: 'text-slate-600 border-slate-300 bg-slate-100' };
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

function DebouncedSearchInput({ value, onChange, dark }) {
  const [draft, setDraft] = useState(value);

  // Keep in sync if the value is changed from outside (e.g. "Clear all").
  useEffect(() => { setDraft(value); }, [value]);

  useEffect(() => {
    if (draft === value) return;
    const t = window.setTimeout(() => onChange(draft), 200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      placeholder="Role, company or skill…"
      className={inputCls(dark) + ' h-11 pl-9 pr-3 rounded-xl'}
    />
  );
}

function FilterPanel({ filters, setFilter, clearFilters, activeFilterCount, LOCATIONS, CATEGORIES, dark, onClose }) {
  const pill = (active) => `shrink-0 h-9 px-3.5 rounded-full text-sm font-medium border transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ${active ? 'bg-blue-600 text-white border-blue-600 shadow-[0_3px_0_0_rgba(29,78,216,1)]' : (dark ? 'border-slate-700 text-slate-300 hover:border-slate-600' : 'border-slate-200 text-slate-600 hover:border-slate-300')}`;

  return (
    <div className={card3D(dark, 'rounded-2xl p-4 sm:p-5')}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`font-display font-bold text-base flex items-center gap-2 ${dark ? 'text-slate-100' : 'text-slate-900'}`}>
          <SlidersHorizontal size={16} className="text-blue-600" /> Filters
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-blue-600 text-white text-[11px] font-bold">{activeFilterCount}</span>
          )}
        </h3>
        <div className="flex items-center gap-3">
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className={`text-xs font-semibold flex items-center gap-1 transition-transform active:scale-95 ${dark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-700 hover:text-blue-800'}`}>
              <RotateCcw size={12} /> Clear all
            </button>
          )}
          {onClose && (
            <button onClick={onClose} aria-label="Close filters" className={`lg:hidden transition-transform active:scale-75 ${dark ? 'text-slate-400' : 'text-slate-500'}`}><X size={18} /></button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className={filterLabelCls(dark)}>Search</label>
          <div className="relative">
            <Search size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 ${dark ? 'text-slate-500' : 'text-slate-400'}`} />
            <DebouncedSearchInput value={filters.q} onChange={(v) => setFilter({ q: v })} dark={dark} />
          </div>
        </div>

        <div>
          <label className={filterLabelCls(dark)}>Location</label>
          <select value={filters.loc} onChange={(e) => setFilter({ loc: e.target.value })} className={selectClsFull(dark)}>
            <option>All Locations</option>
            {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
          </select>
        </div>

        <div>
          <label className={filterLabelCls(dark)}>Category / Education</label>
          <select value={filters.cat} onChange={(e) => setFilter({ cat: e.target.value })} className={selectClsFull(dark)}>
            <option>All Categories</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className={filterLabelCls(dark)}>Domain</label>
          <div className="flex flex-wrap gap-2">
            {[['all', 'All roles'], ['it', 'IT roles'], ['nonit', 'Non-IT roles']].map(([val, label]) => (
              <button key={val} onClick={() => setFilter({ domain: val })} className={pill(filters.domain === val)}>{label}</button>
            ))}
          </div>
        </div>

        <div>
          <label className={filterLabelCls(dark)}>Experience level</label>
          <div className="flex flex-wrap gap-2">
            {[['all', 'All levels'], ['fresher', 'Freshers'], ['experienced', 'Experienced']].map(([val, label]) => (
              <button key={val} onClick={() => setFilter({ level: val, eduYear: 'All Years', expYears: 'Any' })} className={pill(filters.level === val)}>{label}</button>
            ))}
          </div>
        </div>

        {filters.level === 'fresher' && (
          <div className="fade-in">
            <label className={filterLabelCls(dark) + ' flex items-center gap-1.5'}><GraduationCap size={13} /> Which year are you in?</label>
            <select value={filters.eduYear} onChange={(e) => setFilter({ eduYear: e.target.value })} className={selectClsFull(dark)}>
              <option>All Years</option>
              <option>1st Year</option>
              <option>2nd Year</option>
              <option>3rd Year</option>
              <option>Final Year</option>
              <option>Already Graduated</option>
            </select>
            <p className={`text-[11px] mt-1.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>1st–3rd year shows internships; Final Year / Graduated shows full-time fresher roles.</p>
          </div>
        )}

        {filters.level === 'experienced' && (
          <div className="fade-in">
            <label className={filterLabelCls(dark)}>Years of experience</label>
            <select value={filters.expYears} onChange={(e) => setFilter({ expYears: e.target.value })} className={selectClsFull(dark)}>
              <option>Any</option>
              <option>0-2 Years</option>
              <option>2-5 Years</option>
              <option>5-10 Years</option>
              <option>10+ Years</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

function JobOrbit({ dark }) {
  // The brand's own mark (a leaf — the "banyan tree") sits at the centre,
  // with the major hiring branches orbiting it like limbs of the tree.
  // Kept flat (no rotateX tilt) — tilting this into a fake 3D floor made
  // the icons land at inconsistent-looking radii and read as scattered
  // rather than a ring. A clean flat ring + drop shadows reads as more
  // "3D" in practice than a distorted ellipse.
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
    <div
      aria-hidden="true"
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      <div
        className={`orbit-floor absolute inset-0 rounded-full ${dark ? 'text-slate-800' : 'text-slate-200'}`}
        style={{ opacity: 0.6 }}
      />

      <div className="orbit-ring absolute inset-0">
        {branches.map(({ Icon, label }, i) => {
          const angle = (360 / branches.length) * i;
          return (
            <div key={label} className="absolute inset-0" style={{ transform: `rotate(${angle}deg)` }}>
              <div className="absolute left-1/2 top-0" style={{ transform: `translate(-50%, ${size / 2 - radius}px)` }}>
                <div style={{ transform: `rotate(${-angle}deg)` }}>
                  <div className="orbit-icon-counter">
                    <div
                      title={label}
                      className={`h-11 w-11 rounded-xl border shadow-md flex items-center justify-center ${dark ? 'bg-slate-900 border-slate-700 text-blue-400' : 'bg-white border-slate-200 text-blue-600'}`}
                    >
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
        <div
          className={`hub-pulse h-16 w-16 rounded-full flex items-center justify-center ring-4 ${dark ? 'bg-gradient-to-br from-blue-500 to-blue-700 ring-slate-950' : 'bg-gradient-to-br from-blue-400 to-blue-600 ring-white'}`}
        >
          <Leaf size={26} className="text-white" />
        </div>
      </div>

      <div
        className={`float-card absolute -top-1 left-1/2 -translate-x-1/2 rounded-xl border shadow-lg px-3 py-1.5 text-[11px] font-semibold flex items-center gap-1.5 whitespace-nowrap ${dark ? 'bg-slate-900 border-slate-700 text-blue-400' : 'bg-white border-slate-200 text-blue-700'}`}
      >
        <BadgeCheck size={13} /> Verified listings
      </div>
      <div
        className={`float-card float-card-delay absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-xl border shadow-lg px-3 py-1.5 text-[11px] font-semibold flex items-center gap-1.5 whitespace-nowrap ${dark ? 'bg-slate-900 border-slate-700 text-amber-400' : 'bg-white border-slate-200 text-amber-700'}`}
      >
        <Bell size={13} /> New role synced
      </div>
    </div>
  );
}

function JobCardInner({ job, saved, onToggleSave, onOpen, currentUser, onRequestAuth, highlight, dark }) {
  const tilt = useTilt();
  const source = jobSourceLabel(job.link);

  return (
    <div
      ref={tilt.ref}
      onClick={() => onOpen(job.id)}
      onMouseMove={tilt.onMouseMove}
      onMouseLeave={tilt.onMouseLeave}
      style={tilt.tiltStyle}
      className={card3D(dark, `relative h-full cursor-pointer rounded-2xl p-5 flex flex-col gap-3 fade-in ${highlight ? (dark ? 'ring-1 ring-blue-800' : 'ring-1 ring-blue-300') : ''}`)}
    >
      {source && (
        <span
          title={`Posted via ${source}`}
          className={`absolute -top-2.5 right-4 px-2 py-0.5 rounded-full text-[10px] font-semibold border shadow-sm ${dark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-500'}`}
        >
          {source}
        </span>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`h-11 w-11 shrink-0 rounded-xl text-white flex items-center justify-center text-[11px] font-bold font-display shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_3px_6px_rgba(0,0,0,0.25)] ${dark ? 'bg-slate-700' : 'bg-slate-900'}`}>{initials(job.company)}</div>
          <div className="min-w-0">
            <div className={`text-xs truncate ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{job.company}</div>
            <h3 className={`font-display font-bold leading-snug line-clamp-2 ${dark ? 'text-slate-50' : 'text-slate-900'}`}>{job.role}</h3>
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSave(job.id); }}
          aria-label={saved ? 'Remove from saved roles' : 'Save this role'}
          className={`h-9 w-9 shrink-0 flex items-center justify-center rounded-lg border transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-90 ${saved ? (dark ? 'border-blue-700 text-blue-400 bg-blue-500/10' : 'border-blue-300 text-blue-600 bg-blue-50') : (dark ? 'border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-600' : 'border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300')}`}
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
          <a href={job.link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className={`text-sm font-semibold flex items-center gap-1 ${dark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-700 hover:text-blue-800'}`}>
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

// Now that onOpen/onToggleSave are stable function references (see
// toggleSave/openJobModal in the main App component) and currentUser only
// changes when auth state actually changes, memoizing here means typing in
// the search box no longer re-renders every visible job card — only the
// ones whose own data actually changed.
const JobCard = React.memo(JobCardInner);

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
                    <span className={dark ? 'text-blue-400 mt-1' : 'text-blue-600 mt-1'}>•</span>
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
          <button onClick={onToggleSave} className={`h-11 px-4 rounded-xl border font-medium text-sm flex items-center gap-2 shrink-0 transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ${saved ? (dark ? 'border-blue-700 text-blue-400 bg-blue-500/10' : 'border-blue-300 text-blue-700 bg-blue-50') : (dark ? 'border-slate-700 text-slate-400 hover:border-slate-600' : 'border-slate-200 text-slate-600 hover:border-slate-300')}`}>
            <Bookmark size={16} fill={saved ? 'currentColor' : 'none'} /> <span className="hidden sm:inline">{saved ? 'Saved' : 'Save role'}</span>
          </button>
          {currentUser ? (
            <a href={job.link} target="_blank" rel="noopener noreferrer" className={`flex-1 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm flex items-center justify-center gap-2 ${btn3D(dark)}`}>
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

function AuthModal({ mode, onClose, onSwitch, onSendOtp, onVerifyOtp, onGoogle, error, onOpenTC, dark }) {
  const [step, setStep] = useState('email'); // 'email' | 'otp'
  const [email, setEmail] = useState('');
  const [agree, setAgree] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    setStep('email');
    setEmail('');
    setAgree(false);
    setCode('');
    setBusy(false);
    setCooldown(0);
    setLocalError('');
  }, [mode]);

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

  if (!mode) return null;
  const isSignup = mode === 'signup';
  const panelBg = dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
  const shownError = localError || error;

  const submitEmail = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return setLocalError('Enter a valid email address.');
    if (isSignup && !agree) return setLocalError('Please accept the Terms & Conditions to continue.');
    setLocalError('');
    setBusy(true);
    const res = await onSendOtp(cleanEmail);
    setBusy(false);
    if (!res.ok) return setLocalError(res.message);
    setCode('');
    setCooldown(30);
    setStep('otp');
  };

  const resend = async () => {
    if (cooldown > 0 || busy) return;
    setLocalError('');
    setBusy(true);
    const res = await onSendOtp(email.trim().toLowerCase());
    setBusy(false);
    if (!res.ok) return setLocalError(res.message);
    setCooldown(30);
  };

  const submitOtp = async (e) => {
    e.preventDefault();
    if (!/^\d{4,8}$/.test(code.trim())) return setLocalError('Enter the code exactly as you received it.');
    setLocalError('');
    setBusy(true);
    const res = await onVerifyOtp(email.trim().toLowerCase(), code);
    setBusy(false);
    if (!res.ok) return setLocalError(res.message);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div className={`modal-pop-3d w-full max-w-md border rounded-2xl shadow-[0_40px_80px_-20px_rgba(0,0,0,0.5)] p-6 max-h-[90vh] overflow-y-auto ${panelBg}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className={`font-display text-xl font-bold ${dark ? 'text-slate-50' : 'text-slate-900'}`}>
            {step === 'otp' ? 'Enter the code' : (isSignup ? 'Create your account' : 'Log in')}
          </h2>
          <button onClick={onClose} aria-label="Close" className={`transition-transform active:scale-75 ${dark ? 'text-slate-500 hover:text-slate-200' : 'text-slate-400 hover:text-slate-700'}`}><X size={20} /></button>
        </div>

        {step === 'email' ? (
          <>
            <p className={`text-sm mb-5 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{isSignup ? "Free to join — no password needed. We'll email you a one-time code." : 'Welcome back — we\'ll email you a one-time code to log in.'}</p>
            {shownError && <div className={`mb-4 text-sm rounded-lg px-3 py-2 border ${dark ? 'text-red-300 bg-red-500/10 border-red-900' : 'text-red-700 bg-red-50 border-red-200'}`}>{shownError}</div>}

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
              <Field label="Email" dark={dark}><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls(dark)} placeholder="priya@example.com" /></Field>
              {isSignup && (
                <label className={`flex items-start gap-2 text-xs pt-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                  <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" />
                  <span>I agree to the <button type="button" onClick={onOpenTC} className={dark ? 'text-blue-400 underline underline-offset-2' : 'text-blue-700 underline underline-offset-2'}>Terms & Conditions</button>, including storage of my email, phone number and address.</span>
                </label>
              )}
              <button type="submit" disabled={busy} className={`w-full h-11 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 mt-2 disabled:opacity-60 disabled:translate-y-0 disabled:shadow-none ${btn3D(dark)}`}>{busy ? 'Sending code…' : 'Send code'}</button>
            </form>

            <p className={`text-sm mt-4 text-center ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
              {isSignup ? 'Already have an account? ' : 'New here? '}
              <button onClick={onSwitch} className={`font-medium hover:underline ${dark ? 'text-blue-400' : 'text-blue-700'}`}>{isSignup ? 'Log in instead' : 'Create an account'}</button>
            </p>
          </>
        ) : (
          <>
            <p className={`text-sm mb-5 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>We sent a code to <strong className={dark ? 'text-slate-200' : 'text-slate-800'}>{email}</strong>.</p>
            {shownError && <div className={`mb-4 text-sm rounded-lg px-3 py-2 border ${dark ? 'text-red-300 bg-red-500/10 border-red-900' : 'text-red-700 bg-red-50 border-red-200'}`}>{shownError}</div>}
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
              <button type="submit" disabled={busy} className={`w-full h-11 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:translate-y-0 disabled:shadow-none ${btn3D(dark)}`}>{busy ? 'Verifying…' : 'Verify & continue'}</button>
              <div className="flex items-center justify-between text-xs pt-1">
                <button type="button" onClick={() => { setStep('email'); setLocalError(''); }} className={dark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}>Change email</button>
                <button type="button" onClick={resend} disabled={cooldown > 0 || busy} className={`disabled:opacity-50 ${dark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-700 hover:text-blue-800'}`}>{cooldown > 0 ? `Resend code (${cooldown}s)` : 'Resend code'}</button>
              </div>
            </form>
          </>
        )}
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
          <h2 className={`font-display text-xl font-bold flex items-center gap-2 ${strong}`}><ShieldCheck size={20} className="text-blue-600" /> Terms & Conditions</h2>
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
          <span key={s} className={`flex items-center gap-1.5 text-xs font-medium pl-2.5 pr-1.5 py-1 rounded-full border ${dark ? 'bg-blue-500/10 text-blue-400 border-blue-800' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
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
        <button type="button" onClick={addSkill} className={`h-10 px-4 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 flex items-center gap-1 shrink-0 ${btn3D(dark)}`}>
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

function GoogleConfirmModal({ email, onSendOtp, onVerifyOtp, dark }) {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const send = async () => {
    setError('');
    setBusy(true);
    const res = await onSendOtp(email);
    setBusy(false);
    if (!res.ok) return setError(res.message);
    setSent(true);
    setCooldown(30);
  };

  useEffect(() => {
    // Module-level (not component-ref) guard: React's StrictMode
    // deliberately mounts, unmounts, and remounts components once in dev,
    // which recreates refs and would otherwise fire the auto-send twice for
    // the same email — wasting a real SMTP send and showing two errors.
    if (googleOtpAutoSent === email) return;
    googleOtpAutoSent = email;
    send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const submit = async (e) => {
    e.preventDefault();
    if (!/^\d{4,8}$/.test(code.trim())) return setError('Enter the code exactly as you received it.');
    setError('');
    setBusy(true);
    const res = await onVerifyOtp(code);
    setBusy(false);
    if (!res.ok) return setError(res.message);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
      <div className={`modal-pop-3d w-full max-w-md border rounded-2xl shadow-[0_40px_80px_-20px_rgba(0,0,0,0.5)] p-6 ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <h2 className={`font-display text-xl font-bold mb-1 ${dark ? 'text-slate-50' : 'text-slate-900'}`}>Confirm your email</h2>
        <p className={`text-sm mb-4 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
          {sent ? <>We sent a code to <strong className={dark ? 'text-slate-200' : 'text-slate-800'}>{email}</strong> — enter it below to continue.</> : 'Sending you a one-time code…'}
        </p>
        {error && <div className={`mb-4 text-sm rounded-lg px-3 py-2 border ${dark ? 'text-red-300 bg-red-500/10 border-red-900' : 'text-red-700 bg-red-50 border-red-200'}`}>{error}</div>}
        <form className="space-y-3" onSubmit={submit}>
          <Field label="Verification code" dark={dark}>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              autoComplete="one-time-code"
              disabled={!sent}
              className={inputCls(dark) + ' tracking-[0.4em] text-center text-lg font-semibold disabled:opacity-50'}
              placeholder="••••••"
              maxLength={8}
            />
          </Field>
          <button type="submit" disabled={busy || !sent} className={`w-full h-11 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:translate-y-0 disabled:shadow-none ${btn3D(dark)}`}>{busy ? 'Verifying…' : 'Verify & continue'}</button>
          <div className="flex items-center justify-end text-xs pt-1">
            <button type="button" onClick={send} disabled={cooldown > 0 || busy} className={`disabled:opacity-50 ${dark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-700 hover:text-blue-800'}`}>{cooldown > 0 ? `Resend code (${cooldown}s)` : 'Resend code'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CompleteProfileModal({ initialName, initialPhone, initialAddress, onSubmit, onOpenTC, dark }) {
  const [name, setName] = useState(initialName || '');
  const [phone, setPhone] = useState(initialPhone || '');
  const [address, setAddress] = useState(initialAddress || '');
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const cleanAddress = address.trim();
    if (!cleanName) return setError('Please tell us your name.');
    if (!/^(\+91[-\s]?)?[6-9]\d{9}$/.test(cleanPhone.replace(/\s+/g, ''))) return setError('Enter a valid 10-digit Indian mobile number.');
    if (!cleanAddress) return setError('Please add your address.');
    if (!agree) return setError('Please accept the Terms & Conditions to continue.');
    setError('');
    setBusy(true);
    const res = await onSubmit(cleanName, cleanPhone, cleanAddress);
    setBusy(false);
    if (res && !res.ok) setError(res.message);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
      <div className={`modal-pop-3d w-full max-w-md border rounded-2xl shadow-[0_40px_80px_-20px_rgba(0,0,0,0.5)] p-6 ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <h2 className={`font-display text-xl font-bold mb-1 ${dark ? 'text-slate-50' : 'text-slate-900'}`}>Just one more thing</h2>
        <p className={`text-sm mb-4 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>A few details to finish setting up your account — these get saved against the email you just verified.</p>
        {error && <div className={`mb-4 text-sm rounded-lg px-3 py-2 border ${dark ? 'text-red-300 bg-red-500/10 border-red-900' : 'text-red-700 bg-red-50 border-red-200'}`}>{error}</div>}
        <form className="space-y-3" onSubmit={submit}>
          <Field label="Full name" dark={dark}><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls(dark)} placeholder="Priya Sharma" /></Field>
          <Field label="Mobile number" dark={dark}><input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls(dark)} placeholder="98765 43210" /></Field>
          <Field label="Address" dark={dark}><textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className={inputCls(dark) + ' resize-none'} placeholder="City, State" /></Field>
          <label className={`flex items-start gap-2 text-xs pt-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" />
            <span>I agree to the <button type="button" onClick={onOpenTC} className={dark ? 'text-blue-400 underline underline-offset-2' : 'text-blue-700 underline underline-offset-2'}>Terms & Conditions</button>, including storage of my email, phone number and address.</span>
          </label>
          <button type="submit" disabled={busy} className={`w-full h-11 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:translate-y-0 disabled:shadow-none ${btn3D(dark)}`}>{busy ? 'Saving…' : 'Save and continue'}</button>
        </form>
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const DEFAULT_FILTERS = { level: 'all', domain: 'all', q: '', loc: 'All Locations', cat: 'All Categories', eduYear: 'All Years', expYears: 'Any' };
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const setFilter = (patch) => setFilters((f) => ({ ...f, ...patch }));
  const clearFilters = () => setFilters(DEFAULT_FILTERS);
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
      hasName: !!meta.name,
      phone: meta.phone || '',
      address: meta.address || '',
      skills: skillsArr,
      savedJobIds: meta.saved_job_ids || [],
      provider: session.user.app_metadata?.provider || 'email',
      googleOtpConfirmed: !!meta.google_otp_confirmed,
    };
  }, [session]);

  // Google already verifies the email address as part of its own login —
  // this extra step is purely for consistency with the email-OTP path, not
  // because Google's sign-in is any less trustworthy. Only applies once,
  // right after a fresh Google login.
  const needsGoogleOtpConfirm =
    !!currentUser && currentUser.provider === 'google' && !currentUser.googleOtpConfirmed;

  // Email is verified via OTP at signup (see sendEmailOtp/verifyEmailOtp).
  // Phone is just a contact detail collected right after — no separate SMS
  // verification, since it's tied to the account by being saved against the
  // already-verified email identity.
  const needsProfileCompletion =
    !!currentUser && !needsGoogleOtpConfirm && (!currentUser.phone || !currentUser.hasName);

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

  const signInWithGoogle = async () => {
    setAuthError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) setAuthError(error.message);
  };

  // Step 1: email OTP. shouldCreateUser lets this work for both signup
  // (creates the account on first verify) and login (existing user just
  // gets a fresh code) — Supabase treats both the same way here.
  const sendEmailOtp = async (email) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (error) {
      // A bare 500 with no real detail (e.g. the SMTP provider rejected the
      // send) can come back with an empty/unhelpful message — don't show
      // the person a raw "{}" or blank string.
      const message = error.message && error.message.trim() && error.message !== '{}'
        ? error.message
        : "Couldn't send the code — check that your email is allowed to receive mail from your SMTP provider yet, and try again.";
      return { ok: false, message };
    }
    return { ok: true };
  };

  // Step 2: confirm the code. On success Supabase sets a real session,
  // which the onAuthStateChange listener below picks up automatically.
  const verifyEmailOtp = async (email, code) => {
    const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'email' });
    if (error) return { ok: false, message: 'That code is incorrect or expired — try again or resend it.' };
    setAuthModal(null);
    showToast('Welcome! You\'re verified and logged in.');
    return { ok: true };
  };

  // Same OTP mechanics as email signup/login, but for the post-Google
  // consistency step: confirms the code, then just flips a flag so this
  // never has to happen again for this account. It doesn't create a new
  // identity — verifyOtp resolves to the same Google-linked user since the
  // email matches, so the person stays logged in exactly as they were.
  const verifyGoogleOtp = async (code) => {
    const { error: verifyError } = await supabase.auth.verifyOtp({ email: currentUser.email, token: code.trim(), type: 'email' });
    if (verifyError) return { ok: false, message: 'That code is incorrect or expired — try again or resend it.' };
    const meta = session.user.user_metadata || {};
    const { data, error } = await supabase.auth.updateUser({ data: { ...meta, google_otp_confirmed: true } });
    if (error) return { ok: false, message: 'Verified, but saving that failed — try again.' };
    setSession((prev) => (prev ? { ...prev, user: data.user } : prev));
    return { ok: true };
  };

  // Runs after email verification (or Google login) whenever the profile
  // is missing a name and/or phone number. Phone here is just a stored
  // contact detail tied to the account — it rides along with the email
  // identity that was already verified via OTP, no separate SMS step.
  const completeProfile = async (name, phone, address) => {
    const meta = session.user.user_metadata || {};
    const { data, error } = await supabase.auth.updateUser({
      data: { ...meta, name, phone, address },
    });
    if (error) return { ok: false, message: 'Could not save — try again.' };
    setSession((prev) => (prev ? { ...prev, user: data.user } : prev));
    showToast('Thanks — your profile is complete.');
    return { ok: true };
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setPage('home');
    showToast('Logged out.');
  };

  const toggleSave = useCallback(async (jobId) => {
    if (!currentUser) { requestAuth(); showToast('Create a free account to save roles.'); return; }
    const has = currentUser.savedJobIds.includes(jobId);
    const nextSaved = has ? currentUser.savedJobIds.filter((id) => id !== jobId) : [...currentUser.savedJobIds, jobId];
    const { data, error } = await supabase.auth.updateUser({ data: { ...session.user.user_metadata, saved_job_ids: nextSaved } });
    if (error) { console.error('toggleSave failed:', error.message); showToast('Could not save — try again.'); return; }
    setSession((prev) => (prev ? { ...prev, user: data.user } : prev));
    showToast(has ? 'Removed from saved roles.' : 'Saved to your list.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, session]);

  const openJobModal = useCallback((jobId) => setOpenJobId(jobId), []);

  const updateSkills = async (skillsArray) => {
    if (!currentUser) return;
    const { data, error } = await supabase.auth.updateUser({ data: { ...session.user.user_metadata, skills: skillsArray } });
    if (error) { console.error('updateSkills failed:', error.message); showToast('Could not update — try again.'); return; }
    setSession((prev) => (prev ? { ...prev, user: data.user } : prev));
    showToast('Preferences updated — recommendations refreshed.');
  };

  const [deletingAccount, setDeletingAccount] = useState(false);
  const deleteAccount = async () => {
    if (!session) return;
    setDeletingAccount(true);
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
        setDeletingAccount(false);
        return;
      }
      await supabase.auth.signOut();
      setPage('home');
      showToast('Your account and data have been deleted.');
    } catch (err) {
      console.error('deleteAccount failed:', err);
      showToast('Could not reach the server — try again in a moment.');
      setDeletingAccount(false);
    }
  };

  const LOCATIONS = useMemo(() => Array.from(new Set(jobs.map((j) => j.city))).sort(), [jobs]);
  const CATEGORIES = useMemo(() => {
    const live = jobs.map((j) => j.category).filter(Boolean);
    return Array.from(new Set([...EDUCATION_CATEGORIES, ...live])).sort();
  }, [jobs]);
  const COMPANIES = useMemo(() => Array.from(new Set(jobs.map((j) => j.company))), [jobs]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.q.trim()) n++;
    if (filters.domain !== 'all') n++;
    if (filters.level !== 'all') n++;
    if (filters.loc !== 'All Locations') n++;
    if (filters.cat !== 'All Categories') n++;
    if (filters.level === 'fresher' && filters.eduYear !== 'All Years') n++;
    if (filters.level === 'experienced' && filters.expYears !== 'Any') n++;
    return n;
  }, [filters]);

  const filteredJobs = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return jobs.filter((job) => {
      if (filters.level !== 'all' && job.level !== filters.level && job.level !== 'both') return false;
      if (filters.domain === 'it' && !job.isIT) return false;
      if (filters.domain === 'nonit' && job.isIT) return false;
      if (filters.loc !== 'All Locations' && job.city !== filters.loc) return false;
      if (filters.cat !== 'All Categories' && job.category !== filters.cat) return false;

      // College-year sub-filter (only meaningful once "Fresher" is picked):
      // earlier-year students are realistically only eligible for
      // internships, so this maps onto the employment-type field that
      // already exists rather than data we don't have.
      if (filters.level === 'fresher' && filters.eduYear !== 'All Years') {
        const isIntern = (job.employmentType || '').toLowerCase().includes('intern');
        if (['1st Year', '2nd Year', '3rd Year'].includes(filters.eduYear) && !isIntern) return false;
        if (['Final Year', 'Already Graduated'].includes(filters.eduYear) && isIntern) return false;
      }

      // Years-of-experience sub-filter (only once "Experienced" is picked):
      // maps onto the existing free-text experience field's ranges.
      if (filters.level === 'experienced' && filters.expYears !== 'Any') {
        const exp = (job.experience || '').toLowerCase();
        const bucket = { '0-2 years': ['0-2', 'fresher'], '2-5 years': ['2-5', '2-4', '3-5'], '5-10 years': ['5-10', '5+', '5-8'], '10+ years': ['10+', '10-'] }[filters.expYears.toLowerCase()] || [];
        if (bucket.length && !bucket.some((b) => exp.includes(b))) return false;
      }

      if (q) {
        const words = q.split(/[\s,]+/).filter(Boolean);
        const hay = `${job.company} ${job.role} ${job.category} ${job.city} ${job.skills.join(' ')}`.toLowerCase();
        const matchesAll = words.every((w) => expandCategoryTokens([w]).some((alias) => hay.includes(alias)));
        if (!matchesAll) return false;
      }
      return true;
    }).sort((a, b) => a.daysAgo - b.daysAgo);
  }, [filters, jobs]);

  const recommended = useMemo(() => {
    if (!currentUser || !currentUser.skills || currentUser.skills.length === 0) return [];
    const tokens = currentUser.skills.map((s) => s.toLowerCase().trim()).filter((s) => s.length > 1);
    if (!tokens.length) return [];
    const scored = jobs.map((job) => ({ job, score: matchScore(job, tokens) })).filter((x) => x.score > 0);
    scored.sort((a, b) => b.score - a.score || a.job.daysAgo - b.job.daysAgo);
    return scored.slice(0, 6).map((x) => x.job);
  }, [currentUser, jobs]);

  const openJob = openJobId ? jobs.find((j) => j.id === openJobId) : null;

  if (!authLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-body">
        <div className="text-blue-700 text-sm font-medium">Loading CareerBanyan…</div>
      </div>
    );
  }

  const jobCardProps = (job, highlight) => ({
    job, highlight, dark,
    saved: !!currentUser && currentUser.savedJobIds.includes(job.id),
    onToggleSave: toggleSave,
    onOpen: openJobModal,
    currentUser,
    onRequestAuth: requestAuth,
  });

  return (
    <div className={`min-h-screen font-body ${dark ? 'bg-slate-950 text-slate-50' : 'bg-slate-50 text-slate-900'}`}>
      {/* nav */}
      <div className={`border-b sticky top-0 z-40 backdrop-blur shadow-[0_2px_2px_rgba(0,0,0,0.03),0_8px_20px_-10px_rgba(15,23,42,0.15)] ${dark ? 'bg-slate-950/95 border-slate-800' : 'bg-white/95 border-slate-200'}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <button onClick={goHome} className="flex items-center gap-2 shrink-0 transition-transform hover:-translate-y-0.5 active:translate-y-0 active:scale-95">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 text-white flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_10px_rgba(29,78,216,0.4)]"><Leaf size={18} /></div>
            <span className={`font-display font-extrabold text-lg tracking-tight hidden sm:inline ${dark ? 'text-slate-50' : 'text-slate-900'}`}>Career<span className="text-blue-600">Banyan</span></span>
          </button>

          <nav className="hidden md:flex items-center gap-1">
            {currentUser && <NavBtn active={page === 'saved'} onClick={() => setPage('saved')} dark={dark}>Saved ({currentUser.savedJobIds.length})</NavBtn>}
            {currentUser && <NavBtn active={page === 'profile'} onClick={() => setPage('profile')} dark={dark}>Profile</NavBtn>}
          </nav>

          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} className={`hidden md:flex h-9 w-9 items-center justify-center rounded-lg border transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-90 ${dark ? 'border-slate-700 text-amber-400 hover:border-slate-600' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            {currentUser ? (
              <>
                <span className={`hidden md:inline text-sm ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Hi, {currentUser.name.split(' ')[0]}</span>
                <button onClick={handleLogout} className={`hidden md:flex text-sm h-9 px-3 rounded-lg border items-center gap-1.5 transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ${dark ? 'border-slate-700 text-slate-300 hover:border-slate-600' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}><LogOut size={14} /> <span>Log out</span></button>
              </>
            ) : (
              <>
                <button onClick={() => { setAuthError(''); setAuthModal('login'); }} className={`hidden md:inline-flex text-sm h-9 px-3 rounded-lg border transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ${dark ? 'border-slate-700 text-slate-300 hover:border-slate-600' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>Log in</button>
                <button onClick={() => { setAuthError(''); setAuthModal('signup'); }} className={`hidden md:inline-flex text-sm h-9 px-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 ${btn3D(dark)}`}>Sign up free</button>
              </>
            )}
            <button className={`md:hidden h-9 w-9 flex items-center justify-center rounded-lg border transition-all duration-150 active:scale-90 ${dark ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-600'}`} onClick={() => setMobileNav((v) => !v)} aria-label="Menu"><Menu size={16} /></button>
          </div>
        </div>
        {mobileNav && (
          <div className={`md:hidden border-t px-4 py-3 flex flex-col gap-1 ${dark ? 'border-slate-800' : 'border-slate-200'}`}>
            {currentUser && <NavBtn active={page === 'saved'} onClick={() => { setPage('saved'); setMobileNav(false); }} dark={dark}>Saved ({currentUser.savedJobIds.length})</NavBtn>}
            {currentUser && <NavBtn active={page === 'profile'} onClick={() => { setPage('profile'); setMobileNav(false); }} dark={dark}>Profile</NavBtn>}
            <button onClick={() => { toggleTheme(); setMobileNav(false); }} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-left ${dark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}>
              {dark ? <Sun size={15} /> : <Moon size={15} />} {dark ? 'Light mode' : 'Dark mode'}
            </button>
            {currentUser ? (
              <button onClick={() => { handleLogout(); setMobileNav(false); }} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-left ${dark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}>
                <LogOut size={15} /> Log out
              </button>
            ) : (
              <>
                <button onClick={() => { setAuthError(''); setAuthModal('login'); setMobileNav(false); }} className={`px-3 py-2 rounded-lg text-sm font-medium text-left ${dark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}>
                  Log in
                </button>
                <button onClick={() => { setAuthError(''); setAuthModal('signup'); setMobileNav(false); }} className={`mt-1 h-10 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 ${btn3D(dark)}`}>
                  Sign up free
                </button>
              </>
            )}
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
            <section className={`relative overflow-hidden mb-6 rounded-3xl border p-6 sm:p-8 bg-gradient-to-br shadow-[0_1px_1px_rgba(0,0,0,0.03),0_20px_50px_-24px_rgba(15,23,42,0.35)] ${dark ? 'from-blue-500/5 via-slate-950 to-indigo-500/5 border-slate-800' : 'from-blue-50 via-white to-indigo-50 border-slate-200'}`}>
              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-6">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-2">Fresher & experienced roles · Across India</div>
                  <h1 className={`font-display text-3xl sm:text-4xl font-extrabold leading-tight max-w-xl ${dark ? 'text-slate-50' : 'text-slate-900'}`}>New roles land here first. Yours could be next.</h1>
                  <p className={`mt-2 max-w-lg text-sm sm:text-base ${dark ? 'text-slate-400' : 'text-slate-600'}`}>Engineering, management, law, medicine and everything between — filter it your way, then jump straight to the company's own site and apply. Always free.</p>
                </div>
                <div className="hidden lg:flex shrink-0 justify-center">
                  <JobOrbit dark={dark} />
                </div>
              </div>

              <div className="relative z-10 grid grid-cols-3 gap-2 sm:gap-3">
                <StatTile value={jobs.length} label="Live roles" dark={dark} />
                <StatTile value={jobs.filter((j) => j.daysAgo === 0).length} label="New today" dark={dark} />
                <StatTile value={COMPANIES.length} label="Employers" dark={dark} />
              </div>
            </section>

            {/* Mobile filter trigger — the full panel lives in <aside> below,
                shown as a static sidebar on desktop and a slide-in drawer here. */}
            <button
              onClick={() => setFiltersOpen(true)}
              className={`lg:hidden w-full mb-6 h-12 px-4 rounded-xl border font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-150 active:scale-[0.98] ${btn3D(dark, 'slate')} ${dark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'}`}
            >
              <SlidersHorizontal size={16} /> Filters
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-blue-600 text-white text-[11px] font-bold">{activeFilterCount}</span>
              )}
            </button>

            <div className="lg:grid lg:grid-cols-[280px_1fr] lg:gap-6 lg:items-start">
              <aside className="hidden lg:block lg:sticky lg:top-20">
                <FilterPanel
                  filters={filters}
                  setFilter={setFilter}
                  clearFilters={clearFilters}
                  activeFilterCount={activeFilterCount}
                  LOCATIONS={LOCATIONS}
                  CATEGORIES={CATEGORIES}
                  dark={dark}
                />
              </aside>

              {filtersOpen && (
                <div className="lg:hidden fixed inset-0 z-50 flex">
                  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setFiltersOpen(false)} />
                  <div className="modal-pop-3d relative w-[85vw] max-w-xs h-full overflow-y-auto p-4">
                    <FilterPanel
                      filters={filters}
                      setFilter={setFilter}
                      clearFilters={clearFilters}
                      activeFilterCount={activeFilterCount}
                      LOCATIONS={LOCATIONS}
                      CATEGORIES={CATEGORIES}
                      dark={dark}
                      onClose={() => setFiltersOpen(false)}
                    />
                  </div>
                </div>
              )}

              <div className="min-w-0">
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
                          <Sparkles size={16} className="text-blue-600" />
                          <h2 className={`font-display font-bold text-lg ${dark ? 'text-slate-100' : 'text-slate-900'}`}>Matched for you</h2>
                          <span className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-500'}`}>based on the skills saved in your profile</span>
                        </div>
                        <Carousel dark={dark} items={recommended} renderItem={(job) => <JobCard {...jobCardProps(job, true)} />} />
                      </section>
                    )}
                    {currentUser && recommended.length === 0 && (
                      <div className={`mb-8 border rounded-xl px-4 py-3 text-sm ${dark ? 'border-slate-800 bg-slate-900 text-slate-400' : 'border-slate-200 bg-white text-slate-500'}`}>
                        Add a few skills in <button onClick={() => setPage('profile')} className={dark ? 'text-blue-400 underline underline-offset-2' : 'text-blue-700 underline underline-offset-2'}>your profile</button> and we'll match roles to you here.
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
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                          {filteredJobs.map((job) => <JobCard key={job.id} {...jobCardProps(job, false)} />)}
                        </div>
                      )}
                    </section>
                  </>
                )}
              </div>
            </div>

            {!currentUser && (
              <div className={`mt-8 border rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all duration-300 hover:-translate-y-1 ${dark ? 'border-blue-800 bg-blue-500/5 shadow-[0_10px_30px_-14px_rgba(59,130,246,0.35)] hover:shadow-[0_18px_40px_-14px_rgba(59,130,246,0.45)]' : 'border-blue-200 bg-blue-50 shadow-[0_10px_30px_-14px_rgba(59,130,246,0.3)] hover:shadow-[0_18px_40px_-14px_rgba(59,130,246,0.4)]'}`}>
                <div>
                  <div className={`font-display font-bold text-base ${dark ? 'text-slate-100' : 'text-slate-900'}`}>Get roles matched to you</div>
                  <div className={`text-sm mt-1 ${dark ? 'text-slate-400' : 'text-slate-600'}`}>Create a free account to unlock Apply, save roles, and see picks based on your skills.</div>
                </div>
                <button onClick={() => { setAuthError(''); setAuthModal('signup'); }} className={`h-10 px-5 rounded-lg bg-blue-600 text-white font-semibold shrink-0 hover:bg-blue-700 ${btn3D(dark)}`}>Sign up free</button>
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
                    <button onClick={() => setPage('home')} className={`mt-4 h-9 px-4 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 ${btn3D(dark)}`}>Browse roles</button>
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

            <div className={`border rounded-2xl p-5 shadow-[0_10px_24px_-14px_rgba(153,27,27,0.3)] ${dark ? 'border-red-900/50 bg-red-500/5' : 'border-red-200 bg-red-50'}`}>
              <h2 className={`font-semibold text-sm mb-1 ${dark ? 'text-red-400' : 'text-red-700'}`}>Delete account</h2>
              <p className={`text-xs mb-3 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Permanently deletes your login, saved roles and preferences. This cannot be undone.</p>
              <button
                onClick={() => { if (window.confirm("Delete your account and all data? This can't be undone.")) deleteAccount(); }}
                disabled={deletingAccount}
                className={`h-9 px-4 rounded-lg border text-sm transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 disabled:opacity-60 disabled:translate-y-0 ${dark ? 'border-red-800 text-red-400 hover:bg-red-500/10' : 'border-red-300 text-red-700 hover:bg-red-100'}`}
              >
                {deletingAccount ? 'Deleting…' : 'Delete my account & data'}
              </button>
            </div>
          </section>
        )}
      </main>

      <footer className={`border-t mt-12 ${dark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-white'}`}>
        <div className={`max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
          <div>
            <span className={`font-display font-bold ${dark ? 'text-slate-300' : 'text-slate-700'}`}>Career<span className="text-blue-600">Banyan</span></span>
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
        onSendOtp={sendEmailOtp}
        onVerifyOtp={verifyEmailOtp}
        onGoogle={signInWithGoogle}
        error={authError}
        onOpenTC={() => setShowTC(true)}
        dark={dark}
      />
      {needsGoogleOtpConfirm && (
        <GoogleConfirmModal
          email={currentUser.email}
          onSendOtp={sendEmailOtp}
          onVerifyOtp={verifyGoogleOtp}
          dark={dark}
        />
      )}
      {needsProfileCompletion && (
        <CompleteProfileModal
          initialName={currentUser.hasName ? currentUser.name : ''}
          initialPhone={currentUser.phone}
          initialAddress={currentUser.address}
          onSubmit={completeProfile}
          onOpenTC={() => setShowTC(true)}
          dark={dark}
        />
      )}
      {showTC && <TCModal onClose={() => setShowTC(false)} dark={dark} />}
      <Toast message={toast} />
    </div>
  );
}

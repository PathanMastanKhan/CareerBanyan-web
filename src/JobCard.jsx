import React, { useMemo, useState, useRef } from 'react';
import { MapPin, Bookmark, ExternalLink, ChevronLeft, ChevronRight, Code2, Cpu, Wrench, Building2, FlaskConical, Briefcase, BadgeCheck, Bell, Leaf } from 'lucide-react';
import { track } from '@vercel/analytics';
import { initials } from '../lib/matching';
import { card3D } from '../lib/styles';
import { useTilt } from '../hooks/useTilt';
import { LevelBadge, DomainBadge, FreshBadge, SalaryText } from './atoms';

export function JobOrbit({ dark }) {
  const branches = [
    { Icon: Code2, label: 'CSE / IT' },
    { Icon: Cpu, label: 'ECE' },
    { Icon: Wrench, label: 'Mechanical' },
    { Icon: Building2, label: 'Civil' },
    { Icon: FlaskConical, label: 'Chemical' },
    { Icon: Briefcase, label: 'Non-IT' },
  ];
  const size = 200;
  const radius = 86;

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
                    <div title={label} className={`h-10 w-10 rounded-xl border shadow-md flex items-center justify-center ${dark ? 'bg-slate-900 border-slate-700 text-emerald-400' : 'bg-white border-slate-200 text-emerald-600'}`}>
                      <Icon size={17} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className={`hub-pulse h-14 w-14 rounded-full flex items-center justify-center ring-4 ${dark ? 'bg-gradient-to-br from-emerald-500 to-emerald-700 ring-slate-950' : 'bg-gradient-to-br from-emerald-400 to-emerald-600 ring-white'}`}>
          <Leaf size={22} className="text-white" />
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

// Adzuna never gives us a company website, so this is a best-effort guess:
// strip common legal suffixes (Pvt Ltd, Technologies, etc.) and punctuation,
// then try that as a .com domain against Clearbit's free logo API. This
// works well for recognizable brand names (Amazon, Infosys, Flipkart...)
// and silently fails over to the initials avatar for anything obscure or
// wrong — there's no way to know in advance which it'll be.
function guessCompanyDomain(company) {
  if (!company || company === 'Unknown employer') return null;
  const cleaned = company
    .toLowerCase()
    .replace(/\b(pvt\.?|private|ltd\.?|limited|llp|inc\.?|corp\.?|corporation|co\.?|company|india|technologies|technology|solutions|services|group|consulting)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
  if (!cleaned || cleaned.length < 3) return null;
  return `${cleaned}.com`;
}

export function CompanyLogo({ company, dark }) {
  const domain = useMemo(() => guessCompanyDomain(company), [company]);
  const [failed, setFailed] = useState(false);

  if (!domain || failed) {
    return (
      <div className={`h-11 w-11 shrink-0 rounded-xl text-white flex items-center justify-center text-[11px] font-bold font-display shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_3px_6px_rgba(0,0,0,0.25)] ${dark ? 'bg-slate-700' : 'bg-slate-900'}`}>
        {initials(company)}
      </div>
    );
  }
  return (
    <img
      src={`https://logo.clearbit.com/${domain}?size=88`}
      alt=""
      onError={() => setFailed(true)}
      className={`h-11 w-11 shrink-0 rounded-xl object-contain bg-white border p-1 ${dark ? 'border-slate-700' : 'border-slate-200'}`}
    />
  );
}

export const JobCard = React.memo(function JobCard({ job, saved, onToggleSave, onOpen, currentUser, onRequestAuth, highlight, dark }) {
  const tilt = useTilt();

  return (
    <div
      ref={tilt.ref}
      onClick={() => { track('job_card_open', { category: job.category, isIT: job.isIT }); onOpen(job.id); }}
      onMouseMove={tilt.onMouseMove}
      onMouseLeave={tilt.onMouseLeave}
      style={tilt.tiltStyle}
      className={card3D(dark, `h-full cursor-pointer rounded-2xl p-5 flex flex-col gap-3 fade-in ${highlight ? (dark ? 'ring-1 ring-emerald-800' : 'ring-1 ring-emerald-300') : ''}`)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <CompanyLogo company={job.company} dark={dark} />
          <div className="min-w-0">
            <div className={`text-xs truncate ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{job.company}</div>
            <h3 className={`font-display font-bold leading-snug line-clamp-2 ${dark ? 'text-slate-50' : 'text-slate-900'}`}>{job.role}</h3>
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSave(job.id); }}
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
          <a href={job.link} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.stopPropagation(); track('job_apply_click', { category: job.category, isIT: job.isIT }); }} className={`text-sm font-semibold flex items-center gap-1 ${dark ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-700 hover:text-emerald-800'}`}>
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
});

export function Carousel({ items, renderItem, dark }) {
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

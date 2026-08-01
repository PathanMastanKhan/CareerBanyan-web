import { Search } from 'lucide-react';
import { STUDY_YEARS, COURSE_CATEGORIES } from '../lib/matching';
import { inputCls, selectCls, pillCls, card3D } from '../lib/styles';

export function FilterPanel({ filters, setLevel, setExpYears, setStudyYear, setCourse, setDomain, setLoc, searchInput, setSearchInput, clearFilters, LOCATIONS, dark }) {
  return (
    <div className={card3D(dark, 'rounded-2xl p-4 space-y-5')}>
      <div>
        <div className={`text-[11px] uppercase tracking-wide font-semibold mb-2 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Search</div>
        <div className="relative">
          <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${dark ? 'text-slate-500' : 'text-slate-400'}`} />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Role, company or skill…"
            className={inputCls(dark) + ' h-11 pl-9 pr-3 rounded-xl'}
          />
        </div>
      </div>

      <div>
        <div className={`text-[11px] uppercase tracking-wide font-semibold mb-2 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Location</div>
        <select value={filters.loc} onChange={(e) => setLoc(e.target.value)} className={selectCls(dark) + ' w-full'}>
          <option>All Locations</option>
          {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
        </select>
      </div>

      <div>
        <div className={`text-[11px] uppercase tracking-wide font-semibold mb-2 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Role type</div>
        <div className="flex flex-wrap gap-2">
          {[['all', 'All roles'], ['it', 'IT roles'], ['nonit', 'Non-IT roles']].map(([val, label]) => (
            <button key={val} onClick={() => setDomain(val)} className={pillCls(dark, filters.domain === val)}>{label}</button>
          ))}
        </div>
      </div>

      <div>
        <div className={`text-[11px] uppercase tracking-wide font-semibold mb-2 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Experience level</div>
        <div className="flex flex-wrap gap-2">
          {[['all', 'All levels'], ['fresher', 'Freshers'], ['experienced', 'Experienced']].map(([val, label]) => (
            <button key={val} onClick={() => setLevel(val)} className={pillCls(dark, filters.level === val)}>{label}</button>
          ))}
        </div>

        {filters.level === 'experienced' && (
          <div className="mt-3">
            <div className={`text-[11px] uppercase tracking-wide font-semibold mb-2 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Years of experience</div>
            <select value={filters.expYears} onChange={(e) => setExpYears(e.target.value)} className={selectCls(dark) + ' w-full'}>
              <option value="all">Any</option>
              {['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map((y) => (
                <option key={y} value={y}>{y} year{y === '1' ? '' : 's'}</option>
              ))}
              <option value="10+">10+ years</option>
            </select>
          </div>
        )}

        {filters.level === 'fresher' && (
          <div className="mt-3">
            <div className={`text-[11px] uppercase tracking-wide font-semibold mb-2 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Year of study</div>
            <select value={filters.studyYear} onChange={(e) => setStudyYear(e.target.value)} className={selectCls(dark) + ' w-full'}>
              <option value="all">Any</option>
              {STUDY_YEARS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
        )}
      </div>

      <div>
        <div className={`text-[11px] uppercase tracking-wide font-semibold mb-2 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Course / degree background</div>
        <select value={filters.course} onChange={(e) => setCourse(e.target.value)} className={selectCls(dark) + ' w-full'}>
          <option value="all">All courses</option>
          {COURSE_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          <option value="general">Any graduate / general</option>
        </select>
      </div>

      <button onClick={clearFilters} className={`w-full h-10 rounded-lg border text-sm font-medium transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ${dark ? 'border-slate-700 text-slate-300 hover:border-slate-600' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
        Clear all filters
      </button>
    </div>
  );
}


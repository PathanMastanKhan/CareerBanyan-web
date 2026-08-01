import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense, lazy } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LogOut, X, Menu, Sparkles, Leaf, Sun, Moon } from 'lucide-react';
import { track } from '@vercel/analytics';
import { supabase } from './supabaseClient';

import {
  matchScore, inferCategoryFromSkills, classifyCourseCategory,
  DEFAULT_FILTERS, expYearsInRange, matchesStudyYear,
} from './lib/matching';
import { useDocumentHead } from './lib/seo';
import { card3D, btn3D, pillCls } from './lib/styles';

import { NavBtn, StatTile, Toggle, Toast } from './components/atoms';
import { JobOrbit, JobCard, Carousel } from './components/JobCard';
import { SkillsInput } from './components/SkillsInput';
import { FilterPanel } from './components/FilterPanel';

// Most visitors land on Home and never open a modal on their first click —
// splitting these into their own chunk keeps them out of the JS everyone
// has to download and parse just to see the job list.
const JobDetailModal = lazy(() => import('./components/Modals').then((m) => ({ default: m.JobDetailModal })));
const AuthModal = lazy(() => import('./components/Modals').then((m) => ({ default: m.AuthModal })));
const PhoneGateModal = lazy(() => import('./components/Modals').then((m) => ({ default: m.PhoneGateModal })));
const TCModal = lazy(() => import('./components/Modals').then((m) => ({ default: m.TCModal })));
const ConfirmModal = lazy(() => import('./components/Modals').then((m) => ({ default: m.ConfirmModal })));
const JobNotFoundModal = lazy(() => import('./components/Modals').then((m) => ({ default: m.JobNotFoundModal })));

export default function App() {
  const navigate = useNavigate();
  const params = useParams();
  const openJobId = params.id || null;

  const [authLoaded, setAuthLoaded] = useState(false);
  const [session, setSession] = useState(null);

  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);

  const [page, setPage] = useState('home');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authError, setAuthError] = useState('');
  const [showTC, setShowTC] = useState(false);
  const [showBanner, setShowBanner] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [phoneBusy, setPhoneBusy] = useState(false);

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  // How many cards to actually render in the "All roles" grid at once.
  // Rendering all ~600+ jobs as full cards (each with a logo image and a
  // hover-tilt listener) at the same time was the main cause of both slow
  // first paint and laggy scrolling — this caps the initial DOM/image work
  // and reveals more only when asked.
  const PAGE_SIZE = 24;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => ({ ...f, q: searchInput }));
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setSearchInput('');
  };
  const setLevel = (val) => { track('filter_level', { value: val }); setFilters((f) => ({ ...f, level: val, expYears: 'all', studyYear: 'all' })); };
  const setExpYears = (val) => setFilters((f) => ({ ...f, expYears: val }));
  const setStudyYear = (val) => setFilters((f) => ({ ...f, studyYear: val }));
  const setCourse = (val) => { track('filter_course', { value: val }); setFilters((f) => ({ ...f, course: val })); };
  const setDomain = (val) => { track('filter_domain', { value: val }); setFilters((f) => ({ ...f, domain: val })); };
  const setLoc = (val) => { track('filter_location', { value: val }); setFilters((f) => ({ ...f, loc: val })); };

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
    let cancelled = false;

    // A single .limit(500) request used to cap the whole site at 500 jobs.
    // Supabase projects also cap each individual request at a max-rows
    // setting (1000 by default), so instead of one big request we page
    // through in safe 500-row batches and keep going until either we hit
    // MAX_JOBS or the server has no more rows to give us.
    async function loadJobs() {
      const PAGE_SIZE = 500;
      const MAX_JOBS = 5000; // safety cap only — well above anything the current or planned sync buckets will produce
      let all = [];
      let from = 0;
      while (all.length < MAX_JOBS) {
        const to = from + PAGE_SIZE - 1;
        const { data, error } = await supabase
          .from('jobs')
          .select('id, company, role, level, is_it, city, category, experience, salary, employment_type, skills, description, posted_at, link')
          .eq('is_active', true)
          .order('posted_at', { ascending: false })
          .range(from, to);
        if (error) {
          console.error('Failed to load jobs:', error.message);
          break;
        }
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < PAGE_SIZE) break; // no more rows left on the server
        from += PAGE_SIZE;
      }
      if (cancelled) return;
      const mapped = all.map((d) => ({
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
      const withCourses = mapped.map((j) => ({ ...j, courseCategory: classifyCourseCategory(j) }));
      setJobs(withCourses);
      setJobsLoading(false);
    }

    loadJobs();
    return () => { cancelled = true; };
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
      skills: skillsArr,
      savedJobIds: meta.saved_job_ids || [],
      alertsEnabled: !!meta.alerts_enabled,
      phone: meta.phone || '',
      // 'fresher' | 'experienced' | '' (not set) — self-reported once, on
      // the profile page. Used to nudge "Matched for you" and email alerts
      // toward jobs pitched at the right level, on top of skill matching.
      experienceLevel: meta.experience_level || '',
    };
  }, [session]);

  const requestAuth = useCallback(() => { setAuthError(''); setAuthModalOpen(true); }, []);

  const goHome = () => {
    setPage('home');
    clearFilters();
    setMobileNav(false);
    navigate('/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const sendEmailOtp = async (name, email) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setAuthError('Enter a valid email address.');
      return { ok: false };
    }
    setAuthError('');
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: true,
          data: name.trim() ? { name: name.trim() } : undefined,
        },
      });
      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('already registered') || msg.includes('identity')) {
          setAuthError('This email already has an account via Google — tap "Continue with Google" instead.');
        } else {
          setAuthError(error.message || 'Could not send the code. Please try again.');
        }
        return { ok: false };
      }
      return { ok: true };
    } catch (err) {
      console.error('sendEmailOtp failed:', err);
      setAuthError('Could not reach the server. Check your connection and try again.');
      return { ok: false };
    }
  };

  const handleVerifyOtp = async (email, code) => {
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code.trim(),
        type: 'email',
      });
      if (error) { setAuthError('That code is incorrect or expired — try again or resend it.'); return { ok: false }; }
      setAuthError('');
      setAuthModalOpen(false);
      showToast('Welcome to CareerBanyan!');
      return { ok: true };
    } catch (err) {
      console.error('handleVerifyOtp failed:', err);
      setAuthError('Could not reach the server. Try again.');
      return { ok: false };
    }
  };

  const signInWithGoogle = async () => {
    setAuthError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) setAuthError(error.message);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setPage('home');
    navigate('/');
    showToast('Logged out.');
  };

  const updateUserMetadata = useCallback(async (patch) => {
    const { data: latest } = await supabase.auth.getSession();
    const currentMeta = latest?.session?.user?.user_metadata || {};
    const { data, error } = await supabase.auth.updateUser({ data: { ...currentMeta, ...patch } });
    if (error) throw error;
    setSession((prev) => (prev ? { ...prev, user: data.user } : prev));
    return data;
  }, []);

  const toggleSave = useCallback(async (jobId) => {
    if (!currentUser) { requestAuth(); showToast('Create a free account to save roles.'); return; }
    const has = currentUser.savedJobIds.includes(jobId);
    const nextSaved = has ? currentUser.savedJobIds.filter((id) => id !== jobId) : [...currentUser.savedJobIds, jobId];
    try {
      await updateUserMetadata({ saved_job_ids: nextSaved });
      showToast(has ? 'Removed from saved roles.' : 'Saved to your list.');
    } catch (err) {
      console.error('toggleSave failed:', err.message);
      showToast('Could not save — try again.');
    }
  }, [currentUser, requestAuth, showToast, updateUserMetadata]);

  const updateSkills = async (skillsArray) => {
    if (!currentUser) return;
    try {
      await updateUserMetadata({ skills: skillsArray });
      showToast('Preferences updated — recommendations refreshed.');
    } catch (err) {
      console.error('updateSkills failed:', err.message);
      showToast('Could not update — try again.');
    }
  };

  const updateAlerts = async (enabled) => {
    if (!currentUser) return;
    try {
      await updateUserMetadata({ alerts_enabled: enabled });
      showToast(enabled ? 'Email alerts turned on.' : 'Email alerts turned off.');
    } catch (err) {
      console.error('updateAlerts failed:', err.message);
      showToast('Could not update alert settings — try again.');
    }
  };

  const updateExperienceLevel = async (level) => {
    if (!currentUser) return;
    try {
      await updateUserMetadata({ experience_level: level });
      showToast('Preferences updated — recommendations refreshed.');
    } catch (err) {
      console.error('updateExperienceLevel failed:', err.message);
      showToast('Could not update — try again.');
    }
  };

  const submitPhone = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    const cleaned = phoneDraft.replace(/\D/g, '');
    const normalized = cleaned.length === 12 && cleaned.startsWith('91') ? cleaned.slice(2) : cleaned;
    if (normalized.length !== 10) {
      setPhoneError('Enter a valid 10-digit mobile number.');
      return;
    }
    setPhoneError('');
    setPhoneBusy(true);
    try {
      await updateUserMetadata({ phone: normalized });
      // Also store phone + email in the public `profiles` table so they're
      // queryable directly from the database (see supabase/profiles.sql).
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: currentUser.id,
        email: currentUser.email,
        phone: normalized,
        updated_at: new Date().toISOString(),
      });
      if (profileError) {
        // Metadata save already succeeded, so the user isn't blocked — but
        // log this so it's visible the `profiles` table/policy needs setup.
        console.error('profiles upsert failed:', profileError.message);
      }
      showToast('Thanks — your number has been saved.');
    } catch (err) {
      console.error('submitPhone failed:', err.message);
      setPhoneError('Could not save your number — try again.');
    } finally {
      setPhoneBusy(false);
    }
  };

  const deleteAccount = async () => {
    if (!session) return;
    setDeleteBusy(true);
    try {
      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error('deleteAccount failed:', json.error || res.status, json.debug || '');
        showToast(json.error || 'Could not delete your account — try again.');
        setDeleteBusy(false);
        return;
      }
      setDeleteBusy(false);
      setConfirmDeleteOpen(false);
      await supabase.auth.signOut();
      setPage('home');
      navigate('/');
      showToast('Your account and data have been deleted.');
    } catch (err) {
      console.error('deleteAccount failed:', err);
      showToast('Could not reach the server — try again in a moment.');
      setDeleteBusy(false);
    }
  };

  const LOCATIONS = useMemo(() => Array.from(new Set(jobs.map((j) => j.city))).sort(), [jobs]);
  const COMPANIES = useMemo(() => Array.from(new Set(jobs.map((j) => j.company))), [jobs]);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [filters]);

  const filteredJobs = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return jobs.filter((job) => {
      if (filters.level !== 'all' && job.level !== filters.level && job.level !== 'both') return false;
      if (filters.level === 'experienced' && !expYearsInRange(job.experience, filters.expYears)) return false;
      if (filters.level === 'fresher' && !matchesStudyYear(job, filters.studyYear)) return false;
      if (filters.course !== 'all' && job.courseCategory !== filters.course) return false;
      if (filters.domain === 'it' && !job.isIT) return false;
      if (filters.domain === 'nonit' && job.isIT) return false;
      if (filters.loc !== 'All Locations' && job.city !== filters.loc) return false;
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
    if (!currentUser || !currentUser.skills || currentUser.skills.length === 0) return [];
    const tokens = currentUser.skills.map((s) => s.toLowerCase().trim()).filter((s) => s.length > 1);
    if (!tokens.length) return [];
    const scored = jobs.map((job) => ({ job, score: matchScore(job, tokens, currentUser.experienceLevel) })).filter((x) => x.score > 0);
    scored.sort((a, b) => b.score - a.score || a.job.daysAgo - b.job.daysAgo);
    let picks = scored.slice(0, 6).map((x) => x.job);
    // If direct skill matches are thin (skills are real but just don't show
    // up verbatim in any live posting right now), fill remaining slots with
    // recent jobs from the course category their skills point to, so this
    // section isn't empty just because of exact-text mismatches.
    if (picks.length < 6) {
      const category = inferCategoryFromSkills(tokens);
      if (category) {
        const already = new Set(picks.map((j) => j.id));
        const extra = jobs
          .filter((j) => !already.has(j.id) && j.courseCategory === category)
          .sort((a, b) => a.daysAgo - b.daysAgo)
          .slice(0, 6 - picks.length);
        picks = picks.concat(extra);
      }
    }
    return picks;
  }, [currentUser, jobs]);

  const openJob = openJobId ? jobs.find((j) => String(j.id) === String(openJobId)) : null;

  useDocumentHead(openJob);

  const handleOpenJob = useCallback((jobId) => navigate(`/job/${jobId}`), [navigate]);

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
    onToggleSave: toggleSave,
    onOpen: handleOpenJob,
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
                <button onClick={() => { setAuthError(''); setAuthModalOpen(true); }} className={`text-sm h-9 px-3 rounded-lg border transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ${dark ? 'border-slate-700 text-slate-300 hover:border-slate-600' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>Log in</button>
                <button onClick={() => { setAuthError(''); setAuthModalOpen(true); }} className={`text-sm h-9 px-3 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 ${btn3D(dark)}`}>Sign up free</button>
              </>
            )}
            {currentUser && (
              <button className={`md:hidden h-9 w-9 flex items-center justify-center rounded-lg border transition-all duration-150 active:scale-90 ${dark ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-600'}`} onClick={() => setMobileNav((v) => !v)} aria-label="Menu"><Menu size={16} /></button>
            )}
          </div>
        </div>
        {mobileNav && currentUser && (
          <div className={`md:hidden border-t px-4 py-3 flex flex-col gap-1 ${dark ? 'border-slate-800' : 'border-slate-200'}`}>
            <NavBtn active={page === 'saved'} onClick={() => { setPage('saved'); setMobileNav(false); }} dark={dark}>Saved ({currentUser.savedJobIds.length})</NavBtn>
            <NavBtn active={page === 'profile'} onClick={() => { setPage('profile'); setMobileNav(false); }} dark={dark}>Profile</NavBtn>
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
          <div className="flex flex-col lg:flex-row gap-6">
            <aside className="lg:w-72 shrink-0 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
              <FilterPanel
                filters={filters}
                setLevel={setLevel}
                setExpYears={setExpYears}
                setStudyYear={setStudyYear}
                setCourse={setCourse}
                setDomain={setDomain}
                setLoc={setLoc}
                searchInput={searchInput}
                setSearchInput={setSearchInput}
                clearFilters={clearFilters}
                LOCATIONS={LOCATIONS}
                dark={dark}
              />
            </aside>

            <div className="flex-1 min-w-0">
              <section className={`relative overflow-hidden mb-8 rounded-3xl border p-6 sm:p-8 bg-gradient-to-br shadow-[0_1px_1px_rgba(0,0,0,0.03),0_20px_50px_-24px_rgba(15,23,42,0.35)] ${dark ? 'from-emerald-500/5 via-slate-950 to-indigo-500/5 border-slate-800' : 'from-emerald-50 via-white to-indigo-50 border-slate-200'}`}>
                <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-2">Fresher & experienced roles · Across India</div>
                    <h1 className={`font-display text-3xl sm:text-4xl font-extrabold leading-tight max-w-xl ${dark ? 'text-slate-50' : 'text-slate-900'}`}>New roles land here first. Yours could be next.</h1>
                    <p className={`mt-2 max-w-lg text-sm sm:text-base ${dark ? 'text-slate-400' : 'text-slate-600'}`}>Freshers to veterans, IT to everything else — set your filters on the left, then jump straight to the company's own site and apply. Always free.</p>
                    <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-5">
                      <StatTile value={jobs.length} label="Live roles" dark={dark} />
                      <StatTile value={jobs.filter((j) => j.daysAgo === 0).length} label="New today" dark={dark} />
                      <StatTile value={COMPANIES.length} label="Employers" dark={dark} />
                    </div>
                  </div>
                  <div className="hidden xl:flex shrink-0 justify-center">
                    <JobOrbit dark={dark} />
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
                              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                              className={`h-10 px-5 rounded-lg border text-sm font-medium transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ${dark ? 'border-slate-700 text-slate-300 hover:border-slate-600' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                            >
                              Show more roles ({filteredJobs.length - visibleCount} remaining)
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
                  <button onClick={() => { setAuthError(''); setAuthModalOpen(true); }} className={`h-10 px-5 rounded-lg bg-emerald-600 text-white font-semibold shrink-0 hover:bg-emerald-700 ${btn3D(dark)}`}>Sign up free</button>
                </div>
              )}
            </div>
          </div>
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
                <div><dt className={`text-xs mb-0.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Mobile number</dt><dd className={dark ? 'text-slate-200' : 'text-slate-800'}>{currentUser.phone ? `+91 ${currentUser.phone}` : '—'}</dd></div>
              </dl>
            </div>

            <div className={card3D(dark, 'rounded-2xl p-5 mb-6')}>
              <h2 className={`font-semibold text-sm mb-1 ${dark ? 'text-slate-200' : 'text-slate-800'}`}>Skills & interests</h2>
              <p className={`text-xs mb-3 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Add each skill one at a time — we use these to sort "Matched for you" on Home. Changes save automatically.</p>
              <SkillsInput skills={currentUser.skills} onChange={updateSkills} dark={dark} currentUser={currentUser} />
            </div>

            <div className={card3D(dark, 'rounded-2xl p-5 mb-6')}>
              <h2 className={`font-semibold text-sm mb-1 ${dark ? 'text-slate-200' : 'text-slate-800'}`}>Experience level</h2>
              <p className={`text-xs mb-3 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Helps us rank "Matched for you" and email alerts toward roles pitched at your level, on top of your skills.</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { val: 'fresher', label: 'Fresher / student' },
                  { val: 'experienced', label: 'Experienced' },
                  { val: '', label: 'Not sure yet' },
                ].map(({ val, label }) => (
                  <button key={label} onClick={() => updateExperienceLevel(val)} className={pillCls(dark, currentUser.experienceLevel === val)}>{label}</button>
                ))}
              </div>
            </div>

            <div className={card3D(dark, 'rounded-2xl p-5 mb-6')}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className={`font-semibold text-sm mb-1 ${dark ? 'text-slate-200' : 'text-slate-800'}`}>Email job alerts</h2>
                  <p className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Get a daily email when new roles matching your skills go live. Uses the skills list above.</p>
                </div>
                <Toggle checked={currentUser.alertsEnabled} onChange={updateAlerts} dark={dark} label="Email job alerts" />
              </div>
              {currentUser.alertsEnabled && currentUser.skills.length === 0 && (
                <p className={`text-xs mt-3 ${dark ? 'text-amber-400' : 'text-amber-700'}`}>Add at least one skill above so we know what to match you against.</p>
              )}
            </div>

            <div className={`border rounded-2xl p-5 shadow-[0_10px_24px_-14px_rgba(153,27,27,0.3)] ${dark ? 'border-red-900/50 bg-red-500/5' : 'border-red-200 bg-red-50'}`}>
              <h2 className={`font-semibold text-sm mb-1 ${dark ? 'text-red-400' : 'text-red-700'}`}>Delete account</h2>
              <p className={`text-xs mb-3 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Permanently deletes your login, saved roles and preferences. This cannot be undone.</p>
              <button onClick={() => setConfirmDeleteOpen(true)} className={`h-9 px-4 rounded-lg border text-sm transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ${dark ? 'border-red-800 text-red-400 hover:bg-red-500/10' : 'border-red-300 text-red-700 hover:bg-red-100'}`}>Delete my account & data</button>
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

      <Suspense fallback={null}>
        {openJobId && !jobsLoading && !openJob ? (
          <JobNotFoundModal onClose={() => navigate('/')} dark={dark} />
        ) : (
          <JobDetailModal
            job={openJob}
            saved={!!currentUser && !!openJob && currentUser.savedJobIds.includes(openJob.id)}
            onToggleSave={() => openJob && toggleSave(openJob.id)}
            onClose={() => navigate('/')}
            currentUser={currentUser}
            onRequestAuth={requestAuth}
            dark={dark}
          />
        )}

        <AuthModal
          open={authModalOpen}
          onClose={() => { setAuthModalOpen(false); setAuthError(''); }}
          onSendOtp={sendEmailOtp}
          onVerifyOtp={handleVerifyOtp}
          onGoogle={signInWithGoogle}
          error={authError}
          onOpenTC={() => setShowTC(true)}
          dark={dark}
        />
        {showTC && <TCModal onClose={() => setShowTC(false)} dark={dark} />}
        <ConfirmModal
          open={confirmDeleteOpen}
          title="Delete your account?"
          body="This permanently deletes your login, saved roles and preferences. This can't be undone."
          confirmLabel="Delete my account"
          busy={deleteBusy}
          onConfirm={deleteAccount}
          onCancel={() => { if (!deleteBusy) setConfirmDeleteOpen(false); }}
          dark={dark}
        />
        <PhoneGateModal
          open={!!currentUser && !currentUser.phone}
          name={currentUser ? currentUser.name : ''}
          phoneDraft={phoneDraft}
          setPhoneDraft={setPhoneDraft}
          phoneError={phoneError}
          phoneBusy={phoneBusy}
          onSubmit={submitPhone}
          dark={dark}
        />
      </Suspense>
      <Toast message={toast} />
    </div>
  );
}

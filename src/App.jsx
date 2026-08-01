import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search, MapPin, Bookmark, LogOut, X, Menu, ExternalLink, Sparkles, ShieldCheck, Leaf, Sun, Moon, ChevronLeft, ChevronRight, Plus, Code2, Cpu, Wrench, Building2, FlaskConical, Briefcase, BadgeCheck, Bell } from 'lucide-react';
import { track } from '@vercel/analytics';
import { supabase } from './supabaseClient';

export const SITE_URL = 'https://careerbanyan.vercel.app';

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
  const descText = (job.description || []).join(' ').toLowerCase();
  tokens.forEach((t) => {
    if (skillsLower.some((s) => s.includes(t) || t.includes(s))) score += 3;
    if (role.includes(t)) score += 3;
    if (descText.includes(t)) score += 2;
    if (category.includes(t)) score += 1;
    // Multi-word skills (e.g. "machine learning") rarely appear verbatim in
    // a short job title, so also give partial credit for each individual
    // word of 4+ letters — weighted lower so it nudges ranking rather than
    // dominating it.
    if (t.includes(' ')) {
      const hay = `${role} ${descText} ${category}`;
      const words = t.split(' ').filter((w) => w.length > 3);
      const hits = words.filter((w) => hay.includes(w)).length;
      if (hits > 0) score += hits;
    }
  });
  return score;
}

// Fallback used when a person's skills score few or no direct job matches
// (e.g. their skills are real but just don't appear verbatim in any live
// posting right now). Infers which course-category their skill set points
// to, so "Matched for you" can still surface relevant roles instead of
// staying empty.
const SKILL_CATEGORY_HINTS = {
  engineering: ['java', 'python', 'c++', 'c#', 'javascript', 'typescript', 'html', 'css', 'react', 'node', 'angular', 'vue', 'autocad', 'solidworks', 'embedded', 'vlsi', 'plc', 'networking', 'cybersecurity', 'android', 'ios', 'flutter', 'php', 'ruby', 'golang', 'rust', '.net', 'django', 'flask', 'devops', 'aws', 'azure', 'docker', 'kubernetes', 'git', 'machine learning', 'data structures', 'algorithms'],
  computer_apps: ['software testing', 'manual testing', 'automation testing', 'it support', 'network administration', 'dbms', 'sql'],
  science: ['biology', 'microbiology', 'chemistry', 'physics', 'biotechnology', 'bioinformatics', 'lab techniques', 'data science', 'data analysis', 'r programming', 'statistics'],
  pharmacy: ['pharmacology', 'pharmacovigilance', 'clinical research', 'drug safety', 'gmp', 'quality control'],
  commerce: ['accounting', 'tally', 'gst', 'taxation', 'auditing', 'bookkeeping', 'financial analysis', 'sap fico'],
  management: ['marketing', 'digital marketing', 'seo', 'sales', 'business development', 'hr', 'recruitment', 'project management', 'crm'],
  law: ['legal drafting', 'contract law', 'litigation', 'compliance', 'paralegal'],
  arts: ['content writing', 'copywriting', 'journalism', 'graphic design', 'video editing', 'teaching', 'translation'],
};

function inferCategoryFromSkills(tokens) {
  const hay = tokens.join(' ');
  let best = null;
  let bestCount = 0;
  for (const [cat, keys] of Object.entries(SKILL_CATEGORY_HINTS)) {
    const count = keys.filter((k) => hay.includes(k)).length;
    if (count > bestCount) { bestCount = count; best = cat; }
  }
  return best;
}

const COURSE_CATEGORIES = [
  { key: 'engineering', label: 'B.Tech / B.E. (Engineering)', keywords: ['engineer', 'engineering', 'b.tech', 'btech', 'mechanical', 'civil', 'electrical', 'electronics', 'ece', 'software developer', 'developer', 'devops', 'embedded'] },
  { key: 'computer_apps', label: 'BCA / MCA (Computer Applications)', keywords: ['bca', 'mca', 'software tester', 'qa engineer', 'it support', 'network admin'] },
  { key: 'science', label: 'B.Sc / M.Sc (Science)', keywords: ['b.sc', 'bsc', 'm.sc', 'msc', 'lab technician', 'chemist', 'biology', 'microbiology', 'research assistant', 'data scientist', 'data analyst'] },
  { key: 'pharmacy', label: 'B.Pharmacy / Pharmacy', keywords: ['pharmacist', 'pharmacy', 'pharma', 'pharmaceutical', 'drug safety', 'medical representative'] },
  { key: 'commerce', label: 'B.Com / M.Com (Commerce)', keywords: ['accountant', 'accounting', 'b.com', 'bcom', 'taxation', 'audit', 'bookkeeping', 'finance executive', 'gst'] },
  { key: 'management', label: 'BBA / MBA (Management)', keywords: ['mba', 'bba', 'management trainee', 'business analyst', 'marketing executive', 'sales executive', 'hr executive', 'operations manager', 'business development'] },
  { key: 'law', label: 'LLB / Law', keywords: ['lawyer', 'legal', 'llb', 'advocate', 'paralegal', 'compliance officer', 'legal counsel'] },
  { key: 'arts', label: 'BA / MA (Arts & Humanities)', keywords: ['content writer', 'journalist', 'ba ', 'humanities', 'social work', 'teacher', 'copywriter', 'translator'] },
];

function classifyCourseCategory(job) {
  const hay = `${job.role} ${job.category} ${(job.skills || []).join(' ')} ${(job.description || []).join(' ')}`.toLowerCase();
  for (const cat of COURSE_CATEGORIES) {
    if (cat.keywords.some((k) => hay.includes(k))) return cat.key;
  }
  return 'general';
}

// A curated list of real, recognizable skills/tools/competencies across every
// course category this site supports. Profile "skills" are checked against
// this list (case-insensitive, loosely) so people can only add actual skills
// — not their own name, a random word, or a tag — into their profile.
const KNOWN_SKILLS = [
  // Engineering / IT
  'java', 'python', 'c', 'c++', 'c#', 'javascript', 'typescript', 'react', 'react.js', 'node', 'node.js',
  'angular', 'vue', 'vue.js', 'html', 'css', 'sql', 'mysql', 'postgresql', 'mongodb', 'firebase',
  'aws', 'azure', 'gcp', 'google cloud', 'docker', 'kubernetes', 'git', 'github', 'linux', 'unix',
  'devops', 'ci/cd', 'jenkins', 'rest api', 'graphql', 'microservices', 'machine learning', 'deep learning',
  'artificial intelligence', 'data structures', 'algorithms', 'oop', 'dbms', 'operating systems',
  'computer networks', 'autocad', 'solidworks', 'ansys', 'catia', 'creo', 'matlab', 'simulink',
  'embedded systems', 'embedded c', 'plc', 'scada', 'vlsi', 'verilog', 'networking', 'cybersecurity',
  'ethical hacking', 'penetration testing', 'android', 'android development', 'ios', 'ios development',
  'flutter', 'kotlin', 'swift', 'php', 'ruby', 'ruby on rails', 'golang', 'go', 'rust', 'scala',
  '.net', 'asp.net', 'spring', 'spring boot', 'django', 'flask', 'fastapi', 'selenium', 'manual testing',
  'automation testing', 'software testing', 'sap', 'sap abap', 'salesforce', 'power bi', 'tableau',
  'excel', 'advanced excel', 'vba', 'r', 'r programming', 'hadoop', 'spark', 'big data', 'data science',
  'data analysis', 'data analytics', 'data engineering', 'etl', 'blockchain', 'iot', 'ar/vr', 'unity',
  'unreal engine', 'ui/ux', 'ui design', 'ux design', 'figma', 'wordpress', 'shopify', 'jira',
  'agile', 'scrum', 'it support', 'network administration', 'system administration', 'cloud computing',
  // Science
  'biology', 'microbiology', 'biotechnology', 'bioinformatics', 'chemistry', 'physics', 'zoology',
  'botany', 'genetics', 'biochemistry', 'lab techniques', 'lab technician', 'research methodology',
  'statistics', 'gis', 'environmental science', 'food technology', 'nanotechnology',
  // Pharmacy
  'pharmacology', 'pharmacovigilance', 'clinical research', 'clinical trials', 'drug safety',
  'quality control', 'quality assurance', 'gmp', 'regulatory affairs', 'formulation development',
  'medical coding', 'medical representative',
  // Commerce / finance
  'accounting', 'financial accounting', 'tally', 'tally erp', 'gst', 'taxation', 'income tax',
  'auditing', 'bookkeeping', 'financial analysis', 'financial modeling', 'sap fico', 'costing',
  'banking', 'investment banking', 'equity research', 'stock market', 'mutual funds', 'insurance',
  'payroll', 'budgeting', 'cost accounting', 'ca', 'cma', 'cfa',
  // Management / marketing / hr
  'marketing', 'digital marketing', 'seo', 'sem', 'social media marketing', 'content marketing',
  'email marketing', 'brand management', 'sales', 'business development', 'business analysis',
  'operations management', 'project management', 'product management', 'supply chain management',
  'logistics', 'procurement', 'human resources', 'hr', 'recruitment', 'talent acquisition',
  'payroll management', 'employee engagement', 'training and development', 'customer relationship management',
  'crm', 'event management', 'retail management', 'e-commerce', 'negotiation',
  // Law
  'legal drafting', 'contract law', 'corporate law', 'litigation', 'compliance', 'paralegal',
  'intellectual property', 'legal research', 'labour law', 'criminal law', 'civil law', 'llb',
  // Arts / humanities / media
  'content writing', 'copywriting', 'technical writing', 'creative writing', 'journalism',
  'editing', 'proofreading', 'translation', 'teaching', 'tutoring', 'social work', 'counselling',
  'graphic design', 'photography', 'videography', 'video editing', 'animation', 'illustration',
  'public relations', 'mass communication', 'psychology', 'history', 'political science', 'economics',
  // General / soft skills
  'communication', 'communication skills', 'leadership', 'teamwork', 'problem solving',
  'critical thinking', 'time management', 'customer service', 'presentation skills', 'ms office',
  'microsoft office', 'powerpoint', 'word', 'typing', 'data entry', 'analytical skills',
];

function normalizeSkillText(s) {
  return s.toLowerCase().trim().replace(/[.\-_]/g, ' ').replace(/\s+/g, ' ');
}

function isKnownSkill(value) {
  const norm = normalizeSkillText(value);
  return KNOWN_SKILLS.some((k) => {
    const nk = normalizeSkillText(k);
    if (norm === nk) return true;
    // Only allow "contains" matching (e.g. "React JS" vs "react") once both
    // sides are at least 4 characters — short entries like "hr" or "go"
    // would otherwise false-match as substrings of unrelated words (e.g.
    // "hr" is hiding inside the surname "Sharma").
    if (norm.length >= 4 && nk.length >= 4 && (norm.includes(nk) || nk.includes(norm))) return true;
    return false;
  });
}

function looksLikePersonName(value, currentUser) {
  const norm = normalizeSkillText(value);
  if (!norm) return false;
  if (currentUser) {
    const name = normalizeSkillText(currentUser.name || '');
    const emailLocal = normalizeSkillText((currentUser.email || '').split('@')[0] || '');
    if (name && (norm === name || name.includes(norm))) return true;
    if (emailLocal && (norm === emailLocal || emailLocal.includes(norm))) return true;
  }
  return false;
}

function setMetaTag(attrName, attrValue, content) {
  let tag = document.head.querySelector(`meta[${attrName}="${attrValue}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attrName, attrValue);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function setCanonical(href) {
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

const DEFAULT_TITLE = 'CareerBanyan — Jobs for India';
const DEFAULT_DESC = 'Fresher and experienced job listings across India, updated daily.';

function useDocumentHead(job) {
  useEffect(() => {
    if (job) {
      const title = `${job.role} at ${job.company} — CareerBanyan`;
      const rawDesc = `${job.role} at ${job.company} in ${job.city}. ${job.description && job.description[0] ? job.description[0] : ''}`;
      const desc = rawDesc.length > 160 ? `${rawDesc.slice(0, 157)}...` : rawDesc;
      const url = `${SITE_URL}/job/${job.id}`;

      document.title = title;
      setMetaTag('name', 'description', desc);
      setMetaTag('property', 'og:title', title);
      setMetaTag('property', 'og:description', desc);
      setMetaTag('property', 'og:url', url);
      setCanonical(url);
    } else {
      document.title = DEFAULT_TITLE;
      setMetaTag('name', 'description', DEFAULT_DESC);
      setMetaTag('property', 'og:title', DEFAULT_TITLE);
      setMetaTag('property', 'og:description', DEFAULT_DESC);
      setMetaTag('property', 'og:url', `${SITE_URL}/`);
      setCanonical(`${SITE_URL}/`);
    }
  }, [job]);
}

const inputCls = (dark) => `w-full h-10 px-3 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${dark ? 'bg-slate-900 border-slate-700 text-slate-50 placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'}`;
const selectCls = (dark) => `h-11 px-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${dark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-700'}`;
const pillCls = (dark, active) => `shrink-0 h-9 px-4 rounded-full text-sm font-medium border transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ${active ? 'bg-emerald-600 text-white border-emerald-600 shadow-[0_3px_0_0_rgba(4,120,87,1)]' : (dark ? 'border-slate-700 text-slate-300 hover:border-slate-600' : 'border-slate-200 text-slate-600 hover:border-slate-300')}`;

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
  return `transition-all duration-150 ${edge} hover:-translate-y-0.5 active:translate-y-0.5`;
};

function NavBtn({ active, onClick, children, dark }) {
  const cls = active ? (dark ? 'text-emerald-400 bg-emerald-500/10' : 'text-emerald-700 bg-emerald-50') : (dark ? 'text-slate-400 hover:text-slate-100' : 'text-slate-500 hover:text-slate-800');
  return <button onClick={onClick} className={`px-3 py-2 rounded-lg text-sm font-medium transition ${cls}`}>{children}</button>;
}

function StatTile({ value, label, dark }) {
  return (
    <div className={card3D(dark, 'rounded-xl px-3 py-3 sm:px-4 min-w-0')}>
      <div className={`font-display text-xl sm:text-2xl md:text-3xl font-extrabold leading-none ${dark ? 'text-emerald-400' : 'text-emerald-700'}`}>{value}</div>
      <div className="text-[10px] sm:text-[11px] uppercase tracking-wide text-slate-500 mt-1">{label}</div>
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
  const rafRef = useRef(null);
  const pendingRef = useRef(null);

  useEffect(() => {
    try {
      const hoverOk = window.matchMedia('(hover: hover)').matches;
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      enabledRef.current = hoverOk && !reduceMotion;
    } catch (e) {
      enabledRef.current = false;
    }
  }, []);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const flush = () => {
    rafRef.current = null;
    if (pendingRef.current) setTiltStyle(pendingRef.current);
  };

  const onMouseMove = (e) => {
    if (!enabledRef.current || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rotateY = (x - 0.5) * 8;
    const rotateX = (0.5 - y) * 8;
    pendingRef.current = {
      transform: `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`,
      transition: 'transform 0.05s linear, box-shadow 0.2s ease',
    };
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(flush);
  };

  const onMouseLeave = () => {
    if (!enabledRef.current) return;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
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

function CompanyLogo({ company, dark }) {
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

const JobCard = React.memo(function JobCard({ job, saved, onToggleSave, onOpen, currentUser, onRequestAuth, highlight, dark }) {
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

function AuthModal({ open, onClose, onSendOtp, onVerifyOtp, onGoogle, error, onOpenTC, dark }) {
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

function PhoneGateModal({ open, name, phoneDraft, setPhoneDraft, phoneError, phoneBusy, onSubmit, dark }) {
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
          <p><strong className={strong}>Your data.</strong> When you create an account, your email address is stored so we can manage your login, personalize job recommendations against your saved skills, and send you relevant job alerts and application updates.</p>
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

function ConfirmModal({ open, title, body, confirmLabel, onConfirm, onCancel, dark, busy, danger = true }) {
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

function JobNotFoundModal({ onClose, dark }) {
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

function SkillsInput({ skills, onChange, dark, currentUser }) {
  const [draft, setDraft] = useState('');
  const [skillError, setSkillError] = useState('');

  const addSkill = () => {
    const val = draft.trim();
    setSkillError('');
    if (!val) return;
    if (val.length < 2 || val.length > 30) {
      setSkillError('Skill should be 2–30 characters.');
      return;
    }
    if (!/^[a-zA-Z0-9][a-zA-Z0-9+#./\- ]*$/.test(val)) {
      setSkillError("That doesn't look like a valid skill.");
      return;
    }
    if (looksLikePersonName(val, currentUser)) {
      setSkillError('That looks like a name, not a skill — add things like "Java" or "Content Writing" instead.');
      return;
    }
    if (!isKnownSkill(val)) {
      setSkillError('We don\u2019t recognize that as a skill yet. Try a specific skill, tool or competency (e.g. "Excel", "Tally", "Digital Marketing").');
      return;
    }
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
      {skillError && <p className={`text-xs mb-2 ${dark ? 'text-red-400' : 'text-red-600'}`}>{skillError}</p>}
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setSkillError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
          placeholder="e.g. Java — press Enter or tap Add"
          list="cb-known-skills"
          className={inputCls(dark)}
        />
        <datalist id="cb-known-skills">
          {KNOWN_SKILLS.map((s) => <option key={s} value={s} />)}
        </datalist>
        <button type="button" onClick={addSkill} className={`h-10 px-4 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 flex items-center gap-1 shrink-0 ${btn3D(dark)}`}>
          <Plus size={14} /> Add
        </button>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, dark, label }) {
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

function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-[0_20px_40px_-12px_rgba(0,0,0,0.5)] fade-in">
      {message}
    </div>
  );
}

/* ---------------------------------- main app ---------------------------------- */

const DEFAULT_FILTERS = { level: 'all', domain: 'all', q: '', loc: 'All Locations', expYears: 'all', studyYear: 'all', course: 'all' };

const STUDY_YEARS = [
  { key: '1', label: '1st year', keywords: ['1st year', 'first year', 'year 1'] },
  { key: '2', label: '2nd year', keywords: ['2nd year', 'second year', 'year 2'] },
  { key: '3', label: '3rd year', keywords: ['3rd year', 'third year', 'year 3'] },
  { key: '4', label: '4th / final year', keywords: ['4th year', 'fourth year', 'final year', 'year 4', 'last year'] },
  { key: 'completed', label: 'Completed / graduated', keywords: [] },
];

// Parses a job's free-text experience string (e.g. "3-5 years", "5+ years",
// "2 yrs", "Fresher") into a [min, max] range in years. Returns null when the
// string carries no usable number (e.g. "See official listing"), so callers
// can tell "doesn't match" apart from "we don't know".
function parseExperienceRange(expStr) {
  if (!expStr) return null;
  const s = String(expStr).toLowerCase();
  if (/fresher|no experience|entry.?level/.test(s)) return [0, 0];
  const rangeMatch = s.match(/(\d+)\s*(?:-|to)\s*(\d+)/);
  if (rangeMatch) return [parseInt(rangeMatch[1], 10), parseInt(rangeMatch[2], 10)];
  const plusMatch = s.match(/(\d+)\s*\+/);
  if (plusMatch) return [parseInt(plusMatch[1], 10), Infinity];
  const singleMatch = s.match(/(\d+)/);
  if (singleMatch) {
    const n = parseInt(singleMatch[1], 10);
    return [n, n];
  }
  return null;
}

// `exactYear` is either 'all', a specific year as a string ('0'..'9'), or
// '10+'. A job matches if its parsed experience range overlaps that year.
function expYearsInRange(expStr, exactYear) {
  if (exactYear === 'all') return true;
  const range = parseExperienceRange(expStr);
  if (!range) return false;
  const [jobMin, jobMax] = range;
  if (exactYear === '10+') return jobMax >= 10;
  const year = parseInt(exactYear, 10);
  return year >= jobMin && year <= jobMax;
}

// Job postings don't carry a structured "year of study" field the way they
// carry experience — this is a best-effort keyword match against the role
// title and description text. "Completed / graduated" intentionally matches
// everything (it's the default assumption for a fresher-level listing that
// doesn't call out a specific student year).
function matchesStudyYear(job, studyYear) {
  if (studyYear === 'all') return true;
  if (studyYear === 'completed') return true;
  const entry = STUDY_YEARS.find((s) => s.key === studyYear);
  if (!entry || entry.keywords.length === 0) return true;
  const hay = `${job.role} ${(job.description || []).join(' ')}`.toLowerCase();
  return entry.keywords.some((k) => hay.includes(k));
}

/* ---- reusable filter panel, used inside the left sidebar ---- */
function FilterPanel({ filters, setLevel, setExpYears, setStudyYear, setCourse, setDomain, setLoc, searchInput, setSearchInput, clearFilters, LOCATIONS, dark }) {
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
      const MAX_JOBS = 3000;
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
    const scored = jobs.map((job) => ({ job, score: matchScore(job, tokens) })).filter((x) => x.score > 0);
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
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredJobs.map((job) => <JobCard key={job.id} {...jobCardProps(job, false)} />)}
                      </div>
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
      <Toast message={toast} />
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
    </div>
  );
}

// Job-matching, categorization, and skills logic shared across the app.
// Split out of App.jsx so this pure logic can be tested/edited without
// touching any rendering code.

export const SITE_URL = 'https://careerbanyan.vercel.app';

export function initials(name) {
  const clean = (name || '').replace(/\(.*?\)/g, '').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '??';
  if (words.length === 1) return words[0].slice(0, 4).toUpperCase();
  return words.map((w) => w[0]).join('').slice(0, 4).toUpperCase();
}

export function matchScore(job, tokens, experienceLevel = '') {
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
  // Self-reported experience level nudges ranking rather than filtering
  // anything out — a fresher's skills might still be a strong match for a
  // job tagged "experienced", and we don't want to hide that. It just
  // shouldn't outrank an equally-skill-matched job pitched at their level.
  if (experienceLevel === 'fresher') {
    if (job.level === 'fresher') score += 2;
    else if (job.level === 'both') score += 1;
    else if (job.level === 'experienced') score -= 2;
  } else if (experienceLevel === 'experienced') {
    if (job.level === 'experienced') score += 2;
    else if (job.level === 'both') score += 1;
    else if (job.level === 'fresher') score -= 2;
  }
  return score;
}

export const SKILL_CATEGORY_HINTS = {
  engineering: ['java', 'python', 'c++', 'c#', 'javascript', 'typescript', 'html', 'css', 'react', 'node', 'angular', 'vue', 'autocad', 'solidworks', 'embedded', 'vlsi', 'plc', 'networking', 'cybersecurity', 'android', 'ios', 'flutter', 'php', 'ruby', 'golang', 'rust', '.net', 'django', 'flask', 'devops', 'aws', 'azure', 'docker', 'kubernetes', 'git', 'machine learning', 'data structures', 'algorithms'],
  computer_apps: ['software testing', 'manual testing', 'automation testing', 'it support', 'network administration', 'dbms', 'sql'],
  science: ['biology', 'microbiology', 'chemistry', 'physics', 'biotechnology', 'bioinformatics', 'lab techniques', 'data science', 'data analysis', 'r programming', 'statistics'],
  pharmacy: ['pharmacology', 'pharmacovigilance', 'clinical research', 'drug safety', 'gmp', 'quality control'],
  healthcare: ['nursing', 'patient care', 'clinical', 'physiotherapy', 'first aid', 'medical'],
  teaching: ['teaching', 'lesson planning', 'classroom management', 'curriculum', 'mentoring'],
  hospitality: ['hospitality', 'front office', 'housekeeping', 'food and beverage', 'guest relations'],
  commerce: ['accounting', 'tally', 'gst', 'taxation', 'auditing', 'bookkeeping', 'financial analysis', 'sap fico'],
  management: ['marketing', 'digital marketing', 'seo', 'sales', 'business development', 'hr', 'recruitment', 'project management', 'crm', 'retail'],
  law: ['legal drafting', 'contract law', 'litigation', 'compliance', 'paralegal'],
  arts: ['content writing', 'copywriting', 'journalism', 'graphic design', 'video editing', 'translation'],
};

export function inferCategoryFromSkills(tokens) {
  const hay = tokens.join(' ');
  let best = null;
  let bestCount = 0;
  for (const [cat, keys] of Object.entries(SKILL_CATEGORY_HINTS)) {
    const count = keys.filter((k) => hay.includes(k)).length;
    if (count > bestCount) { bestCount = count; best = cat; }
  }
  return best;
}

export const COURSE_CATEGORIES = [
  { key: 'engineering', label: 'B.Tech / B.E. (Engineering)', keywords: ['engineer', 'engineering', 'b.tech', 'btech', 'mechanical', 'civil', 'electrical', 'electronics', 'ece', 'software developer', 'developer', 'devops', 'embedded'] },
  { key: 'computer_apps', label: 'BCA / MCA (Computer Applications)', keywords: ['bca', 'mca', 'software tester', 'qa engineer', 'it support', 'network admin'] },
  { key: 'science', label: 'B.Sc / M.Sc (Science)', keywords: ['b.sc', 'bsc', 'm.sc', 'msc', 'lab technician', 'chemist', 'biology', 'microbiology', 'research assistant', 'data scientist', 'data analyst'] },
  { key: 'pharmacy', label: 'B.Pharmacy / Pharmacy', keywords: ['pharmacist', 'pharmacy', 'pharma', 'pharmaceutical', 'drug safety', 'medical representative'] },
  { key: 'healthcare', label: 'B.Sc Nursing / BAMS / BHMS (Healthcare)', keywords: ['nurse', 'nursing', 'medical officer', 'physiotherapist', 'healthcare', 'hospital staff', 'clinical', 'paramedic'] },
  { key: 'teaching', label: 'B.Ed (Teaching & Education)', keywords: ['teacher', 'teaching', 'faculty', 'trainer', 'tutor', 'lecturer', 'b.ed'] },
  { key: 'hospitality', label: 'BHM (Hospitality & Travel)', keywords: ['hotel', 'front office', 'chef', 'kitchen', 'hospitality', 'travel desk', 'housekeeping'] },
  { key: 'commerce', label: 'B.Com / M.Com (Commerce)', keywords: ['accountant', 'accounting', 'b.com', 'bcom', 'taxation', 'audit', 'bookkeeping', 'finance executive', 'gst'] },
  { key: 'management', label: 'BBA / MBA (Management)', keywords: ['mba', 'bba', 'management trainee', 'business analyst', 'marketing executive', 'sales executive', 'hr executive', 'operations manager', 'business development', 'retail', 'store manager'] },
  { key: 'law', label: 'LLB / Law', keywords: ['lawyer', 'legal', 'llb', 'advocate', 'paralegal', 'compliance officer', 'legal counsel'] },
  { key: 'arts', label: 'BA / MA (Arts & Humanities)', keywords: ['content writer', 'journalist', 'ba ', 'humanities', 'social work', 'copywriter', 'translator'] },
];

export function classifyCourseCategory(job) {
  const hay = `${job.role} ${job.category} ${(job.skills || []).join(' ')} ${(job.description || []).join(' ')}`.toLowerCase();
  for (const cat of COURSE_CATEGORIES) {
    if (cat.keywords.some((k) => hay.includes(k))) return cat.key;
  }
  return 'general';
}

export const KNOWN_SKILLS = [
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

export function normalizeSkillText(s) {
  return s.toLowerCase().trim().replace(/[.\-_]/g, ' ').replace(/\s+/g, ' ');
}

export function isKnownSkill(value) {
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

export function looksLikePersonName(value, currentUser) {
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

export const DEFAULT_FILTERS = { level: 'all', domain: 'all', q: '', loc: 'All Locations', expYears: 'all', studyYear: 'all', course: 'all' };

export const STUDY_YEARS = [
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

export function parseExperienceRange(expStr) {
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

export function expYearsInRange(expStr, exactYear) {
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

export function matchesStudyYear(job, studyYear) {
  if (studyYear === 'all') return true;
  if (studyYear === 'completed') return true;
  const entry = STUDY_YEARS.find((s) => s.key === studyYear);
  if (!entry || entry.keywords.length === 0) return true;
  const hay = `${job.role} ${(job.description || []).join(' ')}`.toLowerCase();
  return entry.keywords.some((k) => hay.includes(k));
}

/* ---- reusable filter panel, used inside the left sidebar ---- */

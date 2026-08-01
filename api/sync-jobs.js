import { createClient } from '@supabase/supabase-js';

/* Each bucket is one Adzuna search query, tagged with the category and
   IT/Non-IT flag it should carry on your site. Add or edit buckets to
   change what kinds of roles get pulled in. */
const SEARCH_BUCKETS = [
  { what: 'software engineer', category: 'IT & Software (CSE/IT)', isIT: true },
  { what: 'data engineer', category: 'Data & Analytics', isIT: true },
  { what: 'data scientist', category: 'Data Science', isIT: true },
  { what: 'machine learning engineer', category: 'AI & Machine Learning', isIT: true },
  { what: 'cloud devops engineer', category: 'Cloud & DevOps', isIT: true },
  { what: 'electronics engineer', category: 'Electronics & Communication (ECE)', isIT: false },
  { what: 'electrical engineer', category: 'Electrical & Electronics (EEE)', isIT: false },
  { what: 'mechanical engineer', category: 'Mechanical Engineering', isIT: false },
  { what: 'civil engineer', category: 'Civil Engineering', isIT: false },
  { what: 'chemical engineer', category: 'Chemical Engineering', isIT: false },
  { what: 'customer support', category: 'Customer Support', isIT: false },
  { what: 'sales executive', category: 'Sales & Marketing', isIT: false },
  { what: 'relationship manager bank', category: 'Finance & Banking', isIT: false },
  { what: 'operations manager', category: 'Operations & Supply Chain', isIT: false },
  { what: 'business analyst', category: 'Business & Analytics', isIT: false },
];

const RESULTS_PER_BUCKET = 20;   // Adzuna allows up to 50 per page
const MAX_LISTING_AGE_DAYS = 30; // jobs not re-seen for this long get hidden, not deleted
const REQUEST_DELAY_MS = 400;    // be polite between calls, and stay well under the function's time limit

const SKILL_DICTIONARY = [
  'Java', 'Python', 'C++', 'C#', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'Angular', 'Vue',
  'SQL', 'MySQL', 'PostgreSQL', 'MongoDB', 'AWS', 'Azure', 'GCP', 'Kubernetes', 'Docker', 'Terraform',
  'DevOps', 'CI/CD', 'Selenium', 'Spring Boot', 'Kafka', 'Spark', 'Airflow', 'ETL', 'Excel', 'Power BI',
  'Tableau', 'SAP', 'Salesforce', 'SEO', 'Digital Marketing', 'Content Writing', 'Customer Support',
  'Communication', 'Banking', 'Sales', 'Accounting', 'Tally', 'GST', 'HR', 'Recruitment',
  'Manual Testing', 'Automation Testing', 'REST API', 'Microservices', 'Linux', 'Networking',
  'CRM', 'B2B', 'Business Development', 'Prospecting', 'Lead Generation', 'Negotiation',
  'AutoCAD', 'SolidWorks', 'CATIA', 'ANSYS', 'CAD', 'CAM', 'PLC', 'SCADA', 'MATLAB', 'Simulink',
  'PCB Design', 'Embedded Systems', 'VLSI', 'Structural Analysis', 'AutoCAD Civil 3D', 'STAAD Pro',
  'Revit', 'Process Engineering', 'Piping Design', 'HVAC', 'Six Sigma', 'Lean Manufacturing',
  'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch', 'NLP', 'Computer Vision', 'Pandas', 'NumPy',
];

function detectSkills(text) {
  const lower = text.toLowerCase();
  return SKILL_DICTIONARY.filter((skill) => lower.includes(skill.toLowerCase()));
}

function detectLevel(text) {
  const lower = text.toLowerCase();
  if (/\b(fresher|entry.level|no experience|trainee|graduate)\b/.test(lower)) return 'fresher';
  if (/\b(senior|lead|principal|\d+\+?\s*-\s*\d+\s*years|manager)\b/.test(lower)) return 'experienced';
  return 'both';
}

// Adzuna's API does not provide a structured "years of experience" field at
// all — the old job-sync script just stored `null` for every single job,
// which is why the site's experience filter had nothing real to match
// against. This pulls a best-effort estimate out of the free-text listing
// itself (title + description), the same way a person skimming the posting
// would. It's heuristic — not every listing states this at all — but it's
// real data where the old version had none.
function parseExperienceFromText(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  let m = lower.match(/(\d{1,2})\s*(?:-|to)\s*(\d{1,2})\s*\+?\s*(?:years?|yrs?)/);
  if (m) return `${m[1]}-${m[2]} years`;
  m = lower.match(/(\d{1,2})\s*\+\s*(?:years?|yrs?)/);
  if (m) return `${m[1]}+ years`;
  m = lower.match(/(?:minimum|min\.?|at least)\s*(?:of\s*)?(\d{1,2})\s*(?:years?|yrs?)/);
  if (m) return `${m[1]}+ years`;
  m = lower.match(/(\d{1,2})\s*(?:years?|yrs?)\s*(?:of\s*)?experience/);
  if (m) return `${m[1]} years`;
  if (/\b(fresher|entry.level|no experience|trainee)\b/.test(lower)) return 'Fresher (0 years)';
  return null;
}

function formatSalary(min, max) {
  if (!min && !max) return null;
  const fmt = (n) => `₹${Math.round(n / 100000)} LPA`;
  if (min && max) return `${fmt(min)} – ${fmt(max)} (indicative)`;
  return `${fmt(min || max)} (indicative)`;
}

function extractDescriptionBullets(rawText) {
  if (!rawText) return ['See the official listing for full details.'];
  const cleaned = rawText.replace(/\s+/g, ' ').trim();

  // Adzuna's raw text has no line breaks — job boards' own bullet characters
  // are usually the only structure left, so split on those first.
  let parts = cleaned.split(/[•●▪︎‣·]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) {
    // No bullet characters at all — fall back to splitting on sentence boundaries.
    parts = cleaned.split(/(?<=[.!?])\s+(?=[A-Z])/).map((p) => p.trim()).filter(Boolean);
  }

  // Keep only fragments that read like real sentences (end in . ! or ?) —
  // this drops stray headings like "Key Responsibilities" that land before
  // the first bullet and would otherwise show up as the lead line.
  const sentences = parts.filter((p) => /[.!?]['")]?$/.test(p) && p.length > 10);
  let finalParts = (sentences.length ? sentences : parts).slice(0, 6);

  // Safety cap so one unusually long sentence can't dominate the card.
  finalParts = finalParts.map((p) => (p.length > 280 ? `${p.slice(0, 277).trim()}…` : p));

  return finalParts.length ? finalParts : ['See the official listing for full details.'];
}

function normalizeJob(raw, bucket) {
  const text = `${raw.title} ${raw.description || ''}`;
  return {
    id: `adzuna-${raw.id}`,
    source: 'adzuna',
    company: raw.company && raw.company.display_name ? raw.company.display_name : 'Unknown employer',
    role: raw.title,
    level: detectLevel(text),
    is_it: bucket.isIT,
    city: raw.location && raw.location.display_name ? raw.location.display_name : 'India',
    category: bucket.category,
    experience: parseExperienceFromText(text),
    salary: formatSalary(raw.salary_min, raw.salary_max),
    employment_type: raw.contract_time === 'part_time' ? 'Part-time' : 'Full-time',
    skills: detectSkills(text),
    description: extractDescriptionBullets(raw.description),
    posted_at: raw.created,
    // NOTE: Adzuna's public API only ever gives you this — its own tracking
    // redirect — not a raw direct-to-employer URL. There isn't a "direct
    // link" field to switch to on Adzuna's free tier; the click always goes
    // through them by design of how they monetize the API.
    link: raw.redirect_url,
    last_seen_at: new Date().toISOString(),
    is_active: true,
  };
}

async function fetchBucket(bucket, adzunaAppId, adzunaAppKey) {
  const url = new URL('https://api.adzuna.com/v1/api/jobs/in/search/1');
  url.searchParams.set('app_id', adzunaAppId);
  url.searchParams.set('app_key', adzunaAppKey);
  url.searchParams.set('what', bucket.what);
  url.searchParams.set('results_per_page', String(RESULTS_PER_BUCKET));
  url.searchParams.set('max_days_old', '14');
  url.searchParams.set('content-type', 'application/json');

  const res = await fetch(url.toString());
  if (!res.ok) {
    console.error(`Adzuna request failed for "${bucket.what}": HTTP ${res.status}`);
    return [];
  }
  const data = await res.json();
  const results = data.results || [];
  return results.map((r) => normalizeJob(r, bucket));
}

export default async function handler(req, res) {
  const isCron = req.headers['x-vercel-cron'] === '1';
  const secretOk = req.query.secret && req.query.secret === process.env.CRON_SECRET;
  if (!isCron && !secretOk) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const adzunaAppId = process.env.ADZUNA_APP_ID;
  const adzunaAppKey = process.env.ADZUNA_APP_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!adzunaAppId || !adzunaAppKey || !supabaseUrl || !serviceKey) {
    return res.status(500).json({
      error: 'Server missing required env vars',
      debug: {
        hasAdzunaAppId: !!adzunaAppId,
        hasAdzunaAppKey: !!adzunaAppKey,
        hasSupabaseUrl: !!supabaseUrl,
        hasServiceKey: !!serviceKey,
      },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  let allJobs = [];
  for (const bucket of SEARCH_BUCKETS) {
    const jobs = await fetchBucket(bucket, adzunaAppId, adzunaAppKey);
    allJobs = allJobs.concat(jobs);
    await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
  }

  if (allJobs.length === 0) {
    return res.status(200).json({ upserted: 0, reason: 'No results from Adzuna this run' });
  }

  // The same listing can match more than one search bucket (e.g. a role
  // matching both "data engineer" and "machine learning engineer"), which
  // would otherwise put the same `id` in this batch twice. Postgres's
  // ON CONFLICT DO UPDATE errors out ("cannot affect row a second time")
  // if that happens within a single upsert, so keep only the first
  // occurrence of each id here.
  const seenIds = new Set();
  const dedupedJobs = allJobs.filter((job) => {
    if (seenIds.has(job.id)) return false;
    seenIds.add(job.id);
    return true;
  });

  const { error: upsertError } = await supabase.from('jobs').upsert(dedupedJobs, { onConflict: 'id' });
  if (upsertError) {
    console.error('sync-jobs: upsert failed', upsertError.message);
    return res.status(500).json({ error: 'Upsert failed', debug: upsertError.message });
  }

  const cutoff = new Date(Date.now() - MAX_LISTING_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error: deactivateError } = await supabase
    .from('jobs')
    .update({ is_active: false })
    .lt('last_seen_at', cutoff)
    .eq('is_active', true);

  if (deactivateError) {
    console.error('sync-jobs: deactivation step failed', deactivateError.message);
  }

  return res.status(200).json({
    fetched: allJobs.length,
    upserted: dedupedJobs.length,
    duplicatesRemoved: allJobs.length - dedupedJobs.length,
    deactivationError: deactivateError ? deactivateError.message : null,
  });
}

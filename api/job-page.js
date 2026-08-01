import { createClient } from '@supabase/supabase-js';

// Only crawlers land here at all — vercel.json only rewrites to this
// function when the User-Agent matches a known bot (see the "has" rule for
// /job/:id). Regular visitors always get the normal React SPA from
// index.html, so this file never has to worry about interactivity, just
// producing correct <head> tags and JSON-LD for a single job.
const SITE_URL = (process.env.SITE_URL || 'https://careerbanyan.vercel.app').replace(/\/$/, '');

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Adzuna's salary fields only ever reach this function as an already
// formatted string (e.g. "₹6 LPA – ₹9 LPA (indicative)"), because that's
// all sync-jobs.js stores. Google's baseSalary field wants real numbers, so
// this pulls the LPA figures back out on a best-effort basis. If nothing
// parses, baseSalary is simply omitted — it's an optional field in the
// JobPosting schema, not a required one.
function parseSalaryForSchema(salaryStr) {
  if (!salaryStr) return null;
  const nums = String(salaryStr).match(/₹(\d+(?:\.\d+)?)\s*LPA/gi);
  if (!nums || !nums.length) return null;
  const values = nums.map((n) => parseFloat(n.replace(/[₹\sLPA]/gi, '')) * 100000);
  const min = Math.min(...values);
  const max = Math.max(...values);
  return {
    '@type': 'MonetaryAmount',
    currency: 'INR',
    value: {
      '@type': 'QuantitativeValue',
      minValue: min,
      maxValue: max,
      unitText: 'YEAR',
    },
  };
}

function buildJobPostingSchema(job) {
  const descriptionHtml = (Array.isArray(job.description) ? job.description : [String(job.description || '')])
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('');

  const posted = job.posted_at ? new Date(job.posted_at) : new Date();
  const validThrough = new Date(posted.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const schema = {
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    title: job.role,
    description: descriptionHtml || `<p>${escapeHtml(job.role)} at ${escapeHtml(job.company)}.</p>`,
    identifier: {
      '@type': 'PropertyValue',
      name: job.company || 'CareerBanyan',
      value: String(job.id),
    },
    datePosted: posted.toISOString(),
    validThrough,
    employmentType: job.employment_type === 'Part-time' ? 'PART_TIME' : 'FULL_TIME',
    hiringOrganization: {
      '@type': 'Organization',
      name: job.company || 'Unknown employer',
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: job.city || 'India',
        addressCountry: 'IN',
      },
    },
    directApply: false,
  };

  const baseSalary = parseSalaryForSchema(job.salary);
  if (baseSalary) schema.baseSalary = baseSalary;

  return schema;
}

function renderHtml(job) {
  if (!job) {
    const title = 'Job not found — CareerBanyan';
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" />
<title>${title}</title>
<meta name="robots" content="noindex" />
<meta http-equiv="refresh" content="0; url=${SITE_URL}/" />
</head><body>Redirecting to <a href="${SITE_URL}/">CareerBanyan</a>...</body></html>`;
  }

  const title = escapeHtml(`${job.role} at ${job.company} — CareerBanyan`);
  const rawDesc = `${job.role} at ${job.company} in ${job.city}. ${
    Array.isArray(job.description) && job.description[0] ? job.description[0] : ''
  }`;
  const desc = escapeHtml(rawDesc.length > 160 ? `${rawDesc.slice(0, 157)}...` : rawDesc);
  const url = `${SITE_URL}/job/${job.id}`;
  const schema = buildJobPostingSchema(job);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<meta name="description" content="${desc}" />
<link rel="canonical" href="${url}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="CareerBanyan" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${desc}" />
<meta property="og:url" content="${url}" />
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${desc}" />
<script type="application/ld+json">${JSON.stringify(schema)}</script>
</head>
<body>
<h1>${escapeHtml(job.role)}</h1>
<p>${escapeHtml(job.company)} — ${escapeHtml(job.city)}</p>
<p>${escapeHtml(rawDesc)}</p>
<p><a href="${url}">View this job on CareerBanyan</a></p>
</body>
</html>`;
}

export default async function handler(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  const jobId = req.query.id;

  if (!supabaseUrl || !serviceKey || !jobId) {
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(renderHtml(null));
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: job, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .maybeSingle();

  if (error) {
    console.error('job-page: fetch failed', error.message);
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.status(job ? 200 : 404).send(renderHtml(job || null));
}

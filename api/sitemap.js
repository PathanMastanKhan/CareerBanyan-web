import { createClient } from '@supabase/supabase-js';
// IMPORTANT: set SITE_URL in Vercel → Settings → Environment Variables to
// your actual production domain (no trailing slash). The fallback below is
// just a safety net — don't rely on it being correct for your deployment.
const SITE_URL = (process.env.SITE_URL || 'https://careerbanyan.vercel.app').replace(/\/$/, '');

export default async function handler(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) {
    res.status(500).send('Server not configured');
    return;
  }
  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('id, posted_at')
    .eq('is_active', true)
    .order('posted_at', { ascending: false })
    .limit(5000);
  if (error) {
    console.error('sitemap: jobs fetch failed', error.message);
    res.status(500).send('Could not build sitemap');
    return;
  }
  const urls = [
    `<url><loc>${SITE_URL}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    ...(jobs || []).map(
      (j) =>
        `<url><loc>${SITE_URL}/job/${j.id}</loc><lastmod>${new Date(j.posted_at).toISOString()}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`
    ),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.status(200).send(xml);
}

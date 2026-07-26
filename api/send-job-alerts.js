import { createClient } from '@supabase/supabase-js';

function matchScore(job, tokens) {
  let score = 0;
  const role = (job.role || '').toLowerCase();
  const category = (job.category || '').toLowerCase();
  const skillsLower = (job.skills || []).map((s) => s.toLowerCase());
  tokens.forEach((t) => {
    if (skillsLower.some((s) => s.includes(t) || t.includes(s))) score += 2;
    if (role.includes(t)) score += 3;
    if (category.includes(t)) score += 1;
  });
  return score;
}

export default async function handler(req, res) {
  const isCron = req.headers['x-vercel-cron'] === '1';
  const secretOk = req.query.secret && req.query.secret === process.env.CRON_SECRET;
  if (!isCron && !secretOk) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const siteUrl = process.env.SITE_URL || 'https://careerbanyan.vercel.app';

  if (!supabaseUrl || !serviceKey || !resendKey) {
    return res.status(500).json({ error: 'Server missing required env vars' });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: newJobs, error: jobsError } = await supabase
    .from('jobs')
    .select('*')
    .eq('is_active', true)
    .gte('posted_at', since);

  if (jobsError) {
    console.error('send-job-alerts: jobs fetch failed', jobsError.message);
    return res.status(500).json({ error: 'Could not fetch jobs' });
  }
  if (!newJobs || newJobs.length === 0) {
    return res.status(200).json({ sent: 0, reason: 'No new jobs in the last 24h' });
  }

  let allUsers = [];
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      console.error('send-job-alerts: listUsers failed', error.message);
      break;
    }
    allUsers = allUsers.concat(data.users);
    if (data.users.length < 1000) break;
    page += 1;
  }

  const subscribers = allUsers.filter((u) => {
    const meta = u.user_metadata || {};
    return meta.alerts_enabled && Array.isArray(meta.skills) && meta.skills.length > 0 && u.email;
  });

  let sentCount = 0;
  for (const user of subscribers) {
    const meta = user.user_metadata || {};
    const tokens = meta.skills.map((s) => s.toLowerCase().trim()).filter(Boolean);
    const matched = newJobs
      .map((job) => ({ job, score: matchScore(job, tokens) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((x) => x.job);

    if (matched.length === 0) continue;

    const rowsHtml = matched
      .map(
        (j) =>
          `<li style="margin-bottom:12px;"><strong>${j.role}</strong> at ${j.company} — ${j.city}<br/><a href="${siteUrl}/job/${j.id}">View & apply</a></li>`
      )
      .join('');

    const html = `
      <div style="font-family:sans-serif;font-size:14px;color:#0f172a;">
        <p>Hi ${meta.name || 'there'},</p>
        <p>New roles matching your saved skills just went live on CareerBanyan:</p>
        <ul style="padding-left:18px;">${rowsHtml}</ul>
        <p style="color:#64748b;font-size:12px;">You're getting this because email alerts are turned on in your CareerBanyan profile. You can turn them off anytime from Profile.</p>
      </div>`;

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'CareerBanyan <alerts@yourdomain.com>',
        to: user.email,
        subject: `${matched.length} new role${matched.length > 1 ? 's' : ''} matching your skills`,
        html,
      }),
    });

    if (resp.ok) sentCount += 1;
    else console.error('send-job-alerts: Resend failed for', user.email, await resp.text());
  }

  return res.status(200).json({ sent: sentCount, newJobsChecked: newJobs.length, subscribers: subscribers.length });
}

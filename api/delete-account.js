import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    return res.status(401).json({ error: 'Missing auth token' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('Server missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY');
    return res.status(500).json({
      error: 'Server is not configured correctly.',
      debug: { hasUrl: !!supabaseUrl, hasServiceKey: !!serviceKey },
    });
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await adminClient.auth.getUser(token);
  if (userError || !userData || !userData.user) {
    console.error('delete-account: token verification failed', userError?.message);
    return res.status(401).json({ error: 'Your session is invalid or expired — please log in again.' });
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userData.user.id);
  if (deleteError) {
    console.error('Account deletion failed:', deleteError.message, deleteError.status);
    return res.status(500).json({ error: `Could not delete the account: ${deleteError.message}` });
  }

  return res.status(200).json({ success: true });
}

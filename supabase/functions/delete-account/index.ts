// Permanently deletes the calling user's Luvdex account:
// photo files in storage, all sessions, and the auth user (database rows cascade).
// Deployed with verify_jwt = false; the user is verified in code below.
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ error: 'Not signed in' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
  const secret = secretKeys.default ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret) return json({ error: 'Server is not configured' }, 500);

  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

  // Verify the caller's session with Supabase Auth.
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return json({ error: 'Not signed in' }, 401);

  // 1. Remove photo files (storage files are not removed by database cascades).
  const folder = user.id;
  for (let round = 0; round < 20; round++) {
    const { data: files, error: listError } = await admin.storage.from('photos').list(folder, { limit: 100 });
    if (listError) return json({ error: 'Could not remove photos' }, 500);
    if (!files || files.length === 0) break;
    const { error: removeError } = await admin.storage.from('photos').remove(files.map((f) => `${folder}/${f.name}`));
    if (removeError) return json({ error: 'Could not remove photos' }, 500);
    if (files.length < 100) break;
  }

  // 2. End every session (deleting a user does not invalidate tokens that were already issued).
  await admin.auth.admin.signOut(token, 'global').catch(() => undefined);

  // 3. Delete the auth user. profiles and photos rows are removed by ON DELETE CASCADE.
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) return json({ error: 'Could not delete account' }, 500);

  return json({ ok: true });
});

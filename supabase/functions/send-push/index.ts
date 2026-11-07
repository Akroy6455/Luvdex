// Sends due phone notifications (Web Push). Called every 20 seconds by pg_cron.
// First run: generates the Web Push keys and stores them in Supabase Vault,
// so the private key never leaves the server.
// Deployed with verify_jwt = false; calls are authorised by the x-cron-secret header.
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import webpush from 'npm:web-push@3.6.7';

type PushRow = { endpoint: string; p256dh: string; auth: string; title: string; body: string; url: string; tag: string };
type PushConfig = { vapid_public: string | null; vapid_private: string | null; cron_secret: string | null; subject: string };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const randomSecret = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '');
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
  const secret = secretKeys.default ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret) return json({ error: 'Server is not configured' }, 500);
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: cfgData, error: cfgError } = await admin.rpc('get_push_config');
  if (cfgError) return json({ error: 'Could not read config' }, 500);
  const cfg = cfgData as PushConfig;

  // One-time setup. Once keys exist this branch never runs again.
  if (!cfg.vapid_private || !cfg.vapid_public || !cfg.cron_secret) {
    const keys = webpush.generateVAPIDKeys();
    const { data: created, error } = await admin.rpc('init_push_keys', {
      vapid_public: keys.publicKey,
      vapid_private: keys.privateKey,
      cron_secret: randomSecret(),
    });
    if (error) return json({ error: 'Could not initialise keys' }, 500);
    return json({ initialized: created === true });
  }

  if (req.headers.get('x-cron-secret') !== cfg.cron_secret) return json({ error: 'Forbidden' }, 403);

  webpush.setVapidDetails(cfg.subject, cfg.vapid_public, cfg.vapid_private);

  const { data: batch, error: batchError } = await admin.rpc('claim_push_batch');
  if (batchError) return json({ error: 'Could not load notifications' }, 500);

  let sent = 0;
  let removed = 0;
  let failed = 0;
  await Promise.all(
    ((batch ?? []) as PushRow[]).map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          JSON.stringify({ title: row.title, body: row.body, url: row.url, tag: row.tag }),
          { TTL: 3600, urgency: 'high' },
        );
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // The browser unsubscribed or the subscription expired.
          await admin.from('push_subscriptions').delete().eq('endpoint', row.endpoint);
          removed++;
        } else {
          failed++;
        }
      }
    }),
  );

  return json({ sent, removed, failed });
});

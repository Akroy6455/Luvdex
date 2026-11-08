// Signed links to private photos, cached.
// Every new signed link makes the browser/phone download the photo again (it looks like a
// new file), and photo downloads are what costs money at scale. So each photo gets one
// link that is reused until shortly before it expires.
import { supabase } from './supabase';

const LINK_LIFETIME_S = 6 * 60 * 60; // links are valid for 6 hours…
const REUSE_UNTIL_S = 5 * 60 * 60; // …and reused for 5 of them

const cache = new Map<string, { url: string; until: number }>();

/** Returns { storage_path: signed_url } for the given photo paths, using cached links when possible. */
export async function photoUrls(paths: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const now = Date.now();
  const missing: string[] = [];
  for (const p of new Set(paths)) {
    const hit = cache.get(p);
    if (hit && hit.until > now) out[p] = hit.url;
    else missing.push(p);
  }
  if (missing.length && supabase) {
    const { data } = await supabase.storage.from('photos').createSignedUrls(missing, LINK_LIFETIME_S);
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) {
        out[item.path] = item.signedUrl;
        cache.set(item.path, { url: item.signedUrl, until: now + REUSE_UNTIL_S * 1000 });
      }
    }
  }
  return out;
}

/** Forget a photo's link (after it was deleted or replaced). */
export function forgetPhotoUrl(path: string) {
  cache.delete(path);
}

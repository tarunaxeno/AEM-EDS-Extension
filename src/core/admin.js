// Browser-only helper (uses chrome.* and fetch). Kept out of the pure, unit-tested modules.
import { ADMIN_BASE, adminStatusUrl } from './links.js';

/**
 * Ask the Admin API for the real edit URL (Universal Editor).
 * Returns null unless the user granted the optional admin.hlx.page permission.
 */
export async function lookupEditUrl(ctx) {
  try {
    const granted = await chrome.permissions.contains({ origins: [`${ADMIN_BASE}/*`] });
    if (!granted) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(adminStatusUrl(ctx), { credentials: 'include', signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = await res.json();
    return json?.edit?.url || null;
  } catch {
    return null;
  }
}

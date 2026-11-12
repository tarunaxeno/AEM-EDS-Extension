// Pure logic, no browser APIs, so it can be unit-tested with plain Node.

// EDS hosts look like {ref}--{site}--{org}.aem.page / .aem.live (legacy: .hlx.page / .hlx.live)
const EDS_HOST =
  /^([a-z0-9][a-z0-9-]*?)--([a-z0-9][a-z0-9-]*?)--([a-z0-9][a-z0-9-]*)\.(aem|hlx)\.(page|live)$/i;

/**
 * Parse a URL that lives on an EDS preview/live host.
 * @param {string} urlString
 * @returns {null | {org:string, site:string, ref:string, env:'preview'|'live', family:'aem'|'hlx',
 *   origin:string, hostname:string, path:string, search:string, hash:string}}
 */
export function parseEdsUrl(urlString) {
  let url;
  try {
    url = new URL(urlString);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  const m = EDS_HOST.exec(url.hostname);
  if (!m) return null;
  const [, ref, site, org, family, tld] = m;
  return {
    org: org.toLowerCase(),
    site: site.toLowerCase(),
    ref: ref.toLowerCase(),
    env: tld.toLowerCase() === 'page' ? 'preview' : 'live',
    family: family.toLowerCase(),
    origin: url.origin,
    hostname: url.hostname,
    path: url.pathname,
    search: url.search,
    hash: url.hash,
  };
}

/**
 * Work out the project context for a tab URL.
 * Falls back to saved projects so production / custom domains work too.
 * @param {string} urlString
 * @param {Array<{org:string, site:string, ref?:string, prodHost?:string}>} projects
 */
export function resolveContext(urlString, projects = []) {
  const eds = parseEdsUrl(urlString);
  if (eds) return eds;

  let url;
  try {
    url = new URL(urlString);
  } catch {
    return null;
  }
  const project = projects.find(
    (p) => p.prodHost && p.prodHost.toLowerCase() === url.hostname.toLowerCase(),
  );
  if (!project) return null;
  return {
    org: project.org.toLowerCase(),
    site: project.site.toLowerCase(),
    ref: (project.ref || 'main').toLowerCase(),
    env: 'prod',
    family: 'aem',
    origin: url.origin,
    hostname: url.hostname,
    path: url.pathname,
    search: url.search,
    hash: url.hash,
  };
}

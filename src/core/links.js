// Pure logic: turns a project context into groups of links.

// Single place to change if Adobe moves the Admin API. VERIFY against the aem.live admin docs.
export const ADMIN_BASE = 'https://admin.hlx.page';
export const UE_BASE = 'https://experience.adobe.com';

export function hostFor(ctx, env) {
  const tld = env === 'live' ? 'live' : 'page';
  return `https://${ctx.ref}--${ctx.site}--${ctx.org}.${ctx.family}.${tld}`;
}

/** "/" -> "/index", "/foo/" -> "/foo/index", "/foo" -> "/foo" */
export function contentPath(webPath) {
  if (!webPath || webPath === '/') return '/index';
  return webPath.endsWith('/') ? `${webPath}index` : webPath;
}

export function findProject(ctx, projects = []) {
  return projects.find((p) => p.org?.toLowerCase() === ctx.org && p.site?.toLowerCase() === ctx.site);
}

/** Universal Editor deep link built from saved project settings. Returns null if not configured. */
export function buildUniversalEditorUrl(ctx, project) {
  if (!project?.imsOrg || !project?.authorHost) return null;
  const root = (project.contentRoot || `/content/${ctx.site}`).replace(/\/$/, '');
  const host = project.authorHost.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return `${UE_BASE}/#/@${project.imsOrg}/aem/editor/canvas/${host}${root}${contentPath(ctx.path)}.html`;
}

export function adminStatusUrl(ctx) {
  return `${ADMIN_BASE}/status/${ctx.org}/${ctx.site}/${ctx.ref}${ctx.path}?editUrl=auto`;
}

/** Preview <-> Live. From production or anything else, go to preview. */
export function toggleUrl(ctx) {
  const env = ctx.env === 'preview' ? 'live' : 'preview';
  return `${hostFor(ctx, env)}${ctx.path}${ctx.search}`;
}

/** Turn "Feature/My Thing" into the form EDS uses in hostnames: "feature-my-thing". */
export function sanitizeRef(input) {
  return (input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Same page on another branch, keeping the current environment (production -> preview). */
export function branchUrl(ctx, branch) {
  const ref = sanitizeRef(branch);
  if (!ref) return null;
  return `${hostFor({ ...ctx, ref }, ctx.env === 'live' ? 'live' : 'preview')}${ctx.path}${ctx.search}`;
}

export function expandTemplate(template, ctx) {
  return template
    .replaceAll('{org}', ctx.org)
    .replaceAll('{site}', ctx.site)
    .replaceAll('{ref}', ctx.ref)
    .replaceAll('{path}', ctx.path)
    .replaceAll('{host}', ctx.hostname);
}

/**
 * @param {object} ctx            result of resolveContext()
 * @param {object} opts
 * @param {object} [opts.project] saved project settings
 * @param {string} [opts.adminEditUrl] edit URL returned by the admin API (preferred when present)
 * @param {Array<{label:string,url:string}>} [opts.customLinks]
 */
export function buildGroups(ctx, { project, adminEditUrl, customLinks = [] } = {}) {
  const suffix = `${ctx.path}${ctx.search}`;
  const ue = adminEditUrl || buildUniversalEditorUrl(ctx, project);

  const groups = [
    {
      title: 'Environments',
      links: [
        { id: 'preview', label: 'Preview', url: `${hostFor(ctx, 'preview')}${suffix}` },
        { id: 'live', label: 'Live', url: `${hostFor(ctx, 'live')}${suffix}` },
        project?.prodHost
          ? { id: 'prod', label: 'Production', url: `https://${project.prodHost}${suffix}` }
          : { id: 'prod', label: 'Production', url: null, hint: 'Set the production host in Options' },
      ],
    },
    {
      title: 'Authoring',
      links: [
        ue
          ? { id: 'ue', label: 'Universal Editor', url: ue }
          : { id: 'ue', label: 'Universal Editor', url: null, hint: 'Set author host and IMS org in Options' },
        { id: 'plain', label: 'Plain HTML', url: `${hostFor(ctx, 'preview')}${ctx.path.replace(/\/$/, '/index')}.plain.html` },
        { id: 'status', label: 'Admin status', url: adminStatusUrl(ctx).replace('?editUrl=auto', '') },
      ],
    },
    {
      title: 'Code',
      links: [
        { id: 'repo', label: 'GitHub repo', url: `https://github.com/${ctx.org}/${ctx.site}` },
        { id: 'branch', label: 'This branch', url: `https://github.com/${ctx.org}/${ctx.site}/tree/${ctx.ref}` },
        { id: 'actions', label: 'Actions', url: `https://github.com/${ctx.org}/${ctx.site}/actions` },
      ],
    },
    {
      title: 'Content & data',
      links: [
        { id: 'index', label: 'Query index', url: `${hostFor(ctx, 'live')}/query-index.json` },
        { id: 'sitemap', label: 'Sitemap', url: `${hostFor(ctx, 'live')}/sitemap.xml` },
        { id: 'robots', label: 'robots.txt', url: `${hostFor(ctx, 'live')}/robots.txt` },
      ],
    },
    {
      title: 'Tools',
      links: [
        { id: 'aem-tools', label: 'AEM Tools', url: 'https://tools.aem.live/' },
        { id: 'aem-docs', label: 'aem.live docs', url: 'https://www.aem.live/docs/' },
        { id: 'ue-home', label: 'Experience Cloud', url: 'https://experience.adobe.com/' },
        {
          id: 'pagespeed',
          label: 'PageSpeed',
          url: `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(`${hostFor(ctx, 'live')}${ctx.path}`)}`,
        },
      ],
    },
    {
      title: 'Copy',
      links: [
        { id: 'copy-preview', label: 'Preview URL', copy: `${hostFor(ctx, 'preview')}${suffix}` },
        { id: 'copy-live', label: 'Live URL', copy: `${hostFor(ctx, 'live')}${suffix}` },
        { id: 'copy-path', label: 'Page path', copy: ctx.path },
      ],
    },
  ];

  const custom = customLinks
    .filter((l) => l?.label && l?.url)
    .map((l, i) => ({ id: `custom-${i}`, label: l.label, url: expandTemplate(l.url, ctx) }));
  if (custom.length) groups.push({ title: 'My links', links: custom });

  return groups;
}

/** Groups shown when the current tab is not an EDS page. */
export function buildFallbackGroups({ projects = [], customLinks = [] } = {}) {
  const groups = [];
  if (projects.length) {
    groups.push({
      title: 'Saved projects',
      links: projects.flatMap((p) => {
        const ref = p.ref || 'main';
        return [
          { id: `${p.org}-${p.site}-p`, label: `${p.site} · Preview`, url: `https://${ref}--${p.site}--${p.org}.aem.page/` },
          { id: `${p.org}-${p.site}-l`, label: `${p.site} · Live`, url: `https://${ref}--${p.site}--${p.org}.aem.live/` },
        ];
      }),
    });
  }
  groups.push({
    title: 'Tools',
    links: [
      { id: 'aem-tools', label: 'AEM Tools', url: 'https://tools.aem.live/' },
      { id: 'aem-docs', label: 'aem.live docs', url: 'https://www.aem.live/docs/' },
      { id: 'ue-home', label: 'Experience Cloud', url: 'https://experience.adobe.com/' },
    ],
  });
  const custom = customLinks.filter((l) => l?.label && l?.url && !/\{(org|site|ref|path|host)\}/.test(l.url));
  if (custom.length) groups.push({ title: 'My links', links: custom.map((l, i) => ({ id: `c${i}`, label: l.label, url: l.url })) });
  return groups;
}

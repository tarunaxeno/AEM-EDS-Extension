import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEdsUrl, resolveContext } from '../src/core/parse-url.js';
import {
  buildGroups, buildUniversalEditorUrl, contentPath, hostFor, expandTemplate, buildFallbackGroups,
  toggleUrl, branchUrl, sanitizeRef,
} from '../src/core/links.js';

test('toggle switches preview and live, keeping path and query', () => {
  const preview = parseEdsUrl('https://main--site--org.aem.page/a/b?x=1');
  assert.equal(toggleUrl(preview), 'https://main--site--org.aem.live/a/b?x=1');
  const live = parseEdsUrl('https://main--site--org.aem.live/a/b?x=1');
  assert.equal(toggleUrl(live), 'https://main--site--org.aem.page/a/b?x=1');
  const prod = resolveContext('https://www.example.com/a', [{ org: 'org', site: 'site', prodHost: 'www.example.com' }]);
  assert.equal(toggleUrl(prod), 'https://main--site--org.aem.page/a');
});

test('branch switcher sanitizes names and keeps env and path', () => {
  assert.equal(sanitizeRef('Feature/My Thing_2'), 'feature-my-thing-2');
  assert.equal(sanitizeRef('  '), '');
  const live = parseEdsUrl('https://main--site--org.aem.live/p');
  assert.equal(branchUrl(live, 'feature/x'), 'https://feature-x--site--org.aem.live/p');
  const preview = parseEdsUrl('https://main--site--org.aem.page/p?q=1');
  assert.equal(branchUrl(preview, 'dev'), 'https://dev--site--org.aem.page/p?q=1');
  assert.equal(branchUrl(preview, '///'), null);
});

test('copy group and PageSpeed link are present', () => {
  const ctx = parseEdsUrl('https://main--site--org.aem.page/a');
  const links = buildGroups(ctx).flatMap((g) => g.links);
  assert.equal(links.find((l) => l.id === 'copy-live').copy, 'https://main--site--org.aem.live/a');
  assert.equal(links.find((l) => l.id === 'copy-path').copy, '/a');
  assert.match(links.find((l) => l.id === 'pagespeed').url, /pagespeed\.web\.dev\/analysis\?url=https%3A%2F%2Fmain--site--org\.aem\.live%2Fa$/);
});

test('parses an aem.page preview URL', () => {
  const ctx = parseEdsUrl('https://main--my-site--my-org.aem.page/blog/post?x=1');
  assert.equal(ctx.org, 'my-org');
  assert.equal(ctx.site, 'my-site');
  assert.equal(ctx.ref, 'main');
  assert.equal(ctx.env, 'preview');
  assert.equal(ctx.path, '/blog/post');
  assert.equal(ctx.search, '?x=1');
});

test('parses live and legacy hlx hosts', () => {
  assert.equal(parseEdsUrl('https://feat-x--site--org.aem.live/').env, 'live');
  const legacy = parseEdsUrl('https://main--site--org.hlx.page/');
  assert.equal(legacy.family, 'hlx');
  assert.equal(hostFor(legacy, 'live'), 'https://main--site--org.hlx.live');
});

test('rejects non-EDS and non-https URLs', () => {
  assert.equal(parseEdsUrl('https://www.example.com/'), null);
  assert.equal(parseEdsUrl('http://main--site--org.aem.page/'), null);
  assert.equal(parseEdsUrl('not a url'), null);
  assert.equal(parseEdsUrl('https://main--site.aem.page/'), null);
});

test('production host resolves through a saved project', () => {
  const projects = [{ org: 'Org', site: 'Site', prodHost: 'www.example.com' }];
  const ctx = resolveContext('https://www.example.com/about', projects);
  assert.equal(ctx.env, 'prod');
  assert.equal(ctx.org, 'org');
  assert.equal(ctx.ref, 'main');
  assert.equal(resolveContext('https://other.com/', projects), null);
});

test('contentPath maps web paths to content paths', () => {
  assert.equal(contentPath('/'), '/index');
  assert.equal(contentPath('/blog/'), '/blog/index');
  assert.equal(contentPath('/blog/post'), '/blog/post');
});

test('Universal Editor URL needs author host and IMS org', () => {
  const ctx = parseEdsUrl('https://main--site--org.aem.page/blog/post');
  assert.equal(buildUniversalEditorUrl(ctx, {}), null);
  const url = buildUniversalEditorUrl(ctx, {
    imsOrg: 'myims',
    authorHost: 'https://author-p1-e2.adobeaemcloud.com/',
    contentRoot: '/content/site/',
  });
  assert.equal(url, 'https://experience.adobe.com/#/@myims/aem/editor/canvas/author-p1-e2.adobeaemcloud.com/content/site/blog/post.html');
});

test('admin API edit URL wins over the configured template', () => {
  const ctx = parseEdsUrl('https://main--site--org.aem.page/');
  const groups = buildGroups(ctx, { adminEditUrl: 'https://example.test/edit' });
  const ue = groups.flatMap((g) => g.links).find((l) => l.id === 'ue');
  assert.equal(ue.url, 'https://example.test/edit');
});

test('unconfigured links are flagged, not broken', () => {
  const ctx = parseEdsUrl('https://main--site--org.aem.page/');
  const links = buildGroups(ctx).flatMap((g) => g.links);
  assert.equal(links.find((l) => l.id === 'ue').url, null);
  assert.equal(links.find((l) => l.id === 'prod').url, null);
  assert.equal(links.find((l) => l.id === 'repo').url, 'https://github.com/org/site');
});

test('custom link templates expand and fallback skips templated links', () => {
  const ctx = parseEdsUrl('https://main--site--org.aem.page/a');
  assert.equal(expandTemplate('https://github.com/{org}/{site}/issues', ctx), 'https://github.com/org/site/issues');
  const fb = buildFallbackGroups({ customLinks: [{ label: 'x', url: 'https://a/{org}' }, { label: 'y', url: 'https://b/' }] });
  const my = fb.find((g) => g.title === 'My links');
  assert.equal(my.links.length, 1);
});

import { loadSettings, saveSettings } from '../core/storage.js';
import { resolveContext } from '../core/parse-url.js';
import { buildGroups, buildFallbackGroups, findProject, branchUrl } from '../core/links.js';
import { lookupEditUrl } from '../core/admin.js';

const $ = (id) => document.getElementById(id);

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/** Draws the groups, optionally filtered. Returns the first rendered button. */
function render(groups, filter, onOpen) {
  const root = $('groups');
  root.replaceChildren();
  const q = filter.trim().toLowerCase();
  let first = null;

  for (const group of groups) {
    const links = q
      ? group.links.filter((l) => l.label.toLowerCase().includes(q) || group.title.toLowerCase().includes(q))
      : group.links;
    if (!links.length) continue;

    const section = document.createElement('section');
    const h = document.createElement('h2');
    h.textContent = group.title;
    const grid = document.createElement('div');
    grid.className = 'grid';

    for (const link of links) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'link';
      b.textContent = link.label;

      if (link.copy) {
        b.title = `Copy ${link.copy}`;
        b.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(link.copy);
            b.textContent = 'Copied ✓';
          } catch {
            b.textContent = 'Copy failed';
          }
          setTimeout(() => { b.textContent = link.label; }, 1200);
        });
      } else if (link.url) {
        b.title = link.url;
        b.addEventListener('click', () => onOpen(link.url));
      } else {
        b.classList.add('needs-setup');
        b.title = link.hint || 'Needs setup';
        b.addEventListener('click', () => chrome.runtime.openOptionsPage());
      }

      grid.append(b);
      first ??= b;
    }
    section.append(h, grid);
    root.append(section);
  }

  if (!first) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'No links match.';
    root.append(p);
  }
  return first;
}

async function init() {
  const settings = await loadSettings();
  const tab = await getActiveTab();

  const newTab = $('newTab');
  newTab.checked = settings.newTab;
  newTab.addEventListener('change', () => saveSettings({ newTab: newTab.checked }));
  $('opts').addEventListener('click', () => chrome.runtime.openOptionsPage());

  const open = async (url) => {
    if (newTab.checked || !tab?.id) await chrome.tabs.create({ url });
    else await chrome.tabs.update(tab.id, { url });
    window.close();
  };

  const ctx = tab?.url ? resolveContext(tab.url, settings.projects) : null;
  let groups;

  if (!ctx) {
    $('ctx').textContent = 'Not an Edge Delivery page';
    groups = buildFallbackGroups(settings);
  } else {
    $('ctx').textContent = `${ctx.org} / ${ctx.site} · ${ctx.ref}`;
    const badge = $('env');
    badge.hidden = false;
    badge.dataset.env = ctx.env;
    badge.textContent = ctx.env;

    const project = findProject(ctx, settings.projects);
    const adminEditUrl = settings.useAdminLookup ? await lookupEditUrl(ctx) : null;
    groups = buildGroups(ctx, { project, adminEditUrl, customLinks: settings.customLinks });

    const form = $('branchForm');
    form.hidden = false;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const url = branchUrl(ctx, $('branch').value);
      if (url) open(url);
    });
  }

  const search = $('search');
  let firstButton = render(groups, '', open);
  search.addEventListener('input', () => {
    firstButton = render(groups, search.value, open);
  });
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && firstButton) firstButton.click();
  });
  search.focus();
}

init();

import { loadSettings, saveSettings, DEFAULTS } from '../core/storage.js';

const $ = (id) => document.getElementById(id);
const ADMIN_ORIGIN = ['https://admin.hlx.page/*'];

let settings = { ...DEFAULTS };

function linksToText(links) {
  return links.map((l) => `${l.label} | ${l.url}`).join('\n');
}

function textToLinks(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf('|');
      return i === -1 ? null : { label: line.slice(0, i).trim(), url: line.slice(i + 1).trim() };
    })
    .filter((l) => l && l.label && /^https?:\/\//i.test(l.url));
}

function clean(value) {
  return (value || '').trim();
}

function renderProjects() {
  const root = $('projects');
  root.replaceChildren();
  if (!settings.projects.length) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'No projects saved yet.';
    root.append(p);
    return;
  }
  settings.projects.forEach((project, index) => {
    const row = document.createElement('div');
    row.className = 'project';
    const info = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = `${project.org} / ${project.site}`;
    const meta = document.createElement('small');
    meta.textContent = ` ${project.prodHost ? `· ${project.prodHost}` : ''}${project.authorHost ? ' · UE configured' : ''}`;
    info.append(name, meta);
    const actions = document.createElement('div');
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => {
      const form = $('projectForm');
      for (const [key, value] of Object.entries(project)) if (form.elements[key]) form.elements[key].value = value;
      form.elements.org.focus();
    });
    const del = document.createElement('button');
    del.type = 'button';
    del.textContent = 'Remove';
    del.addEventListener('click', async () => {
      settings.projects.splice(index, 1);
      await saveSettings({ projects: settings.projects });
      renderProjects();
    });
    actions.append(edit, ' ', del);
    row.append(info, actions);
    root.append(row);
  });
}

async function refreshAdminState() {
  const granted = await chrome.permissions.contains({ origins: ADMIN_ORIGIN });
  const on = granted && settings.useAdminLookup;
  $('adminPerm').textContent = on ? 'Disable lookup' : 'Enable lookup';
  $('adminState').textContent = on ? ' Enabled' : ' Off';
}

async function init() {
  settings = await loadSettings();
  $('customLinks').value = linksToText(settings.customLinks);
  renderProjects();
  refreshAdminState();

  $('projectForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target.elements;
    const project = {
      org: clean(f.org.value).toLowerCase(),
      site: clean(f.site.value).toLowerCase(),
      ref: clean(f.ref.value).toLowerCase() || 'main',
      prodHost: clean(f.prodHost.value).replace(/^https?:\/\//, '').replace(/\/$/, ''),
      authorHost: clean(f.authorHost.value).replace(/^https?:\/\//, '').replace(/\/$/, ''),
      contentRoot: clean(f.contentRoot.value),
      imsOrg: clean(f.imsOrg.value).replace(/^@/, ''),
    };
    const existing = settings.projects.findIndex((p) => p.org === project.org && p.site === project.site);
    if (existing >= 0) settings.projects[existing] = project;
    else settings.projects.push(project);
    await saveSettings({ projects: settings.projects });
    e.target.reset();
    renderProjects();
  });

  $('adminPerm').addEventListener('click', async () => {
    const granted = await chrome.permissions.contains({ origins: ADMIN_ORIGIN });
    if (granted && settings.useAdminLookup) {
      settings.useAdminLookup = false;
      await saveSettings({ useAdminLookup: false });
    } else {
      const ok = granted || (await chrome.permissions.request({ origins: ADMIN_ORIGIN }));
      settings.useAdminLookup = ok;
      await saveSettings({ useAdminLookup: ok });
    }
    refreshAdminState();
  });

  $('saveLinks').addEventListener('click', async () => {
    settings.customLinks = textToLinks($('customLinks').value);
    await saveSettings({ customLinks: settings.customLinks });
    $('customLinks').value = linksToText(settings.customLinks);
    $('linksState').textContent = ` Saved ${settings.customLinks.length} link(s)`;
  });

  $('export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'eds-navigator-settings.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $('import').addEventListener('click', () => $('file').click());
  $('file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const next = {
        newTab: Boolean(data.newTab ?? true),
        useAdminLookup: false,
        projects: Array.isArray(data.projects) ? data.projects : [],
        customLinks: Array.isArray(data.customLinks) ? data.customLinks : [],
      };
      await saveSettings(next);
      settings = { ...settings, ...next };
      $('customLinks').value = linksToText(settings.customLinks);
      renderProjects();
      refreshAdminState();
    } catch {
      alert('That file is not valid settings JSON.');
    }
    e.target.value = '';
  });
}

init();

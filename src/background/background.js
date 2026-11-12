import { loadSettings } from '../core/storage.js';
import { resolveContext } from '../core/parse-url.js';
import { findProject, buildUniversalEditorUrl, toggleUrl } from '../core/links.js';
import { lookupEditUrl } from '../core/admin.js';

async function currentTab(tab) {
  if (tab?.url) return tab;
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  return active;
}

chrome.commands.onCommand.addListener(async (command, tabFromEvent) => {
  const tab = await currentTab(tabFromEvent);
  if (!tab?.url) return;

  const settings = await loadSettings();
  const ctx = resolveContext(tab.url, settings.projects);
  if (!ctx) return;

  if (command === 'toggle-preview-live') {
    // Switching environment replaces the current tab, which feels natural for a toggle.
    await chrome.tabs.update(tab.id, { url: toggleUrl(ctx) });
    return;
  }

  if (command === 'open-editor') {
    const adminUrl = settings.useAdminLookup ? await lookupEditUrl(ctx) : null;
    const url = adminUrl || buildUniversalEditorUrl(ctx, findProject(ctx, settings.projects));
    if (!url) {
      await chrome.runtime.openOptionsPage();
      return;
    }
    if (settings.newTab) await chrome.tabs.create({ url });
    else await chrome.tabs.update(tab.id, { url });
  }
});

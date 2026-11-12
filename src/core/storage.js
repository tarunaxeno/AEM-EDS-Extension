export const DEFAULTS = {
  newTab: true,
  useAdminLookup: false,
  projects: [],
  customLinks: [],
};

export async function loadSettings() {
  const stored = await chrome.storage.sync.get(DEFAULTS);
  return { ...DEFAULTS, ...stored };
}

export async function saveSettings(patch) {
  await chrome.storage.sync.set(patch);
}

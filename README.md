# EDS Navigator

Chrome/Edge extension (Manifest V3, no build step) with one-click links for Edge Delivery Services projects that use the Universal Editor.

## Install (unpacked)
1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select this folder.
3. Pin the extension, open any `*.aem.page` / `*.aem.live` page and click the icon.

## First-time setup (for the Universal Editor button)
Open **Options** and add your project: GitHub org, site/repo, production host, AEM author host, content root and IMS org.
Optionally enable the Admin API lookup to get the exact editor URL automatically.

## Features
- Preview / Live / Production switching, Universal Editor, plain HTML, admin status, GitHub repo / branch / actions, query index, sitemap, robots.txt, PageSpeed, AEM Tools
- Filter box (type, then Enter opens the first match)
- Copy preview URL, live URL or page path
- Open the same page on another branch
- Shortcuts: Alt+Shift+L toggles Preview/Live, Alt+Shift+E opens the Universal Editor (change at brave://extensions/shortcuts)
- Your own links with {org} {site} {ref} {path} {host} placeholders

## Develop
- `npm test` runs the unit tests for the URL parser and link builder (`src/core`, no browser APIs).
- After editing, click the reload icon on the extension card in `chrome://extensions`.

## To verify before release
- `ADMIN_BASE` and the Universal Editor URL pattern in `src/core/links.js` against the current aem.live docs.

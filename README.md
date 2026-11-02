# GChecklist (gSender plugin)

A pre-job checklist for [gSender](https://github.com/Sienci-Labs/gsender). It lives as a **Checklist** tab in the Tools panel on the Carve screen, so you can tick off your setup steps before every job. It's a reminder only: it never touches the machine or your job.

![The GChecklist tab in gSender](docs/images/checklist-tab.png)

## Features

![GChecklist on gSender's Carve screen](docs/images/carve-screen.webp)

- **Touch-friendly list:** every item is a large button, laid out in two columns when the panel is wide enough. Tap to tick, tap again to untick.
- **Green when ready:** the whole panel turns green once every item is ticked.
- **Reset** (bottom right) clears all ticks.
- **Edit** (bottom right) lets you add, remove, reorder and rename items, or restore the default list. gSender saves your list.
- **Fresh start:** ticks clear each time gSender is launched, so you start with an empty list. Switching between tabs and pages keeps your ticks.

## Install

1. Build it (needs Node.js 18+):
   ```
   npm install
   npm run package
   ```
   This creates `release/gchecklist/` and `release/gchecklist.zip`.
2. Copy the `release/gchecklist` folder into gSender's plugins folder:
   - Windows: `%APPDATA%\gSender\plugins\`
   - macOS: `~/Library/Application Support/gSender/plugins/`
   - Linux: `~/.config/gSender/plugins/`

   The exact path is also shown under **Tools → Plugins**, which also has an install option for the zip.
3. Restart gSender. Check that **GChecklist** is enabled under **Tools → Plugins**:

   ![GChecklist in gSender's Plugins list](docs/images/plugins-page.png)

4. On the Carve screen, open the **Checklist** tab in the Tools panel. If you don't see it, scroll the tab row with the arrow at its right end.

Needs a gSender build with plugin support (the manifest asks for `>=1.6.0`; tested on 1.7.0 Edge). The only permission the plugin asks for is to save its own settings (your list and ticks). It can't read or control the machine.

## Why there's no automatic pause

Earlier versions could pause a job that started with items unticked. That was removed because it can't work reliably: in gSender 1.7.0 Edge a plugin tab only runs while it is the open tab, so the pause silently does nothing whenever another tab is showing, and a safety feature that sometimes doesn't fire is worse than none. If gSender later keeps plugin tabs running in the background, it could come back.

## Develop

`npm run watch` rebuilds `ui/` on every change. If this folder is inside a gSender dev checkout's `plugins/` folder, the open tab reloads by itself.

# GChecklist (gSender plugin)

A pre-job checklist for [gSender](https://github.com/Sienci-Labs/gsender). It lives as a **Checklist** tab in the Tools panel on the Carve screen, so you can tick off your setup steps before every job. It only warns you: it never pauses, stops or sends anything to your machine.

![The GChecklist tab in gSender](docs/images/checklist-tab.png)

## Features

![GChecklist on gSender's Carve screen](docs/images/carve-screen.webp)

- **Touch-friendly list:** every item is a large button, laid out in two columns when the panel is wide enough. Tap to tick, tap again to untick.
- **Green when ready:** the whole panel turns green once every item is ticked.
- **Red warning:** if a job starts before everything is ticked, the panel flashes red twice and plays a sound. This only happens while the Checklist tab is the open tab (see below). In **Edit** you can turn the flash and the sound off separately.
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

Needs a gSender build with plugin support (the manifest asks for `>=1.6.0`; tested on 1.7.0 Edge). The plugin asks to save its own settings (your list and ticks) and to listen for when a job starts, which is read-only: it has no permission to send commands to the machine.

## What the warning can and can't do

Earlier versions could pause a job that started with items unticked. That was removed because it can't work reliably, and the red warning has the same limit:

- **It only works while the Checklist tab is the open tab.** In gSender 1.7.0 Edge a plugin tab only runs while it is showing. Switch to Probe, Macros or another tab and the plugin is shut down, so nothing flashes, nothing sounds, and nothing could pause. gSender builds the tab this way and a plugin can't change it. Newer gSender code keeps plugin tabs running in the background, so this may go away in a later release.
- **It warns, it doesn't stop anything.** The job keeps running; the flash and sound are there to make you look. Treat it as a reminder, not a safety device.
- A job that is resumed after a pause doesn't trigger it, only a new start does.

## Develop

`npm run watch` rebuilds `ui/` on every change. If this folder is inside a gSender dev checkout's `plugins/` folder, the open tab reloads by itself.

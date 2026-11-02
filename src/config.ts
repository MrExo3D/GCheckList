import { storage } from '@sienci/gsender-plugin-sdk';

export type ChecklistItem = { id: string; text: string };

// What happens when a job starts:
//   off      - never interrupt
//   unticked - pause only if something on the list is still unticked
//   always   - pause and ask every time
export type GuardMode = 'off' | 'unticked' | 'always';

export type Config = {
    items: ChecklistItem[];
    mode: GuardMode;
    // clear the ticks once a job finishes, so every job starts fresh
    autoReset: boolean;
    // the Checklist tab may be hidden when we pause, so make a sound
    beep: boolean;
};

const CONFIG_KEY = 'config';
const CHECKED_KEY = 'checked';

export const newId = (): string =>
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// kept short so each one fits on a touch button; ordered roughly in the
// order you'd set up a job
const DEFAULT_ITEM_TEXT = [
    'Glasses, hearing and dust protection on',
    'Hair tied back, no loose clothing or jewelry',
    'E-stop within reach',
    'Material matches CAM (size, thickness, orientation)',
    'Workpiece secured, wasteboard clear',
    'Clamps and screws outside the toolpath',
    'Correct bit, in good condition',
    'Collet clean, bit tight, reaches cut depth',
    'Machine homed, correct work coordinates',
    'Spindle / router ready and powered',
    'X, Y, Z zero set to match the CAM file',
    'Right G-code loaded, toolpath reviewed',
    'Dust collection on and clear of the gantry',
    'Jogged above material, position looks right',
];

export const defaultConfig = (): Config => ({
    items: DEFAULT_ITEM_TEXT.map((text) => ({ id: newId(), text })),
    mode: 'unticked',
    autoReset: true,
    beep: true,
});

const isMode = (value: unknown): value is GuardMode =>
    value === 'off' || value === 'unticked' || value === 'always';

// storage holds whatever an older version (or a hand edit) wrote, so take
// only the fields that look right and fall back to defaults for the rest
const sanitizeConfig = (raw: unknown): Config => {
    const fallback = defaultConfig();
    if (!raw || typeof raw !== 'object') {
        return fallback;
    }
    const value = raw as Partial<Config>;
    const items = Array.isArray(value.items)
        ? value.items
              .filter(
                  (item): item is ChecklistItem =>
                      !!item &&
                      typeof item.id === 'string' &&
                      typeof item.text === 'string',
              )
              .map(({ id, text }) => ({ id, text }))
        : fallback.items;
    return {
        items,
        mode: isMode(value.mode) ? value.mode : fallback.mode,
        autoReset:
            typeof value.autoReset === 'boolean'
                ? value.autoReset
                : fallback.autoReset,
        beep: typeof value.beep === 'boolean' ? value.beep : fallback.beep,
    };
};

const LAUNCH_KEY = 'launch';
const DEBUG_KEY = 'lastLoad';

// Ticks from a previous launch say nothing about the job being set up now, so
// they are cleared once per launch. The plugin runs in an iframe served from
// the same origin as gSender's own window, so it can read when that window
// was opened. That time is the same while the Checklist tab is re-mounted and
// different after gSender is quit and started again.
const currentLaunchId = (): string | null => {
    try {
        return String(Math.round(window.parent.performance.timeOrigin));
    } catch {
        return null;
    }
};

export const loadState = async (): Promise<{
    config: Config;
    checked: string[];
}> => {
    const [rawConfig, rawChecked, rawLaunch] = await Promise.all([
        storage.get<unknown>(CONFIG_KEY),
        storage.get<unknown>(CHECKED_KEY),
        storage.get<unknown>(LAUNCH_KEY),
    ]);
    const config =
        rawConfig === undefined ? defaultConfig() : sanitizeConfig(rawConfig);
    if (rawConfig === undefined) {
        await storage.set(CONFIG_KEY, config);
    }
    const saved = Array.isArray(rawChecked)
        ? rawChecked.filter((id): id is string => typeof id === 'string')
        : [];

    // if the launch time can't be read, assume a new launch: starting with an
    // empty list is the safe mistake
    const launchId = currentLaunchId();
    const newLaunch = launchId === null || rawLaunch !== launchId;
    if (launchId !== null && newLaunch) {
        await storage.set(LAUNCH_KEY, launchId);
    }
    const cleared = newLaunch && saved.length > 0;
    if (cleared) {
        await storage.set(CHECKED_KEY, []);
    }
    // a short record of the last load, for working out what happened
    void storage.set(DEBUG_KEY, {
        at: new Date().toISOString(),
        launchId,
        previousLaunchId: rawLaunch ?? null,
        newLaunch,
        savedTicks: saved.length,
        cleared,
    });
    return { config, checked: cleared ? [] : saved };
};

export const saveConfig = (config: Config) => storage.set(CONFIG_KEY, config);

export const saveChecked = (checked: string[]) =>
    storage.set(CHECKED_KEY, checked);

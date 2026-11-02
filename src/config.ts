import { storage } from '@sienci/gsender-plugin-sdk';

export type ChecklistItem = { id: string; text: string };

export type Config = {
    items: ChecklistItem[];
    // when a job starts before everything is ticked:
    flash: boolean; // flash the panel red
    sound: boolean; // play a sound
};

// gSender saves plugin data with a deep merge, which can add and overwrite but
// never remove: saving a shorter array or object leaves the old entries behind
// (an empty list clears nothing). Lists are therefore saved as JSON text, which
// is replaced whole. The earlier versions saved real arrays under the old keys.
const CONFIG_KEY = 'configJson';
const CHECKED_KEY = 'checkedJson';
const LAUNCH_KEY = 'launch';
// keys written by earlier versions; read once so they can be migrated or removed
const LEGACY_CONFIG_KEY = 'config';
const LEGACY_CHECKED_KEY = 'checked';
const LEGACY_DEBUG_KEY = 'lastLoad';

const readJson = (raw: unknown): unknown => {
    if (typeof raw !== 'string') {
        return undefined;
    }
    try {
        return JSON.parse(raw);
    } catch {
        return undefined;
    }
};

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
    flash: true,
    sound: true,
});

// storage holds whatever an older version (or a hand edit) wrote, so take
// only the fields that look right and fall back to defaults for the rest.
// Settings from versions that could pause jobs (mode, beep, autoReset...) are
// ignored and dropped the next time the list is saved.
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
              // an earlier merge-based save could leave the same item twice
              .filter(
                  (item, index, all) =>
                      all.findIndex((other) => other.id === item.id) === index,
              )
        : fallback.items;
    return {
        items,
        flash: typeof value.flash === 'boolean' ? value.flash : fallback.flash,
        sound: typeof value.sound === 'boolean' ? value.sound : fallback.sound,
    };
};

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

export const saveConfig = (config: Config) =>
    storage.set(CONFIG_KEY, JSON.stringify(config));

export const saveChecked = (checked: string[]) =>
    storage.set(CHECKED_KEY, JSON.stringify(checked));

export const loadState = async (): Promise<{
    config: Config;
    checked: string[];
}> => {
    const [
        rawConfig,
        rawChecked,
        rawLaunch,
        legacyConfig,
        legacyChecked,
        legacyDebug,
    ] = await Promise.all([
        storage.get<unknown>(CONFIG_KEY),
        storage.get<unknown>(CHECKED_KEY),
        storage.get<unknown>(LAUNCH_KEY),
        storage.get<unknown>(LEGACY_CONFIG_KEY),
        storage.get<unknown>(LEGACY_CHECKED_KEY),
        storage.get<unknown>(LEGACY_DEBUG_KEY),
    ]);

    // the list: the saved text, else the list an earlier version saved, else
    // the defaults
    const savedConfig = readJson(rawConfig);
    const config = sanitizeConfig(
        savedConfig !== undefined ? savedConfig : legacyConfig,
    );
    // saved again when it came from an older version, so the settings from the
    // pausing versions are dropped
    const hasOldSettings =
        !!savedConfig &&
        typeof savedConfig === 'object' &&
        Object.keys(savedConfig).some(
            (key) => !['items', 'flash', 'sound'].includes(key),
        );
    if (savedConfig === undefined || hasOldSettings) {
        await saveConfig(config);
    }

    // ticks an earlier version saved can't be trusted (clearing them never
    // took effect), so they are dropped along with the other old keys
    if (legacyConfig !== undefined) {
        await storage.delete(LEGACY_CONFIG_KEY);
    }
    if (legacyChecked !== undefined) {
        await storage.delete(LEGACY_CHECKED_KEY);
    }
    if (legacyDebug !== undefined) {
        await storage.delete(LEGACY_DEBUG_KEY);
    }

    const savedChecked = readJson(rawChecked);
    const saved = Array.isArray(savedChecked)
        ? savedChecked.filter((id): id is string => typeof id === 'string')
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
        await saveChecked([]);
    }
    return { config, checked: cleared ? [] : saved };
};

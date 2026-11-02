import { useCallback, useEffect, useState } from 'react';

import {
    type ChecklistItem,
    type Config,
    type GuardMode,
    defaultConfig,
    loadState,
    newId,
    saveChecked,
    saveConfig,
} from './config';
import { useJobGuard } from './useJobGuard';

const MODE_LABELS: Record<GuardMode, string> = {
    unticked: 'Pause if anything is unticked',
    always: 'Always pause and ask',
    off: "Don't pause",
};

type ChecklistProps = {
    items: ChecklistItem[];
    checked: Set<string>;
    onToggle: (id: string) => void;
};

// each item is a full-width button so it's easy to hit on a touchscreen
const Checklist = ({ items, checked, onToggle }: ChecklistProps) => (
    <ul className="checklist">
        {items.map((item) => {
            const done = checked.has(item.id);
            return (
                <li key={item.id}>
                    <button
                        type="button"
                        role="checkbox"
                        aria-checked={done}
                        className={done ? 'item done' : 'item'}
                        onClick={() => onToggle(item.id)}
                    >
                        <span className="box" aria-hidden="true">
                            {done ? '✓' : ''}
                        </span>
                        <span className="text">
                            {item.text || <em>(empty item)</em>}
                        </span>
                    </button>
                </li>
            );
        })}
    </ul>
);

type EditorProps = {
    config: Config;
    onChange: (config: Config) => void;
    onDone: () => void;
    onTestPause: () => void;
};

const Editor = ({ config, onChange, onDone, onTestPause }: EditorProps) => {
    const [confirmingRestore, setConfirmingRestore] = useState(false);
    const setItems = (items: ChecklistItem[]) => onChange({ ...config, items });

    const move = (index: number, delta: number) => {
        const target = index + delta;
        if (target < 0 || target >= config.items.length) {
            return;
        }
        const items = [...config.items];
        [items[index], items[target]] = [items[target], items[index]];
        setItems(items);
    };

    return (
        <div className="editor">
            <div className="toolbar">
                <h1>Edit checklist</h1>
                <button type="button" className="primary" onClick={onDone}>
                    Done
                </button>
            </div>

            <ul className="edit-items">
                {config.items.map((item, index) => (
                    <li key={item.id}>
                        <input
                            type="text"
                            value={item.text}
                            placeholder="Something to check"
                            onChange={(e) =>
                                setItems(
                                    config.items.map((it) =>
                                        it.id === item.id
                                            ? { ...it, text: e.target.value }
                                            : it,
                                    ),
                                )
                            }
                        />
                        <button
                            type="button"
                            className="icon"
                            title="Move up"
                            disabled={index === 0}
                            onClick={() => move(index, -1)}
                        >
                            ↑
                        </button>
                        <button
                            type="button"
                            className="icon"
                            title="Move down"
                            disabled={index === config.items.length - 1}
                            onClick={() => move(index, 1)}
                        >
                            ↓
                        </button>
                        <button
                            type="button"
                            className="icon danger"
                            title="Remove"
                            onClick={() =>
                                setItems(
                                    config.items.filter(
                                        (it) => it.id !== item.id,
                                    ),
                                )
                            }
                        >
                            ✕
                        </button>
                    </li>
                ))}
            </ul>
            <button
                type="button"
                onClick={() =>
                    setItems([...config.items, { id: newId(), text: '' }])
                }
            >
                + Add item
            </button>

            <fieldset>
                <legend>When a job starts</legend>
                {(Object.keys(MODE_LABELS) as GuardMode[]).map((mode) => (
                    <label key={mode} className="option">
                        <input
                            type="radio"
                            name="mode"
                            checked={config.mode === mode}
                            onChange={() => onChange({ ...config, mode })}
                        />
                        {MODE_LABELS[mode]}
                    </label>
                ))}
                <button
                    type="button"
                    className="test-pause"
                    onClick={onTestPause}
                >
                    Test pause prompt
                </button>
                <span className="hint">
                    Shows the prompt and plays the beep. No job is paused.
                </span>
            </fieldset>

            <fieldset>
                <legend>Options</legend>
                <label className="option">
                    <input
                        type="checkbox"
                        checked={config.autoReset}
                        onChange={(e) =>
                            onChange({ ...config, autoReset: e.target.checked })
                        }
                    />
                    Clear ticks when a job finishes
                </label>
                <label className="option">
                    <input
                        type="checkbox"
                        checked={config.beep}
                        onChange={(e) =>
                            onChange({ ...config, beep: e.target.checked })
                        }
                    />
                    Beep when pausing a job
                </label>
            </fieldset>

            {/* the plugin iframe can't open browser dialogs, so confirm inline */}
            {confirmingRestore ? (
                <div className="confirm">
                    <span>Replace your list and options with the defaults?</span>
                    <button
                        type="button"
                        className="danger"
                        onClick={() => {
                            onChange(defaultConfig());
                            setConfirmingRestore(false);
                        }}
                    >
                        Replace
                    </button>
                    <button
                        type="button"
                        onClick={() => setConfirmingRestore(false)}
                    >
                        Keep mine
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    className="link"
                    onClick={() => setConfirmingRestore(true)}
                >
                    Restore defaults
                </button>
            )}
        </div>
    );
};

const App = () => {
    const [config, setConfig] = useState<Config | null>(null);
    const [checked, setChecked] = useState<string[]>([]);
    const [editing, setEditing] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        loadState()
            .then((state) => {
                setConfig(state.config);
                setChecked(state.checked);
            })
            .catch((err: unknown) => {
                setLoadError(err instanceof Error ? err.message : String(err));
                setConfig(defaultConfig());
            });
    }, []);

    // takes an updater so quick taps in a row each see the previous one
    const updateChecked = useCallback(
        (update: (prev: string[]) => string[]) => {
            setChecked((prev) => {
                const next = update(prev);
                void saveChecked(next);
                return next;
            });
        },
        [],
    );

    const updateConfig = useCallback(
        (next: Config) => {
            setConfig(next);
            void saveConfig(next);
            // drop ticks for items that were removed
            const ids = new Set(next.items.map((item) => item.id));
            setChecked((prev) => {
                const kept = prev.filter((id) => ids.has(id));
                if (kept.length !== prev.length) {
                    void saveChecked(kept);
                }
                return kept;
            });
        },
        [],
    );

    const resetChecks = useCallback(
        () => updateChecked(() => []),
        [updateChecked],
    );

    const { phase, error, preview, showPreview, continueJob, stopJob } =
        useJobGuard({
            config,
            checked,
            onJobEnded: resetChecks,
        });

    // turn the whole panel green once everything is ticked; the class goes on
    // <html> so the background fills the iframe, not just the list
    const everythingTicked =
        !!config &&
        config.items.length > 0 &&
        config.items.every((item) => checked.includes(item.id));
    useEffect(() => {
        document.documentElement.classList.toggle('all-done', everythingTicked);
    }, [everythingTicked]);

    if (!config) {
        return <div className="app loading">Loading…</div>;
    }

    const checkedSet = new Set(checked);
    const toggle = (id: string) =>
        updateChecked((prev) =>
            prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
        );
    const doneCount = config.items.filter((item) => checkedSet.has(item.id)).length;
    const total = config.items.length;
    const allDone = total > 0 && doneCount === total;

    if (phase !== 'none') {
        return (
            <div
                className={allDone ? 'app prompt ready' : 'app prompt'}
                role="alertdialog"
                aria-live="assertive"
            >
                <div className="prompt-head">
                    <h1>
                        {preview
                            ? 'Test: job paused'
                            : phase === 'pausing'
                              ? 'Pausing job…'
                              : 'Job paused'}
                    </h1>
                    <p>
                        {preview
                            ? 'This is how the prompt looks. No job is running.'
                            : allDone
                              ? 'Everything is ticked. Ready to continue?'
                              : 'Did you check everything before this job?'}
                    </p>
                </div>
                <Checklist
                    items={config.items}
                    checked={checkedSet}
                    onToggle={toggle}
                />
                {error && <p className="error">{error}</p>}
                <div className="actions">
                    <button
                        type="button"
                        className={allDone ? 'primary' : undefined}
                        disabled={phase === 'pausing'}
                        onClick={continueJob}
                    >
                        Continue job
                    </button>
                    <button type="button" className="danger" onClick={stopJob}>
                        Stop job
                    </button>
                </div>
            </div>
        );
    }

    if (editing) {
        return (
            <div className="app">
                <Editor
                    config={config}
                    onChange={updateConfig}
                    onDone={() => setEditing(false)}
                    onTestPause={() => {
                        setEditing(false);
                        showPreview();
                    }}
                />
            </div>
        );
    }

    return (
        <div className="app">
            <div className="toolbar">
                <h1>
                    Before you run{' '}
                    <span className={allDone ? 'count all' : 'count'}>
                        {doneCount}/{total}
                    </span>
                </h1>
                <div className="toolbar-buttons">
                    <button
                        type="button"
                        onClick={resetChecks}
                        disabled={doneCount === 0}
                    >
                        Reset
                    </button>
                    <button type="button" onClick={() => setEditing(true)}>
                        Edit
                    </button>
                </div>
            </div>
            {loadError && (
                <p className="error">Couldn't load saved list: {loadError}</p>
            )}
            {total === 0 ? (
                <p className="hint">
                    Your checklist is empty. Click Edit to add items.
                </p>
            ) : (
                <Checklist
                    items={config.items}
                    checked={checkedSet}
                    onToggle={toggle}
                />
            )}
            <p className="hint footer">
                {config.mode === 'off'
                    ? 'Jobs start without a check.'
                    : config.mode === 'always'
                      ? 'Each job pauses right after it starts so you can confirm.'
                      : 'A job pauses right after it starts if anything is unticked.'}
            </p>
        </div>
    );
};

export default App;

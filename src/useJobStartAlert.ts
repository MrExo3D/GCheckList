import { machine } from '@sienci/gsender-plugin-sdk';
import { useEffect, useRef } from 'react';

import { beep } from './beep';

type WorkflowState = 'idle' | 'running' | 'paused';

const FLASH_CLASS = 'flashing';
const FLASH_MS = 1500; // two 0.7s flashes, see index.css

// restarts the animation even if one is already playing
const flashRed = () => {
    const root = document.documentElement;
    root.classList.remove(FLASH_CLASS);
    void root.offsetWidth; // force a reflow so the animation starts over
    root.classList.add(FLASH_CLASS);
    window.setTimeout(() => root.classList.remove(FLASH_CLASS), FLASH_MS);
};

/**
 * Flashes the panel red and plays a sound when a job starts while the list
 * isn't fully ticked.
 * It only listens: nothing is sent to the machine and the job is never paused.
 * gSender runs a plugin tab only while it is showing, so this can only react
 * while the Checklist tab is the open tab.
 */
export const useJobStartAlert = (
    options: { flash: boolean; sound: boolean },
    allTicked: boolean,
) => {
    // the listener is registered once, so it reads the latest values from refs
    const optionsRef = useRef(options);
    const allTickedRef = useRef(allTicked);
    optionsRef.current = options;
    allTickedRef.current = allTicked;

    useEffect(() => {
        let previous: WorkflowState | null = null;
        const unsubscribe = machine.addListener(
            'workflow:state',
            (...args: unknown[]) => {
                const state = args[0] as WorkflowState;
                // idle -> running is a job starting; paused -> running is a
                // resume and isn't flashed
                const started =
                    state === 'running' &&
                    previous !== 'running' &&
                    previous !== 'paused';
                previous = state;
                if (started && !allTickedRef.current) {
                    if (optionsRef.current.flash) {
                        flashRed();
                    }
                    if (optionsRef.current.sound) {
                        beep();
                    }
                }
            },
        );
        return unsubscribe;
    }, []);
};

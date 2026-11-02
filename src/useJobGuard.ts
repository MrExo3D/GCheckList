import { machine } from '@sienci/gsender-plugin-sdk';
import { useCallback, useEffect, useRef, useState } from 'react';

import { beep } from './beep';
import type { Config } from './config';

type WorkflowState = 'idle' | 'running' | 'paused';

// pausing: we sent the pause, gSender hasn't reported it yet
// waiting: job is paused and the prompt is asking the user
export type GuardPhase = 'none' | 'pausing' | 'waiting';

type Options = {
    config: Config | null;
    checked: string[];
    onJobEnded: () => void;
};

/**
 * gSender gives plugins no hook before a job starts, so this watches the
 * workflow state and pauses the job as soon as it goes from idle to running.
 * A few lines may already have been sent by then.
 */
export const useJobGuard = ({ config, checked, onJobEnded }: Options) => {
    const [phase, setPhase] = useState<GuardPhase>('none');
    const [error, setError] = useState<string | null>(null);

    // the controller listener is registered once, so it reads these refs
    const configRef = useRef(config);
    const checkedRef = useRef(checked);
    const onJobEndedRef = useRef(onJobEnded);
    const phaseRef = useRef<GuardPhase>('none');
    const lastStateRef = useRef<WorkflowState | null>(null);
    // set when the user stops the job from our prompt, so the ticks they
    // just made aren't wiped by auto-reset
    const stoppedByPromptRef = useRef(false);

    configRef.current = config;
    checkedRef.current = checked;
    onJobEndedRef.current = onJobEnded;

    const updatePhase = (next: GuardPhase) => {
        phaseRef.current = next;
        setPhase(next);
    };

    useEffect(() => {
        const handleJobStart = () => {
            const cfg = configRef.current;
            if (!cfg || cfg.mode === 'off') {
                return;
            }
            const done = new Set(checkedRef.current);
            const allTicked = cfg.items.every((item) => done.has(item.id));
            if (cfg.mode === 'unticked' && allTicked) {
                return;
            }
            setError(null);
            updatePhase('pausing');
            if (cfg.beep) {
                beep();
            }
            machine.command('gcode:pause').catch((err: unknown) => {
                setError(
                    `Couldn't pause the job: ${err instanceof Error ? err.message : String(err)}`,
                );
                updatePhase('waiting');
            });
        };

        const unsubscribe = machine.addListener(
            'workflow:state',
            (...args: unknown[]) => {
                const state = args[0] as WorkflowState;
                const previous = lastStateRef.current;
                lastStateRef.current = state;

                if (state === 'running') {
                    if (previous === 'paused') {
                        // resumed, by us or by gSender's own resume button
                        if (phaseRef.current === 'waiting') {
                            updatePhase('none');
                        }
                    } else if (previous !== 'running') {
                        handleJobStart();
                    }
                } else if (state === 'paused') {
                    if (phaseRef.current === 'pausing') {
                        updatePhase('waiting');
                    }
                } else if (state === 'idle') {
                    const jobEnded =
                        previous === 'running' || previous === 'paused';
                    if (phaseRef.current !== 'none') {
                        updatePhase('none');
                    }
                    if (jobEnded) {
                        if (
                            configRef.current?.autoReset &&
                            !stoppedByPromptRef.current
                        ) {
                            onJobEndedRef.current();
                        }
                        stoppedByPromptRef.current = false;
                    }
                }
            },
        );
        return unsubscribe;
    }, []);

    const continueJob = useCallback(async () => {
        setError(null);
        try {
            await machine.command('gcode:resume');
        } catch (err) {
            setError(
                `Couldn't resume: ${err instanceof Error ? err.message : String(err)}`,
            );
        }
    }, []);

    const stopJob = useCallback(async () => {
        setError(null);
        stoppedByPromptRef.current = true;
        try {
            await machine.command('gcode:stop', { force: true });
        } catch (err) {
            stoppedByPromptRef.current = false;
            setError(
                `Couldn't stop: ${err instanceof Error ? err.message : String(err)}`,
            );
        }
    }, []);

    return { phase, error, continueJob, stopJob };
};

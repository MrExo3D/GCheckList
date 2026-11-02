let context: AudioContext | null = null;

// two short tones; failures are ignored since the sound is only a nudge
export const beep = () => {
    try {
        context ??= new AudioContext();
        void context.resume();
        const start = context.currentTime;
        [0, 0.22].forEach((offset, index) => {
            const osc = context!.createOscillator();
            const gain = context!.createGain();
            osc.type = 'sine';
            osc.frequency.value = index === 0 ? 880 : 660;
            gain.gain.setValueAtTime(0.0001, start + offset);
            gain.gain.exponentialRampToValueAtTime(0.25, start + offset + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.18);
            osc.connect(gain).connect(context!.destination);
            osc.start(start + offset);
            osc.stop(start + offset + 0.2);
        });
    } catch {
        // no audio available
    }
};

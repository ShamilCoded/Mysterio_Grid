export const playSound = (type: 'slide' | 'win' | 'click', enabled: boolean) => {
    if (!enabled || typeof window === 'undefined') return;
    
    // @ts-ignore
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    // Use a shared context to avoid creating too many and hitting limits
    if (!(window as any)._sharedAudioContext) {
        (window as any)._sharedAudioContext = new AudioContextClass();
    }
    const ctx = (window as any)._sharedAudioContext as AudioContext;
    
    if (ctx.state === 'suspended') {
        ctx.resume();
    }

    const gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);
    const now = ctx.currentTime;

    if (type === 'click') {
        const osc = ctx.createOscillator();
        osc.connect(gainNode);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);
        gainNode.gain.setValueAtTime(0.15, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'slide') {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        
        osc.connect(filter);
        filter.connect(gainNode);
        
        osc.type = 'square';
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, now);
        filter.frequency.linearRampToValueAtTime(100, now + 0.1);
        
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'win') {
        const playNote = (freq: number, startTime: number, duration: number) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = 'triangle';
            o.frequency.value = freq;
            o.connect(g);
            g.connect(ctx.destination);
            g.gain.setValueAtTime(0, startTime);
            g.gain.linearRampToValueAtTime(0.15, startTime + duration * 0.1);
            g.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
            o.start(startTime);
            o.stop(startTime + duration);
        };
        
        playNote(440, now, 0.5); // A4
        playNote(554.37, now + 0.1, 0.5); // C#5
        playNote(659.25, now + 0.2, 0.6); // E5
        playNote(880, now + 0.3, 1.0); // A5
    }
};

export const playSound = (type: 'throw' | 'hit') => {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const gain = ctx.createGain();
        gain.connect(ctx.destination);
        
        if (type === 'throw') {
            const osc = ctx.createOscillator();
            osc.connect(gain);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(200, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 1.0);
            gain.gain.setValueAtTime(0.5, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.0);
            osc.start();
            osc.stop(ctx.currentTime + 1.0);
        } else if (type === 'hit') {
            const osc = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            osc.connect(gain);
            osc2.connect(gain);
            
            osc.type = 'square';
            osc.frequency.setValueAtTime(150, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.3);
            
            osc2.type = 'sawtooth';
            osc2.frequency.setValueAtTime(500, ctx.currentTime);
            osc2.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.3);
            
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            
            osc.start();
            osc2.start();
            osc.stop(ctx.currentTime + 0.3);
            osc2.stop(ctx.currentTime + 0.3);
        }
    } catch (e) {
        console.error("Audio play error", e);
    }
}

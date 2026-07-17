/**
 * NES APU (Audio Processing Unit) Synthesizer via Web Audio API
 */

class NESAPU {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.masterVolume = 0.25;

        // Channel state registers
        this.sq1Regs = new Uint8Array(4);
        this.sq2Regs = new Uint8Array(4);
        this.triRegs = new Uint8Array(4);
        this.noiseRegs = new Uint8Array(4);

        // Web Audio Nodes
        this.sq1Osc = null;
        this.sq1Gain = null;
        this.sq2Osc = null;
        this.sq2Gain = null;
        this.triOsc = null;
        this.triGain = null;
        this.noiseNode = null;
        this.noiseGain = null;

        this.dutyCycles = [0.125, 0.25, 0.5, 0.75];
    }

    initAudioContext() {
        if (this.ctx) return;
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioCtx();
            this.setupNodes();
        } catch (e) {
            console.warn('Web Audio API not available or suspended:', e);
        }
    }

    resumeAudio() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    setupNodes() {
        if (!this.ctx) return;

        // Square 1
        this.sq1Osc = this.ctx.createOscillator();
        this.sq1Gain = this.ctx.createGain();
        this.sq1Osc.type = 'square';
        this.sq1Gain.gain.setValueAtTime(0, this.ctx.currentTime);
        this.sq1Osc.connect(this.sq1Gain);
        this.sq1Gain.connect(this.ctx.destination);
        this.sq1Osc.start();

        // Square 2
        this.sq2Osc = this.ctx.createOscillator();
        this.sq2Gain = this.ctx.createGain();
        this.sq2Osc.type = 'square';
        this.sq2Gain.gain.setValueAtTime(0, this.ctx.currentTime);
        this.sq2Osc.connect(this.sq2Gain);
        this.sq2Gain.connect(this.ctx.destination);
        this.sq2Osc.start();

        // Triangle
        this.triOsc = this.ctx.createOscillator();
        this.triGain = this.ctx.createGain();
        this.triOsc.type = 'triangle';
        this.triGain.gain.setValueAtTime(0, this.ctx.currentTime);
        this.triOsc.connect(this.triGain);
        this.triGain.connect(this.ctx.destination);
        this.triOsc.start();

        // Noise Channel (BufferSource)
        this.setupNoiseChannel();
    }

    setupNoiseChannel() {
        if (!this.ctx) return;
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        this.noiseBuffer = buffer;
        this.noiseGain = this.ctx.createGain();
        this.noiseGain.gain.setValueAtTime(0, this.ctx.currentTime);
        this.noiseGain.connect(this.ctx.destination);
    }

    writeRegister(addr, val) {
        if (!this.enabled) return;
        this.initAudioContext();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;

        if (addr >= 0x4000 && addr <= 0x4003) { // Square 1
            this.sq1Regs[addr - 0x4000] = val;
            this.updateSquare(1, now);
        } else if (addr >= 0x4004 && addr <= 0x4007) { // Square 2
            this.sq2Regs[addr - 0x4004] = val;
            this.updateSquare(2, now);
        } else if (addr >= 0x4008 && addr <= 0x400B) { // Triangle
            this.triRegs[addr - 0x4008] = val;
            this.updateTriangle(now);
        } else if (addr >= 0x400C && addr <= 0x400F) { // Noise
            this.noiseRegs[addr - 0x400C] = val;
            this.updateNoise(now);
        }
    }

    updateSquare(ch, now) {
        const regs = ch === 1 ? this.sq1Regs : this.sq2Regs;
        const osc = ch === 1 ? this.sq1Osc : this.sq2Osc;
        const gainNode = ch === 1 ? this.sq1Gain : this.sq2Gain;

        if (!osc || !gainNode) return;

        const vol = (regs[0] & 0x0F) / 15.0 * this.masterVolume;
        const rawTimer = regs[2] | ((regs[3] & 0x07) << 8);

        if (rawTimer > 8 && vol > 0) {
            const freq = 1789773 / (16 * (rawTimer + 1));
            osc.frequency.setValueAtTime(freq, now);
            gainNode.gain.setValueAtTime(vol * 0.15, now);
        } else {
            gainNode.gain.setValueAtTime(0, now);
        }
    }

    updateTriangle(now) {
        if (!this.triOsc || !this.triGain) return;
        const rawTimer = this.triRegs[2] | ((this.triRegs[3] & 0x07) << 8);
        const linearCounter = this.triRegs[0] & 0x7F;

        if (rawTimer > 2 && linearCounter > 0) {
            const freq = 1789773 / (32 * (rawTimer + 1));
            this.triOsc.frequency.setValueAtTime(freq, now);
            this.triGain.gain.setValueAtTime(this.masterVolume * 0.2, now);
        } else {
            this.triGain.gain.setValueAtTime(0, now);
        }
    }

    updateNoise(now) {
        if (!this.ctx || !this.noiseGain) return;
        const vol = (this.noiseRegs[0] & 0x0F) / 15.0 * this.masterVolume;

        if (vol > 0) {
            if (this.noiseSource) {
                try { this.noiseSource.stop(); } catch (e) {}
            }
            this.noiseSource = this.ctx.createBufferSource();
            this.noiseSource.buffer = this.noiseBuffer;
            this.noiseSource.loop = true;
            this.noiseSource.connect(this.noiseGain);
            this.noiseSource.start();

            this.noiseGain.gain.setValueAtTime(vol * 0.1, now);
        } else {
            this.noiseGain.gain.setValueAtTime(0, now);
        }
    }

    setMuted(muted) {
        this.enabled = !muted;
        if (muted && this.ctx) {
            if (this.sq1Gain) this.sq1Gain.gain.setValueAtTime(0, this.ctx.currentTime);
            if (this.sq2Gain) this.sq2Gain.gain.setValueAtTime(0, this.ctx.currentTime);
            if (this.triGain) this.triGain.gain.setValueAtTime(0, this.ctx.currentTime);
            if (this.noiseGain) this.noiseGain.gain.setValueAtTime(0, this.ctx.currentTime);
        }
    }
}

window.NESAPU = NESAPU;

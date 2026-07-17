/**
 * RetroArch Web App Manager, Nestopia Core Integration, Fullscreen Translucent Overlay & 6502 IDE UI
 */

class RetroArchUI {
    constructor() {
        this.nes = new NESSystem();
        this.nestopia = new NestopiaCore(this.nes);
        this.asmEngine = new ASM6502();

        this.canvas = document.getElementById('nes-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.imageData = this.ctx.createImageData(256, 240);

        this.isRunning = true;
        this.fastForward = false;
        this.crtEnabled = true;
        this.audioMuted = false;

        // FPS Limiter & Power Saver (Default: 60 FPS Native NES)
        this.targetFPS = 60;
        this.isInfiniteFPS = false;
        this.lastFrameTime = performance.now();
        this.fpsFrameCount = 0;
        this.lastFpsUpdate = performance.now();
        this.actualFPS = 60;

        this.savedStateJSON = null;

        // Joy-Con Fusion State
        this.joyConFusionActive = false;
        this.lastGamepadCount = 0;

        this.initDOM();
        this.initControls();
        this.initAssemblyEditor();
        this.loadBuiltInGame('game1');

        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }

    initDOM() {
        document.getElementById('btn-save').addEventListener('click', () => this.saveState());
        document.getElementById('btn-load').addEventListener('click', () => this.loadState());
        document.getElementById('btn-ff').addEventListener('click', () => this.toggleFastForward());
        document.getElementById('btn-pause').addEventListener('click', () => this.togglePause());
        document.getElementById('btn-crt').addEventListener('click', () => this.toggleCRT());
        document.getElementById('btn-mute').addEventListener('click', () => this.toggleMute());
        document.getElementById('btn-asm').addEventListener('click', () => this.openASMModal());
        document.getElementById('btn-full').addEventListener('click', () => this.toggleFullscreen());
        document.getElementById('btn-exit-fullscreen').addEventListener('click', () => this.toggleFullscreen());

        document.addEventListener('fullscreenchange', () => {
            const isFull = !!document.fullscreenElement;
            const container = document.getElementById('app-container');
            if (container) {
                container.classList.toggle('fullscreen-active', isFull);
            }
        });

        // FPS Control Slider & Infinite Mode Toggle
        const fpsSlider = document.getElementById('fps-slider');
        const fpsBadge = document.getElementById('fps-val');
        const fpsInfiniteBtn = document.getElementById('btn-fps-unlimited');

        if (fpsSlider) {
            fpsSlider.addEventListener('input', (e) => {
                this.isInfiniteFPS = false;
                if (fpsInfiniteBtn) fpsInfiniteBtn.classList.remove('active');
                this.targetFPS = parseInt(e.target.value) || 60;
                fpsBadge.innerText = this.targetFPS + " FPS";
                this.showOSD(`TARGET FPS SET TO: ${this.targetFPS} FPS`);
            });
        }

        if (fpsInfiniteBtn) {
            fpsInfiniteBtn.addEventListener('click', () => {
                this.isInfiniteFPS = !this.isInfiniteFPS;
                fpsInfiniteBtn.classList.toggle('active', this.isInfiniteFPS);
                if (this.isInfiniteFPS) {
                    fpsBadge.innerText = "∞ UNLIMITED";
                    this.showOSD("⚡ INFINITE FPS UNLOCKED! (SPEED TEST)");
                } else {
                    fpsBadge.innerText = this.targetFPS + " FPS";
                    this.showOSD(`TARGET FPS LIMITED TO: ${this.targetFPS} FPS`);
                }
            });
        }

        document.getElementById('rom-file-input').addEventListener('change', (e) => this.handleROMUpload(e));

        document.getElementById('game-select').addEventListener('change', (e) => {
            this.loadBuiltInGame(e.target.value);
        });

        document.getElementById('close-asm-modal').addEventListener('click', () => {
            document.getElementById('asm-modal').classList.remove('open');
        });
    }

    showOSD(text) {
        const toast = document.getElementById('osd-toast');
        toast.innerText = text;
        toast.style.opacity = '1';
        if (this.osdTimeout) clearTimeout(this.osdTimeout);
        this.osdTimeout = setTimeout(() => {
            toast.style.opacity = '0';
        }, 2200);
    }

    saveState() {
        this.savedStateJSON = this.nes.saveState();
        try {
            localStorage.setItem('retroarch_nes_savestate', this.savedStateJSON);
        } catch (e) {}
        this.showOSD("STATE SAVED SLOT 1");
    }

    loadState() {
        let state = this.savedStateJSON;
        if (!state) {
            state = localStorage.getItem('retroarch_nes_savestate');
        }
        if (state && this.nes.loadState(state)) {
            this.showOSD("STATE LOADED SLOT 1");
        } else {
            this.showOSD("NO SAVED STATE FOUND");
        }
    }

    toggleFastForward() {
        this.fastForward = !this.fastForward;
        const btn = document.getElementById('btn-ff');
        btn.classList.toggle('active', this.fastForward);
        this.showOSD(this.fastForward ? "FAST FORWARD 2X" : "SPEED 1X");
    }

    togglePause() {
        this.isRunning = !this.isRunning;
        const btn = document.getElementById('btn-pause');
        btn.innerText = this.isRunning ? "PAUSE" : "PLAY";
        this.showOSD(this.isRunning ? "RESUMED" : "PAUSED");
    }

    toggleCRT() {
        this.crtEnabled = !this.crtEnabled;
        document.querySelector('.crt-overlay').style.opacity = this.crtEnabled ? '1' : '0';
        document.getElementById('btn-crt').classList.toggle('active', this.crtEnabled);
        this.showOSD(this.crtEnabled ? "CRT SCANLINES ON" : "CRT SCANLINES OFF");
    }

    toggleMute() {
        this.audioMuted = !this.audioMuted;
        this.nes.apu.setMuted(this.audioMuted);
        document.getElementById('btn-mute').classList.toggle('active', this.audioMuted);
        this.showOSD(this.audioMuted ? "AUDIO MUTED" : "AUDIO UNMUTED");
    }

    toggleFullscreen() {
        const container = document.getElementById('app-container');
        if (!document.fullscreenElement) {
            if (container.requestFullscreen) {
                container.requestFullscreen().catch(() => {
                    container.classList.toggle('fullscreen-active');
                });
            } else {
                container.classList.toggle('fullscreen-active');
            }
            this.showOSD("RETROARCH FULLSCREEN OVERLAY ON");
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
            container.classList.remove('fullscreen-active');
            this.showOSD("EXITED FULLSCREEN");
        }
    }

    initControls() {
        const keyMap = {
            'ArrowUp': 4, 'KeyW': 4,
            'ArrowDown': 5, 'KeyS': 5,
            'ArrowLeft': 6, 'KeyA': 6,
            'ArrowRight': 7, 'KeyD': 7,
            'KeyZ': 0, 'KeyJ': 0,
            'KeyX': 1, 'KeyK': 1,
            'ShiftRight': 2, 'KeyC': 2,
            'Enter': 3, 'KeyV': 3
        };

        window.addEventListener('keydown', (e) => {
            this.nes.apu.resumeAudio();
            if (keyMap[e.code] !== undefined) {
                this.nes.pad1State |= (1 << keyMap[e.code]);
                e.preventDefault();
            }
        });

        window.addEventListener('keyup', (e) => {
            if (keyMap[e.code] !== undefined) {
                this.nes.pad1State &= ~(1 << keyMap[e.code]);
                e.preventDefault();
            }
        });

        const touchBindings = [
            { id: 'btn-dpad-up', bit: 4 },
            { id: 'btn-dpad-down', bit: 5 },
            { id: 'btn-dpad-left', bit: 6 },
            { id: 'btn-dpad-right', bit: 7 },
            { id: 'btn-a', bit: 0 },
            { id: 'btn-b', bit: 1 },
            { id: 'btn-select', bit: 2 },
            { id: 'btn-start', bit: 3 }
        ];

        touchBindings.forEach(binding => {
            const el = document.getElementById(binding.id);
            if (!el) return;

            const press = (e) => {
                e.preventDefault();
                this.nes.apu.resumeAudio();
                this.nes.pad1State |= (1 << binding.bit);
                el.classList.add('pressed');
                if (navigator.vibrate) navigator.vibrate(12);
            };

            const release = (e) => {
                e.preventDefault();
                this.nes.pad1State &= ~(1 << binding.bit);
                el.classList.remove('pressed');
            };

            el.addEventListener('touchstart', press, { passive: false });
            el.addEventListener('touchend', release, { passive: false });
            el.addEventListener('mousedown', press);
            el.addEventListener('mouseup', release);
        });

        let turboTimer = null;
        const bindTurbo = (btnId, targetBit) => {
            const el = document.getElementById(btnId);
            if (!el) return;

            const startTurbo = (e) => {
                e.preventDefault();
                this.nes.apu.resumeAudio();
                if (turboTimer) clearInterval(turboTimer);
                el.classList.add('pressed');
                turboTimer = setInterval(() => {
                    this.nes.pad1State ^= (1 << targetBit);
                }, 40);
            };

            const stopTurbo = (e) => {
                e.preventDefault();
                if (turboTimer) clearInterval(turboTimer);
                this.nes.pad1State &= ~(1 << targetBit);
                el.classList.remove('pressed');
            };

            el.addEventListener('touchstart', startTurbo, { passive: false });
            el.addEventListener('touchend', stopTurbo, { passive: false });
            el.addEventListener('mousedown', startTurbo);
            el.addEventListener('mouseup', stopTurbo);
        };

        bindTurbo('btn-turbo-a', 0);
        bindTurbo('btn-turbo-b', 1);
    }

    pollGamepadAPI() {
        const rawGamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        const activeGamepads = [];

        for (let i = 0; i < rawGamepads.length; i++) {
            if (rawGamepads[i] && rawGamepads[i].connected) {
                activeGamepads.push(rawGamepads[i]);
            }
        }

        if (activeGamepads.length !== this.lastGamepadCount) {
            this.lastGamepadCount = activeGamepads.length;
            if (activeGamepads.length >= 2) {
                let hasLeftJoyCon = activeGamepads.some(g => g.id.toLowerCase().includes('joy-con') && g.id.toLowerCase().includes('(l)'));
                let hasRightJoyCon = activeGamepads.some(g => g.id.toLowerCase().includes('joy-con') && g.id.toLowerCase().includes('(r)'));

                if (hasLeftJoyCon || hasRightJoyCon || activeGamepads.length === 2) {
                    this.showOSD("🎮 DUAL JOY-CONS AUTO-MERGED INTO 1 CONTROLLER!");
                }
            } else if (activeGamepads.length === 1) {
                this.showOSD("🎮 CONTROLLER CONNECTED: " + activeGamepads[0].id.substring(0, 20));
            }
        }

        if (activeGamepads.length === 0) return;

        let combinedPadState = 0;

        for (let gp of activeGamepads) {
            const id = gp.id.toLowerCase();
            const isLeftJoyCon = id.includes('joy-con') && id.includes('(l)');
            const isRightJoyCon = id.includes('joy-con') && id.includes('(r)');

            if (gp.buttons[0]?.pressed) combinedPadState |= (1 << 0);
            if (gp.buttons[1]?.pressed) combinedPadState |= (1 << 1);
            if (gp.buttons[2]?.pressed) combinedPadState |= (1 << 1);
            if (gp.buttons[3]?.pressed) combinedPadState |= (1 << 0);
            if (gp.buttons[8]?.pressed) combinedPadState |= (1 << 2);
            if (gp.buttons[9]?.pressed) combinedPadState |= (1 << 3);

            if (gp.buttons[12]?.pressed) combinedPadState |= (1 << 4);
            if (gp.buttons[13]?.pressed) combinedPadState |= (1 << 5);
            if (gp.buttons[14]?.pressed) combinedPadState |= (1 << 6);
            if (gp.buttons[15]?.pressed) combinedPadState |= (1 << 7);

            if (isLeftJoyCon) {
                if (gp.buttons[0]?.pressed) combinedPadState |= (1 << 5);
                if (gp.buttons[1]?.pressed) combinedPadState |= (1 << 7);
                if (gp.buttons[2]?.pressed) combinedPadState |= (1 << 6);
                if (gp.buttons[3]?.pressed) combinedPadState |= (1 << 4);
                if (gp.buttons[8]?.pressed) combinedPadState |= (1 << 2);
                if (gp.buttons[16]?.pressed) combinedPadState |= (1 << 2);
            }

            if (isRightJoyCon) {
                if (gp.buttons[0]?.pressed) combinedPadState |= (1 << 0);
                if (gp.buttons[1]?.pressed) combinedPadState |= (1 << 1);
                if (gp.buttons[2]?.pressed) combinedPadState |= (1 << 1);
                if (gp.buttons[3]?.pressed) combinedPadState |= (1 << 0);
                if (gp.buttons[9]?.pressed) combinedPadState |= (1 << 3);
                if (gp.buttons[16]?.pressed) combinedPadState |= (1 << 3);
            }

            if (gp.axes[1] < -0.4 || gp.axes[3] < -0.4) combinedPadState |= (1 << 4);
            if (gp.axes[1] > 0.4 || gp.axes[3] > 0.4) combinedPadState |= (1 << 5);
            if (gp.axes[0] < -0.4 || gp.axes[2] < -0.4) combinedPadState |= (1 << 6);
            if (gp.axes[0] > 0.4 || gp.axes[2] > 0.4) combinedPadState |= (1 << 7);
        }

        this.nes.pad1State |= combinedPadState;
    }

    loadBuiltInGame(key) {
        const game = window.BUILT_IN_ROMS[key];
        if (!game) return;

        const chrData = window.generateDefaultCHRData();
        const compiled = this.asmEngine.assemble(game.asm, chrData);

        if (this.nestopia.loadRomBinary(compiled.rom) && this.nes.loadROM(compiled.rom)) {
            this.currentASM = game.asm;
            this.showOSD("NESTOPIA CORE LOADED: " + game.title);
            document.getElementById('asm-textarea').value = game.asm;
        }
    }

    handleROMUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const bytes = new Uint8Array(e.target.result);
            if (this.nestopia.loadRomBinary(bytes) && this.nes.loadROM(bytes)) {
                const mapperNames = { 0: "NROM", 1: "MMC1", 2: "UxROM", 3: "CNROM", 4: "MMC3", 7: "AxROM" };
                const mName = mapperNames[this.nes.mapperType] || ("MAPPER " + this.nes.mapperType);
                this.showOSD(`NESTOPIA ROM LOADED: ${file.name} (${mName})`);
            } else {
                alert("Nestopia Core Error: Failed to parse NES file.");
            }
        };
        reader.readAsArrayBuffer(file);
    }

    initAssemblyEditor() {
        document.getElementById('btn-compile-run').addEventListener('click', () => {
            const asmCode = document.getElementById('asm-textarea').value;
            try {
                const chrData = window.generateDefaultCHRData();
                const compiled = this.asmEngine.assemble(asmCode, chrData);

                if (this.nestopia.loadRomBinary(compiled.rom) && this.nes.loadROM(compiled.rom)) {
                    this.showOSD("NESTOPIA BUILD SUCCESSFUL! 6502 ROM UPDATED");
                    document.getElementById('asm-modal').classList.remove('open');
                } else {
                    alert("Assembly compiled but Nestopia execution failed.");
                }
            } catch (err) {
                alert("Assembly Compiler Error: " + err.message);
            }
        });
    }

    openASMModal() {
        document.getElementById('asm-modal').classList.add('open');
        this.updateCPUDebuggerUI();
    }

    updateCPUDebuggerUI() {
        const cpu = this.nes.cpu;
        document.getElementById('reg-a').innerText = 'A: $' + cpu.A.toString(16).padStart(2, '0').toUpperCase();
        document.getElementById('reg-x').innerText = 'X: $' + cpu.X.toString(16).padStart(2, '0').toUpperCase();
        document.getElementById('reg-y').innerText = 'Y: $' + cpu.Y.toString(16).padStart(2, '0').toUpperCase();
        document.getElementById('reg-pc').innerText = 'PC: $' + cpu.PC.toString(16).padStart(4, '0').toUpperCase();
        document.getElementById('reg-sp').innerText = 'SP: $' + cpu.SP.toString(16).padStart(2, '0').toUpperCase();
    }

    loop(now) {
        if (this.isRunning) {
            const interval = 1000 / this.targetFPS;
            const elapsed = now - this.lastFrameTime;

            if (this.isInfiniteFPS || elapsed >= interval - 1) {
                this.lastFrameTime = now - (elapsed % interval);

                this.pollGamepadAPI();

                const steps = this.fastForward ? 2 : 1;
                for (let i = 0; i < steps; i++) {
                    this.nestopia.stepFrame(this.nes.pad1State, this.nes.pad2State);
                }

                const fb32 = new Uint32Array(this.imageData.data.buffer);
                fb32.set(this.nes.ppu.frameBuffer);
                this.ctx.putImageData(this.imageData, 0, 0);

                this.fpsFrameCount++;

                if (document.getElementById('asm-modal').classList.contains('open')) {
                    this.updateCPUDebuggerUI();
                }
            }

            if (now - this.lastFpsUpdate >= 500) {
                this.actualFPS = Math.round((this.fpsFrameCount * 1000) / (now - this.lastFpsUpdate));
                this.fpsFrameCount = 0;
                this.lastFpsUpdate = now;

                const statusText = document.getElementById('fps-live-status');
                if (statusText) {
                    statusText.innerText = `NESTOPIA CORE • ${this.actualFPS} FPS`;
                }
            }
        }

        requestAnimationFrame(this.loop);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.retroArchUI = new RetroArchUI();
});

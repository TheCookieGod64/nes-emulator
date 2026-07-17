# 🎮 RetroArch Web NES (6502 Assembly Engine)

A lightweight, high-performance HTML5 NES Emulator and live 6502 Assembly IDE featuring a RetroArch mobile-friendly control overlay, pixel-perfect Ricoh 2C02 PPU rendering, Ricoh 2A03 APU audio synthesis, and real-time assembly compilation.

---

## ✨ Features

- **100% 6502 Assembly Homebrew Game Built-in**: Includes `"NES 6502 RETRO QUEST"`, an authentic homebrew platformer written directly in 6502 assembly code with sprite movement, collision detection, score mechanics, and sound chimes.
- **Live 6502 Assembler & Inspector**: Edit 6502 source code live in the browser, monitor CPU registers (`A`, `X`, `Y`, `PC`, `SP`), and compile directly to standard iNES `.nes` binary format on the fly.
- **RetroArch Touch Overlay**: Optimized touch control layout featuring tactile D-Pad, round A/B action buttons, Turbo A/B rapid fire, Select/Start pill buttons, and haptic feedback on mobile devices.
- **Gamepad API Support**: Connect Bluetooth or USB gamepads (Xbox, PlayStation, Switch Pro, 8BitDo) for seamless controls.
- **Retro CRT Shader Effect**: Toggleable scanlines and CRT monitor phosphor glow.
- **Save State / Load State**: Instant state serialization to LocalStorage.
- **Custom `.nes` ROM Loader**: Drag & drop external commercial or homebrew NES games.

---

## 📁 File Structure

```
.
├── index.html            # Main web application entry point
├── css/
│   └── retroarch_nes.css # RetroArch theme styles, CRT shaders, mobile overlay layout
├── js/
│   ├── nes_cpu.js        # Ricoh 2A03 (6502) CPU Core execution engine
│   ├── nes_ppu.js        # Ricoh 2C02 Picture Processing Unit renderer & NES palette
│   ├── nes_apu.js        # Ricoh 2A03 APU Web Audio sound synthesizer
│   ├── nes_system.js     # System bus, RAM, PPU/APU registers & Mapper 0 (NROM)
│   ├── asm6502.js        # Complete 6502 Assembler & Disassembler engine
│   ├── built_in_roms.js  # Built-in 6502 Assembly homebrew games & font generator
│   └── retroarch_ui.js   # Event handlers, touch gesture mapping, OSD toasts & state logic
└── README.md             # Project documentation
```

---

## 🛠️ Local Setup & Deployment

Since this project uses modern HTML5 ES6 modules and Web Audio API:

### Option 1: Static File Server (Node.js)
```bash
npx serve .
```

### Option 2: Python HTTP Server
```bash
python3 -m http.server 8000
```
Open `http://localhost:8000` in your web browser.

---

## 🚀 Git Quickstart for iSH / iOS Terminal

```bash
git init
git add .
git commit -m "Initial commit: RetroArch Web NES 6502 Assembly Engine"
git remote add origin https://github.com/YOUR_USERNAME/retroarch-web-nes-6502.git
git branch -M main
git push -u origin main
```

---

## 🎮 Controls Summary

| Input | Mobile Touch Overlay | Keyboard | Gamepad |
| :--- | :--- | :--- | :--- |
| **D-Pad Up/Down/Left/Right** | Virtual D-Pad | Arrow Keys / WASD | D-Pad / Left Stick |
| **Button A** | Button A | `Z` / `J` | Button 0 (A / Cross) |
| **Button B** | Button B | `X` / `K` | Button 1 (B / Circle) |
| **Turbo A / B** | Turbo A / B | — | — |
| **Select** | SELECT Pill | `Shift` / `C` | Button 8 (Select / Back) |
| **Start** | START Pill | `Enter` / `V` | Button 9 (Start) |

/**
 * NES 2C02 PPU (Picture Processing Unit) Emulator Core
 */

class NESPPU {
    constructor(bus) {
        this.bus = bus;

        // VRAM Memory (16KB total address space mapped by PPU)
        this.chr = new Uint8Array(8192); // CHR ROM/RAM (Pattern Tables)
        this.vram = new Uint8Array(2048); // 2KB Nametable RAM (Horizontal/Vertical mirroring)
        this.palette = new Uint8Array(32); // Palette RAM
        this.oam = new Uint8Array(256); // Sprite OAM Memory

        // Mirroring mode: 0 = Horizontal, 1 = Vertical
        this.mirroring = 0;

        // Registers
        this.ctrl = 0;   // $2000 PPUCTRL
        this.mask = 0;   // $2001 PPUMASK
        this.status = 0; // $2002 PPUSTATUS
        this.oamAddr = 0; // $2003 OAMADDR

        // Internal PPU Latches
        this.v = 0; // Current VRAM address (15 bit)
        this.t = 0; // Temporary VRAM address (15 bit)
        this.x = 0; // Fine X scroll (3 bit)
        this.w = 0; // First or second write latch (1 bit)
        this.readBuffer = 0;

        // Scanline / Cycle state
        this.scanline = 0;
        this.cycle = 0;
        this.nmiTriggered = false;

        // Screen Framebuffer: 256x240 ImageData buffer
        this.frameBuffer = new Uint32Array(256 * 240);

        // NES Master Palette RGB Values
        this.nesPalette = [
            0x7C7C7C, 0x002492, 0x0000DB, 0x680092, 0x000000, 0x000000, 0x000000, 0x000000,
            0x000000, 0x000000, 0x000000, 0x000000, 0x000000, 0x000000, 0x000000, 0x000000,
            0xBCBCBC, 0x0073F8, 0x0050F8, 0x6800D8, 0x000000, 0x000000, 0x000000, 0x000000,
            0x000000, 0x000000, 0x000000, 0x000000, 0x000000, 0x000000, 0x000000, 0x000000,
            0xFFFFFF, 0x3CBCFC, 0x6888FC, 0x9878F8, 0xF878F8, 0xF85898, 0xF87800, 0xAC7C00,
            0x00B800, 0x00F800, 0x00B8F8, 0x00F8F8, 0x000000, 0x000000, 0x000000, 0x000000,
            0xFFFFFF, 0xA4E4FC, 0xB8B8FC, 0xD8B8FC, 0xF8B8F8, 0xF8A4C0, 0xF0D0B0, 0xFCE0A8,
            0xF8D878, 0xD8F878, 0xB8F8B8, 0xB8F8D8, 0x00F8F8, 0x000000, 0x000000, 0x000000
        ];

        this.initRGBPalette();
    }

    initRGBPalette() {
        // Standard full 64-color NES RGB lookup table
        const colors = [
            [0x66,0x66,0x66], [0x00,0x2A,0x88], [0x14,0x12,0xA7], [0x3B,0x00,0xA4], [0x5C,0x00,0x7E], [0x6E,0x00,0x40], [0x6C,0x06,0x00], [0x56,0x1D,0x00],
            [0x33,0x35,0x00], [0x0B,0x48,0x00], [0x00,0x52,0x00], [0x00,0x4F,0x08], [0x00,0x40,0x4D], [0x00,0x00,0x00], [0x00,0x00,0x00], [0x00,0x00,0x00],
            [0xAD,0xAD,0xAD], [0x15,0x5F,0xD9], [0x42,0x40,0xFF], [0x75,0x27,0xFE], [0xA0,0x1A,0xCC], [0xB7,0x1E,0x7B], [0xB5,0x31,0x20], [0x99,0x4E,0x00],
            [0x6B,0x6D,0x00], [0x38,0x87,0x00], [0x0C,0x93,0x00], [0x00,0x8F,0x32], [0x00,0x7C,0x8D], [0x00,0x00,0x00], [0x00,0x00,0x00], [0x00,0x00,0x00],
            [0xFF,0xFF,0xFF], [0x64,0xB0,0xFF], [0x92,0x90,0xFF], [0xC6,0x76,0xFF], [0xF3,0x6A,0xFF], [0xFE,0x6E,0xCC], [0xFE,0x81,0x70], [0xEA,0x9E,0x22],
            [0xBC,0xBE,0x00], [0x88,0xD8,0x00], [0x5C,0xE4,0x30], [0x45,0xE0,0x82], [0x48,0xCD,0xDE], [0x4F,0x4F,0x4F], [0x00,0x00,0x00], [0x00,0x00,0x00],
            [0xFF,0xFF,0xFF], [0xC0,0xE0,0xFF], [0xD3,0xD2,0xFF], [0xE8,0xC8,0xFF], [0xFA,0xC2,0xFF], [0xFF,0xC4,0xEA], [0xFF,0xCC,0xC5], [0xF7,0xD8,0xA5],
            [0xE4,0xE5,0x94], [0xCF,0xEF,0x96], [0xBD,0xF4,0xAB], [0xB3,0xF3,0xCC], [0xB5,0xEB,0xF2], [0xB8,0xB8,0xB8], [0x00,0x00,0x00], [0x00,0x00,0x00]
        ];

        this.palette32 = new Uint32Array(64);
        for (let i = 0; i < 64; i++) {
            const [r, g, b] = colors[i];
            // Format for Canvas ImageData Uint32 ABGR (Little Endian Alpha-B-G-R)
            this.palette32[i] = 0xFF000000 | (b << 16) | (g << 8) | r;
        }
    }

    reset() {
        this.ctrl = 0;
        this.mask = 0;
        this.status = 0;
        this.oamAddr = 0;
        this.v = 0;
        this.t = 0;
        this.x = 0;
        this.w = 0;
        this.scanline = 0;
        this.cycle = 0;
    }

    mirrorNametable(addr) {
        const mirrored = addr & 0x2FFF;
        const index = mirrored - 0x2000;
        const nt = Math.floor(index / 0x0400);
        const offset = index % 0x0400;

        if (this.mirroring === 0) { // Horizontal
            // NT 0 & 1 map to 0, NT 2 & 3 map to 1
            const page = (nt === 0 || nt === 1) ? 0 : 0x0400;
            return page + offset;
        } else { // Vertical
            // NT 0 & 2 map to 0, NT 1 & 3 map to 1
            const page = (nt === 0 || nt === 2) ? 0 : 0x0400;
            return page + offset;
        }
    }

    readRegister(addr) {
        let val = 0;
        switch (addr) {
            case 0x2002: // PPUSTATUS
                val = (this.status & 0xE0) | (this.readBuffer & 0x1F);
                // Clear VBLANK flag and reset latch w
                this.status &= ~0x80;
                this.w = 0;
                break;
            case 0x2004: // OAMDATA
                val = this.oam[this.oamAddr];
                break;
            case 0x2007: // PPUDATA
                val = this.readVRAM(this.v);
                if (this.v < 0x3F00) {
                    const buffered = this.readBuffer;
                    this.readBuffer = val;
                    val = buffered;
                } else {
                    this.readBuffer = this.readVRAM(this.v - 0x1000);
                }
                this.v += (this.ctrl & 0x04) ? 32 : 1;
                this.v &= 0x7FFF;
                break;
        }
        return val;
    }

    writeRegister(addr, val) {
        switch (addr) {
            case 0x2000: // PPUCTRL
                this.ctrl = val;
                this.t = (this.t & ~0x0C00) | ((val & 0x03) << 10);
                break;
            case 0x2001: // PPUMASK
                this.mask = val;
                break;
            case 0x2003: // OAMADDR
                this.oamAddr = val;
                break;
            case 0x2004: // OAMDATA
                this.oam[this.oamAddr] = val;
                this.oamAddr = (this.oamAddr + 1) & 0xFF;
                break;
            case 0x2005: // PPUSCROLL
                if (this.w === 0) {
                    this.t = (this.t & ~0x001F) | ((val >> 3) & 0x001F);
                    this.x = val & 0x07;
                    this.w = 1;
                } else {
                    this.t = (this.t & ~0x73E0) | ((val & 0x07) << 12) | ((val & 0xF8) << 2);
                    this.w = 0;
                }
                break;
            case 0x2006: // PPUADDR
                if (this.w === 0) {
                    this.t = (this.t & 0x00FF) | ((val & 0x3F) << 8);
                    this.w = 1;
                } else {
                    this.t = (this.t & 0x7F00) | val;
                    this.v = this.t;
                    this.w = 0;
                }
                break;
            case 0x2007: // PPUDATA
                this.writeVRAM(this.v, val);
                this.v += (this.ctrl & 0x04) ? 32 : 1;
                this.v &= 0x7FFF;
                break;
        }
    }

    readVRAM(addr) {
        addr &= 0x3FFF;
        if (addr < 0x2000) {
            return this.chr[addr];
        } else if (addr < 0x3F00) {
            return this.vram[this.mirrorNametable(addr)];
        } else {
            let pAddr = addr & 0x001F;
            if (pAddr === 0x0010 || pAddr === 0x0014 || pAddr === 0x0018 || pAddr === 0x001C) pAddr &= ~0x0010;
            return this.palette[pAddr];
        }
    }

    writeVRAM(addr, val) {
        addr &= 0x3FFF;
        if (addr < 0x2000) {
            this.chr[addr] = val;
        } else if (addr < 0x3F00) {
            this.vram[this.mirrorNametable(addr)] = val;
        } else {
            let pAddr = addr & 0x001F;
            if (pAddr === 0x0010 || pAddr === 0x0014 || pAddr === 0x0018 || pAddr === 0x001C) pAddr &= ~0x0010;
            this.palette[pAddr] = val;
        }
    }

    step() {
        // Increment PPU cycle & scanline timing
        this.cycle++;
        if (this.cycle >= 341) {
            this.cycle = 0;
            this.scanline++;

            if (this.scanline === 240) {
                // Post-render scanline - render complete frame
                this.renderFrame();
            } else if (this.scanline === 241) {
                // Start VBLANK
                this.status |= 0x80;
                if (this.ctrl & 0x80) {
                    this.nmiTriggered = true;
                }
            } else if (this.scanline >= 261) {
                // End VBLANK / Pre-render
                this.scanline = -1;
                this.status &= ~0x80; // Clear VBLANK flag
                this.status &= ~0x40; // Clear Sprite 0 Hit
            }
        }
    }

    renderFrame() {
        const bgEnabled = (this.mask & 0x08) !== 0;
        const sprEnabled = (this.mask & 0x10) !== 0;

        const bgPatternBase = (this.ctrl & 0x10) ? 0x1000 : 0x0000;
        const sprPatternBase = (this.ctrl & 0x08) ? 0x1000 : 0x0000;

        const universalBgColor = this.palette32[this.readVRAM(0x3F00) & 0x3F];

        // 1. Render Background
        if (bgEnabled) {
            const baseNametable = this.ctrl & 0x03;
            const nametableBaseAddr = 0x2000 + (baseNametable * 0x0400);

            for (let tileY = 0; tileY < 30; tileY++) {
                for (let tileX = 0; tileX < 32; tileX++) {
                    const ntAddr = nametableBaseAddr + (tileY * 32) + tileX;
                    const tileIndex = this.readVRAM(ntAddr);

                    // Attribute byte calculation (4x4 tiles per attribute byte)
                    const attrX = Math.floor(tileX / 4);
                    const attrY = Math.floor(tileY / 4);
                    const attrAddr = nametableBaseAddr + 0x03C0 + (attrY * 8) + attrX;
                    const attrByte = this.readVRAM(attrAddr);

                    // Determine quadrant palette (2 bits)
                    const quadX = Math.floor((tileX % 4) / 2);
                    const quadY = Math.floor((tileY % 4) / 2);
                    const paletteShift = (quadY * 4) + (quadX * 2);
                    const paletteIdx = (attrByte >> paletteShift) & 0x03;

                    // Fetch 8x8 Tile pixels from Pattern Table
                    const patternOffset = bgPatternBase + (tileIndex * 16);
                    for (let py = 0; py < 8; py++) {
                        const plane0 = this.readVRAM(patternOffset + py);
                        const plane1 = this.readVRAM(patternOffset + py + 8);

                        const screenY = tileY * 8 + py;
                        if (screenY >= 240) continue;

                        for (let px = 0; px < 8; px++) {
                            const bit = 7 - px;
                            const colorBit0 = (plane0 >> bit) & 0x01;
                            const colorBit1 = (plane1 >> bit) & 0x01;
                            const pixelVal = (colorBit1 << 1) | colorBit0;

                            const screenX = tileX * 8 + px;
                            if (screenX >= 256) continue;

                            if (pixelVal === 0) {
                                this.frameBuffer[screenY * 256 + screenX] = universalBgColor;
                            } else {
                                const paletteColor = this.readVRAM(0x3F00 + (paletteIdx * 4) + pixelVal);
                                this.frameBuffer[screenY * 256 + screenX] = this.palette32[paletteColor & 0x3F];
                            }
                        }
                    }
                }
            }
        } else {
            this.frameBuffer.fill(universalBgColor);
        }

        // 2. Render Sprites (OAM)
        if (sprEnabled) {
            for (let i = 63; i >= 0; i--) { // Reverse order for correct sprite priority
                const oamIdx = i * 4;
                const y = this.oam[oamIdx] + 1; // PPU Y offset by 1
                const tileIdx = this.oam[oamIdx + 1];
                const attr = this.oam[oamIdx + 2];
                const x = this.oam[oamIdx + 3];

                if (y >= 240) continue;

                const paletteIdx = (attr & 0x03) + 4; // Sprite palettes 4-7
                const priorityBehind = (attr & 0x20) !== 0;
                const flipH = (attr & 0x40) !== 0;
                const flipV = (attr & 0x80) !== 0;

                const patternOffset = sprPatternBase + (tileIdx * 16);

                for (let py = 0; py < 8; py++) {
                    const line = flipV ? (7 - py) : py;
                    const plane0 = this.readVRAM(patternOffset + line);
                    const plane1 = this.readVRAM(patternOffset + line + 8);

                    const screenY = y + py;
                    if (screenY >= 240) continue;

                    for (let px = 0; px < 8; px++) {
                        const bit = flipH ? px : (7 - px);
                        const colorBit0 = (plane0 >> bit) & 0x01;
                        const colorBit1 = (plane1 >> bit) & 0x01;
                        const pixelVal = (colorBit1 << 1) | colorBit0;

                        if (pixelVal === 0) continue; // Transparent pixel

                        const screenX = x + px;
                        if (screenX >= 256) continue;

                        // Sprite 0 Hit detection
                        if (i === 0 && bgEnabled && pixelVal !== 0) {
                            this.status |= 0x40; // Set Sprite 0 Hit
                        }

                        const targetIdx = screenY * 256 + screenX;
                        if (!priorityBehind || this.frameBuffer[targetIdx] === universalBgColor) {
                            const paletteColor = this.readVRAM(0x3F00 + (paletteIdx * 4) + pixelVal);
                            this.frameBuffer[targetIdx] = this.palette32[paletteColor & 0x3F];
                        }
                    }
                }
            }
        }
    }
}

window.NESPPU = NESPPU;

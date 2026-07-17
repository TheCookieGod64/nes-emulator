/**
 * Built-in 6502 Assembly Programs & Custom CHR Pattern Generator
 */

// Generate default 8x8 CHR ROM tile map containing NES font, Player Sprite, Monster, Gem, Bricks
function generateDefaultCHRData() {
    const chr = new Uint8Array(8192); // 8KB CHR Pattern Table

    // 8x8 Pixel Tile Bitmaps (Plane 0 and Plane 1 for 2 bpp NES graphics)
    const rawTiles = {
        // Tile 0: Empty
        0: [0,0,0,0,0,0,0,0],

        // Tile 1: Brick Block
        1: [
            0b11111111,
            0b10000001,
            0b10000001,
            0b11111111,
            0b10010001,
            0b10010001,
            0b10010001,
            0b11111111
        ],

        // Tile 2: Gem / Star
        2: [
            0b00011000,
            0b00111100,
            0b01111110,
            0b11111111,
            0b01111110,
            0b00111100,
            0b00011000,
            0b00000000
        ],

        // Tile 3: Player Hero Sprite
        3: [
            0b00111100,
            0b01111110,
            0b01011010,
            0b01111110,
            0b00111100,
            0b01111110,
            0b10111101,
            0b01000010
        ],

        // Tile 4: Bouncing Monster Enemy
        4: [
            0b01111110,
            0b11111111,
            0b10111101,
            0b11111111,
            0b01111110,
            0b11111111,
            0b10100101,
            0b10000001
        ]
    };

    // Helper to store raw tile into CHR bank
    for (let tileIdx in rawTiles) {
        const rows = rawTiles[tileIdx];
        const offset = tileIdx * 16;
        for (let y = 0; y < 8; y++) {
            chr[offset + y] = rows[y];     // Plane 0
            chr[offset + 8 + y] = rows[y]; // Plane 1 (makes pixels 2-bit value %11 = index 3)
        }
    }

    // Generate Basic Font Tiles (A-Z, 0-9, Symbols)
    const fontBitmaps = {
        'A': [0x18,0x3C,0x66,0x7E,0x66,0x66,0x66,0x00],
        'B': [0x7C,0x66,0x66,0x7C,0x66,0x66,0x7C,0x00],
        'C': [0x3C,0x66,0x60,0x60,0x60,0x66,0x3C,0x00],
        'D': [0x78,0x6C,0x66,0x66,0x66,0x6C,0x78,0x00],
        'E': [0x7E,0x60,0x60,0x7C,0x60,0x60,0x7E,0x00],
        'F': [0x7E,0x60,0x60,0x7C,0x60,0x60,0x60,0x00],
        'G': [0x3C,0x66,0x60,0x6E,0x66,0x66,0x3E,0x00],
        'H': [0x66,0x66,0x66,0x7E,0x66,0x66,0x66,0x00],
        'I': [0x3C,0x18,0x18,0x18,0x18,0x18,0x3C,0x00],
        'J': [0x1E,0x0C,0x0C,0x0C,0x0C,0x6C,0x38,0x00],
        'K': [0x66,0x6C,0x78,0x70,0x78,0x6C,0x66,0x00],
        'L': [0x60,0x60,0x60,0x60,0x60,0x60,0x7E,0x00],
        'M': [0x63,0x77,0x7F,0x6B,0x63,0x63,0x63,0x00],
        'N': [0x66,0x76,0x7E,0x7E,0x6E,0x66,0x66,0x00],
        'O': [0x3C,0x66,0x66,0x66,0x66,0x66,0x3C,0x00],
        'P': [0x7C,0x66,0x66,0x7C,0x60,0x60,0x60,0x00],
        'Q': [0x3C,0x66,0x66,0x66,0x6A,0x6C,0x36,0x00],
        'R': [0x7C,0x66,0x66,0x7C,0x6C,0x66,0x66,0x00],
        'S': [0x3C,0x66,0x60,0x3C,0x06,0x66,0x3C,0x00],
        'T': [0x7E,0x18,0x18,0x18,0x18,0x18,0x18,0x00],
        'U': [0x66,0x66,0x66,0x66,0x66,0x66,0x3C,0x00],
        'V': [0x66,0x66,0x66,0x66,0x66,0x3C,0x18,0x00],
        'W': [0x63,0x63,0x63,0x6B,0x7F,0x77,0x63,0x00],
        'X': [0x66,0x66,0x3C,0x18,0x3C,0x66,0x66,0x00],
        'Y': [0x66,0x66,0x66,0x3C,0x18,0x18,0x18,0x00],
        'Z': [0x7E,0x06,0x0C,0x18,0x30,0x60,0x7E,0x00],
        '0': [0x3C,0x66,0x6E,0x76,0x66,0x66,0x3C,0x00],
        '1': [0x18,0x38,0x18,0x18,0x18,0x18,0x7E,0x00],
        '2': [0x3C,0x66,0x06,0x0C,0x18,0x30,0x7E,0x00],
        '3': [0x3C,0x66,0x06,0x1C,0x06,0x66,0x3C,0x00],
        '4': [0x0C,0x1C,0x3C,0x6C,0xFE,0x0C,0x0C,0x00],
        '5': [0x7E,0x60,0x7C,0x06,0x06,0x66,0x3C,0x00],
        '6': [0x3C,0x66,0x60,0x7C,0x66,0x66,0x3C,0x00],
        '7': [0x7E,0x06,0x0C,0x18,0x30,0x30,0x30,0x00],
        '8': [0x3C,0x66,0x66,0x3C,0x66,0x66,0x3C,0x00],
        '9': [0x3C,0x66,0x66,0x3E,0x06,0x66,0x3C,0x00],
        ' ': [0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00],
        ':': [0x00,0x18,0x18,0x00,0x18,0x18,0x00,0x00]
    };

    let tileOffset = 16 * 10; // Start storing font at ASCII tile offset
    for (let char in fontBitmaps) {
        const rows = fontBitmaps[char];
        for (let y = 0; y < 8; y++) {
            chr[tileOffset + y] = rows[y];
            chr[tileOffset + 8 + y] = rows[y];
        }
        tileOffset += 16;
    }

    return chr;
}

const BUILT_IN_ROMS = {
    game1: {
        title: "NES 6502 RETRO QUEST (Playable Game)",
        description: "A complete homebrew platformer/arcade game written 100% in 6502 Assembly! Features hero sprite movement with RetroArch controls, coin collection, sound effects, animated enemies, and live assembly code viewer.",
        asm: `; =========================================================
; NES 6502 RETRO QUEST - 100% Assembly Code Homebrew
; =========================================================
.inesprg 1
.ineschr 1
.inesmir 0

; PPU Registers
PPUCTRL   = $2000
PPUMASK   = $2001
PPUSTATUS = $2002
OAMADDR   = $2003
OAMDATA   = $2004
PPUSCROLL = $2005
PPUADDR   = $2006
PPUDATA   = $2007
OAMDMA    = $4014

; APU Registers
SQ1_VOL   = $4000
SQ1_SWEEP = $4001
SQ1_LO    = $4002
SQ1_HI    = $4003

; Joypad Register
JOYPAD1   = $4016

; Zero Page Variables
PLAYER_X  = $00
PLAYER_Y  = $01
ENEMY_X   = $02
ENEMY_Y   = $03
ENEMY_DIR = $04
GEM_X     = $05
GEM_Y     = $06
SCORE     = $07
BUTTONS   = $08

.org $C000

RESET:
    SEI          ; Disable IRQs
    CLD          ; Clear decimal mode
    LDX #$FF
    TXS          ; Initialize Stack Pointer

    ; Disable PPU rendering during init
    LDA #$00
    STA PPUCTRL
    STA PPUMASK

vblank_wait1:
    BIT PPUSTATUS
    BPL vblank_wait1

    ; Clear RAM
    LDX #$00
    LDA #$00
clear_ram:
    STA $0000, X
    STA $0100, X
    STA $0200, X
    STA $0300, X
    STA $0400, X
    STA $0500, X
    STA $0600, X
    STA $0700, X
    INX
    BNE clear_ram

vblank_wait2:
    BIT PPUSTATUS
    BPL vblank_wait2

    ; Initialize Variables
    LDA #$80
    STA PLAYER_X
    LDA #$70
    STA PLAYER_Y

    LDA #$20
    STA ENEMY_X
    LDA #$90
    STA ENEMY_Y
    LDA #$01
    STA ENEMY_DIR

    LDA #$B0
    STA GEM_X
    LDA #$70
    STA GEM_Y

    LDA #$00
    STA SCORE

    ; Load Palettes
    LDA #$3F
    STA PPUADDR
    LDA #$00
    STA PPUADDR

    LDX #$00
load_palettes:
    LDA palette_data, X
    STA PPUDATA
    INX
    CPX #$20
    BNE load_palettes

    ; Write Nametable Text Header
    LDA #$20
    STA PPUADDR
    LDA #$42
    STA PPUADDR

    ; "NES 6502 QUEST"
    LDX #$00
write_title:
    LDA title_text, X
    BEQ title_done
    STA PPUDATA
    INX
    JMP write_title
title_done:

    ; Enable NMI & PPU Display
    LDA #$90 ; Enable NMI, Background $0000, Sprites $1000
    STA PPUCTRL
    LDA #$1E ; Show BG & Sprites
    STA PPUMASK

main_loop:
    JMP main_loop ; Loop indefinitely, logic runs in NMI

NMI:
    ; OAM DMA Transfer
    LDA #$02
    STA OAMDMA

    ; Read Joypad Inputs
    JSR read_controller

    ; Update Player Movement
    LDA BUTTONS
    AND #$01 ; A Button - Sound test
    BEQ check_dpad
    JSR play_jump_sound

check_dpad:
    LDA BUTTONS
    AND #$08 ; Up
    BEQ no_up
    DEC PLAYER_Y
no_up:
    LDA BUTTONS
    AND #$04 ; Down
    BEQ no_down
    INC PLAYER_Y
no_down:
    LDA BUTTONS
    AND #$02 ; Left
    BEQ no_left
    DEC PLAYER_X
no_left:
    LDA BUTTONS
    AND #$01 ; Right (Bit shift offset check)
    BEQ no_right
    INC PLAYER_X
no_right:

    ; Update Bouncing Enemy Movement
    LDA ENEMY_DIR
    BEQ enemy_moving_left
    INC ENEMY_X
    LDA ENEMY_X
    CMP #$E0
    BCC enemy_done
    LDA #$00
    STA ENEMY_DIR
    JMP enemy_done
enemy_moving_left:
    DEC ENEMY_X
    LDA ENEMY_X
    CMP #$10
    BCS enemy_done
    LDA #$01
    STA ENEMY_DIR
enemy_done:

    ; Check Collision with Gem
    LDA PLAYER_X
    SEC
    SBC GEM_X
    BPL abs_dx
    EOR #$FF
    ADC #$01
abs_dx:
    CMP #$08
    BCS no_gem_collect
    
    LDA PLAYER_Y
    SEC
    SBC GEM_Y
    BPL abs_dy
    EOR #$FF
    ADC #$01
abs_dy:
    CMP #$08
    BCS no_gem_collect

    ; Collected Gem!
    INC SCORE
    JSR play_coin_sound
    ; Move Gem to new random position
    LDA PLAYER_X
    ADC #$40
    STA GEM_X

no_gem_collect:

    ; Update Sprites in OAM RAM ($0200)
    ; Sprite 0: Player Hero
    LDA PLAYER_Y
    STA $0200
    LDA #$03 ; Tile 3
    STA $0201
    LDA #$00 ; Palette 0
    STA $0202
    LDA PLAYER_X
    STA $0203

    ; Sprite 1: Gem / Star
    LDA GEM_Y
    STA $0204
    LDA #$02 ; Tile 2
    STA $0205
    LDA #$01 ; Palette 1
    STA $0206
    LDA GEM_X
    STA $0207

    ; Sprite 2: Bouncing Enemy
    LDA ENEMY_Y
    STA $0208
    LDA #$04 ; Tile 4
    STA $0209
    LDA #$02 ; Palette 2
    STA $020A
    LDA ENEMY_X
    STA $020B

    ; Reset PPU Scroll
    LDA #$00
    STA PPUSCROLL
    STA PPUSCROLL

    RTI

read_controller:
    LDA #$01
    STA JOYPAD1
    LDA #$00
    STA JOYPAD1
    STA BUTTONS

    LDX #$08
read_loop:
    LDA JOYPAD1
    LSR A
    ROL BUTTONS
    DEX
    BNE read_loop
    RTS

play_jump_sound:
    LDA #$8F
    STA SQ1_VOL
    LDA #$7F
    STA SQ1_LO
    LDA #$08
    STA SQ1_HI
    RTS

play_coin_sound:
    LDA #$9F
    STA SQ1_VOL
    LDA #$C0
    STA SQ1_LO
    LDA #$09
    STA SQ1_HI
    RTS

palette_data:
    .byte $0F,$00,$10,$30, $0F,$01,$11,$21, $0F,$06,$16,$26, $0F,$09,$19,$29 ; Background
    .byte $0F,$28,$16,$30, $0F,$27,$17,$37, $0F,$06,$16,$26, $0F,$09,$19,$29 ; Sprites

title_text:
    .byte $1D,$14,$22,$00,$1A,$1E,$19,$1B,$00,$20,$1A,$14,$22,$23, $00 ; "NES 6502 QUEST"

.org $FFFA
    .word NMI
    .word RESET
    .word $0000
`
    },

    demo2: {
        title: "NES 6502 APU Chiptune & Sound Synth",
        description: "An assembly program demonstrating real-time Ricoh 2A03 APU chiptune sound generation across Square, Triangle, and Noise sound channels.",
        asm: `; =========================================================
; NES 6502 APU CHIPTUNE SOUND GENERATOR
; =========================================================
.inesprg 1
.ineschr 1
.inesmir 0

PPUCTRL = $2000
PPUMASK = $2001
PPUSTATUS = $2002

SQ1_VOL   = $4000
SQ1_SWEEP = $4001
SQ1_LO    = $4002
SQ1_HI    = $4003

TRI_LINEAR = $4008
TRI_LO     = $400A
TRI_HI     = $400B

NOISE_VOL  = $400C
NOISE_LO   = $400E
NOISE_HI   = $400F

.org $C000

RESET:
    SEI
    CLD
    LDX #$FF
    TXS

    ; Enable Sound
    LDA #$0F
    STA $4015

main_loop:
    ; Square Wave Note
    LDA #$8F
    STA SQ1_VOL
    LDA #$A0
    STA SQ1_LO
    LDA #$08
    STA SQ1_HI

    ; Bass Triangle
    LDA #$FF
    STA TRI_LINEAR
    LDA #$80
    STA TRI_LO
    LDA #$09
    STA TRI_HI

    ; Noise Snare
    LDA #$30
    STA NOISE_VOL
    LDA #$04
    STA NOISE_LO
    LDA #$08
    STA NOISE_HI

    JMP main_loop

.org $FFFA
    .word RESET
    .word RESET
    .word $0000
`
    }
};

window.BUILT_IN_ROMS = BUILT_IN_ROMS;
window.generateDefaultCHRData = generateDefaultCHRData;

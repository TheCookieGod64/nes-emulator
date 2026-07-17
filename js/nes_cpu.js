/**
 * NES 6502 CPU Emulator Core
 * Cycles-aware implementation of the Ricoh 2A03 (NMOS 6502 without decimal mode)
 */

class NESCPU {
    constructor(bus) {
        this.bus = bus;

        // Registers
        this.A = 0x00;
        this.X = 0x00;
        this.Y = 0x00;
        this.PC = 0xC000;
        this.SP = 0xFD;

        // Flags: N V U B D I Z C
        this.status = 0x24; // Default I=1, U=1

        this.cycles = 0;
        this.stallCycles = 0;

        // Flag Masks
        this.C_FLAG = 1 << 0; // Carry
        this.Z_FLAG = 1 << 1; // Zero
        this.I_FLAG = 1 << 2; // Interrupt Disable
        this.D_FLAG = 1 << 3; // Decimal Mode (ignored in 2A03)
        this.B_FLAG = 1 << 4; // Break
        this.U_FLAG = 1 << 5; // Unused (Always 1)
        this.V_FLAG = 1 << 6; // Overflow
        this.N_FLAG = 1 << 7; // Negative

        this.initOpcodeTable();
    }

    reset() {
        this.A = 0;
        this.X = 0;
        this.Y = 0;
        this.SP = 0xFD;
        this.status = 0x24; // I=1, U=1

        // Fetch Reset Vector from $FFFC-$FFFD
        const lo = this.bus.read(0xFFFC);
        const hi = this.bus.read(0xFFFD);
        this.PC = (hi << 8) | lo;
        this.cycles = 7;
    }

    nmi() {
        this.push16(this.PC);
        this.push8((this.status & ~this.B_FLAG) | this.U_FLAG);
        this.setFlag(this.I_FLAG, true);

        const lo = this.bus.read(0xFFFA);
        const hi = this.bus.read(0xFFFB);
        this.PC = (hi << 8) | lo;
        this.cycles += 7;
    }

    irq() {
        if (!this.getFlag(this.I_FLAG)) {
            this.push16(this.PC);
            this.push8((this.status & ~this.B_FLAG) | this.U_FLAG);
            this.setFlag(this.I_FLAG, true);

            const lo = this.bus.read(0xFFFE);
            const hi = this.bus.read(0xFFFF);
            this.PC = (hi << 8) | lo;
            this.cycles += 7;
        }
    }

    getFlag(flag) {
        return (this.status & flag) !== 0;
    }

    setFlag(flag, value) {
        if (value) {
            this.status |= flag;
        } else {
            this.status &= ~flag;
        }
    }

    updateZeroAndNegative(value) {
        const val = value & 0xFF;
        this.setFlag(this.Z_FLAG, val === 0);
        this.setFlag(this.N_FLAG, (val & 0x80) !== 0);
    }

    push8(val) {
        this.bus.write(0x0100 + (this.SP & 0xFF), val & 0xFF);
        this.SP = (this.SP - 1) & 0xFF;
    }

    pop8() {
        this.SP = (this.SP + 1) & 0xFF;
        return this.bus.read(0x0100 + this.SP);
    }

    push16(val) {
        this.push8((val >> 8) & 0xFF);
        this.push8(val & 0xFF);
    }

    pop16() {
        const lo = this.pop8();
        const hi = this.pop8();
        return (hi << 8) | lo;
    }

    step() {
        if (this.stallCycles > 0) {
            this.stallCycles--;
            return 1;
        }

        const opcode = this.bus.read(this.PC);
        this.PC = (this.PC + 1) & 0xFFFF;

        const instr = this.opcodes[opcode];
        if (!instr) {
            // NOP for unimplemented / illegal opcodes
            return 2;
        }

        const cyclesBefore = this.cycles;

        // Fetch operand address based on addressing mode
        const addrInfo = instr.mode.call(this);
        instr.exec.call(this, addrInfo);

        this.cycles += instr.cycles;
        if (addrInfo && addrInfo.pageCrossed) {
            this.cycles += instr.pageCycles || 0;
        }

        return this.cycles - cyclesBefore;
    }

    // --- Addressing Modes ---
    modeIMP() { return { addr: 0, mode: 'IMP' }; }
    modeACC() { return { addr: 0, mode: 'ACC' }; }
    
    modeIMM() {
        const addr = this.PC;
        this.PC = (this.PC + 1) & 0xFFFF;
        return { addr, mode: 'IMM' };
    }

    modeZP() {
        const addr = this.bus.read(this.PC) & 0xFF;
        this.PC = (this.PC + 1) & 0xFFFF;
        return { addr, mode: 'ZP' };
    }

    modeZPX() {
        const base = this.bus.read(this.PC);
        this.PC = (this.PC + 1) & 0xFFFF;
        const addr = (base + this.X) & 0xFF;
        return { addr, mode: 'ZPX' };
    }

    modeZPY() {
        const base = this.bus.read(this.PC);
        this.PC = (this.PC + 1) & 0xFFFF;
        const addr = (base + this.Y) & 0xFF;
        return { addr, mode: 'ZPY' };
    }

    modeREL() {
        let offset = this.bus.read(this.PC);
        this.PC = (this.PC + 1) & 0xFFFF;
        if (offset & 0x80) offset |= -256;
        return { offset, mode: 'REL' };
    }

    modeABS() {
        const lo = this.bus.read(this.PC);
        const hi = this.bus.read((this.PC + 1) & 0xFFFF);
        this.PC = (this.PC + 2) & 0xFFFF;
        const addr = (hi << 8) | lo;
        return { addr, mode: 'ABS' };
    }

    modeABSX() {
        const lo = this.bus.read(this.PC);
        const hi = this.bus.read((this.PC + 1) & 0xFFFF);
        this.PC = (this.PC + 2) & 0xFFFF;
        const base = (hi << 8) | lo;
        const addr = (base + this.X) & 0xFFFF;
        const pageCrossed = (base & 0xFF00) !== (addr & 0xFF00);
        return { addr, mode: 'ABSX', pageCrossed };
    }

    modeABSY() {
        const lo = this.bus.read(this.PC);
        const hi = this.bus.read((this.PC + 1) & 0xFFFF);
        this.PC = (this.PC + 2) & 0xFFFF;
        const base = (hi << 8) | lo;
        const addr = (base + this.Y) & 0xFFFF;
        const pageCrossed = (base & 0xFF00) !== (addr & 0xFF00);
        return { addr, mode: 'ABSY', pageCrossed };
    }

    modeIND() {
        const lo = this.bus.read(this.PC);
        const hi = this.bus.read((this.PC + 1) & 0xFFFF);
        this.PC = (this.PC + 2) & 0xFFFF;
        const ptr = (hi << 8) | lo;
        // 6502 Indirect JMP Bug simulation: page boundary wrap
        let targetHi;
        if ((ptr & 0x00FF) === 0x00FF) {
            targetHi = this.bus.read(ptr & 0xFF00);
        } else {
            targetHi = this.bus.read(ptr + 1);
        }
        const targetLo = this.bus.read(ptr);
        const addr = (targetHi << 8) | targetLo;
        return { addr, mode: 'IND' };
    }

    modeINDX() {
        const base = this.bus.read(this.PC);
        this.PC = (this.PC + 1) & 0xFFFF;
        const ptr = (base + this.X) & 0xFF;
        const lo = this.bus.read(ptr);
        const hi = this.bus.read((ptr + 1) & 0xFF);
        const addr = (hi << 8) | lo;
        return { addr, mode: 'INDX' };
    }

    modeINDY() {
        const ptr = this.bus.read(this.PC);
        this.PC = (this.PC + 1) & 0xFFFF;
        const lo = this.bus.read(ptr & 0xFF);
        const hi = this.bus.read((ptr + 1) & 0xFF);
        const base = (hi << 8) | lo;
        const addr = (base + this.Y) & 0xFFFF;
        const pageCrossed = (base & 0xFF00) !== (addr & 0xFF00);
        return { addr, mode: 'INDY', pageCrossed };
    }

    // --- Opcode Execution Methods ---
    adc(info) {
        const val = this.bus.read(info.addr);
        const carry = this.getFlag(this.C_FLAG) ? 1 : 0;
        const sum = this.A + val + carry;
        this.setFlag(this.C_FLAG, sum > 255);
        this.setFlag(this.V_FLAG, (~(this.A ^ val) & (this.A ^ sum) & 0x80) !== 0);
        this.A = sum & 0xFF;
        this.updateZeroAndNegative(this.A);
    }

    sbc(info) {
        const val = this.bus.read(info.addr) ^ 0xFF;
        const carry = this.getFlag(this.C_FLAG) ? 1 : 0;
        const sum = this.A + val + carry;
        this.setFlag(this.C_FLAG, sum > 255);
        this.setFlag(this.V_FLAG, (~(this.A ^ val) & (this.A ^ sum) & 0x80) !== 0);
        this.A = sum & 0xFF;
        this.updateZeroAndNegative(this.A);
    }

    and(info) {
        this.A &= this.bus.read(info.addr);
        this.updateZeroAndNegative(this.A);
    }

    ora(info) {
        this.A |= this.bus.read(info.addr);
        this.updateZeroAndNegative(this.A);
    }

    eor(info) {
        this.A ^= this.bus.read(info.addr);
        this.updateZeroAndNegative(this.A);
    }

    asl(info) {
        if (info.mode === 'ACC') {
            this.setFlag(this.C_FLAG, (this.A & 0x80) !== 0);
            this.A = (this.A << 1) & 0xFF;
            this.updateZeroAndNegative(this.A);
        } else {
            let val = this.bus.read(info.addr);
            this.setFlag(this.C_FLAG, (val & 0x80) !== 0);
            val = (val << 1) & 0xFF;
            this.bus.write(info.addr, val);
            this.updateZeroAndNegative(val);
        }
    }

    lsr(info) {
        if (info.mode === 'ACC') {
            this.setFlag(this.C_FLAG, (this.A & 0x01) !== 0);
            this.A = (this.A >> 1) & 0xFF;
            this.updateZeroAndNegative(this.A);
        } else {
            let val = this.bus.read(info.addr);
            this.setFlag(this.C_FLAG, (val & 0x01) !== 0);
            val = (val >> 1) & 0xFF;
            this.bus.write(info.addr, val);
            this.updateZeroAndNegative(val);
        }
    }

    rol(info) {
        const carry = this.getFlag(this.C_FLAG) ? 1 : 0;
        if (info.mode === 'ACC') {
            this.setFlag(this.C_FLAG, (this.A & 0x80) !== 0);
            this.A = ((this.A << 1) | carry) & 0xFF;
            this.updateZeroAndNegative(this.A);
        } else {
            let val = this.bus.read(info.addr);
            this.setFlag(this.C_FLAG, (val & 0x80) !== 0);
            val = ((val << 1) | carry) & 0xFF;
            this.bus.write(info.addr, val);
            this.updateZeroAndNegative(val);
        }
    }

    ror(info) {
        const carry = this.getFlag(this.C_FLAG) ? 0x80 : 0;
        if (info.mode === 'ACC') {
            this.setFlag(this.C_FLAG, (this.A & 0x01) !== 0);
            this.A = ((this.A >> 1) | carry) & 0xFF;
            this.updateZeroAndNegative(this.A);
        } else {
            let val = this.bus.read(info.addr);
            this.setFlag(this.C_FLAG, (val & 0x01) !== 0);
            val = ((val >> 1) | carry) & 0xFF;
            this.bus.write(info.addr, val);
            this.updateZeroAndNegative(val);
        }
    }

    branch(cond, info) {
        if (cond) {
            this.cycles += 1;
            const target = (this.PC + info.offset) & 0xFFFF;
            if ((this.PC & 0xFF00) !== (target & 0xFF00)) {
                this.cycles += 1;
            }
            this.PC = target;
        }
    }

    bit(info) {
        const val = this.bus.read(info.addr);
        this.setFlag(this.Z_FLAG, (this.A & val) === 0);
        this.setFlag(this.N_FLAG, (val & 0x80) !== 0);
        this.setFlag(this.V_FLAG, (val & 0x40) !== 0);
    }

    cmpReg(regVal, info) {
        const val = this.bus.read(info.addr);
        const sub = regVal - val;
        this.setFlag(this.C_FLAG, regVal >= val);
        this.updateZeroAndNegative(sub & 0xFF);
    }

    dec(info) {
        const val = (this.bus.read(info.addr) - 1) & 0xFF;
        this.bus.write(info.addr, val);
        this.updateZeroAndNegative(val);
    }

    inc(info) {
        const val = (this.bus.read(info.addr) + 1) & 0xFF;
        this.bus.write(info.addr, val);
        this.updateZeroAndNegative(val);
    }

    jmp(info) {
        this.PC = info.addr;
    }

    jsr(info) {
        this.push16((this.PC - 1) & 0xFFFF);
        this.PC = info.addr;
    }

    rts() {
        this.PC = (this.pop16() + 1) & 0xFFFF;
    }

    rti() {
        this.status = (this.pop8() & ~this.B_FLAG) | this.U_FLAG;
        this.PC = this.pop16();
    }

    lda(info) {
        this.A = this.bus.read(info.addr);
        this.updateZeroAndNegative(this.A);
    }

    ldx(info) {
        this.X = this.bus.read(info.addr);
        this.updateZeroAndNegative(this.X);
    }

    ldy(info) {
        this.Y = this.bus.read(info.addr);
        this.updateZeroAndNegative(this.Y);
    }

    sta(info) {
        this.bus.write(info.addr, this.A);
    }

    stx(info) {
        this.bus.write(info.addr, this.X);
    }

    sty(info) {
        this.bus.write(info.addr, this.Y);
    }

    initOpcodeTable() {
        this.opcodes = new Array(256);

        const map = (code, exec, mode, cycles, pageCycles = 0) => {
            this.opcodes[code] = { exec, mode, cycles, pageCycles };
        };

        // ADC
        map(0x69, this.adc, this.modeIMM, 2);
        map(0x65, this.adc, this.modeZP, 3);
        map(0x75, this.adc, this.modeZPX, 4);
        map(0x6D, this.adc, this.modeABS, 4);
        map(0x7D, this.adc, this.modeABSX, 4, 1);
        map(0x79, this.adc, this.modeABSY, 4, 1);
        map(0x61, this.adc, this.modeINDX, 6);
        map(0x71, this.adc, this.modeINDY, 5, 1);

        // SBC
        map(0xE9, this.sbc, this.modeIMM, 2);
        map(0xE5, this.sbc, this.modeZP, 3);
        map(0xF5, this.sbc, this.modeZPX, 4);
        map(0xED, this.sbc, this.modeABS, 4);
        map(0xFD, this.sbc, this.modeABSX, 4, 1);
        map(0xF9, this.sbc, this.modeABSY, 4, 1);
        map(0xE1, this.sbc, this.modeINDX, 6);
        map(0xF1, this.sbc, this.modeINDY, 5, 1);

        // AND
        map(0x29, this.and, this.modeIMM, 2);
        map(0x25, this.and, this.modeZP, 3);
        map(0x35, this.and, this.modeZPX, 4);
        map(0x2D, this.and, this.modeABS, 4);
        map(0x3D, this.and, this.modeABSX, 4, 1);
        map(0x39, this.and, this.modeABSY, 4, 1);
        map(0x21, this.and, this.modeINDX, 6);
        map(0x31, this.and, this.modeINDY, 5, 1);

        // ORA
        map(0x09, this.ora, this.modeIMM, 2);
        map(0x05, this.ora, this.modeZP, 3);
        map(0x15, this.ora, this.modeZPX, 4);
        map(0x0D, this.ora, this.modeABS, 4);
        map(0x1D, this.ora, this.modeABSX, 4, 1);
        map(0x19, this.ora, this.modeABSY, 4, 1);
        map(0x01, this.ora, this.modeINDX, 6);
        map(0x11, this.ora, this.modeINDY, 5, 1);

        // EOR
        map(0x49, this.eor, this.modeIMM, 2);
        map(0x45, this.eor, this.modeZP, 3);
        map(0x55, this.eor, this.modeZPX, 4);
        map(0x4D, this.eor, this.modeABS, 4);
        map(0x5D, this.eor, this.modeABSX, 4, 1);
        map(0x59, this.eor, this.modeABSY, 4, 1);
        map(0x41, this.eor, this.modeINDX, 6);
        map(0x51, this.eor, this.modeINDY, 5, 1);

        // ASL
        map(0x0A, this.asl, this.modeACC, 2);
        map(0x06, this.asl, this.modeZP, 5);
        map(0x16, this.asl, this.modeZPX, 6);
        map(0x0E, this.asl, this.modeABS, 6);
        map(0x1E, this.asl, this.modeABSX, 7);

        // LSR
        map(0x4A, this.lsr, this.modeACC, 2);
        map(0x46, this.lsr, this.modeZP, 5);
        map(0x56, this.lsr, this.modeZPX, 6);
        map(0x4E, this.lsr, this.modeABS, 6);
        map(0x5E, this.lsr, this.modeABSX, 7);

        // ROL
        map(0x2A, this.rol, this.modeACC, 2);
        map(0x26, this.rol, this.modeZP, 5);
        map(0x36, this.rol, this.modeZPX, 6);
        map(0x2E, this.rol, this.modeABS, 6);
        map(0x3E, this.rol, this.modeABSX, 7);

        // ROR
        map(0x6A, this.ror, this.modeACC, 2);
        map(0x66, this.ror, this.modeZP, 5);
        map(0x76, this.ror, this.modeZPX, 6);
        map(0x6E, this.ror, this.modeABS, 6);
        map(0x7E, this.ror, this.modeABSX, 7);

        // Branches
        map(0x90, info => this.branch(!this.getFlag(this.C_FLAG), info), this.modeREL, 2);
        map(0xB0, info => this.branch(this.getFlag(this.C_FLAG), info), this.modeREL, 2);
        map(0xF0, info => this.branch(this.getFlag(this.Z_FLAG), info), this.modeREL, 2);
        map(0xD0, info => this.branch(!this.getFlag(this.Z_FLAG), info), this.modeREL, 2);
        map(0x30, info => this.branch(this.getFlag(this.N_FLAG), info), this.modeREL, 2);
        map(0x10, info => this.branch(!this.getFlag(this.N_FLAG), info), this.modeREL, 2);
        map(0x70, info => this.branch(this.getFlag(this.V_FLAG), info), this.modeREL, 2);
        map(0x50, info => this.branch(!this.getFlag(this.V_FLAG), info), this.modeREL, 2);

        // BIT
        map(0x24, this.bit, this.modeZP, 3);
        map(0x2C, this.bit, this.modeABS, 4);

        // Compare
        map(0xC9, info => this.cmpReg(this.A, info), this.modeIMM, 2);
        map(0xC5, info => this.cmpReg(this.A, info), this.modeZP, 3);
        map(0xD5, info => this.cmpReg(this.A, info), this.modeZPX, 4);
        map(0xCD, info => this.cmpReg(this.A, info), this.modeABS, 4);
        map(0xDD, info => this.cmpReg(this.A, info), this.modeABSX, 4, 1);
        map(0xD9, info => this.cmpReg(this.A, info), this.modeABSY, 4, 1);
        map(0xC1, info => this.cmpReg(this.A, info), this.modeINDX, 6);
        map(0xD1, info => this.cmpReg(this.A, info), this.modeINDY, 5, 1);

        map(0xE0, info => this.cmpReg(this.X, info), this.modeIMM, 2);
        map(0xE4, info => this.cmpReg(this.X, info), this.modeZP, 3);
        map(0xEC, info => this.cmpReg(this.X, info), this.modeABS, 4);

        map(0xC0, info => this.cmpReg(this.Y, info), this.modeIMM, 2);
        map(0xC4, info => this.cmpReg(this.Y, info), this.modeZP, 3);
        map(0xCC, info => this.cmpReg(this.Y, info), this.modeABS, 4);

        // DEC / INC
        map(0xC6, this.dec, this.modeZP, 5);
        map(0xD6, this.dec, this.modeZPX, 6);
        map(0xCE, this.dec, this.modeABS, 6);
        map(0xDE, this.dec, this.modeABSX, 7);

        map(0xE6, this.inc, this.modeZP, 5);
        map(0xF6, this.inc, this.modeZPX, 6);
        map(0xEE, this.inc, this.modeABS, 6);
        map(0xFE, this.inc, this.modeABSX, 7);

        map(0xCA, () => { this.X = (this.X - 1) & 0xFF; this.updateZeroAndNegative(this.X); }, this.modeIMP, 2);
        map(0x88, () => { this.Y = (this.Y - 1) & 0xFF; this.updateZeroAndNegative(this.Y); }, this.modeIMP, 2);
        map(0xE8, () => { this.X = (this.X + 1) & 0xFF; this.updateZeroAndNegative(this.X); }, this.modeIMP, 2);
        map(0xC8, () => { this.Y = (this.Y + 1) & 0xFF; this.updateZeroAndNegative(this.Y); }, this.modeIMP, 2);

        // JMP / JSR / RTS / RTI
        map(0x4C, this.jmp, this.modeABS, 3);
        map(0x6C, this.jmp, this.modeIND, 5);
        map(0x20, this.jsr, this.modeABS, 6);
        map(0x60, this.rts, this.modeIMP, 6);
        map(0x40, this.rti, this.modeIMP, 6);

        // LDA / LDX / LDY
        map(0xA9, this.lda, this.modeIMM, 2);
        map(0xA5, this.lda, this.modeZP, 3);
        map(0xB5, this.lda, this.modeZPX, 4);
        map(0xAD, this.lda, this.modeABS, 4);
        map(0xBD, this.lda, this.modeABSX, 4, 1);
        map(0xB9, this.lda, this.modeABSY, 4, 1);
        map(0xA1, this.lda, this.modeINDX, 6);
        map(0xB1, this.lda, this.modeINDY, 5, 1);

        map(0xA2, this.ldx, this.modeIMM, 2);
        map(0xA6, this.ldx, this.modeZP, 3);
        map(0xB6, this.ldx, this.modeZPY, 4);
        map(0xAE, this.ldx, this.modeABS, 4);
        map(0xBE, this.ldx, this.modeABSY, 4, 1);

        map(0xA0, this.ldy, this.modeIMM, 2);
        map(0xA4, this.ldy, this.modeZP, 3);
        map(0xB4, this.ldy, this.modeZPX, 4);
        map(0xAC, this.ldy, this.modeABS, 4);
        map(0xBC, this.ldy, this.modeABSX, 4, 1);

        // STA / STX / STY
        map(0x85, this.sta, this.modeZP, 3);
        map(0x95, this.sta, this.modeZPX, 4);
        map(0x8D, this.sta, this.modeABS, 4);
        map(0x9D, this.sta, this.modeABSX, 5);
        map(0x99, this.sta, this.modeABSY, 5);
        map(0x81, this.sta, this.modeINDX, 6);
        map(0x91, this.sta, this.modeINDY, 6);

        map(0x86, this.stx, this.modeZP, 3);
        map(0x96, this.stx, this.modeZPY, 4);
        map(0x8E, this.stx, this.modeABS, 4);

        map(0x84, this.sty, this.modeZP, 3);
        map(0x94, this.sty, this.modeZPX, 4);
        map(0x8C, this.sty, this.modeABS, 4);

        // Transfers / Stack / NOP / Flags
        map(0xAA, () => { this.X = this.A; this.updateZeroAndNegative(this.X); }, this.modeIMP, 2);
        map(0x8A, () => { this.A = this.X; this.updateZeroAndNegative(this.A); }, this.modeIMP, 2);
        map(0xA8, () => { this.Y = this.A; this.updateZeroAndNegative(this.Y); }, this.modeIMP, 2);
        map(0x98, () => { this.A = this.Y; this.updateZeroAndNegative(this.A); }, this.modeIMP, 2);
        map(0xBA, () => { this.X = this.SP; this.updateZeroAndNegative(this.X); }, this.modeIMP, 2);
        map(0x9A, () => { this.SP = this.X; }, this.modeIMP, 2);

        map(0x48, () => { this.push8(this.A); }, this.modeIMP, 3);
        map(0x68, () => { this.A = this.pop8(); this.updateZeroAndNegative(this.A); }, this.modeIMP, 4);
        map(0x08, () => { this.push8(this.status | this.B_FLAG | this.U_FLAG); }, this.modeIMP, 3);
        map(0x28, () => { this.status = (this.pop8() & ~this.B_FLAG) | this.U_FLAG; }, this.modeIMP, 4);

        map(0x18, () => { this.setFlag(this.C_FLAG, false); }, this.modeIMP, 2);
        map(0x38, () => { this.setFlag(this.C_FLAG, true); }, this.modeIMP, 2);
        map(0x58, () => { this.setFlag(this.I_FLAG, false); }, this.modeIMP, 2);
        map(0x78, () => { this.setFlag(this.I_FLAG, true); }, this.modeIMP, 2);
        map(0xB8, () => { this.setFlag(this.V_FLAG, false); }, this.modeIMP, 2);
        map(0xD8, () => { this.setFlag(this.D_FLAG, false); }, this.modeIMP, 2);
        map(0xF8, () => { this.setFlag(this.D_FLAG, true); }, this.modeIMP, 2);

        map(0xEA, () => {}, this.modeIMP, 2); // NOP

        map(0x00, () => { // BRK
            this.PC = (this.PC + 1) & 0xFFFF;
            this.push16(this.PC);
            this.push8(this.status | this.B_FLAG | this.U_FLAG);
            this.setFlag(this.I_FLAG, true);
            const lo = this.bus.read(0xFFFE);
            const hi = this.bus.read(0xFFFF);
            this.PC = (hi << 8) | lo;
        }, this.modeIMP, 7);
    }
}

window.NESCPU = NESCPU;

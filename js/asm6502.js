/**
 * Complete 6502 NES Assembler and Disassembler Engine
 * Translates 6502 Assembly Source Code directly into standard iNES ROM format (.nes)
 */

class ASM6502 {
    constructor() {
        this.opcodesMap = {
            'ADC': { IMM: 0x69, ZP: 0x65, ZPX: 0x75, ABS: 0x6D, ABSX: 0x7D, ABSY: 0x79, INDX: 0x61, INDY: 0x71 },
            'SBC': { IMM: 0xE9, ZP: 0xE5, ZPX: 0xF5, ABS: 0xED, ABSX: 0xFD, ABSY: 0xF9, INDX: 0xE1, INDY: 0xF1 },
            'AND': { IMM: 0x29, ZP: 0x25, ZPX: 0x35, ABS: 0x2D, ABSX: 0x3D, ABSY: 0x39, INDX: 0x21, INDY: 0x31 },
            'ORA': { IMM: 0x09, ZP: 0x05, ZPX: 0x15, ABS: 0x0D, ABSX: 0x1D, ABSY: 0x19, INDX: 0x01, INDY: 0x11 },
            'EOR': { IMM: 0x49, ZP: 0x45, ZPX: 0x55, ABS: 0x4D, ABSX: 0x5D, ABSY: 0x59, INDX: 0x41, INDY: 0x51 },
            'ASL': { ACC: 0x0A, ZP: 0x06, ZPX: 0x16, ABS: 0x0E, ABSX: 0x1E },
            'LSR': { ACC: 0x4A, ZP: 0x46, ZPX: 0x56, ABS: 0x4E, ABSX: 0x5E },
            'ROL': { ACC: 0x2A, ZP: 0x26, ZPX: 0x36, ABS: 0x2E, ABSX: 0x3E },
            'ROR': { ACC: 0x6A, ZP: 0x66, ZPX: 0x76, ABS: 0x6E, ABSX: 0x7E },
            'BCC': { REL: 0x90 }, 'BCS': { REL: 0xB0 }, 'BEQ': { REL: 0xF0 }, 'BNE': { REL: 0xD0 },
            'BMI': { REL: 0x30 }, 'BPL': { REL: 0x10 }, 'BVC': { REL: 0x50 }, 'BVS': { REL: 0x70 },
            'BIT': { ZP: 0x24, ABS: 0x2C },
            'CMP': { IMM: 0xC9, ZP: 0xC5, ZPX: 0xD5, ABS: 0xCD, ABSX: 0xDD, ABSY: 0xD9, INDX: 0xC1, INDY: 0xD1 },
            'CPX': { IMM: 0xE0, ZP: 0xE4, ABS: 0xEC },
            'CPY': { IMM: 0xC0, ZP: 0xC4, ABS: 0xCC },
            'DEC': { ZP: 0xC6, ZPX: 0xD6, ABS: 0xCE, ABSX: 0xDE },
            'INC': { ZP: 0xE6, ZPX: 0xF6, ABS: 0xEE, ABSX: 0xFE },
            'DEX': { IMP: 0xCA }, 'DEY': { IMP: 0x88 }, 'INX': { IMP: 0xE8 }, 'INY': { IMP: 0xC8 },
            'JMP': { ABS: 0x4C, IND: 0x6C },
            'JSR': { ABS: 0x20 },
            'RTS': { IMP: 0x60 }, 'RTI': { IMP: 0x40 },
            'LDA': { IMM: 0xA9, ZP: 0xA5, ZPX: 0xB5, ABS: 0xAD, ABSX: 0xBD, ABSY: 0xB9, INDX: 0xA1, INDY: 0xB1 },
            'LDX': { IMM: 0xA2, ZP: 0xA6, ZPY: 0xB6, ABS: 0xAE, ABSY: 0xBE },
            'LDY': { IMM: 0xA0, ZP: 0xA4, ZPX: 0xB4, ABS: 0xAC, ABSX: 0xBC },
            'STA': { ZP: 0x85, ZPX: 0x95, ABS: 0x8D, ABSX: 0x9D, ABSY: 0x99, INDX: 0x81, INDY: 0x91 },
            'STX': { ZP: 0x86, ZPY: 0x96, ABS: 0x8E },
            'STY': { ZP: 0x84, ZPX: 0x94, ABS: 0x8C },
            'TAX': { IMP: 0xAA }, 'TXA': { IMP: 0x8A }, 'TAY': { IMP: 0xA8 }, 'TYA': { IMP: 0x98 },
            'TSX': { IMP: 0xBA }, 'TXS': { IMP: 0x9A }, 'PHA': { IMP: 0x48 }, 'PLA': { IMP: 0x68 },
            'PHP': { IMP: 0x08 }, 'PLP': { IMP: 0x28 }, 'CLC': { IMP: 0x18 }, 'SEC': { IMP: 0x38 },
            'CLI': { IMP: 0x58 }, 'SEI': { IMP: 0x78 }, 'CLV': { IMP: 0xB8 }, 'CLD': { IMP: 0xD8 },
            'SED': { IMP: 0xF8 }, 'NOP': { IMP: 0xEA }, 'BRK': { IMP: 0x00 }
        };
    }

    parseValue(token, symbols = {}) {
        if (!token) return null;
        token = token.trim();

        if (token.startsWith('#')) {
            token = token.substring(1);
        }

        if (symbols[token] !== undefined) {
            return symbols[token];
        }

        if (token.startsWith('$')) {
            return parseInt(token.substring(1), 16);
        }

        if (token.startsWith('%')) {
            return parseInt(token.substring(1), 2);
        }

        if (/^-?\d+$/.test(token)) {
            return parseInt(token, 10);
        }

        return null;
    }

    assemble(sourceCode, chrBytes = null) {
        const lines = sourceCode.split('\n');
        const symbols = {};
        let currentOrg = 0xC000;

        let inesPrg = 1; // 16KB units
        let inesChr = 1; // 8KB units
        let inesMir = 0; // Horizontal mirroring

        const prgBuffer = new Uint8Array(16384 * inesPrg);
        prgBuffer.fill(0xEA);

        // PASS 1: Calculate exact addresses & collect symbols/labels
        let passAddress = currentOrg;

        for (let l = 0; l < lines.length; l++) {
            let line = lines[l].split(';')[0].trim();
            if (!line) continue;

            if (line.includes('=')) {
                const parts = line.split('=');
                const symName = parts[0].trim();
                const val = this.parseValue(parts[1].trim(), symbols);
                if (val !== null) symbols[symName] = val;
                continue;
            }

            if (line.endsWith(':') || line.includes(':')) {
                const colonIdx = line.indexOf(':');
                const label = line.substring(0, colonIdx).trim();
                symbols[label] = passAddress;
                line = line.substring(colonIdx + 1).trim();
                if (!line) continue;
            }

            const tokens = line.split(/\s+/);
            const opcode = tokens[0].toUpperCase();

            if (opcode === '.ORG') {
                const val = this.parseValue(tokens[1], symbols);
                if (val !== null) passAddress = val;
                continue;
            } else if (opcode === '.BYTE' || opcode === '.DB') {
                const byteCount = line.substring(line.indexOf(' ')).split(',').length;
                passAddress += byteCount;
                continue;
            } else if (opcode === '.WORD' || opcode === '.DW') {
                const wordCount = line.substring(line.indexOf(' ')).split(',').length;
                passAddress += wordCount * 2;
                continue;
            } else if (opcode.startsWith('.')) {
                continue;
            }

            const instrInfo = this.opcodesMap[opcode];
            if (instrInfo) {
                const operand = tokens.slice(1).join('').toUpperCase();

                if (!operand || operand === 'A') {
                    passAddress += 1; // Implied or Accumulator
                } else if (instrInfo['REL']) {
                    passAddress += 2; // Relative branch ALWAYS 2 bytes!
                } else if (operand.startsWith('#')) {
                    passAddress += 2; // Immediate
                } else if (operand.endsWith(',X')) {
                    const base = operand.substring(0, operand.length - 2);
                    const val = this.parseValue(base, symbols);
                    passAddress += (val !== null && val <= 0xFF && instrInfo['ZPX']) ? 2 : 3;
                } else if (operand.endsWith(',Y')) {
                    const base = operand.substring(0, operand.length - 2);
                    const val = this.parseValue(base, symbols);
                    passAddress += (val !== null && val <= 0xFF && instrInfo['ZPY']) ? 2 : 3;
                } else {
                    const val = this.parseValue(operand, symbols);
                    if (val !== null && val <= 0xFF && instrInfo['ZP']) {
                        passAddress += 2;
                    } else {
                        passAddress += 3;
                    }
                }
            }
        }

        // PASS 2: Emit Machine Code Bytes
        let emitAddress = currentOrg;

        for (let l = 0; l < lines.length; l++) {
            let line = lines[l].split(';')[0].trim();
            if (!line) continue;

            if (line.includes('=')) continue;

            if (line.includes(':')) {
                line = line.substring(line.indexOf(':') + 1).trim();
                if (!line) continue;
            }

            const tokens = line.split(/\s+/);
            const opcode = tokens[0].toUpperCase();

            if (opcode === '.ORG') {
                const val = this.parseValue(tokens[1], symbols);
                if (val !== null) emitAddress = val;
                continue;
            } else if (opcode === '.BYTE' || opcode === '.DB') {
                const argStr = line.substring(line.indexOf(' ')).trim();
                const byteVals = argStr.split(',').map(s => this.parseValue(s.trim(), symbols));
                for (let b of byteVals) {
                    if (b !== null) {
                        prgBuffer[emitAddress - currentOrg] = b & 0xFF;
                        emitAddress++;
                    }
                }
                continue;
            } else if (opcode === '.WORD' || opcode === '.DW') {
                const argStr = line.substring(line.indexOf(' ')).trim();
                const wordVals = argStr.split(',').map(s => this.parseValue(s.trim(), symbols));
                for (let w of wordVals) {
                    if (w !== null) {
                        prgBuffer[emitAddress - currentOrg] = w & 0xFF;
                        prgBuffer[emitAddress - currentOrg + 1] = (w >> 8) & 0xFF;
                        emitAddress += 2;
                    }
                }
                continue;
            } else if (opcode === '.INESPRG') {
                inesPrg = parseInt(tokens[1]) || 1;
                continue;
            } else if (opcode === '.INESCHR') {
                inesChr = parseInt(tokens[1]) || 1;
                continue;
            } else if (opcode === '.INESMIR') {
                inesMir = parseInt(tokens[1]) || 0;
                continue;
            }

            const instrInfo = this.opcodesMap[opcode];
            if (instrInfo) {
                const operandRaw = tokens.slice(1).join('').trim();

                let mode = 'IMP';
                let opByte = null;
                let operandValue = null;

                if (!operandRaw || operandRaw === 'A') {
                    mode = instrInfo['ACC'] ? 'ACC' : 'IMP';
                    opByte = instrInfo[mode];
                } else if (operandRaw.startsWith('#')) {
                    mode = 'IMM';
                    opByte = instrInfo['IMM'];
                    operandValue = this.parseValue(operandRaw, symbols);
                } else if (instrInfo['REL']) {
                    mode = 'REL';
                    opByte = instrInfo['REL'];
                    let targetAddr = this.parseValue(operandRaw, symbols);
                    if (targetAddr !== null) {
                        let relOffset = targetAddr - (emitAddress + 2);
                        operandValue = relOffset & 0xFF;
                    }
                } else if (operandRaw.endsWith(',X')) {
                    const base = operandRaw.substring(0, operandRaw.length - 2);
                    let val = this.parseValue(base, symbols);
                    operandValue = val;
                    mode = (val !== null && val <= 0xFF && instrInfo['ZPX']) ? 'ZPX' : 'ABSX';
                    opByte = instrInfo[mode];
                } else if (operandRaw.endsWith(',Y')) {
                    const base = operandRaw.substring(0, operandRaw.length - 2);
                    let val = this.parseValue(base, symbols);
                    operandValue = val;
                    mode = (val !== null && val <= 0xFF && instrInfo['ZPY']) ? 'ZPY' : 'ABSY';
                    opByte = instrInfo[mode];
                } else {
                    let val = this.parseValue(operandRaw, symbols);
                    operandValue = val;
                    if (val !== null && val <= 0xFF && instrInfo['ZP']) {
                        mode = 'ZP';
                    } else {
                        mode = 'ABS';
                    }
                    opByte = instrInfo[mode];
                }

                if (opByte !== undefined && opByte !== null) {
                    prgBuffer[emitAddress - currentOrg] = opByte;
                    emitAddress++;

                    if (mode === 'IMM' || mode === 'ZP' || mode === 'ZPX' || mode === 'ZPY' || mode === 'REL') {
                        prgBuffer[emitAddress - currentOrg] = (operandValue || 0) & 0xFF;
                        emitAddress++;
                    } else if (mode === 'ABS' || mode === 'ABSX' || mode === 'ABSY' || mode === 'IND') {
                        prgBuffer[emitAddress - currentOrg] = (operandValue || 0) & 0xFF;
                        prgBuffer[emitAddress - currentOrg + 1] = ((operandValue || 0) >> 8) & 0xFF;
                        emitAddress += 2;
                    }
                }
            }
        }

        const totalPrgBytes = inesPrg * 16384;
        const totalChrBytes = inesChr * 8192;
        const finalRom = new Uint8Array(16 + totalPrgBytes + totalChrBytes);

        finalRom[0] = 0x4E; finalRom[1] = 0x45; finalRom[2] = 0x53; finalRom[3] = 0x1A;
        finalRom[4] = inesPrg;
        finalRom[5] = inesChr;
        finalRom[6] = inesMir & 0x01;

        finalRom.set(prgBuffer.subarray(0, totalPrgBytes), 16);

        if (chrBytes && chrBytes.length > 0) {
            finalRom.set(chrBytes.subarray(0, totalChrBytes), 16 + totalPrgBytes);
        }

        return {
            rom: finalRom,
            symbols: symbols,
            prgSize: totalPrgBytes
        };
    }
}

window.ASM6502 = ASM6502;

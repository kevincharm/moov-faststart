import { asciiToU32Be, readU32, readU64, u32BeToAscii, Cursor } from './util'

export const FREE_ATOM = asciiToU32Be('free')
export const JUNK_ATOM = asciiToU32Be('junk')
export const MDAT_ATOM = asciiToU32Be('mdat')
export const MOOV_ATOM = asciiToU32Be('moov')
export const PNOT_ATOM = asciiToU32Be('pnot')
export const SKIP_ATOM = asciiToU32Be('skip')
export const WIDE_ATOM = asciiToU32Be('wide')
export const PICT_ATOM = asciiToU32Be('PICT')
export const FTYP_ATOM = asciiToU32Be('ftyp')
export const UUID_ATOM = asciiToU32Be('uuid')
export const CMOV_ATOM = asciiToU32Be('cmov')
export const TRAK_ATOM = asciiToU32Be('trak')
export const MDIA_ATOM = asciiToU32Be('mdia')
export const MINF_ATOM = asciiToU32Be('minf')
export const STBL_ATOM = asciiToU32Be('stbl')
export const STCO_ATOM = asciiToU32Be('stco')
export const CO64_ATOM = asciiToU32Be('co64')

export const ATOM_PREAMBLE_SIZE = BigInt(8)
export const MAX_FTYP_ATOM_SIZE = BigInt(1048576)

export interface QtAtom {
    kind: string
    size: BigInt
    data: QtAtom[] | Buffer
}

export function parseAtoms(infile: Buffer, depth = 0): QtAtom[] {
    const atoms: QtAtom[] = []
    const cur: Cursor = {
        pos: BigInt(0)
    }

    const len = BigInt(infile.byteLength)
    while (cur.pos < len) {
        if (len - cur.pos < 8) {
            break
        }

        let fwd: BigInt // forward-seek counter
        let atomSize = BigInt(readU32(cur, infile))
        const atomType = readU32(cur, infile)
        if (Number(atomSize) === 1) {
            // 64-bit atom size
            atomSize = readU64(cur, infile)
            if (atomSize > BigInt(Number.MAX_SAFE_INTEGER)) {
                throw new Error(`"${atomType}" atom size is larger than MAX_SAFE_INTEGER!`)
            }
            fwd = atomSize - ATOM_PREAMBLE_SIZE * BigInt(2)
        } else {
            fwd = atomSize - ATOM_PREAMBLE_SIZE
        }
        const endOfAtom = cur.pos + fwd
        const subatoms = Buffer.from(infile.slice(Number(cur.pos), Number(endOfAtom)))
        const data = hasSubatoms(atomType) && depth < 10 ? parseAtoms(subatoms, depth + 1) : subatoms
        cur.pos = endOfAtom
        if (depth === 0 && !isQtAtom(atomType)) {
            throw new Error(`Non-QT top-level atom found: ${u32BeToAscii(atomType)}`)
        }
        atoms.push({
            kind: u32BeToAscii(atomType),
            size: atomSize,
            data
        })
    }

    return atoms
}

export function recurseFlattenAtoms(atoms: QtAtom[], depth = 0): Buffer {
    const buffers: Buffer[] = []
    for (const atom of atoms) {
        if (!Buffer.isBuffer(atom.data)) {
            atom.data = recurseFlattenAtoms(atom.data, depth + 1)
        }

        const u64Size = Number(ATOM_PREAMBLE_SIZE) + atom.data.byteLength > 2 ** 32 - 1
        let header
        if (u64Size) {
            const u64Preamble = Number(ATOM_PREAMBLE_SIZE) * 2
            header = Buffer.alloc(u64Preamble)
            header.writeUInt32BE(1, 0)
            header.writeUInt32BE(asciiToU32Be(atom.kind), 4)
            const newSize = u64Preamble + atom.data.byteLength
            header.writeUInt32BE((newSize >> 32) & 0xffffffff, 8)
            header.writeUInt32BE(newSize & 0xffffffff, 12)
        } else {
            header = Buffer.alloc(Number(ATOM_PREAMBLE_SIZE))
            const newSize = Number(ATOM_PREAMBLE_SIZE) + atom.data.byteLength
            header.writeUInt32BE(newSize, 0)
            header.writeUInt32BE(asciiToU32Be(atom.kind), 4)
        }
        const buf = Buffer.concat([header, atom.data])
        buffers.push(buf)
    }
    return Buffer.concat(buffers)
}

export function traverseAtoms(atoms: QtAtom[], callback: (atom: QtAtom) => void) {
    for (const atom of atoms) {
        if (!Buffer.isBuffer(atom.data)) {
            traverseAtoms(atom.data, callback)
        }

        callback(atom)
    }
}

export function isQtAtom(atomType: number) {
    return [
        FREE_ATOM,
        JUNK_ATOM,
        MDAT_ATOM,
        MOOV_ATOM,
        PNOT_ATOM,
        SKIP_ATOM,
        WIDE_ATOM,
        PICT_ATOM,
        FTYP_ATOM,
        UUID_ATOM,
        CMOV_ATOM,
        TRAK_ATOM,
        MDIA_ATOM,
        MINF_ATOM,
        STBL_ATOM,
        STCO_ATOM,
        CO64_ATOM
    ].includes(atomType)
}

export function hasSubatoms(atomType: number) {
    return [MOOV_ATOM, TRAK_ATOM, MDIA_ATOM, MINF_ATOM, STBL_ATOM].includes(atomType)
}

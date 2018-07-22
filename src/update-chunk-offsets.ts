import { FaststartOptions } from './options'
import { QtAtom, traverseAtoms, ATOM_PREAMBLE_SIZE } from './atom'

/**
 * Adds the specified offset to each entry in stco/co64 atoms
 *
 * @param atoms QT atoms to traverse
 * @param offset offset to add
 * @param forceUpgrade always upgrade stco atoms to co64
 */
export default function updateChunkOffsets(moov: QtAtom, options: FaststartOptions) {
    const atoms = moov.data as QtAtom[] // TODO: does this need to be type checked?
    const originalMoovSize = Number(moov.size)
    let newChunksSize = 0
    let originalChunksSize = 0

    // First pass to count total entries, which is needed for co64 upgrades.
    traverseAtoms(atoms, atom => {
        if (!['stco', 'co64'].includes(atom.kind) || !Buffer.isBuffer(atom.data)) {
            return
        }

        const entries = atom.data.readUInt32BE(4)
        const originalEntrySize = isCo64(atom.kind) ? 8 : 4
        originalChunksSize += entries * originalEntrySize
        const newEntrySize = isCo64(atom.kind) || options.forceUpgradeToCo64 ? 8 : 4
        newChunksSize += entries * newEntrySize
    })

    // Calculate new mdat offsets to add to stco/co64 chunk offset values
    const totalOffset = originalMoovSize - originalChunksSize + newChunksSize

    // Second pass to actually update offsets.
    traverseAtoms(atoms, atom => {
        if (!['stco', 'co64'].includes(atom.kind) || !Buffer.isBuffer(atom.data)) {
            return
        }
        const overflow = updateChunkAtom(atom, totalOffset, options)
        if (!overflow) {
            return
        }

        upgradeStcoToCo64(atom, totalOffset)
    })
}

/**
 * Updates `stco` or `co64` atoms' chunk offsets.
 *
 * @param atom `stco` or `co64` to update chunk offsets of
 * @param totalOffset the total offset value to add to the existing chunk offsets
 * @param options
 * @returns {boolean} `true` if overflowed (did not finish updating chunks), `false` if succeeded
 */
function updateChunkAtom(atom: QtAtom, totalOffset: number, options: FaststartOptions) {
    if (!Buffer.isBuffer(atom.data)) {
        throw new Error(`${atom.kind} data is not a Buffer!`)
    }

    let overflow = false

    const entrySize = isCo64(atom.kind) ? 8 : 4
    const entries = atom.data.readUInt32BE(4)
    const newData = Buffer.alloc(8 + entries * entrySize) // 8 byte header
    atom.data.copy(newData, 0, 0, 8) // copy header
    for (let i = 0; i < entries; i++) {
        const cur = 8 + i * entrySize // 8 byte header
        if (isCo64(atom.kind)) {
            const newVal64 =
                Number((BigInt(atom.data.readUInt32BE(cur)) << 32) | BigInt(atom.data.readUInt32BE(cur + 4))) +
                totalOffset
            newData.writeUInt32BE((BigInt(newVal64) >> BigInt(32)) & BigInt(0xffffffff), cur)
            newData.writeUInt32BE(BigInt(newVal64) & BigInt(0xffffffff), cur + 4)
            continue
        }

        if (options.forceUpgradeToCo64) {
            overflow = true
            break
        }
        const newVal32 = atom.data.readUInt32BE(cur) + totalOffset
        if (newVal32 > 2 ** 32 - 1) {
            overflow = true
            break
        }
        newData.writeUInt32BE(newVal32, cur)
    }

    if (!overflow) {
        atom.data = newData
    }

    return overflow
}

/**
 * **Upgrades** `stco` atom to a `co64` atom and also updates the chunk offsets.
 *
 * @param atom `stco` or `co64` to update chunk offsets of
 * @param totalOffset the total offset value to add to the existing chunk offsets
 */
function upgradeStcoToCo64(atom: QtAtom, totalOffset: number) {
    if (!Buffer.isBuffer(atom.data)) {
        throw new Error(`${atom.kind} data is not a Buffer!`)
    }

    // Upgrade to stco atoms to co64 atoms
    const entries = atom.data.readUInt32BE(4)
    const upgradedData = Buffer.alloc(8 + entries * 8) // 8-byte header, 8-byte entry size
    atom.data.copy(upgradedData, 0, 0, 8)
    upgradedData.writeUInt32BE((entries >> 32) & 0xffffffff, 8) // MSB 64-bit size
    upgradedData.writeUInt32BE(entries & 0xffffffff, 12) // LSB 64-bit size
    for (let i = 0; i < entries; i++) {
        const cur32 = 8 + i * 4 // 8-byte header, 4-byte entry size for READS (stco)
        const newVal = atom.data.readUInt32BE(cur32) + totalOffset
        const cur64 = 8 + i * 8 // 8-byte header, 8-byte entry size for WRITES (co64)
        upgradedData.writeUInt32BE(Number((BigInt(newVal) >> BigInt(32)) & BigInt(0xffffffff)), cur64)
        upgradedData.writeUInt32BE(Number(BigInt(newVal) & BigInt(0xffffffff)), cur64 + 4)
    }
    atom.kind = 'co64'
    atom.data = upgradedData
    atom.size = ATOM_PREAMBLE_SIZE * BigInt(2) + BigInt(upgradedData.byteLength)
}

function isCo64(atomKind: string) {
    return atomKind === 'co64'
}

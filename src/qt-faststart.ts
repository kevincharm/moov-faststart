import { parseAtoms, recurseFlattenAtoms, QtAtom, MAX_FTYP_ATOM_SIZE } from './atom'
import { FaststartOptions } from './options'
import updateChunkOffsets from './update-chunk-offsets'

/**
 * Enables "faststart" for QuickTime files so that they can be streamed.
 *
 * @param infile QT/mp4 to faststart
 * @returns Faststarted QT/mp4
 */
export default function faststart(infile: Buffer, options: FaststartOptions = {}) {
    const file = Buffer.from(infile)
    const atoms = parseAtoms(file)
    const mdatIndex = atoms.findIndex(atom => atom.kind === 'mdat')
    if (mdatIndex === -1) {
        throw new Error(`No mdat atom found!`)
    }
    const moovIndex = atoms.findIndex(atom => atom.kind === 'moov')
    if (moovIndex === -1) {
        throw new Error(`No moov atom found!`)
    }
    if (moovIndex < mdatIndex) {
        // moov atom is already up front!
        return file
    }

    const faststarted = sortFaststartAtoms(atoms, options)
    return recurseFlattenAtoms(faststarted)
}

/**
 * Sorts an array of QT atoms so that the first two atoms are `ftyp`, then `moov`.
 * Additionally updates all chunk offsets (`stco`/`co64` atoms) in `moov`.
 *
 * @param atoms QT atoms to sort
 */
export function sortFaststartAtoms(atoms: QtAtom[], options: FaststartOptions) {
    const faststarted: QtAtom[] = []

    const ftyp = atoms.find(atom => atom.kind === 'ftyp')
    if (!ftyp) {
        throw new Error('Missing ftyp atom!')
    }
    if (ftyp.size > MAX_FTYP_ATOM_SIZE) {
        throw new Error(`ftyp atom is greater than ${MAX_FTYP_ATOM_SIZE}`)
    }

    const moov = atoms.find(atom => atom.kind === 'moov')!
    updateChunkOffsets(moov, options)

    faststarted.push(ftyp, moov)
    const rest = atoms.filter(atom => !['ftyp', 'moov'].includes(atom.kind))
    faststarted.push(...rest)
    return faststarted
}

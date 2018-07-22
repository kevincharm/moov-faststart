/// <reference path="../src/types/bigint.d.ts" />
// tslint:disable no-unused-expression

import * as fs from 'fs'
import * as path from 'path'
import { expect } from 'chai'
import faststart, { sortFaststartAtoms } from '../src/qt-faststart'
import { QtAtom, parseAtoms, traverseAtoms } from '../src/atom'

describe('qt-faststart', () => {
    const infile = fs.readFileSync(path.resolve(__dirname, 'h264/bbb_baseline.mp4'))

    it('should parse top-level atoms', () => {
        const atoms = parseAtoms(infile)
        expect(withoutData(atoms)).to.deep.equal([
            {
                kind: 'ftyp',
                size: BigInt(32)
            },
            {
                kind: 'free',
                size: BigInt(8)
            },
            {
                kind: 'mdat',
                size: BigInt(1051467)
            },
            {
                kind: 'mdat',
                size: BigInt(8)
            },
            {
                kind: 'moov',
                size: BigInt(4221)
            }
        ])
    })

    it('should parse moov subatom hierarchy until stco', () => {
        const atoms = parseAtoms(infile)
        const moov = atoms.find(atom => atom.kind === 'moov')
        expect(moov).to.exist
        expect(moov!.data).is.an('array')

        const moovSubatoms: QtAtom[] = moov!.data as any[]
        const traks = moovSubatoms.filter(atom => atom.kind === 'trak')
        expect(withoutData(traks)).to.deep.equal([
            {
                kind: 'trak',
                size: BigInt(1605)
            },
            {
                kind: 'trak',
                size: BigInt(2404)
            }
        ])

        const mdias = []
        for (const trak of traks) {
            const data: QtAtom[] = trak.data as any[]
            expect(data).is.an('array')
            mdias.push(...data.filter(atom => atom.kind === 'mdia'))
        }
        expect(withoutData(mdias)).to.deep.equal([
            {
                kind: 'mdia',
                size: BigInt(1469)
            },
            {
                kind: 'mdia',
                size: BigInt(2268)
            }
        ])

        const minfs = []
        for (const mdia of mdias) {
            const data: QtAtom[] = mdia.data as any[]
            expect(data).is.an('array')
            minfs.push(...data.filter(atom => atom.kind === 'minf'))
        }
        expect(withoutData(minfs)).to.deep.equal([
            {
                kind: 'minf',
                size: BigInt(1384)
            },
            {
                kind: 'minf',
                size: BigInt(2183)
            }
        ])

        const stbls = []
        for (const minf of minfs) {
            const data: QtAtom[] = minf.data as any[]
            expect(data).is.an('array')
            stbls.push(...data.filter(atom => atom.kind === 'stbl'))
        }
        expect(withoutData(stbls)).to.deep.equal([
            {
                kind: 'stbl',
                size: BigInt(1320)
            },
            {
                kind: 'stbl',
                size: BigInt(2123)
            }
        ])

        const stcos = []
        for (const stbl of stbls) {
            const data: QtAtom[] = stbl.data as any[]
            expect(data).is.an('array')
            stcos.push(...data.filter(atom => atom.kind === 'stco'))
        }
        expect(withoutData(stcos)).to.deep.equal([
            {
                kind: 'stco',
                size: BigInt(544)
            },
            {
                kind: 'stco',
                size: BigInt(548)
            }
        ])
    })

    it('should re-order moov atom to the top (sortFaststartAtoms)', () => {
        const atoms = parseAtoms(infile)
        const faststarted = sortFaststartAtoms(atoms, { forceUpgradeToCo64: false })
        expect(withoutData(faststarted)).to.deep.equal([
            {
                kind: 'ftyp',
                size: BigInt(32)
            },
            {
                kind: 'moov',
                size: BigInt(4221)
            },
            {
                kind: 'free',
                size: BigInt(8)
            },
            {
                kind: 'mdat',
                size: BigInt(1051467)
            },
            {
                kind: 'mdat',
                size: BigInt(8)
            }
        ])
    })

    it('should update chunk offsets (stco)', () => {
        // Get offset values before processing to compare against
        const vanillaAtoms = parseAtoms(infile)
        const vanillaOffsets: number[] = []
        traverseAtoms(vanillaAtoms, atom => {
            if (atom.kind !== 'stco') {
                return
            }

            const data = atom.data as Buffer
            const entries = data.readUInt32BE(4)
            for (let i = 0; i < entries; i++) {
                const cur = 8 + i * 4
                vanillaOffsets.push(data.readUInt32BE(cur))
            }
        })

        // Process and compare
        const faststarted = faststart(infile, { forceUpgradeToCo64: false })
        const atoms = parseAtoms(faststarted)
        const moov = atoms.find(atom => atom.kind === 'moov')!
        const updatedOffsets: number[] = []
        traverseAtoms(atoms, atom => {
            if (atom.kind !== 'stco') {
                return
            }
            const data = atom.data as Buffer
            const entries = data.readUInt32BE(4)
            for (let i = 0; i < entries; i++) {
                const cur = 8 + i * 4
                updatedOffsets.push(data.readUInt32BE(cur))
            }
        })

        expect(vanillaOffsets.length).to.equal(updatedOffsets.length)
        for (let i = 0; i < updatedOffsets.length; i++) {
            expect(updatedOffsets[i] - vanillaOffsets[i]).to.equal(Number(moov.size))
        }
    })

    it('should update chunk offsets with forced upgrade (stco->co64)', () => {
        // Get offset values before processing to compare against
        const vanillaAtoms = parseAtoms(infile)
        const vanillaOffsets: number[] = []
        traverseAtoms(vanillaAtoms, atom => {
            if (atom.kind !== 'stco') {
                return
            }

            const data = atom.data as Buffer
            const entries = data.readUInt32BE(4)
            for (let i = 0; i < entries; i++) {
                const cur = 8 + i * 4
                vanillaOffsets.push(data.readUInt32BE(cur))
            }
        })

        // Process and compare
        const faststarted = faststart(infile, { forceUpgradeToCo64: true })
        const atoms = parseAtoms(faststarted)
        const moov = atoms.find(atom => atom.kind === 'moov')!
        const updatedOffsets: number[] = []
        traverseAtoms(atoms, atom => {
            if (atom.kind !== 'co64') {
                return
            }
            const data = atom.data as Buffer
            const entries = data.readUInt32BE(4)
            for (let i = 0; i < entries; i++) {
                const cur = 8 + i * 8
                updatedOffsets.push((data.readUInt32BE(cur) >> 32) | data.readUInt32BE(cur + 4))
            }
        })

        expect(vanillaOffsets.length).to.equal(updatedOffsets.length)
        for (let i = 0; i < updatedOffsets.length; i++) {
            expect(updatedOffsets[i] - vanillaOffsets[i]).to.equal(Number(moov.size))
        }
    })

    it('should produce valid qt/mp4 file (end-to-end)', () => {
        const faststarted = faststart(infile)
        const atoms = parseAtoms(faststarted)
        expect(withoutData(atoms)).to.deep.equal([
            {
                kind: 'ftyp',
                size: BigInt(32)
            },
            {
                kind: 'moov',
                size: BigInt(4221)
            },
            {
                kind: 'free',
                size: BigInt(8)
            },
            {
                kind: 'mdat',
                size: BigInt(1051467)
            },
            {
                kind: 'mdat',
                size: BigInt(8)
            }
        ])
    })

    it('should match snapshot', () => {
        const faststarted = faststart(infile)
        const snapshot = fs.readFileSync(path.resolve(__dirname, 'h264/bbb_faststarted.snapshot.mp4'))
        const cmp = Buffer.compare(faststarted, snapshot)
        expect(cmp).to.equal(0)
    })
})

function withoutData(atoms: QtAtom[]) {
    return atoms.map(({ kind, size }) => ({ kind, size }))
}

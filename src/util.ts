export interface Cursor {
    pos: BigInt
}

export function numToHex(val: number) {
    return val.toString(16)
}

export function asciiToU32Be(chars: string) {
    return Buffer.from(chars.split('').map(char => char.charCodeAt(0))).readUInt32BE(0)
}

export function u32BeToAscii(u32: number) {
    const buf = Buffer.alloc(4)
    buf.writeUInt32BE(u32, 0)
    return buf.toString('ascii')
}

export function readU32(cur: Cursor, buf: Buffer) {
    const u32 = buf.readUInt32BE(Number(cur.pos))
    cur.pos += BigInt(4)
    return u32
}

export function readU64(cur: Cursor, buf: Buffer): BigInt {
    const long = buf.slice(Number(cur.pos), Number(cur.pos + BigInt(8)))
    const u64 = (BigInt(long.readUInt32BE(0)) << BigInt(32)) | (BigInt(long.readUInt32BE(4)) & BigInt(0xffffffff))
    cur.pos += BigInt(8)
    return u64
}

// Escritor de imágenes SquashFS 4.0 en JavaScript puro (sin mksquashfs). Lo usa el exportador de AppImage:
// un AppImage es «runtime (ELF) + imagen squashfs». Datos comprimidos con zlib («gzip» de SquashFS), sin fragmentos ni xattrs.
//
//   const t = dir()                              // árbol virtual
//   addFile(t, 'bin/juego', { path: '/ruta', mode: 0o755 })    // o { data: Buffer }
//   addSymlink(t, '.DirIcon', 'juego.png')
//   await writeSquashfs(t, '/salida.AppImage', { prefix: runtimeBuffer, onProgress })
'use strict'
const fs = require('node:fs')
const zlib = require('node:zlib')
const { promisify } = require('node:util')
const deflate = promisify(zlib.deflate)

const BLOCK = 131072, BLOCK_LOG = 17, META = 8192
const T = { dir: 1, file: 2, symlink: 3 }
const NONE = 0xffffffffffffffffn

const dir = (mode = 0o755) => ({ type: 'dir', mode, children: new Map() })

function ensureDir(root, parts) {
  let n = root
  for (const p of parts) {
    let c = n.children.get(p)
    if (!c) { c = dir(); n.children.set(p, c) } else if (c.type !== 'dir') throw new Error('No es una carpeta: ' + p)
    n = c
  }
  return n
}
const split = (p) => String(p).split('/').filter(Boolean)

function addEntry(root, path, node) {
  const parts = split(path)
  const name = parts.pop()
  if (!name) throw new Error('Ruta vacía')
  ensureDir(root, parts).children.set(name, node)
  return node
}
/** opts: { path } (archivo en disco, se lee al escribir) o { data } (Buffer); mode = permisos. */
function addFile(root, path, { path: src, data, mode = 0o644, size }) {
  if (data !== undefined) size = data.length
  else if (size === undefined) size = fs.statSync(src).size
  return addEntry(root, path, { type: 'file', mode: mode & 0o7777, src, data, size })
}
const addSymlink = (root, path, target) => addEntry(root, path, { type: 'symlink', mode: 0o777, target: Buffer.from(target) })
const addDir = (root, path, mode = 0o755) => ensureDir(root, split(path)).mode = mode

const u16 = (b, v, o) => b.writeUInt16LE(v, o)
const u32 = (b, v, o) => b.writeUInt32LE(v >>> 0, o)
const u64 = (b, v, o) => b.writeBigUInt64LE(BigInt(v), o)

/** Trocea un flujo de metadatos en bloques de 8 KiB, sin comprimir (bit 15 = «sin comprimir»). */
function metaBlocks(buf) {
  const out = []
  for (let o = 0; o < buf.length; o += META) {
    const chunk = buf.subarray(o, Math.min(buf.length, o + META))
    const h = Buffer.alloc(2); h.writeUInt16LE(0x8000 | chunk.length, 0)
    out.push(h, chunk)
  }
  return Buffer.concat(out)
}
// posición en el flujo → (inicio del bloque en disco, desplazamiento dentro del bloque)
const mblock = (p) => Math.floor(p / META) * (META + 2)
const moff = (p) => p % META

class Stream {
  constructor() { this.parts = []; this.len = 0 }
  push(b) { this.parts.push(b); this.len += b.length }
  buf() { return Buffer.concat(this.parts) }
}

/**
 * Escribe la imagen. `prefix` = bytes que van antes (el runtime del AppImage); los desplazamientos son relativos a la imagen.
 * @returns {Promise<{ size: number, offset: number }>}
 */
async function writeSquashfs(root, outPath, { prefix = Buffer.alloc(0), onProgress, level = 6, mtime = Math.floor(Date.now() / 1000) } = {}) {
  // ---- 1) numerar nodos (preorden) y sumar el tamaño de los datos
  const nodes = []
  let total = 0
  const walk = (n, name, parent) => {
    n.ino = nodes.length + 1; n.name = name; n.parent = parent
    nodes.push(n)
    if (n.type === 'file') total += n.size
    if (n.type === 'dir') for (const k of [...n.children.keys()].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)))) walk(n.children.get(k), k, n)
  }
  walk(root, '', null)
  const nInodes = nodes.length

  const fh = await fs.promises.open(outPath, 'w')
  const base = prefix.length
  try {
    if (base) await fh.write(prefix, 0, base, 0)
    let pos = 96 // posición relativa a la imagen (tras el superbloque)
    const put = async (buf) => { await fh.write(buf, 0, buf.length, base + pos); pos += buf.length }
    let done = 0

    // ---- 2) datos de los archivos (bloques de 128 KiB comprimidos en paralelo por lotes)
    const BATCH = 24
    const flush = async (batch, node) => {
      const res = await Promise.all(batch.map(async (b) => {
        const c = await deflate(b, { level })
        return c.length < b.length ? { buf: c, word: c.length } : { buf: b, word: b.length | (1 << 24) }
      }))
      for (const r of res) { await put(r.buf); node.sizes.push(r.word) }
    }
    for (const n of nodes) {
      if (n.type !== 'file') continue
      n.start = pos; n.sizes = []
      let batch = []
      if (n.data) {
        for (let o = 0; o < n.data.length; o += BLOCK) {
          batch.push(n.data.subarray(o, Math.min(n.data.length, o + BLOCK)))
          if (batch.length >= BATCH) { await flush(batch, n); batch = [] }
        }
        done += n.size
      } else if (n.size > 0) {
        const f = await fs.promises.open(n.src, 'r')
        try {
          let off = 0
          while (off < n.size) {
            const len = Math.min(BLOCK, n.size - off)
            const b = Buffer.allocUnsafe(len)
            const { bytesRead } = await f.read(b, 0, len, off)
            if (bytesRead !== len) throw new Error('Lectura incompleta: ' + n.src)
            batch.push(b); off += len
            if (batch.length >= BATCH) { await flush(batch, n); batch = []; onProgress?.(done + off, total) }
          }
        } finally { await f.close() }
        done += n.size
      }
      if (batch.length) await flush(batch, n)
      onProgress?.(done, total)
    }

    // ---- 3) posición de cada inodo en la tabla de inodos
    let ip = 0
    for (const n of nodes) {
      n.ipos = ip
      ip += n.type === 'file' ? 32 + 4 * n.sizes.length : n.type === 'dir' ? 32 : 24 + n.target.length
    }
    for (const n of nodes) { n.iblock = mblock(n.ipos); n.ioff = moff(n.ipos) }

    // ---- 4) listados de directorios
    const dirs = new Stream()
    for (const n of nodes) {
      if (n.type !== 'dir') continue
      const kids = [...n.children.entries()].sort((a, b) => Buffer.compare(Buffer.from(a[0]), Buffer.from(b[0])))
      const parts = []
      let i = 0
      while (i < kids.length) {
        const first = kids[i][1]
        let j = i
        while (j < kids.length && j - i < 256 && kids[j][1].iblock === first.iblock && Math.abs(kids[j][1].ino - first.ino) < 32000) j++
        const h = Buffer.alloc(12); u32(h, j - i - 1, 0); u32(h, first.iblock, 4); u32(h, first.ino, 8)
        parts.push(h)
        for (let k = i; k < j; k++) {
          const [name, c] = kids[k]
          const nb = Buffer.from(name)
          const e = Buffer.alloc(8 + nb.length)
          u16(e, c.ioff, 0); e.writeInt16LE(c.ino - first.ino, 2); u16(e, T[c.type], 4); u16(e, nb.length - 1, 6); nb.copy(e, 8)
          parts.push(e)
        }
        i = j
      }
      const listing = Buffer.concat(parts)
      n.dblock = mblock(dirs.len); n.doff = moff(dirs.len); n.dsize = listing.length
      dirs.push(listing)
    }

    // ---- 5) tabla de inodos
    const inodes = new Stream()
    for (const n of nodes) {
      let b
      if (n.type === 'dir') {
        b = Buffer.alloc(32)
        u16(b, T.dir, 0)
        u32(b, n.dblock, 16); u32(b, n.children.size + 2, 20); u16(b, n.dsize + 3, 24); u16(b, n.doff, 26); u32(b, n.parent ? n.parent.ino : nInodes + 1, 28)
      } else if (n.type === 'file') {
        b = Buffer.alloc(32 + 4 * n.sizes.length)
        u16(b, T.file, 0)
        u32(b, n.start, 16); u32(b, 0xffffffff, 20); u32(b, 0, 24); u32(b, n.size, 28)
        n.sizes.forEach((s, k) => u32(b, s, 32 + 4 * k))
      } else {
        b = Buffer.alloc(24 + n.target.length)
        u16(b, T.symlink, 0)
        u32(b, 1, 16); u32(b, n.target.length, 20); n.target.copy(b, 24)
      }
      u16(b, n.mode & 0o7777, 2); u16(b, 0, 4); u16(b, 0, 6); u32(b, mtime, 8); u32(b, n.ino, 12)
      inodes.push(b)
    }

    // ---- 6) tablas al final de la imagen
    const inodeStart = pos
    await put(metaBlocks(inodes.buf()))
    const dirStart = pos
    await put(metaBlocks(dirs.buf()))
    const fragStart = pos // sin fragmentos: tabla vacía
    const idBlockPos = pos
    const ids = Buffer.alloc(4) // un único id (0 = root)
    await put(metaBlocks(ids))
    const idStart = pos
    const ptr = Buffer.alloc(8); u64(ptr, idBlockPos, 0)
    await put(ptr)
    const used = pos
    const padded = Math.ceil(used / 4096) * 4096
    if (padded > used) await put(Buffer.alloc(padded - used))

    // ---- 7) superbloque
    const sb = Buffer.alloc(96)
    u32(sb, 0x73717368, 0); u32(sb, nInodes, 4); u32(sb, mtime, 8); u32(sb, BLOCK, 12); u32(sb, 0, 16)
    u16(sb, 1, 20); u16(sb, BLOCK_LOG, 22); u16(sb, 0x10 | 0x200, 24); u16(sb, 1, 26); u16(sb, 4, 28); u16(sb, 0, 30)
    const rootRef = (BigInt(root.iblock) << 16n) | BigInt(root.ioff)
    sb.writeBigUInt64LE(rootRef, 32)
    u64(sb, used, 40); u64(sb, idStart, 48); sb.writeBigUInt64LE(NONE, 56)
    u64(sb, inodeStart, 64); u64(sb, dirStart, 72); u64(sb, fragStart, 80); sb.writeBigUInt64LE(NONE, 88)
    await fh.write(sb, 0, 96, base)
    return { size: base + padded, offset: base }
  } finally {
    await fh.close()
  }
}

module.exports = { dir, addFile, addSymlink, addDir, writeSquashfs }

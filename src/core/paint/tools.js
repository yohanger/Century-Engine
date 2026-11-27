// Herramientas de pixel art (como las de dibujo de LibreSprite): lápiz con «pixel perfect», borrador, cubo de relleno (con
// tolerancia y contiguo / global), cuentagotas, línea, rectángulo, elipse (contorno o rellenos), spray y simetría horizontal y
// vertical. Trabajan sobre una imagen { width, height, data: Uint8ClampedArray RGBA } (ImageData en el navegador). Sin DOM.

export const TOOLS = [
  ['pencil', 'Lápiz', 'B'], ['eraser', 'Borrador', 'E'], ['bucket', 'Cubo de relleno', 'G'], ['picker', 'Cuentagotas', 'I'],
  ['line', 'Línea', 'L'], ['rect', 'Rectángulo', 'U'], ['ellipse', 'Elipse', 'O'], ['spray', 'Spray', 'S'],
]
/** Paleta DB32 (DawnBringer), la de LibreSprite / Aseprite por defecto. */
export const PALETTE_DB32 = [
  '#000000', '#222034', '#45283c', '#663931', '#8f563b', '#df7126', '#d9a066', '#eec39a', '#fbf236', '#99e550', '#6abe30', '#37946e',
  '#4b692f', '#524b24', '#323c39', '#3f3f74', '#306082', '#5b6ee1', '#639bff', '#5fcde4', '#cbdbfc', '#ffffff', '#9badb7', '#847e87',
  '#696a6a', '#595652', '#76428a', '#ac3232', '#d95763', '#d77bba', '#8f974a', '#8a6f30',
]

export const TRANSPARENT = [0, 0, 0, 0]
/** '#rgb', '#rrggbb' o '#rrggbbaa' → [r, g, b, a]. */
export function rgba(hex) {
  let h = String(hex || '').trim().replace(/^#/, '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (h.length === 6) h += 'ff'
  if (!/^[0-9a-f]{8}$/i.test(h)) return [0, 0, 0, 255]
  return [0, 2, 4, 6].map((i) => parseInt(h.slice(i, i + 2), 16))
}
export const hexOf = (c) => '#' + c.slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('') + (c[3] === 255 ? '' : c[3].toString(16).padStart(2, '0'))

export const inside = (img, x, y) => x >= 0 && y >= 0 && x < img.width && y < img.height
export function getPx(img, x, y) { const i = (y * img.width + x) * 4, d = img.data; return [d[i], d[i + 1], d[i + 2], d[i + 3]] }
export function setPx(img, x, y, c) {
  if (!inside(img, x, y)) return
  const i = (y * img.width + x) * 4, d = img.data
  d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = c[3]
}
export const copyImage = (img) => ({ width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) })
export const restore = (img, snap) => img.data.set(snap.data)

/** Puntos de la simetría: { symX: espejo izquierda-derecha, symY: arriba-abajo }. */
export function mirrors(img, x, y, sym = {}) {
  const out = [[x, y]]
  const mx = img.width - 1 - x, my = img.height - 1 - y
  if (sym.symX) out.push([mx, y])
  if (sym.symY) out.push([x, my])
  if (sym.symX && sym.symY) out.push([mx, my])
  return out
}
/** Pincel cuadrado de `size` píxeles centrado en (x, y), con simetría. */
export function dab(img, x, y, size, c, sym) {
  const s = Math.max(1, Math.round(size)), o = Math.floor((s - 1) / 2)
  for (const [px, py] of mirrors(img, x, y, sym)) for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) setPx(img, px - o + i, py - o + j, c)
}

/** Píxeles de una línea (Bresenham). */
export function linePts(x0, y0, x1, y1) {
  const out = []
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  for (;;) {
    out.push([x0, y0])
    if (x0 === x1 && y0 === y1) break
    const e2 = 2 * err
    if (e2 >= dy) { err += dy; x0 += sx }
    if (e2 <= dx) { err += dx; y0 += sy }
  }
  return out
}
/** Trazo continuo a partir de los puntos del ratón (sin huecos). */
export function strokePts(pts) {
  const out = []
  for (let i = 0; i < pts.length; i++) {
    const seg = i ? linePts(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]).slice(1) : [pts[0]]
    for (const p of seg) if (!out.length || out.at(-1)[0] !== p[0] || out.at(-1)[1] !== p[1]) out.push(p)
  }
  return out
}
/** «Pixel perfect»: quita las esquinas en L de un trazo de 1 px (las líneas a mano quedan limpias). */
export function pixelPerfect(pts) {
  if (pts.length < 3) return pts.slice()
  const out = [pts[0]]
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out.at(-1), b = pts[i], c = pts[i + 1]
    const corner = ((a[0] === b[0] && b[1] === c[1]) || (a[1] === b[1] && b[0] === c[0])) && Math.abs(a[0] - c[0]) === 1 && Math.abs(a[1] - c[1]) === 1
    if (!corner) out.push(b)
  }
  out.push(pts.at(-1))
  return out
}
/** Dibuja un trazo de lápiz o borrador sobre la imagen. */
export function drawStroke(img, pts, { size = 1, color, perfect = true, sym } = {}) {
  let path = strokePts(pts)
  if (perfect && Math.round(size) <= 1) path = pixelPerfect(path)
  for (const [x, y] of path) dab(img, x, y, size, color, sym)
}

/** Rectángulo (contorno de grosor `size`, o relleno). */
export function drawRect(img, x0, y0, x1, y1, { color, fill = false, size = 1, sym } = {}) {
  const ax = Math.min(x0, x1), bx = Math.max(x0, x1), ay = Math.min(y0, y1), by = Math.max(y0, y1)
  const s = Math.max(1, Math.round(size))
  for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) {
    if (fill || x - ax < s || bx - x < s || y - ay < s || by - y < s) for (const [px, py] of mirrors(img, x, y, sym)) setPx(img, px, py, color)
  }
}
/** Elipse inscrita en el rectángulo (contorno o rellena). */
export function drawEllipse(img, x0, y0, x1, y1, { color, fill = false, sym } = {}) {
  const ax = Math.min(x0, x1), bx = Math.max(x0, x1), ay = Math.min(y0, y1), by = Math.max(y0, y1)
  const cx = (ax + bx) / 2, cy = (ay + by) / 2, rx = (bx - ax) / 2 + 0.5, ry = (by - ay) / 2 + 0.5
  const inE = (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1
  for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) {
    if (!inE(x, y)) continue
    // contorno: el píxel está dentro y alguno de sus vecinos (4) está fuera
    if (fill || !inE(x - 1, y) || !inE(x + 1, y) || !inE(x, y - 1) || !inE(x, y + 1)) for (const [px, py] of mirrors(img, x, y, sym)) setPx(img, px, py, color)
  }
}
/** Línea recta de grosor `size`. */
export function drawLine(img, x0, y0, x1, y1, { color, size = 1, sym } = {}) {
  for (const [x, y] of linePts(x0, y0, x1, y1)) dab(img, x, y, size, color, sym)
}

const close = (a, b, t) => Math.abs(a[0] - b[0]) <= t && Math.abs(a[1] - b[1]) <= t && Math.abs(a[2] - b[2]) <= t && Math.abs(a[3] - b[3]) <= t
/** Cubo de relleno: contiguo (zona conectada) o global (todos los píxeles de ese color). `tolerance` 0–255. */
export function floodFill(img, x, y, color, { tolerance = 0, contiguous = true } = {}) {
  if (!inside(img, x, y)) return 0
  const target = getPx(img, x, y)
  if (close(target, color, 0)) return 0
  const t = Math.max(0, Math.min(255, tolerance | 0))
  let n = 0
  if (!contiguous) {
    for (let j = 0; j < img.height; j++) for (let i = 0; i < img.width; i++) if (close(getPx(img, i, j), target, t)) { setPx(img, i, j, color); n++ }
    return n
  }
  const seen = new Uint8Array(img.width * img.height)
  const stack = [[x, y]]
  while (stack.length) {
    const [i, j] = stack.pop()
    if (!inside(img, i, j)) continue
    const k = j * img.width + i
    if (seen[k]) continue
    seen[k] = 1
    if (!close(getPx(img, i, j), target, t)) continue
    setPx(img, i, j, color); n++
    stack.push([i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1])
  }
  return n
}
/** Spray: `count` píxeles al azar dentro de un círculo de radio `size * 2`. `rand` permite pruebas repetibles. */
export function spray(img, x, y, { color, size = 1, count = 0, sym, rand = Math.random } = {}) {
  const r = Math.max(2, Math.round(size) * 2), n = count || Math.max(3, r)
  for (let k = 0; k < n; k++) {
    const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * r
    const px = Math.round(x + Math.cos(a) * d), py = Math.round(y + Math.sin(a) * d)
    for (const [mx, my] of mirrors(img, px, py, sym)) setPx(img, mx, my, color)
  }
}

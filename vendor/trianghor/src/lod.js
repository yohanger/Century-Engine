// Detalle adaptativo (LOD) — lógica PURA, sin three ni DOM (se prueba en «prueba retirada»).
//
// Idea: dibujar cada cosa con tantos triángulos como píxeles tiene sentido darle. Regla única para todo: un triángulo debe cubrir unos
// `targetPx` píxeles de lado; si en pantalla caben menos, sobra geometría y se usa un nivel más grueso.
//   · Terreno: la misma malla de vértices con otro índice (cada 2, 4, 8 vértices). El borde de cada pieza SIEMPRE es de resolución
//     completa, así que dos piezas con niveles distintos encajan sin grietas.
//   · Mallas pesadas: simplificación por agrupación de vértices en una rejilla (rápida y robusta; ideal para niveles lejanos).

/** Índice de triángulos del terreno de `n`×`n` celdas, tomando un vértice de cada `stride`. El perímetro conserva todas las celdas. */
export function terrainIndex(n, stride = 1, nz = n) {
  const n1 = n + 1
  const out = []
  const tri = (a, b, c) => out.push(a, b, c)
  const v = (i, j) => j * n1 + i
  if (stride <= 1 || n % stride !== 0 || nz % stride !== 0 || n / stride < 2 || nz / stride < 2) {
    for (let j = 0; j < nz; j++) for (let i = 0; i < n; i++) { const a = v(i, j), b = a + 1, c = a + n1, d = c + 1; tri(a, c, b); tri(b, c, d) }
    return Uint32Array.from(out)
  }
  const s = stride, blocksX = n / s, blocksZ = nz / s
  for (let bj = 0; bj < blocksZ; bj++) for (let bi = 0; bi < blocksX; bi++) {
    const i0 = bi * s, j0 = bj * s, i1 = i0 + s, j1 = j0 + s
    // un lado del bloque es «fino» solo si cae en el borde de la pieza (ahí hay que encajar con la pieza vecina)
    const fineN = bj === 0, fineS = bj === blocksZ - 1, fineW = bi === 0, fineE = bi === blocksX - 1
    if (!fineN && !fineS && !fineW && !fineE) { // bloque interior: dos triángulos grandes
      const a = v(i0, j0), b = v(i1, j0), c = v(i0, j1), d = v(i1, j1)
      tri(a, c, b); tri(b, c, d)
      continue
    }
    // bloque de borde: abanico desde el vértice central hacia el perímetro (con todos los vértices en los lados finos)
    const ring = []
    for (let i = i0; i < i1; i++) { ring.push(v(i, j0)); if (!fineN) i += s - 1 }   // lado norte, de oeste a este
    for (let j = j0; j < j1; j++) { ring.push(v(i1, j)); if (!fineE) j += s - 1 }   // lado este
    for (let i = i1; i > i0; i--) { ring.push(v(i, j1)); if (!fineS) i -= s - 1 }   // lado sur, de este a oeste
    for (let j = j1; j > j0; j--) { ring.push(v(i0, j)); if (!fineW) j -= s - 1 }   // lado oeste
    const c = v(i0 + s / 2, j0 + s / 2)
    for (let k = 0; k < ring.length; k++) tri(c, ring[(k + 1) % ring.length], ring[k])
  }
  return Uint32Array.from(out)
}

/** Strides válidos para una pieza de `n` celdas: potencias de 2 que dividen n y dejan al menos 2 bloques por lado. */
export function terrainStrides(n, max = 8, nz = n) {
  const out = [1]
  for (let s = 2; s <= max; s *= 2) if (n % s === 0 && nz % s === 0 && n / s >= 2 && nz / s >= 2) out.push(s)
  return out
}


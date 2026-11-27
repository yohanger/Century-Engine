// Los huecos entre nubes dominan el campo. Comprimimos las secuencias de ceros
// para poder guardar el volumen junto con la partida.
export function encodeCloudWater(volume) {
  const { data, _vapor: vapor } = volume, bytes = []
  let zeros = 0
  for (let i = 0; i < vapor.length; i++) {
    const values = [data[i * 2], data[i * 2 + 1], Math.round(vapor[i] * 255)]
    for (const value of values) {
      if (value === 0) {
        if (++zeros === 255) { bytes.push(0, zeros); zeros = 0 }
      } else {
        if (zeros) { bytes.push(0, zeros); zeros = 0 }
        bytes.push(value)
      }
    }
  }
  if (zeros) bytes.push(0, zeros)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.slice(i, i + 8192))
  return btoa(binary)
}

export function decodeCloudWater(encoded, size) {
  if (typeof encoded !== 'string' || encoded.length > size * 8) throw new Error('Nubes: snapshot de condensado incompatible')
  const binary = atob(encoded), out = new Uint8Array(size)
  let cursor = 0
  for (let i = 0; i < binary.length; i++) {
    const value = binary.charCodeAt(i)
    if (value) out[cursor++] = value
    else {
      const zeros = binary.charCodeAt(++i)
      if (!(zeros > 0)) throw new Error('Nubes: snapshot de condensado inválido')
      cursor += zeros
    }
    if (cursor > size) break
  }
  if (cursor !== size) throw new Error('Nubes: tamaño de condensado inválido')
  return out
}

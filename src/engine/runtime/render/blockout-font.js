// Atlas común, ligero y sin ficheros externos para etiquetas métricas del Blockout.
import * as THREE from 'three'
let atlas = null
export function blockoutFont() {
  if (atlas) return atlas
  if (typeof document === 'undefined') return null
  const chars = '0123456789METROS: X.-'
  const canvas = document.createElement('canvas')
  canvas.width = chars.length * 24; canvas.height = 32
  const c = canvas.getContext('2d')
  if (!c) return null
  c.clearRect(0, 0, canvas.width, canvas.height)
  c.fillStyle = '#ffffff'
  c.font = 'bold 23px monospace'
  c.textAlign = 'center'; c.textBaseline = 'middle'
  for (let i = 0; i < chars.length; i++) c.fillText(chars[i], i * 24 + 12, 16)
  atlas = new THREE.CanvasTexture(canvas)
  atlas.colorSpace = THREE.NoColorSpace
  atlas.magFilter = THREE.LinearFilter
  atlas.minFilter = THREE.LinearFilter
  atlas.generateMipmaps = false
  return atlas
}

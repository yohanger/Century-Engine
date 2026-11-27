// Formato de valores del texto de escenas de Godot 4 (.tscn). Sin dependencias del DOM.
import * as THREE from 'three'
import { DEG } from '../../engine/runtime/util.js'

export const num = (v) => {
  const s = Number(Number(v).toFixed(5)).toString()
  return s === '-0' ? '0' : s
}
export const flt = (v) => {
  const s = num(v)
  return /[.e]/.test(s) ? s : s + '.0'
}
export const vec3 = (a) => `Vector3(${a.map(num).join(', ')})`
export const q = (s) => JSON.stringify(String(s))

/** Color en sRGB tal cual, como lo guarda el editor de Godot. */
export const col = (hex, a = 1) => {
  const c = new THREE.Color().setStyle(hex, THREE.NoColorSpace)
  return `Color(${num(c.r)}, ${num(c.g)}, ${num(c.b)}, ${num(a)})`
}

export function matrixToTransform3D(m) {
  const el = m.elements // column-major; Godot serializa la base por filas
  const rows = []
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) rows.push(el[c * 4 + r])
  const ident = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]
  const all = [...rows, el[12], el[13], el[14]]
  if (all.every((v, i) => Math.abs(v - ident[i]) < 1e-6)) return null
  return `Transform3D(${all.map(num).join(', ')})`
}

/** Posición + rotación (Euler YXZ, igual que Godot). La escala nunca se hereda: los tamaños van en los recursos. */
export function transformStr(obj) {
  const e = new THREE.Euler(obj.rotation[0] * DEG, obj.rotation[1] * DEG, obj.rotation[2] * DEG, 'YXZ')
  const quat = new THREE.Quaternion().setFromEuler(e)
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...obj.position), quat, new THREE.Vector3(1, 1, 1))
  return matrixToTransform3D(m)
}

export const scaleStr = (s) => matrixToTransform3D(new THREE.Matrix4().makeScale(...s))

export const localT = (x, y, z) =>
  x === 0 && y === 0 && z === 0 ? null : `Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, ${num(x)}, ${num(y)}, ${num(z)})`

/** Nombre válido y único entre hermanos (Godot prohíbe . : @ / " %). */
export function safeName(name, used, fallback = 'Nodo') {
  const base = String(name || fallback).replace(/[.:@/"%\\]/g, '_').trim() || fallback
  let n = base, i = 2
  while (used.has(n)) n = `${base}_${i++}`
  used.add(n)
  return n
}

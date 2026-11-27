// Toma horneada → timeline de Century (sin three): pista de cámara con la cámara virtual del móvil, pista de comandos que
// reproduce la animación capturada sobre el personaje y las capas de efectos (subtítulos, fundidos, barras de cine).
import { newTimeline, newTrack, newKey } from '../timeline/model.js'
import { uid } from '../../engine/runtime/util.js'

const cmd = (code, p) => ({ id: uid('c'), code, p, b: {} })
const r3 = (v) => Math.round(v * 1000) / 1000

/**
 * Espacio «escenario» de las claves de cámara de la captura: el actor en el origen mirando hacia +Z (hacia el móvil);
 * la cámara por defecto está en [0, 1.5, 3.5] mirando a −Z. `anchor` coloca ese escenario en el mundo (normalmente el nodo del personaje).
 */
export function stageToWorld(k, anchor = { pos: [0, 0, 0], yaw: 0 }) {
  const y = ((anchor.yaw || 0) * Math.PI) / 180, c = Math.cos(y), s = Math.sin(y)
  const [x, py, z] = k.pos, a = anchor.pos || [0, 0, 0]
  return { pos: [r3(a[0] + c * x + s * z), r3(a[1] + py), r3(a[2] - s * x + c * z)], rot: [k.rot[0], r3(k.rot[1] + (anchor.yaw || 0)), k.rot[2]], fov: k.fov }
}

/**
 * @param take  una toma de bake()
 * @param o { name, node (id del nodo con el modelo), clip (nombre del clip capturado), anchor, camera (bool), endWithPlayer (bool) }
 */
export function cinematicFromTake(take, o = {}) {
  const tl = newTimeline(o.name || take.name, { duration: Math.max(0.1, r3(take.duration)) })
  const tracks = []
  if (o.camera !== false && take.camera?.length) {
    const cam = newTrack('camera', { name: 'Cámara (móvil)' })
    cam.keys = take.camera.map((k) => newKey('camera', r3(k.t), { mode: 'free', ...stageToWorld(k, o.anchor), ease: 'linear' }))
    if (o.endWithPlayer) cam.keys.push(newKey('camera', r3(take.duration + 0.6), { mode: 'player' }))
    tracks.push(cam)
  }
  const cmds = newTrack('commands', { name: 'Captura y efectos' })
  if (o.clip) cmds.keys.push(newKey('commands', 0, { name: 'Animación capturada', essential: true, list: [cmd('playAnimation', { node: o.node || '', clip: o.clip, loop: 'no', speed: 1, fade: 0.15, from: 0, layer: '', mask: '', weight: 1, wait: false })] }))
  for (const l of take.layers || []) {
    const len = Math.max(0.05, r3(l.t1 - l.t0))
    if (l.kind === 'text') cmds.keys.push(newKey('commands', r3(l.t0), { name: 'Subtítulo', list: [cmd('caption', { text: String(l.params.text ?? ''), seconds: len, pos: l.params.pos || 'bottom', wait: false })] }))
    else if (l.kind === 'fade') cmds.keys.push(newKey('commands', r3(l.t0), { name: 'Fundido', essential: l.params.dir === 'in', list: [cmd('fade', { dir: l.params.dir === 'in' ? 'in' : 'out', seconds: len, color: l.params.color || '#000000' })] }))
    else if (l.kind === 'letterbox') {
      const pc = Math.min(25, Math.max(0, +l.params.percent || 12))
      if (l.t0 <= 0.05 && l.t1 >= take.duration - 0.05) { tl.letterbox = pc; continue }
      cmds.keys.push(newKey('commands', r3(l.t0), { name: 'Barras de cine', list: [cmd('letterbox', { percent: pc })] }))
      cmds.keys.push(newKey('commands', r3(l.t1), { name: 'Quitar barras', list: [cmd('letterbox', { percent: 0 })] }))
    }
  }
  cmds.keys.sort((a, b) => a.t - b.t)
  if (cmds.keys.length) tracks.push(cmds)
  tl.tracks = tracks
  return tl
}

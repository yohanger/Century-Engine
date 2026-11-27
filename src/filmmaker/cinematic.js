// Pase de cámara de Nether Film Maker → cinemática de Century (sin three): pista de cámara con las claves grabadas (ya en
// coordenadas del mundo) y, si el pase acompaña a una toma, «Reproducir animación» del clip del actor al empezar.
import { newTimeline, newTrack, newKey } from '../core/timeline/model.js'
import { uid } from '../engine/runtime/util.js'
import { cameraForPass } from './montage.js'

export function cinematicFromPass(pass, { name, node = '', clip = '', duration, film = null, objects = [], animations = [] } = {}) {
  const tl = newTimeline(name || pass.name, { duration: Math.max(0.1, +(duration ?? pass.duration).toFixed(3)) })
  const cam = newTrack('camera', { name: `Cámara · ${pass.name}`, path: 'linear' })
  cam.keys = pass.keys.map((key) => { const k = cameraForPass(film, pass, key.t, { objects, animations }) || key
    return newKey('camera', key.t, { mode: 'free', pos: [...k.pos], rot: [...k.rot], fov: k.fov, ease: 'linear' }) })
  tl.tracks.push(cam)
  if (clip && node) {
    const cmds = newTrack('commands', { name: 'Actor' })
    cmds.keys = [newKey('commands', 0, { name: 'Animación capturada', essential: true, list: [{ id: uid('c'), code: 'playAnimation', p: { node, clip, loop: 'no', speed: 1, fade: 0.15, from: 0, layer: '', mask: '', weight: 1, wait: false }, b: {} }] })]
    tl.tracks.push(cmds)
  }
  return tl
}

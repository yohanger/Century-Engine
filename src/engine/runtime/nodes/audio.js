import * as THREE from 'three'
import { registerNode } from './registry.js'
import { makeRoot, applyBase, iconMat, lineMat, arrowToward } from './three-helpers.js'
import { normalizeSource, SOURCE_DEFAULTS } from '../audio/config.js'

const ring = (axis) => {
  const pts = []
  for (let i = 0; i <= 48; i++) { const a = (i / 48) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); pts.push(axis === 0 ? new THREE.Vector3(0, c, s) : axis === 1 ? new THREE.Vector3(c, 0, s) : new THREE.Vector3(c, s, 0)) }
  return new THREE.BufferGeometry().setFromPoints(pts)
}
const rings = (color, opacity) => {
  const g = new THREE.Group(), m = lineMat(color)
  m.transparent = true; m.opacity = opacity
  for (let a = 0; a < 3; a++) g.add(new THREE.Line(ring(a), m))
  g.userData.mat = m
  g.userData.helper = true // los radios son guías, no superficies de selección
  return g
}

const SOURCE_FIELDS = [
  ['clip','Clip','string',''], ['group','Salida','string','sfx'],
  ['mode','Tipo','enum','3d',{options:['3d','ui']}],
  ['mute','Silenciar','bool',false],['playOnStart','Al empezar','bool',true],
  ['loop','Bucle','bool',false],['volume','Volumen','number',1,{min:0,max:2}],
  ['pitch','Tono','number',1,{min:0.1,max:4}],['delay','Retardo','number',0,{min:0,max:60}],
  ['minDistance','Distancia mínima','number',1,{min:0.1,max:1000}],
  ['maxDistance','Distancia máxima','number',30,{min:0.2,max:5000}],
  ['rolloff','Atenuación','enum','logarithmic',{options:['logarithmic','linear']}],
  ['coneInner','Cono interior','number',360,{min:0,max:360}],
  ['coneOuter','Cono exterior','number',360,{min:0,max:360}],
  ['coneOuterGain','Volumen fuera','number',0,{min:0,max:1}],
  ['hrtf','HRTF','bool',false],['occlusion','Oclusión','bool',false],
]
const sourceAnimation = Object.fromEntries(SOURCE_FIELDS.map(([key,label,kind,def,bounds={}]) => [`audio.${key}`,{
  label,kind,def,...bounds,
  read: obj => normalizeSource(obj.props)[key],
  runtimeRead: (root,obj) => root.userData.timelineAudio?.[key] ?? normalizeSource(obj.props)[key],
  apply: (root,value) => { (root.userData.timelineAudio ??= {})[key] = value },
  capture: root => ({had:Object.hasOwn(root.userData.timelineAudio || {},key),value:root.userData.timelineAudio?.[key]}),
  restore: (root,snapshot) => {
    if (snapshot?.had) (root.userData.timelineAudio ??= {})[key] = snapshot.value
    else if (root.userData.timelineAudio) {
      delete root.userData.timelineAudio[key]
      if (!Object.keys(root.userData.timelineAudio).length) delete root.userData.timelineAudio
    }
  },
}]))

export default registerNode({
  type: 'audio',
  label: 'Fuente de audio',
  icon: 'audio',
  category: 'Audio',
  scalable: false,
  animation: sourceAnimation,
  // Señal con emisor real: final natural del clip, nunca interrupciones.
  nativeSignals: [{ name: 'finished', source: 'audio-voice', phase: 'natural-end',
    condition: 'voz de nodo terminada naturalmente (sin stop, pausa ni loop activo)', args: [] }],
  kinds: { audio3d: { label: 'Fuente de audio 3D', icon: 'audio' }, audioui: { label: 'Fuente de audio UI', icon: 'audio-ui' } },
  create: (kind) => ({
    name: kind === 'audioui' ? 'Audio UI' : 'Audio', collision: false, color: '#58b4e8', position: [0, 1.2, 0],
    props: { ...SOURCE_DEFAULTS, mode: kind === 'audioui' ? 'ui' : '3d', group: kind === 'audioui' ? 'ui' : 'ambient' }, // las fuentes UI nuevas van al grupo «UI» (las antiguas conservan el suyo)
  }),

  build(obj) {
    const { root, visual } = makeRoot(obj)
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.45, 20), iconMat(obj.color))
    body.rotation.x = -Math.PI / 2; body.position.z = -0.1
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), iconMat(obj.color))
    box.position.z = 0.18
    const aim = arrowToward(0.9, '#8fd0f5')
    visual.add(body, box, aim)
    root.userData.iconMat = body.material; root.userData.iconMat2 = box.material
    const near = rings('#8fd0f5', 0.55), far = rings('#58b4e8', 0.22)
    visual.add(near, far) // icono y anillos son ayudas del editor, no geometría del juego
    root.userData.near = near; root.userData.far = far
    root.userData.editorGizmos = [aim, near, far]
    root.userData.editorOnlyVisual = visual
    // Que el icono pueda localizarse incluso delante de una pared mientras se edita.
    visual.traverse((part) => {
      if (!part.isMesh && !part.isLine) return
      part.material.depthTest = false; part.material.depthWrite = false
      part.renderOrder = 1000
    })
    return root
  },
  update(root, obj) {
    applyBase(root, obj, false)
    const u = root.userData, p = normalizeSource({ ...obj.props, ...root.userData.timelineAudio })
    u.iconMat.color.set(obj.color); u.iconMat2.color.set(obj.color)
    const is3d = p.mode === '3d'
    u.near.visible = u.far.visible = is3d
    u.near.userData.editorGizmoEnabled = u.far.userData.editorGizmoEnabled = is3d
    u.near.scale.setScalar(p.minDistance); u.far.scale.setScalar(p.maxDistance)
  },
})

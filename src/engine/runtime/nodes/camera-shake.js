import { registerNode } from './registry.js'
import { makeRoot, applyBase, hitSphere, arrowToward } from './three-helpers.js'

// La receta Camera Shake es propiedad de su nodo. Timeline guarda únicamente
// overrides transitorios en la raíz visual; nunca reescribe props del proyecto.
const SHAKE_ANIMATION_FIELDS = [
  ['camera', 'Cámara objetivo', 'string', 'player'],
  ['enabled', 'Activado', 'bool', true],
  ['autoPlay', 'Reproducir al iniciar', 'bool', true],
  ['loop', 'Bucle', 'bool', true],
  ['pattern', 'Patrón', 'enum', 'sine', { options: ['sine', 'noise', 'clip'] }],
  ['clip', 'Animación', 'string', ''],
  ['position', 'Desplazamiento XYZ (m)', 'vec3', [0, 0.012, 0]],
  ['rotation', 'Rotación XYZ (°)', 'vec3', [0, 0, 0.12]],
  ['frequency', 'Frecuencia (Hz)', 'number', 0.65, { min: 0.05, max: 10 }],
  ['positionFrequency', 'Frecuencia XYZ · desplazamiento', 'vec3', [1, 1, 1]],
  ['rotationFrequency', 'Frecuencia XYZ · rotación', 'vec3', [1, 1, 1]],
  ['positionPhase', 'Fase XYZ · desplazamiento', 'vec3', [0, 0, 0]],
  ['rotationPhase', 'Fase XYZ · rotación', 'vec3', [0, 0, 0]],
  ['duration', 'Duración del impulso (s)', 'number', 0, { min: 0, max: 30 }],
  ['blendIn', 'Blend In (s)', 'number', 0.4, { min: 0, max: 10 }],
  ['blendOut', 'Blend Out (s)', 'number', 0.25, { min: 0, max: 10 }],
]
const shakeAnimation = Object.fromEntries(SHAKE_ANIMATION_FIELDS.map(([key, label, kind, def, constraints = {}]) => {
  const own = root => root.userData.timelineShake || null
  const authored = obj => obj.props?.[key] ?? (Array.isArray(def) ? [...def] : def)
  return [`shake.${key}`, {
    label, kind, def, ...constraints,
    read: authored,
    runtimeRead: (root, obj) => Object.hasOwn(own(root) || {}, key) ? own(root)[key] : authored(obj),
    apply: (root, value) => { (root.userData.timelineShake ??= {})[key] = Array.isArray(value) ? [...value] : value },
    capture: root => ({ had: Object.hasOwn(own(root) || {}, key), value: own(root)?.[key] }),
    restore: (root, snapshot) => {
      if (snapshot?.had) (root.userData.timelineShake ??= {})[key] = snapshot.value
      else if (own(root)) { delete root.userData.timelineShake[key]; if (!Object.keys(root.userData.timelineShake).length) delete root.userData.timelineShake }
    },
  }]
}))

// El nodo guarda la receta; la cámara real se mueve solo durante el render de Play.
export default registerNode({
  type: 'cameraShake',
  label: 'Camera Shake Base',
  icon: 'camera-shake',
  category: 'Gameplay',
  scalable: false,
  animation: shakeAnimation,
  create: () => ({
    name: 'Camera Shake Base', collision: false, color: '#69b4d2',
    props: {
      camera: 'player', enabled: true, autoPlay: true, loop: true,
      pattern: 'sine', clip: '',
      position: [0, 0.012, 0], rotation: [0, 0, 0.12],
      frequency: 0.65, duration: 0, blendIn: 0.4, blendOut: 0.25,
      positionFrequency: [1, 1, 1], rotationFrequency: [1, 1, 1],
      positionPhase: [0, 0, 0], rotationPhase: [0, 0, 0],
    },
  }),
  build(obj) {
    const { root, visual } = makeRoot(obj)
    visual.add(arrowToward(0.8, obj.color))
    root.add(hitSphere(0.4))
    root.userData.editorGizmos = [visual]
    return root
  },
  update(root, obj) { applyBase(root, obj, false) },
})

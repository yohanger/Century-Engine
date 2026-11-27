// Plantillas de proyecto. Una plantilla decide con qué nace un proyecto (contenido inicial) y qué «juego» produce
// (jugador, controles, ventana). Solo se elige al crear el proyecto; después el proyecto lleva sus propios ajustes.
//
// Las plantillas describen el tipo de Player inicial. Para añadir uno: { id, name, description, game, scene }.
// Los IDs originales blank/empty se conservan: hay proyectos anteriores que los utilizan.
import { GAME_DEFAULTS } from '../../engine/runtime/templates/gameParams.js'
import { createFirstPersonResources } from './fps-player.js'

// `scene`: objetos iniciales ([tipo, variante, campos]); [] = escena realmente vacía.
const SUN = ['light', 'directional', {}]

export const TEMPLATES = [
  {
    id: 'empty-project',
    name: 'Empty',
    category: 'Juegos',
    icon: 'square',
    description: 'Proyecto desde cero. Escena sin objetos, sin cámara, sin Spawn y sin jugador en Database. Tú decides cómo empezar.',
    game: { ...GAME_DEFAULTS, player: 'none' },
    scene: [],
    emptyDatabase: true,
    emptyBindings: true,
  },
  {
    id: 'blank',
    name: 'Vacío clásico (compatibilidad)',
    category: 'Legado',
    icon: 'camera',
    description: 'Como una escena nueva de Unity: un sol y una Cámara principal, sin jugador ni Spawn. No trae personaje, ni manos, ni mirada con el ratón: lo construyes tú con nodos, eventos y scripts. Para juegos que no son de primera persona.',
    game: { ...GAME_DEFAULTS, player: 'none' },
    scene: [SUN, ['camera', 'camera', { name: 'Cámara principal', position: [0, 1.7, 6], props: { fov: 70, main: true } }]],
  },
  {
    id: 'empty',
    name: 'First Person',
    category: 'Juegos',
    icon: 'crosshair',
    description: 'Escena inicial con sol y Prefab Personaje FPS en Assets. Arrástralo a la escena y designa CharacterBody3D; no se crea ningún jugador implícito.',
    game: { ...GAME_DEFAULTS },
    scene: [SUN],
    createResources: createFirstPersonResources,
  },
]

export const DEFAULT_TEMPLATE = 'empty-project'
// Proyectos viejos sin campo template seguían el flujo First Person.
export const LEGACY_TEMPLATE = 'empty'
export const getTemplate = (id) => TEMPLATES.find((t) => t.id === id) || TEMPLATES.find((t) => t.id === 'blank')

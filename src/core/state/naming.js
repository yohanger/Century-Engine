// Sufijos de archivo de escenas y prefabs


export const SUFFIX = { scene: '.scene.json', prefab: '.prefab' } // escenas y prefabs guardan el nombre sin extensión
export const stripSuffix = (kind, n) => (SUFFIX[kind] && n.endsWith(SUFFIX[kind]) ? n.slice(0, -SUFFIX[kind].length) : n)

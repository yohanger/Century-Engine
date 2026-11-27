// Lógica de la extensión SIN depender de «vscode» (así se prueba con Node: scripts/test-vscode-extension.mjs).
'use strict'

const FOLDER = '.levelforge'

/** Comentario guía de los scripts nuevos (mismo contenido que el botón «Nuevo script» de Century). */
const SCRIPT_TEMPLATE = `// Script del proyecto: se ejecuta UNA vez al pulsar «Jugar». Aquí registras funciones y escuchas.
//   game.define('nombre', async (a, b) => { ... })   → se llama desde el comando «Llamar función de script»
//   game.on('start' | 'scene' | 'update', fn)         → inicio del juego · escena cargada · cada fotograma (dt)
//   await game.say('Hola', 'Ana')   await game.choose(['Sí', 'No'])   await game.wait(1)
//   game.setSwitch('Puerta', true)  game.variable('Llaves')           → por nombre o por número
//   game.node('Puerta').visible = false     game.player.position     game.player.walk = 6
//   game.viewModel.attach(event)            → lleva este evento a la mano (slots: Base de datos ▸ Jugador) · game.viewModel.release(event)
game.define('ejemplo', async () => {
  await game.say('Hola desde un script')
})
`

const JSCONFIG = {
  compilerOptions: {
    checkJs: true, allowJs: true, noEmit: true, strict: false,
    target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler', moduleDetection: 'force', lib: ['ES2022'],
  },
  include: ['Assets/**/*.js', `${FOLDER}/*.d.ts`],
}

/** Nombre de archivo válido y con .js: «mi puerta» → «mi puerta.js»; prohíbe rutas y caracteres que los sistemas de archivos rechazan. */
function cleanScriptName(input) {
  let n = String(input ?? '').trim().replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').replace(/^\.+/, '').replace(/\s+/g, ' ')
  n = n.replace(/(\.js)+$/i, '')
  if (!n || /^-+$/.test(n)) return ''
  return n.slice(0, 80) + '.js'
}

/** Nombre libre en la carpeta: si «a.js» existe → «a 2.js», «a 3.js»… `exists(name)` dice si ya está. */
function uniqueName(name, exists) {
  if (!exists(name)) return name
  const base = name.replace(/\.js$/i, '')
  for (let i = 2; i < 1000; i++) if (!exists(`${base} ${i}.js`)) return `${base} ${i}.js`
  return `${base} ${Date.now()}.js`
}

/** Carpeta de scripts de la configuración: relativa, sin «..» ni barras de más. Siempre dentro de Assets/ (donde Century sincroniza). */
function scriptsFolder(setting) {
  const parts = String(setting || 'Assets/Scripts').replace(/\\/g, '/').split('/').filter((p) => p && p !== '.' && p !== '..')
  if (parts[0] !== 'Assets') parts.unshift('Assets')
  return parts.join('/')
}

/** ¿Es esta carpeta un proyecto de Century? (`has(ruta)` dice si existe). */
const isProject = (has) => has('project.lfproj') || has(`${FOLDER}/sync.json`) || has(`${FOLDER}/api.d.ts`)

/**
 * Qué archivos hay que escribir para que VS Code entienda los scripts. Century ya los escribe al guardar el proyecto; esto cubre
 * el caso de abrir la carpeta antes de guardar, o con una versión anterior. Nunca pisa un jsconfig.json del usuario ni el api.d.ts que ya dejó Century.
 * @returns {Map<string,string>} ruta → contenido
 */
function prepareFiles(has, bundledDts) {
  const out = new Map()
  if (!has('jsconfig.json')) out.set('jsconfig.json', JSON.stringify(JSCONFIG, null, 2) + '\n')
  if (!has(`${FOLDER}/api.d.ts`)) out.set(`${FOLDER}/api.d.ts`, bundledDts) // si ya existe lo escribió Century (más reciente que esta copia)
  return out
}

module.exports = { FOLDER, SCRIPT_TEMPLATE, JSCONFIG, cleanScriptName, uniqueName, scriptsFolder, isProject, prepareFiles }

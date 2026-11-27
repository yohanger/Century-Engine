const fs = require('node:fs')
const path = require('node:path')
const { parse } = require('smol-toml')

const template = fs.readFileSync(path.join(__dirname, 'editor.toml'), 'utf8')
const defaults = parse(template)
const colorTokens = {
  background: '--g-900', input_background: '--g-950', panel: '--g-850', surface: '--g-800',
  hover: '--g-700', elevated: '--g-600', border: '--hair', subtle_border: '--hair-soft',
  text: '--text', secondary_text: '--text-2', muted_text: '--text-3',
  accent: '--blue', accent_hover: '--blue-hi', accent_background: '--blue-wash',
  selection: '--editor-selection', frame: '--editor-frame', titlebar: '--editor-chrome',
}

const numeric = (min, max) => (value) => Number.isFinite(value) && value >= min && value <= max
const bool = (value) => typeof value === 'boolean'
const oneOf = (...values) => (value) => values.includes(value)
const hex = (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
const preferenceFields = [
  ['navigation', 'device', 'navigation', oneOf('mouse', 'trackpad')],
  ['navigation', 'orbit_selection', 'orbitSelection', bool],
  ['camera', 'fov', 'editorFov', numeric(40, 120)],
  ['mouse', 'sensitivity', 'mouseSensitivity', numeric(0.1, 3)],
  ['mouse', 'orbit', 'mouseOrbit', numeric(0.2, 3)],
  ['mouse', 'pan', 'mousePan', numeric(0.2, 3)],
  ['mouse', 'zoom', 'mouseZoom', numeric(0.2, 4)],
  ['mouse', 'invert_zoom', 'mouseInvertZoom', bool],
  ['trackpad', 'orbit', 'padOrbit', numeric(0.1, 3)],
  ['trackpad', 'pan', 'padPan', numeric(0.1, 3)],
  ['trackpad', 'zoom', 'padZoom', numeric(0.1, 4)],
  ['trackpad', 'invert', 'padInvert', bool],
  ['trackpad', 'invert_y', 'padInvertY', bool],
  ['trackpad', 'zoom_to_cursor', 'padZoomCursor', bool],
  ['flight', 'speed', 'flySpeed', numeric(2, 120)],
  ['flight', 'sprint', 'flySprint', numeric(1, 10)],
  ['flight', 'look', 'flyLook', numeric(0.2, 3)],
  ['gizmos', 'size', 'gizmoSize', numeric(0.5, 4)],
  ['gizmos', 'orientation', 'orientGizmo', bool],
  ['gizmos', 'visible', 'showGizmos', bool],
  ['selection', 'style', 'selectionStyle', oneOf('box', 'outline', 'none')],
  ['selection', 'color', 'selectionOutlineColor', hex],
  ['selection', 'width', 'selectionOutlineWidth', numeric(0.5, 4)],
  ['selection', 'strength', 'selectionOutlineStrength', numeric(0.5, 6)],
  ['behavior', 'tooltips', 'tooltips', bool],
  ['behavior', 'add_as_child', 'addAsChild', bool],
  ['behavior', 'terrain_crop_warning', 'terrainCropWarning', bool],
  ['behavior', 'disk_delay', 'diskDelay', numeric(1, 60)],
  ['behavior', 'inspector_label_width', 'inspLabelWidth', numeric(72, 240)],
]

const publicConfig = ({ path: file, scale, css, prefs, missingPrefs, issues }) => ({ path: file, scale, css, prefs, missingPrefs, issues })

function loadEditorConfig(file) {
  const issues = []
  let data = {}
  try {
    if (!fs.existsSync(file)) fs.writeFileSync(file, template, { flag: 'wx' })
    if (fs.statSync(file).size > 64 * 1024) throw new Error('El archivo supera 64 KiB')
    data = parse(fs.readFileSync(file, 'utf8'), { onUnsafeKey: 'throw' })
  } catch (error) { issues.push(error.message) }

  const get = (section, key, valid) => {
    const value = data[section]?.[key]
    if (value === undefined) return defaults[section][key]
    if (valid(value)) return value
    issues.push(`Valor inválido en ${section}.${key}`)
    return defaults[section][key]
  }
  const string = (max) => (value) => typeof value === 'string' && value.length <= max && !/[\u0000-\u001f\u007f]/u.test(value)
  const font = get('interface', 'font', (value) => string(100)(value) && !!value.trim()).trim()
  const generic = ['system-ui', 'sans-serif', 'serif', 'monospace'].includes(font)
  const scale = get('interface', 'scale', numeric(0.75, 1.5))
  const css = {
    '--font': `${generic ? font : JSON.stringify(font)}, Selawik, system-ui, sans-serif`,
    '--editor-font-size': `${get('interface', 'font_size', numeric(10, 20))}px`,
    '--r': `${get('interface', 'radius', numeric(0, 16))}px`,
    '--h': `${get('interface', 'control_height', numeric(20, 40))}px`,
    '--editor-color-scheme': get('interface', 'color_scheme', oneOf('dark', 'light')),
  }
  for (const [key, token] of Object.entries(colorTokens)) {
    css[token] = get('colors', key, (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value))
  }
  Object.assign(css, {
    '--menu-surface': css['--g-800'], '--menu-hover': css['--g-700'],
    '--menu-selected': css['--blue-wash'], '--menu-stroke': css['--g-600'],
  })
  const prefs = {}
  const missingPrefs = []
  for (const [section, key, pref, valid] of preferenceFields) {
    if (data[section]?.[key] === undefined) missingPrefs.push(pref)
    prefs[pref] = get(section, key, valid)
  }
  // Las claves [splash] de perfiles anteriores se ignoran sin reescribir el archivo.
  return { path: file, scale, css, prefs, missingPrefs, issues }
}

const tomlValue = (value) => typeof value === 'string' ? JSON.stringify(value) : String(value)
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Actualiza únicamente claves conocidas, conservando comentarios, secciones ajenas y el formato del usuario. */
function patchToml(source, updates) {
  let result = source.replace(/\r\n/g, '\n')
  for (const { section, key, value } of updates) {
    const sectionHeader = new RegExp(`^\\[${escapeRegExp(section)}\\]\\s*(?:#.*)?$`, 'm')
    const match = sectionHeader.exec(result)
    const line = `${key} = ${tomlValue(value)}`
    if (!match) {
      result = `${result.trimEnd()}\n\n[${section}]\n${line}\n`
      continue
    }
    const bodyStart = match.index + match[0].length
    const nextHeader = /^\s*\[[^\]]+\]\s*(?:#.*)?$/m.exec(result.slice(bodyStart))
    const bodyEnd = nextHeader ? bodyStart + nextHeader.index : result.length
    const body = result.slice(bodyStart, bodyEnd)
    const keyLine = new RegExp(`^(\\s*${escapeRegExp(key)}\\s*=\\s*)([^#\\r\\n]*?)(\\s*(?:#.*)?)$`, 'm')
    if (keyLine.test(body)) {
      const patched = body.replace(keyLine, (_all, prefix, _old, comment) => `${prefix}${tomlValue(value)}${comment}`)
      result = result.slice(0, bodyStart) + patched + result.slice(bodyEnd)
    } else {
      const insertion = `${body.endsWith('\n') || !body ? '' : '\n'}${line}\n`
      result = result.slice(0, bodyEnd) + insertion + result.slice(bodyEnd)
    }
  }
  return result
}

function saveEditorPreferences(file, values) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw new TypeError('Preferencias del editor inválidas')
  if (!fs.existsSync(file)) fs.writeFileSync(file, template, { flag: 'wx' })
  const source = fs.readFileSync(file, 'utf8')
  parse(source, { onUnsafeKey: 'throw' }) // un archivo roto nunca se sobreescribe silenciosamente
  const updates = []
  for (const [section, key, pref, valid] of preferenceFields) {
    if (!Object.hasOwn(values, pref)) continue
    if (!valid(values[pref])) throw new TypeError(`Valor inválido en ${section}.${key}`)
    updates.push({ section, key, value: values[pref] })
  }
  if (!updates.length) return loadEditorConfig(file)
  const next = patchToml(source, updates)
  if (Buffer.byteLength(next) > 64 * 1024) throw new Error('El archivo supera 64 KiB')
  const temporary = `${file}.tmp-${process.pid}`
  fs.writeFileSync(temporary, next)
  fs.renameSync(temporary, file)
  return loadEditorConfig(file)
}

module.exports = { loadEditorConfig, saveEditorPreferences, publicConfig }

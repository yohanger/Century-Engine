// Tema de la interfaz del juego: fuente, colores, ventanas, diálogo y velocidad de texto. Se aplica como variables CSS (--rt-*)
// a TODAS las pantallas (diálogo, opciones, indicación, pausa, inventario… y las tuyas, si las usas con var(--rt-…)).
// Sin DOM: lo usan el gestor de UI, el editor de temas y las pruebas.

export const FONT_STACKS = {
  system: ['Sistema (sans)', "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"],
  serif: ['Serif (novela)', "Georgia, 'Times New Roman', 'Noto Serif', serif"],
  mono: ['Monoespaciada (terminal)', "ui-monospace, 'SF Mono', Menlo, Consolas, 'DejaVu Sans Mono', monospace"],
  rounded: ['Redondeada', "'Trebuchet MS', 'Segoe UI Rounded', 'Varela Round', system-ui, sans-serif"],
  hand: ['Manuscrita', "'Segoe Print', 'Comic Sans MS', 'Bradley Hand', cursive"],
  asset: ['Fuente importada del proyecto', ''],
}

export const THEME_DEFAULTS = {
  font: 'system', fontAsset: '', fontSize: 17, lineHeight: 1.5, letterSpacing: 0, bold: false,
  textColor: '#f2f2f2', textShadow: false,
  winBg: '#080a10', winOpacity: 0.88, winBorder: '#ffffff', winBorderOpacity: 0.22, winBorderWidth: 1, radius: 8, padding: 16, shadow: true,
  bgImage: '', bgImageOpacity: 1,
  accent: '#3d8bd6', accentText: '#ffffff', nameBg: '#3d8bd6', nameText: '#ffffff', nextColor: '#e0a43a', nextIcon: '▼',
  dlgWidth: 760, dlgBottom: 5, dlgLines: 2, speed: 48,
}

/** Temas listos para usar. */
export const THEME_PRESETS = {
  clasico: ['Clásico oscuro', {}],
  novela: ['Novela visual', { font: 'serif', fontSize: 19, lineHeight: 1.6, winBg: '#fbf6ea', winOpacity: 0.94, textColor: '#2b2118', winBorder: '#8a6d3b', winBorderOpacity: 0.8, winBorderWidth: 2, radius: 4, accent: '#8a3b2b', nameBg: '#8a3b2b', nameText: '#fff4e0', nextColor: '#8a3b2b', nextIcon: '❧', textShadow: false, speed: 36 }],
  terminal: ['Terminal retro', { font: 'mono', fontSize: 16, winBg: '#020a04', winOpacity: 0.92, textColor: '#6dff9a', winBorder: '#2dd16a', winBorderOpacity: 0.7, radius: 0, accent: '#2dd16a', accentText: '#001a08', nameBg: '#2dd16a', nameText: '#001a08', nextColor: '#6dff9a', nextIcon: '█', speed: 60, textShadow: true }],
  vhs: ['Found footage (VHS)', { font: 'mono', fontSize: 15, letterSpacing: 0.5, winBg: '#000000', winOpacity: 0.55, textColor: '#f4f4f4', winBorder: '#ffffff', winBorderOpacity: 0, winBorderWidth: 0, radius: 0, shadow: false, textShadow: true, accent: '#e0443a', accentText: '#ffffff', nameBg: '#e0443a', nameText: '#ffffff', nextColor: '#e0443a', nextIcon: '●', dlgWidth: 900, dlgBottom: 3, speed: 70 }],
  fantasia: ['Fantasía (estilo MZ)', { font: 'rounded', fontSize: 18, winBg: '#10204a', winOpacity: 0.92, textColor: '#ffffff', winBorder: '#e8eeff', winBorderOpacity: 0.9, winBorderWidth: 2, radius: 10, accent: '#5aa0ff', nameBg: '#2b4fa8', nameText: '#ffffff', nextColor: '#ffe27a', nextIcon: '▼', textShadow: true }],
  terror: ['Terror / sutil', { font: 'serif', fontSize: 18, winBg: '#0b0505', winOpacity: 0.7, textColor: '#e9dcd0', winBorder: '#7a1a1a', winBorderOpacity: 0.55, radius: 2, accent: '#8f1d1d', nameBg: '#5c0f0f', nameText: '#f3d9d0', nextColor: '#a32222', nextIcon: '▾', speed: 28, dlgWidth: 700 }],
}

const clamp = (v, a, b, d) => { v = +v; return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d }
const hex = (v, d) => (/^#[0-9a-f]{6}$/i.test(v || '') ? v : d)

export function normalizeTheme(t) {
  const s = t || {}, D = THEME_DEFAULTS
  return {
    font: s.font in FONT_STACKS ? s.font : D.font, fontAsset: String(s.fontAsset || ''), fontSize: clamp(s.fontSize, 8, 64, D.fontSize), lineHeight: clamp(s.lineHeight, 1, 3, D.lineHeight),
    letterSpacing: clamp(s.letterSpacing, -2, 10, D.letterSpacing), bold: !!s.bold,
    textColor: hex(s.textColor, D.textColor), textShadow: !!s.textShadow,
    winBg: hex(s.winBg, D.winBg), winOpacity: clamp(s.winOpacity, 0, 1, D.winOpacity), winBorder: hex(s.winBorder, D.winBorder), winBorderOpacity: clamp(s.winBorderOpacity, 0, 1, D.winBorderOpacity),
    winBorderWidth: clamp(s.winBorderWidth, 0, 12, D.winBorderWidth), radius: clamp(s.radius, 0, 40, D.radius), padding: clamp(s.padding, 0, 60, D.padding), shadow: s.shadow !== false,
    bgImage: String(s.bgImage || ''), bgImageOpacity: clamp(s.bgImageOpacity, 0, 1, D.bgImageOpacity),
    accent: hex(s.accent, D.accent), accentText: hex(s.accentText, D.accentText), nameBg: hex(s.nameBg, D.nameBg), nameText: hex(s.nameText, D.nameText), nextColor: hex(s.nextColor, D.nextColor),
    nextIcon: String(s.nextIcon ?? D.nextIcon).slice(0, 3),
    dlgWidth: clamp(s.dlgWidth, 280, 1800, D.dlgWidth), dlgBottom: clamp(s.dlgBottom, 0, 40, D.dlgBottom), dlgLines: clamp(s.dlgLines, 1, 8, D.dlgLines), speed: clamp(s.speed, 5, 500, D.speed),
  }
}
export const defaultTheme = () => normalizeTheme({})

export function rgba(h, a) {
  const n = parseInt(hex(h, '#000000').slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${+a.toFixed(3)})`
}

export const fontFamily = (t, assetFamily = 'LFThemeFont') => (t.font === 'asset' && t.fontAsset ? `'${assetFamily}', ${FONT_STACKS.system[1]}` : FONT_STACKS[t.font]?.[1] || FONT_STACKS.system[1])

/** Variables CSS (objeto para :style). `imgUrl` = url ya resuelta de la imagen de fondo. */
export function themeVars(theme, { imgUrl = '' } = {}) {
  const t = normalizeTheme(theme)
  return {
    '--rt-font': fontFamily(t), '--rt-fs': t.fontSize + 'px', '--rt-lh': String(t.lineHeight), '--rt-ls': t.letterSpacing + 'px', '--rt-weight': t.bold ? '700' : '400',
    '--rt-text': t.textColor, '--rt-text-shadow': t.textShadow ? '0 1px 3px rgba(0,0,0,.85), 0 0 2px rgba(0,0,0,.6)' : 'none',
    '--rt-win-bg': rgba(t.winBg, t.winOpacity), '--rt-win-border': rgba(t.winBorder, t.winBorderOpacity), '--rt-bw': t.winBorderWidth + 'px',
    '--rt-radius': t.radius + 'px', '--rt-pad': t.padding + 'px', '--rt-shadow': t.shadow ? '0 10px 40px rgba(0,0,0,.5)' : 'none',
    '--rt-accent': t.accent, '--rt-accent-text': t.accentText, '--rt-name-bg': t.nameBg, '--rt-name-text': t.nameText, '--rt-next': t.nextColor, '--rt-next-icon': JSON.stringify(t.nextIcon),
    '--rt-dlg-w': t.dlgWidth + 'px', '--rt-dlg-bottom': t.dlgBottom + '%', '--rt-dlg-min': (t.dlgLines * t.lineHeight).toFixed(2) + 'em',
    '--rt-win-img': imgUrl ? `url("${imgUrl}")` : 'none', '--rt-win-img-op': String(t.bgImageOpacity),
  }
}

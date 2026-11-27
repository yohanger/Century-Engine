// IntelliSense de JavaScript + API de Century para CodeMirror 6 (scripts, comando «Script» de eventos y pantallas .ui).
//
//   · Autocompletado por tipos: game.node('x').light. → miembros de LightHandle; variables locales, for…of y parámetros de callbacks
//     (game.on('footstep', (e) => e.surface)); nombres del proyecto dentro de las comillas (nodos, interruptores, audio…); claves de
//     los objetos de opciones ({ fadeOut, fadeIn… }).
//   · Información al pasar el ratón (firma + documentación) y ayuda de parámetros al escribir dentro de una llamada.
//   · Diagnósticos: errores de sintaxis, miembros que no existen (game.nodo), promesas sin await y nombres que no están en el proyecto.
//   · Formatear documento (Prettier, cargado solo cuando se usa).
// El motor de tipos (types.js) lee game-api.d.ts: la misma fuente que VS Code. No hay listas que mantener a mano.
import { autocompletion, snippetCompletion, completeFromList } from '@codemirror/autocomplete'
import { EditorView, hoverTooltip, showTooltip, keymap } from '@codemirror/view'
import { StateField, StateEffect } from '@codemirror/state'
import { syntaxTree, ensureSyntaxTree } from '@codemirror/language'
import { linter } from '@codemirror/lint'
import { javascriptLanguage } from '@codemirror/lang-javascript'
import { GAME_API_DTS } from '../events/apiDocs.js'
import { mask, signatureOf, shortType } from './types.js'
import { createAnalysis, CONTEXTS, ROOT_DOCS, jsSegment, scriptRoots } from './analysis.js'
import { makeEl } from '../../engine/runtime/platform.js'
import { analyzeScriptEditables } from '../../engine/runtime/scene/script-editables.js'

const analysis = createAnalysis(GAME_API_DTS)
export const engine = analysis.engine
const { describeAt, signatureAt, diagnose } = analysis
export { CONTEXTS, describeAt, signatureAt, diagnose, jsSegment }

// ---------------------------------------------------------------- presentación
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
/** Colorea una firma como en VS Code (nombres, tipos, literales). */
function colorSig(sig, activeParam = -1) {
  // resalta el parámetro activo: se localiza por posición entre los paréntesis de nivel 0
  let html = '', depth = 0, param = 0, inParams = false
  const tokens = sig.match(/'[^']*'|"[^"]*"|[A-Za-z_$][\w$]*|\s+|=>|./g) || []
  let paramOpen = false
  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i]
    if (tk === '(' || tk === '{' || tk === '[' || tk === '<') { if (tk === '(' && depth === 0 && !inParams) { inParams = true; paramOpen = true; html += '('; depth++; if (activeParam === 0) html += '<b class="lf-sig-act">'; continue } depth++ }
    if (tk === ')' || tk === '}' || tk === ']' || (tk === '>' && tokens[i - 1] !== '=')) {
      depth--
      if (tk === ')' && depth === 0 && paramOpen) { if (param === activeParam) html += '</b>'; paramOpen = false; html += ')'; continue }
    }
    if (tk === ',' && depth === 1 && paramOpen) {
      if (param === activeParam) html += '</b>'
      param++
      html += ','
      if (param === activeParam) html += '<b class="lf-sig-act">'
      continue
    }
    let cls = ''
    if (/^['"]/.test(tk)) cls = 'str'
    else if (/^(string|number|boolean|any|void|null|undefined|object|true|false)$/.test(tk)) cls = 'kw'
    else if (/^[A-Z]/.test(tk)) cls = 'type'
    else if (/^[A-Za-z_$]/.test(tk) && tokens[i + 1] === '(') cls = 'fn'
    else if (/^[A-Za-z_$]/.test(tk)) cls = 'id'
    html += cls ? `<span class="lf-sig-${cls}">${esc(tk)}</span>` : esc(tk)
  }
  return html
}
function docHtml(doc) {
  if (!doc) return ''
  return esc(doc).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\n/g, '<br>')
}
function infoNode(entries, prefix) {
  const div = makeEl('div')
  div.className = 'lf-info'
  const sigs = entries.map((e) => signatureOf(e, prefix))
  const shown = sigs.slice(0, 4)
  div.innerHTML = `<pre class="lf-sig">${shown.map((s) => colorSig(s)).join('\n')}${sigs.length > 4 ? `\n<span class="lf-more">+${sigs.length - 4} sobrecargas</span>` : ''}</pre>`
    + (entries.find((e) => e.doc) ? `<div class="lf-doc">${docHtml(entries.find((e) => e.doc).doc)}</div>` : '')
  return div
}
const isDeprecated = (entries) => entries.some((e) => /@deprecated|obsolet/i.test(e.doc || ''))

function optionFor({ name, entries }, prefix) {
  const e = entries[0]
  const method = e.kind === 'method'
  const opt = {
    label: name,
    type: method ? 'method' : 'property',
    detail: (isDeprecated(entries) ? 'obsoleto · ' : '') + shortType(e),
    info: () => infoNode(entries, prefix),
    boost: isDeprecated(entries) ? -5 : 0,
  }
  if (method) {
    const hasParams = entries.some((x) => x.params.length)
    opt.apply = (view, completion, from, to) => {
      const next = view.state.sliceDoc(to, to + 1)
      if (next === '(') { view.dispatch({ changes: { from, to, insert: name }, selection: { anchor: from + name.length + 1 } }); return }
      view.dispatch({ changes: { from, to, insert: `${name}()` }, selection: { anchor: from + name.length + (hasParams ? 1 : 2) } })
    }
  }
  return opt
}

// ---------------------------------------------------------------- autocompletado
/**
 * Fuente de autocompletado por tipos. `opts`: { roots, names: () => nombres del proyecto }.
 * Devuelve null cuando no le toca (identificadores sueltos → las demás fuentes: variables locales, globales, fragmentos).
 */
export function typedSource(opts) {
  const roots = opts.roots || CONTEXTS.script
  return (context) => {
    const full = context.state.doc.toString()
    if (!opts.segment) return typedComplete(full, context.pos, context.explicit, roots, opts.names)
    const seg = jsSegment(full, context.pos)
    if (!seg) return null
    const r = typedComplete(full.slice(seg.start, seg.end), context.pos - seg.start, context.explicit, roots, opts.names)
    return r && { ...r, from: r.from + seg.start }
  }
}

function typedComplete(text, pos, explicit, roots, namesFn) {
  {
    const mk = mask(text, pos)
    if (mk.comment && !mk.string) return null
    const names = namesFn?.() || {}
    if (mk.string) {
      const start = mk.string.start
      const cc = engine.callContext(text, start, mk.text)
      if (!cc) return null
      const ctx = engine.contextAt(text, cc.open, roots)
      const list = cc.objectAt != null
        ? (cc.objectKey ? engine.objectValueChoices(cc.callee, cc.args, cc.argIndex, cc.objectKey, ctx, names) : null)
        : engine.stringChoices(cc.callee, cc.args, cc.argIndex, ctx, names)
      if (!list?.length) return null
      return {
        from: start + 1,
        options: list.map((c) => ({ label: c.label, type: 'text', detail: c.detail, info: c.info || undefined })),
        validFor: /^[^'"`\n]*$/,
      }
    }
    let from = pos
    while (from > 0 && /[\w$]/.test(text[from - 1])) from--
    const word = { from, to: pos }
    let dot = from
    if (text[dot - 1] === '.') {
      const exprEnd = text[dot - 2] === '?' ? dot - 2 : dot - 1
      const start = engine.expressionStart(mk.text, exprEnd)
      const expr = text.slice(start, exprEnd)
      if (!expr.trim()) return null
      const ctx = engine.contextAt(text, start, roots)
      const r = engine.membersAfter(expr, ctx)
      if (!r) return null
      const prefix = /^[A-Za-z_$][\w$]*$/.test(expr) ? `${expr}.` : ''
      return { from, options: r.list.map((m) => ({ ...optionFor(m, prefix), boost: (optionFor(m, prefix).boost || 0) + 40 })), validFor: /^[\w$]*$/ }
    }
    // clave de un objeto de opciones: game.goScene('x', 'y', { fa|
    const cc = engine.callContext(text, from, mk.text)
    if (cc && cc.objectAt != null && !cc.objectKey) {
      const ctx = engine.contextAt(text, cc.open, roots)
      const keys = engine.objectKeys(cc.callee, cc.args, cc.argIndex, ctx)
      if (keys?.length && (word.from < word.to || explicit)) {
        return { from, options: keys.map((k) => ({ ...optionFor(k, ''), type: 'property', apply: `${k.name}: `, boost: 60 })), validFor: /^[\w$]*$/ }
      }
    }
    return null
  }
}

/** Nombres raíz del contexto (game, event…, o los del setup de una pantalla .ui). */
function rootsSource(roots) {
  const options = Object.entries(roots).map(([name, type]) => ({
    label: name, type: /=>/.test(type) ? 'function' : 'variable', detail: /=>/.test(type) ? 'función' : type.replace(/^Record<.*>$/, 'objeto'),
    info: ROOT_DOCS[name], boost: name === 'game' ? 3 : 1,
  }))
  return (context) => {
    const w = context.matchBefore(/(?<![.\w$])[A-Za-z_$][\w$]*/)
    if (!w || (w.from === w.to && !context.explicit)) return null
    if (inStringOrKey(context, w.from)) return null
    return { from: w.from, options, validFor: /^[\w$]*$/ }
  }
}

/** ¿Dentro de una cadena, o escribiendo la clave de un objeto de opciones (`{ ener|`)? Ahí no van fragmentos ni nombres globales. */
function inStringOrKey(context, from) {
  const text = context.state.doc.toString()
  const mk = mask(text, context.pos)
  if (mk.string) return true
  const before = text.slice(Math.max(0, from - 200), from)
  if (!/[{,]\s*$/.test(mk.text.slice(Math.max(0, from - 200), from))) return false
  const cc = engine.callContext(text, from, mk.text)
  return !!(cc && cc.objectAt != null && !cc.objectKey && before)
}
const JS_GLOBALS = [
  ['Math', 'Funciones matemáticas: Math.floor, Math.random…'], ['JSON', 'JSON.parse / JSON.stringify'], ['console', 'console.log(...) escribe en la consola del editor'],
  ['Array', ''], ['Object', 'Object.keys / values / entries'], ['Number', ''], ['String', ''], ['Promise', ''], ['Date', ''], ['Map', ''], ['Set', ''],
  ['setTimeout', 'Mejor: await game.wait(segundos)'], ['parseInt', ''], ['parseFloat', ''], ['isNaN', ''],
].map(([label, info]) => ({ label, type: 'variable', detail: 'global', info: info || undefined, boost: -2 }))
const globalsSource = (context) => {
  const w = context.matchBefore(/(?<![.\w$])[A-Za-z_$][\w$]*/)
  if (!w || (w.from === w.to && !context.explicit)) return null
  if (inStringOrKey(context, w.from)) return null
  return { from: w.from, options: JS_GLOBALS, validFor: /^[\w$]*$/ }
}

export const SNIPPETS = [
  snippetCompletion('for (const ${item} of ${lista}) {\n\t${}\n}', { label: 'for…of', detail: 'bucle', type: 'keyword' }),
  snippetCompletion('for (let ${i} = 0; ${i} < ${n}; ${i}++) {\n\t${}\n}', { label: 'for', detail: 'bucle', type: 'keyword' }),
  snippetCompletion('while (${condición}) {\n\t${}\n\tawait game.wait(0)\n}', { label: 'while', detail: 'bucle con espera', type: 'keyword' }),
  snippetCompletion('if (${condición}) {\n\t${}\n}', { label: 'if', detail: 'condición', type: 'keyword' }),
  snippetCompletion('try {\n\t${}\n} catch (e) {\n\tconsole.error(e)\n}', { label: 'try', detail: 'try / catch', type: 'keyword' }),
  snippetCompletion("game.on('${update}', (${dt}) => {\n\t${}\n})", { label: 'game.on', detail: 'escuchar un evento del juego', type: 'function' }),
  snippetCompletion("game.define('${nombre}', async (${}) => {\n\t\n})", { label: 'game.define', detail: 'función para «Llamar función de script»', type: 'function' }),
  snippetCompletion("const ${n} = game.node('${Nombre}')", { label: 'const node', detail: 'buscar un nodo', type: 'function' }),
  snippetCompletion('await game.wait(${1})', { label: 'wait', detail: 'esperar segundos', type: 'method' }),
  snippetCompletion("await game.say('${Texto}', '${Quién}')", { label: 'say', detail: 'mostrar texto', type: 'method' }),
]
const snippetsSource = (context) => {
  const w = context.matchBefore(/(?<![.\w$])[\w$.]+/)
  if (!w && !context.explicit) return null
  if (inStringOrKey(context, w ? w.from : context.pos)) return null
  return { from: w ? w.from : context.pos, options: SNIPPETS, validFor: /^[\w$.]*$/ }
}

/** Todas las fuentes de autocompletado para un contexto ('script' | 'ui'). */
export function completionSources({ context = 'script', ownerType = null, names, extra = [] } = {}) {
  const roots = scriptRoots(context, ownerType)
  return [typedSource({ roots, names }), rootsSource(roots), globalsSource, snippetsSource, ...extra]
}

// ---------------------------------------------------------------- información al pasar el ratón
/** Aplica `fn(texto, pos)` al trozo JS de una plantilla (o al texto entero) y recoloca las posiciones del resultado. */
function inSegment(full, pos, segment, fn) {
  if (!segment) return fn(full, pos)
  const seg = jsSegment(full, pos)
  if (!seg) return null
  const r = fn(full.slice(seg.start, seg.end), pos - seg.start)
  if (!r) return null
  return { ...r, from: r.from != null ? r.from + seg.start : r.from, to: r.to != null ? r.to + seg.start : r.to }
}
function hoverExt(roots, segment = false) {
  return hoverTooltip((view, pos) => {
    const d = inSegment(view.state.doc.toString(), pos, segment, (t, p) => describeAt(t, p, roots))
    if (!d) return null
    return {
      pos: d.from, end: d.to, above: true,
      create() {
        if (d.entries) return { dom: infoNode(d.entries, d.prefix) }
        const div = makeEl('div')
        div.className = 'lf-info'
        div.innerHTML = `<pre class="lf-sig">${colorSig(d.title)}</pre>${d.doc ? `<div class="lf-doc">${docHtml(d.doc)}</div>` : ''}`
        return { dom: div }
      },
    }
  }, { hoverTime: 350 })
}

// ---------------------------------------------------------------- ayuda de parámetros
const hideSig = StateEffect.define()
function signatureExt(roots, segment = false) {
  const compute = (state, hidden) => {
    if (hidden) return null
    const sel = state.selection.main
    if (!sel.empty) return null
    const s = inSegment(state.doc.toString(), sel.head, segment, (t, p) => signatureAt(t, p, roots))
    if (!s) return null
    return {
      pos: sel.head, above: true, strictSide: true, arrow: false,
      create() {
        const e = s.entries[s.active]
        const div = makeEl('div')
        div.className = 'lf-info lf-sighelp'
        const name = s.callee.replace(/^.*\./, '')
        const prefix = s.callee.slice(0, s.callee.length - name.length).replace(/\s+/g, '')
        div.innerHTML = `<pre class="lf-sig">${s.entries.length > 1 ? `<span class="lf-more">${s.active + 1}/${s.entries.length}</span> ` : ''}${colorSig(signatureOf(e, prefix.length < 24 ? prefix : ''), s.param)}</pre>`
          + (e.doc ? `<div class="lf-doc">${docHtml(e.doc)}</div>` : '')
        return { dom: div }
      },
    }
  }
  const field = StateField.define({
    create: (state) => ({ hidden: false, tip: null }),
    update(v, tr) {
      let hidden = v.hidden
      for (const ef of tr.effects) if (ef.is(hideSig)) hidden = true
      if (tr.docChanged) hidden = tr.effects.some((ef) => ef.is(hideSig))
      if (!tr.docChanged && !tr.selection && hidden === v.hidden) return v
      return { hidden, tip: compute(tr.state, hidden) }
    },
    provide: (f) => showTooltip.from(f, (v) => v.tip),
  })
  return [field, keymap.of([{ key: 'Escape', run: (view) => { if (!view.state.field(field).tip) return false; view.dispatch({ effects: hideSig.of(null) }); return true } }])]
}

// ---------------------------------------------------------------- diagnósticos
function lintExt(context, names, ownerType) {
  return linter((view) => {
    const code = view.state.doc.toString()
    const editable = context === 'nodeScript' ? analyzeScriptEditables(code) : null
    const diagnostics = (editable?.diagnostics || []).map(issue => {
      const lines = code.split('\n')
      const start = lines.slice(0, issue.line - 1).reduce((total, line) => total + line.length + 1, 0)
      return { from: Math.min(start, code.length), to: Math.min(start + Math.max(1, (lines[issue.line - 1] || '').length), code.length), severity: 'error', message: issue.message, source: 'Century' }
    })
    const hasDecorators = !!editable?.annotationLines.length
    const tree = hasDecorators ? javascriptLanguage.parser.parse(editable.editorSource) : (ensureSyntaxTree(view.state, view.state.doc.length, 400) || syntaxTree(view.state))
    return [...diagnostics, ...diagnose(hasDecorators ? editable.editorSource : code, { context, ownerType, names: names?.() || {}, tree }).map(({ line, ...d }) => d)]
  }, { delay: 450 })
}

// ---------------------------------------------------------------- formatear (Prettier bajo demanda)
const PRETTIER = { semi: false, singleQuote: true, printWidth: 110, tabWidth: 2, arrowParens: 'always', trailingComma: 'all' }
/** Formatea código: 'script' (cuerpo de función async), 'ui' (setup), 'css' o 'template' (plantilla Vue). Lanza si hay errores de sintaxis. */
export async function formatCode(code, kind = 'script') {
  const prettier = await import('prettier/standalone')
  if (kind === 'css') {
    const postcss = await import('prettier/plugins/postcss')
    return prettier.format(code, { ...PRETTIER, parser: 'css', plugins: [postcss.default || postcss] })
  }
  if (kind === 'template') {
    const html = await import('prettier/plugins/html')
    const babel = await import('prettier/plugins/babel'), estree = await import('prettier/plugins/estree')
    const out = await prettier.format(`<template>\n${code}\n</template>\n`, { ...PRETTIER, parser: 'vue', plugins: [html.default || html, babel.default || babel, estree.default || estree] })
    return unwrap(out, /^<template>\n/, /\n<\/template>\n?$/)
  }
  const babel = await import('prettier/plugins/babel'), estree = await import('prettier/plugins/estree')
  const editable = kind === 'nodeScript' ? analyzeScriptEditables(code) : null
  if (editable?.diagnostics.length) throw new Error(editable.diagnostics[0].message)
  const annotations = editable?.annotationLines || []
  const decorated = new Map(annotations.map(({ line, value }, index) => [line, { marker: `__century_editable_marker_${index}__`, value }]))
  const input = decorated.size ? code.split('\n').map((line, index) => decorated.get(index + 1) ? `// ${decorated.get(index + 1).marker}` : line).join('\n') : code
  const out = await prettier.format(`async function __lf__() {\n${input}\n}\n`, { ...PRETTIER, parser: 'babel', plugins: [babel.default || babel, estree.default || estree] })
  let formatted = unwrap(out, /^async function __lf__\(\) \{\n?/, /\n?\}\n?$/)
  for (const item of decorated.values()) formatted = formatted.replace(`// ${item.marker}`, item.value)
  return formatted
}
function unwrap(out, head, tail) {
  const body = out.replace(head, '').replace(tail, '')
  return body.split('\n').map((l) => l.replace(/^ {2}/, '')).join('\n').replace(/^\n+/, '') + '\n'
}

// ---------------------------------------------------------------- todo junto
/**
 * Extensiones de IntelliSense para un editor CodeMirror de JavaScript.
 * `opts`: { context: 'script' | 'ui', names: () => nombres del proyecto, language: lenguaje que lleva el autocompletado (javascriptLanguage por defecto) }.
 */
export function jsIntelligence(opts = {}) {
  const context = opts.context || 'script'
  const roots = scriptRoots(context, opts.ownerType)
  const lang = opts.language || javascriptLanguage
  return [
    ...completionSources({ context, ownerType: opts.ownerType, names: opts.names }).map((src) => lang.data.of({ autocomplete: src })),
    hoverExt(roots),
    signatureExt(roots),
    opts.lint === false ? [] : lintExt(context, opts.names, opts.ownerType),
    intelTheme,
  ]
}
/** Solo las piezas que sirven dentro de una plantilla HTML ({{ }}, :attr, @evento): completado por tipos, información y parámetros. */
export function templateIntelligence() {
  const roots = CONTEXTS.ui
  return [hoverExt(roots, true), signatureExt(roots, true), intelTheme]
}
export const templateTypedSource = (names) => typedSource({ roots: CONTEXTS.ui, names, segment: true })

export const intelTheme = EditorView.baseTheme({
  '.lf-info': { maxWidth: '560px', padding: '0', fontSize: '12px', lineHeight: '1.5' },
  '.lf-info .lf-sig': { margin: '0', padding: '8px 12px', fontFamily: '"DejaVu Sans Mono", "Liberation Mono", Consolas, monospace', fontSize: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#d4d4d4' },
  '.lf-info .lf-doc': { padding: '8px 12px', borderTop: '1px solid #3c3c3c', color: '#c8c8c8', whiteSpace: 'normal' },
  '.lf-info .lf-doc code': { fontFamily: 'monospace', background: '#ffffff14', padding: '0 4px', borderRadius: '3px' },
  '.lf-sig-fn': { color: '#dcdcaa' }, '.lf-sig-type': { color: '#4ec9b0' }, '.lf-sig-kw': { color: '#569cd6' }, '.lf-sig-str': { color: '#ce9178' }, '.lf-sig-id': { color: '#9cdcfe' },
  '.lf-sig-act': { fontWeight: '700', textDecoration: 'underline', textUnderlineOffset: '3px', color: '#ffffff' },
  '.lf-sig-act .lf-sig-id': { color: '#ffffff' },
  '.lf-more': { color: '#8b8b8b', fontSize: '11px' },
  '.cm-tooltip.cm-tooltip-hover, .cm-tooltip:has(.lf-sighelp)': { backgroundColor: '#252526', border: '1px solid #454545', borderRadius: '4px', boxShadow: '0 8px 24px #0009' },
})

export { completeFromList }

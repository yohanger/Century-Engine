// Aspecto común de los editores de código (scripts, comando «Script», pantallas .ui, shaders): tema oscuro estilo VS Code «Dark+»,
// resaltado por colores, guías de sangría, minimapa opcional y atajos.
import { EditorView, keymap } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting, indentUnit } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import { indentationMarkers } from '@replit/codemirror-indentation-markers'
import { showMinimap } from '@replit/codemirror-minimap'
import { indentWithTab } from '@codemirror/commands'
import { makeEl } from '../../engine/runtime/platform.js'

export const MONO = '"JetBrains Mono", "Cascadia Code", "DejaVu Sans Mono", "Liberation Mono", Consolas, ui-monospace, monospace'

export const darkPlus = EditorView.theme({
  '&': { height: '100%', backgroundColor: '#1e1e1e', color: '#d4d4d4', fontSize: '13.5px' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { overflow: 'auto', fontFamily: MONO, lineHeight: '1.65' },
  '.cm-content': { padding: '10px 0 40vh', caretColor: '#aeafad' },
  '.cm-line': { padding: '0 16px 0 10px' },
  '.cm-gutters': { backgroundColor: '#1e1e1e', border: 'none', color: '#6e7681' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 10px 0 14px', minWidth: '34px' },
  '.cm-foldGutter .cm-gutterElement': { color: '#7d7d7d', padding: '0 4px' },
  '.cm-activeLine': { backgroundColor: '#ffffff0a' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: '#c6c6c6' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: '#264f78 !important' },
  '.cm-selectionMatch': { backgroundColor: '#add6ff26' },
  '.cm-cursor, .cm-dropCursor': { borderLeft: '2px solid #aeafad' },
  '.cm-matchingBracket': { backgroundColor: '#0064001a', outline: '1px solid #888' },
  '.cm-nonmatchingBracket': { color: '#f44747' },
  '.cm-panels': { backgroundColor: '#252526', color: '#d4d4d4' },
  '.cm-panels.cm-panels-top': { borderBottom: '1px solid #3c3c3c' },
  '.cm-panels.cm-panels-bottom': { borderTop: '1px solid #3c3c3c' },
  '.cm-panels input, .cm-panels button': { fontSize: '12px' },
  '.cm-searchMatch': { backgroundColor: '#623315', outline: '1px solid #9e6a03' },
  '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: '#9e6a03' },
  '.cm-tooltip': { backgroundColor: '#252526', color: '#d4d4d4', border: '1px solid #454545', borderRadius: '4px', boxShadow: '0 10px 24px #0008' },
  '.cm-tooltip-autocomplete > ul': { maxHeight: '290px', fontFamily: MONO, fontSize: '12.5px' },
  '.cm-tooltip-autocomplete > ul > li': { padding: '3px 8px', lineHeight: '1.5' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: '#04395e', color: '#fff' },
  '.cm-completionMatchedText': { color: '#2aaaff', textDecoration: 'none', fontWeight: '600' },
  '.cm-completionDetail': { marginLeft: '18px', color: '#8b8b8b', fontStyle: 'normal', fontSize: '11.5px' },
  '.cm-completionInfo': { maxWidth: '520px', padding: '0', whiteSpace: 'normal' },
  '.cm-completionInfo.cm-completionInfo-right, .cm-completionInfo.cm-completionInfo-left': { backgroundColor: '#252526' },
  '.cm-completionIcon': { width: '1.1em', opacity: '1', paddingRight: '.7em' },
  '.cm-completionIcon-method:after, .cm-completionIcon-function:after': { content: "'ƒ'", color: '#b180d7' },
  '.cm-completionIcon-property:after': { content: "'◆'", color: '#75beff', fontSize: '10px' },
  '.cm-completionIcon-variable:after': { content: "'𝑥'", color: '#75beff' },
  '.cm-completionIcon-keyword:after': { content: "'⌘'", color: '#c5c5c5', fontSize: '10px' },
  '.cm-completionIcon-text:after': { content: "'\"'", color: '#ce9178' },
  '.cm-completionIcon-type:after, .cm-completionIcon-class:after': { content: "'T'", color: '#ee9d28' },
  '.cm-foldPlaceholder': { backgroundColor: '#303030', border: '1px solid #494949', color: '#bdbdbd' },
  '.cm-lintRange-error': { backgroundImage: 'none', textDecoration: 'underline wavy #f14c4c', textUnderlineOffset: '3px', textDecorationSkipInk: 'none' },
  '.cm-lintRange-warning': { backgroundImage: 'none', textDecoration: 'underline wavy #cca700', textUnderlineOffset: '3px', textDecorationSkipInk: 'none' },
  '.cm-lintRange-info': { backgroundImage: 'none', textDecoration: 'underline dotted #3794ff', textUnderlineOffset: '3px' },
  '.cm-diagnostic': { padding: '6px 10px', fontFamily: 'inherit' },
  '.cm-diagnostic-error': { borderLeft: '3px solid #f14c4c' },
  '.cm-diagnostic-warning': { borderLeft: '3px solid #cca700' },
  '.cm-diagnostic-info': { borderLeft: '3px solid #3794ff' },
  '.cm-lint-marker': { width: '.8em', height: '.8em' },
  '.cm-panel.cm-panel-lint ul': { maxHeight: '140px' },
  '.cm-panel.cm-panel-lint ul [aria-selected]': { backgroundColor: '#04395e' },
  '.cm-minimap-gutter': { borderLeft: '1px solid #2b2b2b' },
  '.cm-minimap-overlay-container .cm-minimap-overlay': { background: '#79797933' },
}, { dark: true })

/** Colores «Dark+» de VS Code para JavaScript, HTML/Vue, CSS y GLSL. */
export const darkPlusHighlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword], color: '#c586c0' },
  { tag: [t.definitionKeyword, t.modifier, t.self, t.null, t.bool, t.atom], color: '#569cd6' },
  { tag: [t.number, t.integer, t.float], color: '#b5cea8' },
  { tag: [t.string, t.special(t.string), t.attributeValue], color: '#ce9178' },
  { tag: t.regexp, color: '#d16969' },
  { tag: t.escape, color: '#d7ba7d' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: '#6a9955', fontStyle: 'italic' },
  { tag: t.docComment, color: '#6a9955', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.function(t.definition(t.variableName))], color: '#dcdcaa' },
  { tag: [t.propertyName, t.attributeName], color: '#9cdcfe' },
  { tag: [t.definition(t.variableName), t.variableName, t.local(t.variableName)], color: '#9cdcfe' },
  { tag: [t.typeName, t.className, t.namespace, t.standard(t.typeName)], color: '#4ec9b0' },
  { tag: [t.tagName, t.angleBracket], color: '#569cd6' },
  { tag: t.processingInstruction, color: '#c586c0' },
  { tag: [t.operator, t.punctuation, t.separator, t.bracket, t.derefOperator], color: '#d4d4d4' },
  { tag: t.meta, color: '#c586c0' },
  { tag: t.invalid, color: '#f44747' },
  { tag: [t.labelName, t.macroName], color: '#c8c8c8' },
  { tag: t.heading, color: '#569cd6', fontWeight: 'bold' },
  { tag: t.link, color: '#3794ff', textDecoration: 'underline' },
  { tag: [t.unit, t.color], color: '#b5cea8' },
  { tag: t.constant(t.variableName), color: '#4fc1ff' },
])

const markers = indentationMarkers({ hideFirstIndent: false, markerType: 'fullScope', thickness: 1, colors: { light: '#d3d3d3', dark: '#404040', activeLight: '#939393', activeDark: '#707070' } })

/** Minimapa a la derecha (como VS Code). */
export function minimap() {
  return showMinimap.compute(['doc'], () => ({
    create: () => { const dom = makeEl('div'); return { dom } },
    displayText: 'blocks', showOverlay: 'always', gutters: [],
  }))
}

/** Base de cualquier editor: tema, colores, guías de sangría, Tab sangra (Esc + Tab sale del editor), 2 espacios. */
export function editorLook({ minimap: withMap = false } = {}) {
  return [darkPlus, syntaxHighlighting(darkPlusHighlight), markers, indentUnit.of('  '), keymap.of([indentWithTab]), withMap ? minimap() : []]
}

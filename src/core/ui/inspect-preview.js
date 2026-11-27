const attr = (name, value) => `[${name}="${String(value).replace(/["\\\r\n\f]/g, char => '\\' + char.codePointAt(0).toString(16) + ' ')}"]`
const SLOT = 'data-inventory-slot'

/** Selector relativo a la pantalla .ui, sin las clases internas de Vue ni del editor. */
export function inspectSelector(element, screen) {
  if (element === screen) return ':root'
  for (const name of ['id', 'data-lf']) {
    const value = element.getAttribute(name)
    if (!value) continue
    const candidate = name === 'id' ? '#' + CSS.escape(value) : attr(name, value)
    if (screen.querySelectorAll(candidate).length === 1) return candidate
  }
  const parent = element.parentElement
  const base = inspectSelector(parent, screen)
  const prefix = base === ':root' ? ':root > ' : base + ' > '
  if (element.hasAttribute(SLOT)) return prefix + attr(SLOT, element.getAttribute(SLOT))
  const tag = element.localName
  const siblings = Array.from(parent.children).filter(sibling => sibling.localName === tag)
  return prefix + tag + (siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(element) + 1})` : '')
}

export function inspectLabel(element) {
  if (element.matches('.rt-screen')) return 'Pantalla'
  if (element.hasAttribute(SLOT)) return 'Casilla ' + element.getAttribute(SLOT)
  return element.getAttribute('data-lf') || element.id || element.localName
}

export function selectInspected(screen, selector) {
  if (selector === ':root') return screen
  return screen.querySelector(selector.replace(/^:root(?=\s|$)/, ':scope'))
}

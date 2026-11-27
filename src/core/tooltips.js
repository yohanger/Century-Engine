// Tooltips del editor: DESACTIVADOS por petición. Los textos no se borraron: en las plantillas viven en `data-tooltip`
// (scripts/tooltips-off.mjs los movió desde `title`). Con Preferencias ▸ «Mostrar tooltips» se vuelven a poner como `title`.
let obs = null
const apply = (root) => {
  if (root.nodeType !== 1) return
  if (root.hasAttribute?.('data-tooltip')) root.setAttribute('title', root.getAttribute('data-tooltip'))
  for (const el of root.querySelectorAll?.('[data-tooltip]') || []) el.setAttribute('title', el.getAttribute('data-tooltip'))
}
const clear = () => { for (const el of document.querySelectorAll('[data-tooltip][title]')) el.removeAttribute('title') }

/** Activa o desactiva los tooltips (sigue los cambios de la interfaz mientras están activos). */
export function setTooltips(on) {
  if (typeof document === 'undefined') return
  // también los párrafos de ayuda del Inspector (styles.css: html:not(.lf-tips) … .hint)
  document.documentElement.classList.toggle('lf-tips', !!on)
  obs?.disconnect(); obs = null
  if (!on) { clear(); return }
  apply(document.body)
  obs = new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'attributes') { const el = m.target; const v = el.getAttribute('data-tooltip'); if (v == null) el.removeAttribute('title'); else el.setAttribute('title', v) } else for (const n of m.addedNodes) apply(n)
    }
  })
  obs.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-tooltip'] })
}

// El texto realmente recortado se revela aunque los tooltips de ayuda estén desactivados.
// Reutiliza la delegación de eventos; no instala observadores por cada etiqueta.
const READABLE_TEXT = '.idock .field > label, .idock .pf .row > label, .idock .node-type, .idock .path, .idock .tabs button, .mixer .nm, .mixer .nm2, .mixer .slot span, .mixer .insp .r span'
export function textIsClipped(el, style) {
  if (!el || !style) return false
  const x = (el.scrollWidth || 0) > (el.clientWidth || 0) + 1 && ['hidden', 'clip', 'auto'].includes(style.overflowX)
  const y = (el.scrollHeight || 0) > (el.clientHeight || 0) + 1 && ['hidden', 'clip', 'auto'].includes(style.overflowY)
  return x || y
}

export function showClippedText(root = document) {
  if (!root?.addEventListener || !root.body) return () => {}
  const bubble = document.createElement('div')
  bubble.className = 'lf-clipped-text'
  bubble.id = 'lf-clipped-text-hint'
  bubble.setAttribute('role', 'tooltip')
  bubble.hidden = true
  document.body.appendChild(bubble)
  let active = null
  let lastDescription = null
  const hide = () => {
    if (active && lastDescription === null) active.removeAttribute('aria-describedby')
    else if (active) active.setAttribute('aria-describedby', lastDescription)
    active = null; lastDescription = null; bubble.hidden = true
  }
  const reveal = (event) => {
    const el = event.target?.closest?.(READABLE_TEXT)
    if (!el) return hide()
    if (el === active) return
    hide()
    const content = el.textContent?.trim()
    const rendered = el.matches('.idock .tabs button') ? el.querySelector('span') : el
    if (!content || !textIsClipped(rendered, getComputedStyle(rendered))) return
    active = el
    lastDescription = el.getAttribute('aria-describedby')
    el.setAttribute('aria-describedby', bubble.id)
    bubble.textContent = content
    bubble.hidden = false
    const box = el.getBoundingClientRect()
    const width = Math.min(340, window.innerWidth - 24)
    bubble.style.maxWidth = width + 'px'
    bubble.style.left = Math.max(12, Math.min(box.left, window.innerWidth - width - 12)) + 'px'
    const h = bubble.getBoundingClientRect().height
    bubble.style.top = (box.bottom + h + 10 <= window.innerHeight ? box.bottom + 6 : Math.max(8, box.top - h - 6)) + 'px'
  }
  const out = (event) => {
    if (active && !active.contains(event.relatedTarget)) hide()
  }
  const esc = (event) => { if (event.key === 'Escape') hide() }
  root.addEventListener('pointerover', reveal)
  root.addEventListener('focusin', reveal)
  root.addEventListener('pointerout', out)
  root.addEventListener('focusout', out)
  root.addEventListener('scroll', hide, true)
  root.addEventListener('keydown', esc, true)
  window.addEventListener('resize', hide)
  return () => {
    hide()
    root.removeEventListener('pointerover', reveal)
    root.removeEventListener('focusin', reveal)
    root.removeEventListener('pointerout', out)
    root.removeEventListener('focusout', out)
    root.removeEventListener('scroll', hide, true)
    root.removeEventListener('keydown', esc, true)
    window.removeEventListener('resize', hide)
    bubble.remove()
  }
}

const selector = 'details[data-scene-fold], details.chunk'
const localFolds = new WeakMap()
const normalize = value => String(value || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
export function matchSceneSections(entries, query) {
  const term = normalize(query).trim()
  const matches = new Set()
  const byId = new Map(entries.map(e => [e.id, e]))
  for (const entry of entries) {
    if (term && !normalize(entry.text).includes(term)) continue
    matches.add(entry.id)
    let parent = entry.parent
    while (parent && !matches.has(parent)) {
      matches.add(parent)
      parent = byId.get(parent)?.parent
    }
  }
  // A section matched by its heading exposes the complete section, including descendants.
  for (const entry of entries) {
    let parent = entry.parent
    while (parent) {
      const ancestor = byId.get(parent)
      if (!ancestor) break
      if (normalize(ancestor.heading).includes(term)) { matches.add(entry.id); break }
      parent = ancestor.parent
    }
  }
  return matches
}
export function sceneFoldPreferred(el, prefs) {
  const key = `fold:scene:${el.dataset.sceneFold}`
  return Object.hasOwn(prefs, key) ? !prefs[key] : el.dataset.foldDefault === 'open'
}
export function filterSceneInspector(root, query, prefs) {
  const term = normalize(query).trim()
  const nodes = [...root.querySelectorAll(selector)]
  if (!term) {
    for (const el of nodes) {
      if (el.dataset.sceneSearch !== 'true') continue
      el.hidden = false
      el.open = el.dataset.sceneFold ? sceneFoldPreferred(el, prefs) : localFolds.get(el) ?? false
      delete el.dataset.sceneSearch
      localFolds.delete(el)
    }
    return { found: true, count: nodes.length }
  }
  const entries = nodes.map(el => {
    const summary = el.querySelector(':scope > summary')
    const heading = summary?.textContent || ''
    const labels = [...el.querySelectorAll('label, .row > span, .clock-head > span, button, [data-tooltip], [aria-label]')]
      .filter(label => label.closest(selector) === el)
      .map(label => [label.textContent, label.getAttribute('data-tooltip'), label.getAttribute('aria-label')].filter(Boolean).join(' '))
    return { id: el, parent: el.parentElement.closest(selector), heading, text: [heading, ...labels].join(' ') }
  })
  const matches = matchSceneSections(entries, term)
  for (const el of nodes) {
    if (!el.dataset.sceneFold && !localFolds.has(el)) localFolds.set(el, el.open)
    el.dataset.sceneSearch = 'true'
    el.hidden = !matches.has(el)
    if (matches.has(el)) el.open = true
  }
  return { found: matches.size > 0, count: nodes.length }
}

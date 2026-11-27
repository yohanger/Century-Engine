// La búsqueda y la posición del menú no necesitan Vue ni conocer cómo se crean los nodos.
export const normalizeAddSearch = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim()

export function addMenuTree(items = []) {
  return items.filter((item) => !item.sep && !item.heading && item.checked === undefined)
    .map((item) => ({ ...item, children: item.children ? addMenuTree(item.children) : undefined }))
    .filter((item) => item.children?.length || (typeof item.run === 'function' && !item.disabled))
}

export function searchAddNodes(tree, query) {
  const words = normalizeAddSearch(query).split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const found = []
  function scan(nodes, trail = []) {
    for (const item of nodes) {
      if (item.children) scan(item.children, [...trail, item.label])
      else if (words.every((word) => normalizeAddSearch([...trail, item.label].join(' ')).includes(word))) {
        found.push({ ...item, group: trail.join(' › ') })
      }
    }
  }
  scan(tree)
  return found
}

export function addMenuPosition(anchor, viewport, width = 268, height = 350) {
  const margin = 8
  const x = Number.isFinite(anchor?.x) ? anchor.x : viewport.width / 2
  const y = Number.isFinite(anchor?.y) ? anchor.y : viewport.height / 2
  return {
    left: Math.max(margin, Math.min(x, Math.max(margin, viewport.width - width - margin))),
    top: Math.max(margin, Math.min(y, Math.max(margin, viewport.height - height - margin))),
  }
}

export function addSubmenuPosition(row, parent, viewport, width = 260, height = 350) {
  const margin = 8
  const left = parent.right + width + margin <= viewport.width ? parent.right + 2 : parent.left - width - 2
  return addMenuPosition({ x: left, y: row.top }, viewport, width, height)
}

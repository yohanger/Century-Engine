// Asociación de Script de Nodo mediante el contrato compartido de Assets.
import { hasAssetDrag, readAssetDrag, resolveAssetDrop } from './asset-drop.js'

export function draggedScriptId(transfer) {
  const entry = readAssetDrag(transfer)?.[0]
  return entry?.kind === 'script' ? entry.id : null
}

export function nodeScriptFromDrop(transfer, scripts = []) {
  const entries = scripts.map((script) => ({ kind: 'script', id: script.id, ref: script }))
  return resolveAssetDrop(transfer, entries, { kinds: ['script'] })?.ref || null
}

export const hasAssetEntry = hasAssetDrag

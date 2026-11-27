// Resolución Wavefront confinada a los recursos del proyecto.
const MAP_KEYS = { map_kd: 'albedo', map_bump: 'height', bump: 'height', norm: 'normal', map_pr: 'roughness', map_pm: 'metallic', map_ka: 'ao', map_ke: 'emission' }
const decode = input => typeof input === 'string' ? input : new TextDecoder().decode(input)
function mapPath(tokens) {
  const fixed = { '-mm': 2, '-bm': 1, '-clamp': 1, '-blendu': 1, '-blendv': 1, '-imfchan': 1, '-type': 1, '-texres': 1, '-boost': 1, '-cc': 1 }
  let i = 0
  while (tokens[i]?.startsWith('-')) {
    const flag = tokens[i++]
    if (['-o','-s','-t'].includes(flag)) { let n = 0; while (n < 3 && tokens[i] !== undefined && Number.isFinite(Number(tokens[i]))) { i++; n++ } }
    else if (Object.hasOwn(fixed, flag)) i += fixed[flag]
    else return ''
  }
  return tokens.slice(i).join(' ').replace(/^"|"$/g, '')
}
export function parseMTL(input) {
  const result = new Map()
  let current = null
  for (const raw of decode(input).split(/\r?\n/)) {
    const [key, ...args] = raw.split('#')[0].trim().split(/\s+/)
    const k = key.toLowerCase(), n = Number(args[0])
    if (k === 'newmtl') { current = { maps: {} }; result.set(args.join(' '), current) }
    else if (current) {
      if (['kd','ke'].includes(k) && args.length >= 3 && args.slice(0,3).every(x => Number.isFinite(+x))) current[k] = args.slice(0,3).map(Number)
      else if (['d','tr','ns','pr','pm'].includes(k) && Number.isFinite(n)) current[k] = n
      else if (MAP_KEYS[k]) { const path = mapPath(args); if (path) current.maps[MAP_KEYS[k]] = path }
    }
  }
  return result
}
export function resolveModelAsset(assets, folder, reference, accept = () => true) {
  const ref = String(reference || '').replace(/\\/g, '/')
  if (!ref || /^(?:\/|[a-z][a-z0-9+.-]*:)/i.test(ref)) return null
  const parts = String(folder || 'Assets').split('/')
  for (const part of ref.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') { if (parts.length <= 1) return null; parts.pop() }
    else parts.push(part)
  }
  const full = parts.join('/')
  const candidates = assets.filter(accept)
  return candidates.find(a => `${a.folder || 'Assets'}/${a.name}` === full) ||
    (candidates.filter(a => a.name === parts.at(-1)).length === 1 ? candidates.find(a => a.name === parts.at(-1)) : null)
}

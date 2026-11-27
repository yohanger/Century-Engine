// Línea de tiempo de la captura (tiempo de la grabación original): cabezal, zona recortada, cortes (tomas), capas y claves de cámara.
// Arrastra para moverte; toca una capa para seleccionarla.
import React, { useMemo, useRef } from 'react'
import { View, PanResponder, Text, Pressable } from 'react-native'
import { C, LAYER_COLORS } from '../theme.js'

const ROW = 16
export default function TimeBar({ width, duration, time, trim, cuts, layers, camKeys, selected, onSeek, onSelectLayer }) {
  const W = Math.max(50, width - 16), d = Math.max(0.01, duration)
  const x = (t) => 8 + (Math.min(d, Math.max(0, t)) / d) * W
  const ref = useRef({ onSeek, W, d }); ref.current = { onSeek, W, d }
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => { const r = ref.current; r.onSeek(((e.nativeEvent.locationX - 8) / r.W) * r.d) },
    onPanResponderMove: (e) => { const r = ref.current; r.onSeek(((e.nativeEvent.locationX - 8) / r.W) * r.d) },
  }), [])
  const [a, b] = trim || [0, d]
  const rows = []
  const rowOf = new Map()
  for (const l of layers) { let r = 0; while (rows[r]?.some((o) => !(l.t1 <= o.t0 || l.t0 >= o.t1))) r++; (rows[r] ||= []).push(l); rowOf.set(l.id, r) }
  const H = 34 + Math.max(1, rows.length) * ROW + 14
  const marks = []
  const step = d > 60 ? 10 : d > 20 ? 5 : d > 6 ? 1 : 0.5
  for (let t = 0; t <= d + 1e-6; t += step) marks.push(t)
  return (
    <View style={{ width, height: H, backgroundColor: C.panel }}>
      <View {...pan.panHandlers} style={{ position: 'absolute', left: 0, top: 0, width, height: 34 }}>
        <View style={{ position: 'absolute', left: 8, top: 14, width: W, height: 12, backgroundColor: C.panel2, borderRadius: 3 }} />
        <View style={{ position: 'absolute', left: x(a), top: 14, width: Math.max(1, x(b) - x(a)), height: 12, backgroundColor: '#2f6fed55', borderRadius: 3 }} />
        {marks.map((t) => <Text key={t} style={{ position: 'absolute', left: x(t) - 10, top: 0, width: 20, textAlign: 'center', color: C.muted, fontSize: 9 }}>{Math.round(t * 10) / 10}</Text>)}
        {camKeys.map((k, i) => <View key={'k' + i} style={{ position: 'absolute', left: x(k.t) - 1, top: 27, width: 2, height: 5, backgroundColor: C.cam }} />)}
        {cuts.map((t, i) => <View key={'c' + i} style={{ position: 'absolute', left: x(t) - 1, top: 10, width: 2, height: 20, backgroundColor: C.err }} />)}
      </View>
      {layers.map((l) => (
        <Pressable key={l.id} onPress={() => onSelectLayer?.(l.id)} style={{ position: 'absolute', left: x(l.t0), top: 36 + rowOf.get(l.id) * ROW, width: Math.max(6, x(l.t1) - x(l.t0)), height: ROW - 3, borderRadius: 3, backgroundColor: LAYER_COLORS[l.kind] || C.muted, opacity: selected === l.id ? 1 : 0.6, borderWidth: selected === l.id ? 1 : 0, borderColor: '#fff' }}>
          <Text numberOfLines={1} style={{ color: '#000', fontSize: 9, paddingHorizontal: 3 }}>{l.kind === 'text' ? l.params.text : { fade: 'Fundido', letterbox: 'Barras', shake: 'Temblor' }[l.kind]}</Text>
        </Pressable>
      ))}
      <View pointerEvents="none" style={{ position: 'absolute', left: x(time) - 1, top: 8, width: 2, height: H - 10, backgroundColor: '#fff' }} />
    </View>
  )
}

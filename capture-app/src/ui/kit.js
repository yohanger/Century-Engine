// Controles básicos con la estética de Century.
import React, { useEffect, useState } from 'react'
import { Pressable, Text, View, StyleSheet, TextInput } from 'react-native'
import Slider from '@react-native-community/slider'
import { C } from '../theme.js'

export function Btn({ title, onPress, kind = 'normal', disabled, small, style, testID }) {
  const bg = kind === 'primary' ? C.accent : kind === 'danger' ? C.rec : kind === 'ghost' ? 'transparent' : C.panel2
  return (
    <Pressable testID={testID} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.btn, small && s.small, { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 }, kind === 'ghost' && s.ghost, style]}>
      <Text style={[s.btnT, small && { fontSize: 12 }]}>{title}</Text>
    </Pressable>
  )
}
/** Selector segmentado: options = [[valor, texto], …] */
export function Seg({ value, options, onChange }) {
  return (
    <View style={s.seg}>
      {options.map(([v, label]) => (
        <Pressable key={String(v)} onPress={() => onChange(v)} style={[s.segI, value === v && { backgroundColor: C.accent }]}>
          <Text style={[s.segT, value === v && { color: '#fff' }]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  )
}
export function Field({ label, children, hint }) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <View style={{ flex: 1 }}>{children}{hint ? <Text style={s.hint}>{hint}</Text> : null}</View>
    </View>
  )
}
export function Range({ value, min = 0, max = 1, step = 0, onChange, onDone, fmt }) {
  const [live, setLive] = useState(value)
  useEffect(() => setLive(value), [value])
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Slider style={{ flex: 1, height: 32 }} value={value} minimumValue={min} maximumValue={max} step={step} onValueChange={(v) => { setLive(v); onChange?.(v) }} onSlidingComplete={onDone}
        minimumTrackTintColor={C.accent} maximumTrackTintColor={C.line} thumbTintColor={C.accent2} />
      <Text style={[s.hint, { width: 52, textAlign: 'right' }]}>{fmt ? fmt(live) : live.toFixed(2)}</Text>
    </View>
  )
}
export function Input(props) { return <TextInput placeholderTextColor={C.muted} {...props} style={[s.input, props.style]} /> }
export const Title = ({ children, style }) => <Text style={[s.title, style]}>{children}</Text>
export const Muted = ({ children, style }) => <Text style={[s.hint, style]}>{children}</Text>

export const s = StyleSheet.create({
  btn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  small: { paddingHorizontal: 10, paddingVertical: 6 },
  ghost: { borderWidth: 1, borderColor: C.line },
  btnT: { color: C.text, fontSize: 14, fontWeight: '600' },
  seg: { flexDirection: 'row', backgroundColor: C.panel2, borderRadius: 6, padding: 2 },
  segI: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 5 },
  segT: { color: C.muted, fontSize: 12, fontWeight: '600' },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  label: { color: C.muted, fontSize: 12, width: 104 },
  hint: { color: C.muted, fontSize: 11 },
  input: { backgroundColor: C.panel2, color: C.text, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: C.line },
  title: { color: C.text, fontSize: 18, fontWeight: '700' },
})

// Biblioteca: tus capturas, crear una nueva, abrir un .lfcap.
import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native'
import { listCaptures, deleteCapture, importCaptureFile } from '../storage'
import { Btn, Title, Muted } from '../ui/kit.js'
import { C } from '../theme.js'

const fmtDate = (s) => { const d = new Date(s); if (isNaN(d)) return ''; const z = (n) => String(n).padStart(2, '0'); return `${z(d.getDate())}/${z(d.getMonth() + 1)}/${d.getFullYear()} ${d.getHours()}:${z(d.getMinutes())}` }

export default function Home({ go }) {
  const [list, setList] = useState(null), [msg, setMsg] = useState(''), [armed, setArmed] = useState(null)
  const refresh = useCallback(() => listCaptures().then(setList).catch((e) => setMsg(String(e.message || e))), [])
  useEffect(() => { refresh() }, [refresh])
  const open = async () => { try { const c = await importCaptureFile(); if (c) { setMsg(`Abierta «${c.name}»`); refresh() } } catch (e) { setMsg('No es un .lfcap válido: ' + (e.message || e)) } }
  const del = async (id) => { if (armed !== id) { setArmed(id); return } setArmed(null); await deleteCapture(id); refresh() }
  return (
    <View style={{ flex: 1 }}>
      <View style={st.head}>
        <View style={{ flex: 1 }}>
          <Title>Century Capture</Title>
          <Muted>Graba movimiento con el móvil, edítalo y llévalo a Century como cinemática.</Muted>
        </View>
      </View>
      <View style={st.actions}>
        <Btn testID="new" kind="primary" title="● Nueva captura" onPress={() => go('record')} style={{ flex: 1 }} />
        <Btn title="Abrir .lfcap" onPress={open} />
      </View>
      {msg ? <Text style={st.msg}>{msg}</Text> : null}
      <FlatList
        data={list || []}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        ListEmptyComponent={<Muted style={{ textAlign: 'center', marginTop: 40 }}>{list ? 'Aún no hay capturas. Pulsa «Nueva captura».' : 'Cargando…'}</Muted>}
        renderItem={({ item }) => (
          <Pressable onPress={() => !item.broken && go('editor', item.id)} style={st.item}>
            <View style={{ flex: 1 }}>
              <Text style={st.name}>{item.name}</Text>
              {item.broken ? <Text style={{ color: C.err, fontSize: 11 }}>{item.broken}</Text>
                : <Muted>{item.duration.toFixed(1)} s · {item.frames} fotogramas · {item.cameraKeys} claves de cámara · {item.layers} efectos · {fmtDate(item.created)}</Muted>}
            </View>
            <Btn small kind={armed === item.id ? 'danger' : 'ghost'} title={armed === item.id ? '¿Borrar?' : '✕'} onPress={() => del(item.id)} />
          </Pressable>
        )}
      />
    </View>
  )
}
const st = StyleSheet.create({
  head: { flexDirection: 'row', padding: 16, paddingBottom: 8 },
  actions: { flexDirection: 'row', gap: 8, paddingHorizontal: 12 },
  msg: { color: C.warn, paddingHorizontal: 16, paddingTop: 8, fontSize: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.panel, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: C.line },
  name: { color: C.text, fontSize: 15, fontWeight: '600', marginBottom: 2 },
})

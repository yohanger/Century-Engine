// Editor de la captura (como un editor de vídeo): vista previa, línea de tiempo y pestañas Recorte · Movimiento · Cámara · Efectos · Exportar.
// Los cambios se guardan solos; el movimiento original nunca se toca (las ediciones se aplican al exportar o al importar en Century).
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, useWindowDimensions } from 'react-native'
import { useAwake } from '../ui/awake.js'
import { loadCapture, saveCapture, shareCapture } from '../storage'
import * as Ops from '../editorOps.js'
import { LAYER_KINDS } from '../core/format.js'
import { useDeviceCamera } from '../pose/sensors.js'
import StickView from '../ui/StickView.js'
import TimeBar from '../ui/TimeBar.js'
import { Btn, Seg, Field, Range, Input, Muted, Title } from '../ui/kit.js'
import { C } from '../theme.js'

const TABS = [['cut', 'Recorte'], ['move', 'Movimiento'], ['cam', 'Cámara'], ['fx', 'Efectos'], ['out', 'Exportar']]
const f1 = (v) => v.toFixed(1) + ' s'

export default function Editor({ id, go }) {
  useAwake()
  const { width, height } = useWindowDimensions()
  const [cap, setCap] = useState(null), [err, setErr] = useState('')
  const [t, setT] = useState(0), [playing, setPlaying] = useState(false)
  const [tab, setTab] = useState('cut'), [view, setView] = useState('camera'), [sel, setSel] = useState(null)
  const [rig, setRig] = useState(Ops.SHOTS.general.rig), [zoom, setZoom] = useState(1)
  const [pass, setPass] = useState(false), [msg, setMsg] = useState('')
  const samples = useRef([])
  const dev = useDeviceCamera(tab === 'cam')

  useEffect(() => { loadCapture(id).then((c) => { setCap(c); setT(Ops.trimOf(c)[0]) }).catch((e) => setErr(String(e.message || e))) }, [id])
  // guardado automático
  useEffect(() => { if (!cap) return; const h = setTimeout(() => saveCapture(cap).catch((e) => setMsg('No se pudo guardar: ' + e.message)), 700); return () => clearTimeout(h) }, [cap])
  const pv = useMemo(() => (cap ? Ops.previewOf(cap) : null), [cap?.body, cap?.edits.smooth, cap?.edits.mirror])

  // reproducción (tiempo de la grabación, dentro del recorte, a la velocidad elegida)
  const tr = useRef(t); tr.current = t
  useEffect(() => {
    if (!playing || !cap) return
    let raf = 0, last = Date.now()
    const [a, b] = Ops.trimOf(cap)
    const loop = () => {
      const now = Date.now(), dt = (now - last) / 1000; last = now
      let nt = tr.current + dt * cap.edits.speed
      if (pass) {
        const r = dev.read()
        if (r) samples.current.push({ t: nt, rot: r, zoom })
        if (nt >= b) { finishPass(); return }
      } else if (nt > b) nt = a
      setT(nt); raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [playing, pass, cap?.edits.speed, cap?.edits.trim, zoom])

  if (err) return <View style={{ padding: 20 }}><Text style={{ color: C.err }}>{err}</Text><Btn title="Volver" onPress={() => go('home')} /></View>
  if (!cap || !pv) return <View style={{ padding: 20 }}><Muted>Cargando…</Muted></View>

  const total = Ops.totalOf(cap), [ta, tb] = Ops.trimOf(cap)
  const frame = Ops.frameAt(pv, t)
  const fx = Ops.effectsAt(cap, t)
  let camKey = view === 'rig' ? Ops.rigKey(rig) : Ops.cameraAt(cap, t)
  if (camKey && fx.shake) camKey = { ...camKey, rot: [camKey.rot[0] + Math.sin(t * 23) * fx.shake, camKey.rot[1] + Math.sin(t * 17 + 1) * fx.shake, camKey.rot[2]] }
  const layer = cap.layers.find((l) => l.id === sel)
  const seek = (v) => { setPlaying(false); setT(Math.max(0, Math.min(total, v))) }
  const pvW = width, pvH = Math.min(height * 0.42, (width * 9) / 16 + 40)

  function startPass() { dev.zero(); samples.current = []; setT(ta); setPass(true); setPlaying(true) }
  function finishPass() {
    setPlaying(false); setPass(false)
    setCap((c) => Ops.applyCameraPass(c, samples.current, rig))
    setMsg(`Cámara grabada: ${samples.current.length} muestras`)
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={st.bar}>
        <Btn small kind="ghost" title="‹" onPress={() => go('home')} />
        <Text style={st.name} numberOfLines={1}>{cap.name}</Text>
        <Seg value={view} onChange={setView} options={[['camera', '🎥'], ['front', 'Frente'], ['side', 'Lado'], ['top', 'Arriba']]} />
      </View>
      <StickView frame={frame} floor={pv.floor} view={view === 'rig' ? 'camera' : view} camKey={camKey} width={pvW} height={pvH} letterbox={fx.letterbox} caption={fx.caption} fade={fx.fade} />
      <View style={st.transport}>
        <Btn small title={playing ? '❚❚' : '▶'} onPress={() => { if (!playing && (t < ta || t >= tb)) setT(ta); setPlaying(!playing) }} disabled={pass} />
        <Text style={st.time}>{f1(t)} / {f1(total)}</Text>
        <Muted>Recorte {f1(ta)}–{f1(tb)} · {Ops.takesOf(cap).length} toma(s) · ×{cap.edits.speed}</Muted>
      </View>
      <TimeBar width={width} duration={total} time={t} trim={cap.edits.trim} cuts={cap.edits.cuts} layers={cap.layers} camKeys={cap.camera.keys} selected={sel} onSeek={seek} onSelectLayer={(lid) => { setSel(lid); setTab('fx') }} />
      <View style={st.tabs}>{TABS.map(([k, label]) => <Btn key={k} small kind={tab === k ? 'primary' : 'ghost'} title={label} onPress={() => setTab(k)} />)}</View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, gap: 8 }}>
        {msg ? <Text style={{ color: C.warn, fontSize: 12 }}>{msg}</Text> : null}

        {tab === 'cut' ? <>
          <View style={st.row}>
            <Btn small title="⇤ Inicio aquí" onPress={() => setCap(Ops.setTrimStart(cap, t))} />
            <Btn small title="Fin aquí ⇥" onPress={() => setCap(Ops.setTrimEnd(cap, t))} />
            <Btn small kind="ghost" title="Quitar recorte" onPress={() => setCap(Ops.resetTrim(cap))} />
          </View>
          <View style={st.row}>
            <Btn small title="✂ Dividir aquí (nueva toma)" onPress={() => setCap(Ops.addCut(cap, t))} />
          </View>
          {cap.edits.cuts.map((c, i) => <View key={i} style={st.row}><Muted>Corte en {f1(c)}</Muted><Btn small kind="ghost" title="✕" onPress={() => setCap(Ops.removeCut(cap, i))} /><Btn small kind="ghost" title="Ir" onPress={() => seek(c)} /></View>)}
          <Field label="Velocidad"><Seg value={cap.edits.speed} onChange={(v) => setCap(Ops.setEdit(cap, { speed: v }))} options={[[0.5, '×0,5'], [0.75, '×0,75'], [1, '×1'], [1.5, '×1,5'], [2, '×2']]} /></Field>
          {Ops.takesOf(cap).map((k, i) => <Muted key={i}>• {k.name}: {f1(k.t0)}–{f1(k.t1)} → {f1(k.duration)}</Muted>)}
        </> : null}

        {tab === 'move' ? <>
          <Field label="Suavizado" hint="Quita el temblor de la IA. Demasiado hace los movimientos rápidos más lentos."><Range value={cap.edits.smooth} min={0} max={1} step={0.05} onDone={(v) => setCap(Ops.setEdit(cap, { smooth: v }))} /></Field>
          <Field label="Espejo"><Seg value={cap.edits.mirror} onChange={(v) => setCap(Ops.setEdit(cap, { mirror: v }))} options={[[false, 'No'], [true, 'Izquierda ↔ derecha']]} /></Field>
          <Muted>Los puntos que la cámara no ve bien (poca visibilidad) se rellenan solos con los fotogramas vecinos. Los ejes se calibran con tu postura del primer segundo: empieza de frente y erguido.</Muted>
        </> : null}

        {tab === 'cam' ? <>
          <Muted>La cámara del Timeline: posición del encuadre + hacia dónde apuntas con el móvil. En Century se ancla al actor.</Muted>
          <View style={[st.row, { flexWrap: 'wrap' }]}>{Object.entries(Ops.SHOTS).map(([k, s]) => <Btn key={k} small kind="ghost" title={s.label} onPress={() => { setRig(s.rig); setCap(Ops.setCameraKey(cap, t, Ops.rigKey(s.rig))) }} />)}</View>
          <Field label="Distancia"><Range value={rig.dist} min={0.6} max={10} step={0.1} onChange={(v) => setRig({ ...rig, dist: v })} fmt={(v) => v.toFixed(1) + ' m'} /></Field>
          <Field label="Altura"><Range value={rig.height} min={0.1} max={6} step={0.05} onChange={(v) => setRig({ ...rig, height: v })} fmt={(v) => v.toFixed(2) + ' m'} /></Field>
          <Field label="Ángulo"><Range value={rig.angle} min={-180} max={180} step={1} onChange={(v) => setRig({ ...rig, angle: v })} fmt={(v) => Math.round(v) + '°'} /></Field>
          <Field label="Zoom"><Range value={zoom} min={1} max={4} step={0.1} onChange={setZoom} fmt={(v) => '×' + v.toFixed(1)} /></Field>
          <View style={[st.row, { flexWrap: 'wrap' }]}>
            <Btn small title="◆ Clave aquí" onPress={() => setCap(Ops.setCameraKey(cap, t, { ...Ops.rigKey(rig), fov: 2 * Math.atan(Math.tan(((rig.fov ?? 50) * Math.PI) / 360) / zoom) * 180 / Math.PI }))} />
            <Btn small kind="ghost" title="Borrar clave cercana" onPress={() => setCap(Ops.removeCameraKeyNear(cap, t))} />
            <Btn small kind="ghost" title={view === 'rig' ? 'Ver la toma' : 'Ver encuadre'} onPress={() => setView(view === 'rig' ? 'camera' : 'rig')} />
          </View>
          {pass ? <Btn kind="danger" title="■ Parar pase de cámara" onPress={finishPass} />
            : <Btn kind="primary" title="● Grabar pase de cámara con el móvil" disabled={!dev.available()} onPress={startPass} />}
          <Muted>{dev.available() ? 'Apunta al frente y pulsa: se reproduce la toma y se graba la orientación del móvil (giro, inclinación, alabeo) sobre el encuadre elegido.' : 'Este dispositivo no tiene sensores de orientación.'}</Muted>
          <Muted>{cap.camera.keys.length} claves de cámara.</Muted>
        </> : null}

        {tab === 'fx' ? <>
          <View style={[st.row, { flexWrap: 'wrap' }]}>{Object.entries(LAYER_KINDS).map(([k, d]) => <Btn key={k} small title={'+ ' + d.label} onPress={() => { const r = Ops.addLayer(cap, k, t); setCap(r.cap); setSel(r.id) }} />)}</View>
          {cap.layers.map((l) => <Btn key={l.id} small kind={sel === l.id ? 'primary' : 'ghost'} title={`${LAYER_KINDS[l.kind].label}${l.kind === 'text' ? ' «' + l.params.text + '»' : ''} · ${f1(l.t0)}–${f1(l.t1)}`} onPress={() => { setSel(l.id); seek(l.t0) }} style={{ alignItems: 'flex-start' }} />)}
          {layer ? <View style={st.box}>
            <Title style={{ fontSize: 14 }}>{LAYER_KINDS[layer.kind].label}</Title>
            <View style={st.row}><Btn small title="Empieza aquí" onPress={() => setCap(Ops.updateLayer(cap, layer.id, { t0: t }))} /><Btn small title="Acaba aquí" onPress={() => setCap(Ops.updateLayer(cap, layer.id, { t1: t }))} /><Btn small kind="danger" title="Eliminar" onPress={() => { setCap(Ops.removeLayer(cap, layer.id)); setSel(null) }} /></View>
            {layer.kind === 'text' ? <>
              <Input value={String(layer.params.text)} onChangeText={(v) => setCap(Ops.updateLayer(cap, layer.id, { params: { text: v } }))} placeholder="Texto del subtítulo" />
              <Field label="Posición"><Seg value={layer.params.pos} onChange={(v) => setCap(Ops.updateLayer(cap, layer.id, { params: { pos: v } }))} options={[['bottom', 'Abajo'], ['center', 'Centro'], ['top', 'Arriba']]} /></Field>
            </> : null}
            {layer.kind === 'fade' ? <Field label="Fundido"><Seg value={layer.params.dir} onChange={(v) => setCap(Ops.updateLayer(cap, layer.id, { params: { dir: v } }))} options={[['out', 'A negro'], ['in', 'Desde negro']]} /></Field> : null}
            {layer.kind === 'letterbox' ? <Field label="Alto barras"><Range value={+layer.params.percent} min={2} max={25} step={1} onDone={(v) => setCap(Ops.updateLayer(cap, layer.id, { params: { percent: v } }))} fmt={(v) => Math.round(v) + ' %'} /></Field> : null}
            {layer.kind === 'shake' ? <Field label="Intensidad"><Range value={+layer.params.amount} min={0.2} max={6} step={0.1} onDone={(v) => setCap(Ops.updateLayer(cap, layer.id, { params: { amount: v } }))} fmt={(v) => v.toFixed(1) + '°'} /></Field> : null}
          </View> : <Muted>Coloca el cabezal y añade un efecto; toca una capa para editarla.</Muted>}
        </> : null}

        {tab === 'out' ? <>
          <Field label="Nombre"><Input value={cap.name} onChangeText={(v) => setCap({ ...cap, name: v })} /></Field>
          {Ops.takesOf(cap).map((k, i) => <Muted key={i}>• {k.name} — {f1(k.duration)}</Muted>)}
          <Btn kind="primary" title="Compartir .lfcap (Drive, WhatsApp, USB…)" onPress={() => shareCapture(cap).then(() => setMsg('Archivo listo. En Century: panel Animación → «📱 Importar .lfcap…»')).catch((e) => setMsg(e.message))} />
          <Muted>En Century eliges el modelo con huesos y el actor de la escena: cada toma se convierte en un clip de animación y en una cinemática (Timeline) con esta cámara y estos efectos.</Muted>
        </> : null}
      </ScrollView>
    </View>
  )
}
const st = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 },
  name: { color: C.text, fontSize: 15, fontWeight: '700', flex: 1 },
  transport: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: C.panel },
  time: { color: C.text, fontVariant: ['tabular-nums'], fontSize: 13 },
  tabs: { flexDirection: 'row', gap: 4, padding: 6, flexWrap: 'wrap', borderBottomWidth: 1, borderColor: C.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  box: { backgroundColor: C.panel, borderRadius: 8, padding: 10, gap: 8, borderWidth: 1, borderColor: C.line },
})

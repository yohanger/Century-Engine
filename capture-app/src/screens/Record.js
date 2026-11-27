// Grabar: el cuerpo con la cámara (MediaPipe) o con el actor simulado y, si quieres, la orientación del móvil como cámara virtual.
// Consejo: para el cuerpo deja el móvil quieto (trípode o apoyado) a 2–3 m; la cámara virtual se graba mejor después, en el editor.
import React, { useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native'
import { useAwake } from '../ui/awake.js'
import { newCapture } from '../core/format.js'
import { r4 } from '../core/math.js'
import { CameraPose, cameraSupported, cameraError } from '../pose/camera'
import { useSimulatedPose } from '../pose/simulated.js'
import { useDeviceCamera } from '../pose/sensors.js'
import { saveCapture } from '../storage'
import { Btn, Seg, Muted, Input } from '../ui/kit.js'
import StickView, { OverlayStick } from '../ui/StickView.js'
import { floorOf } from '../ui/stage.js'
import { calibrate, toCanonical } from '../core/edit.js'
import { C } from '../theme.js'

const DEFAULT_CAM = [0, 1.5, 3.5]

export default function Record({ go }) {
  useAwake()
  const { width, height } = useWindowDimensions()
  const [source, setSource] = useState(cameraSupported() ? 'camera' : 'sim')
  const [facing, setFacing] = useState('back')
  const [withCam, setWithCam] = useState(false)
  const [name, setName] = useState(() => { const d = new Date(); return `Captura ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}` })
  const [state, setState] = useState('idle') // idle · countdown · rec · saving
  const [count, setCount] = useState(0), [elapsed, setElapsed] = useState(0), [nFrames, setNFrames] = useState(0), [fps, setFps] = useState(0)
  const [image, setImage] = useState(null), [preview, setPreview] = useState(null)
  const cap = useRef(null), t0 = useRef(0), lastCam = useRef(0), fpsWin = useRef([])
  const dev = useDeviceCamera(withCam)

  const onPose = (p, img) => {
    const now = Date.now()
    fpsWin.current.push(now); while (fpsWin.current.length && now - fpsWin.current[0] > 1000) fpsWin.current.shift()
    setImage(img)
    if (!img) { // vista previa del actor simulado
      const c = toCanonical([{ t: 0, p }], calibrate([{ t: 0, p }]))[0]
      setPreview(c)
    }
    if (state !== 'rec' || !cap.current) return
    const t = (now - t0.current) / 1000
    cap.current.body.frames.push({ t: r4(t), p: p.map(r4) })
    if (withCam && now - lastCam.current > 100) {
      lastCam.current = now
      const r = dev.read()
      if (r) cap.current.camera.keys.push({ t: r4(t), pos: DEFAULT_CAM, rot: r.map((v) => r4(v)), fov: 60 })
    }
  }
  useSimulatedPose(source === 'sim', onPose)

  useEffect(() => { const id = setInterval(() => { setFps(fpsWin.current.length); if (state === 'rec') { setElapsed((Date.now() - t0.current) / 1000); setNFrames(cap.current?.body.frames.length || 0) } }, 250); return () => clearInterval(id) }, [state])

  const start = () => {
    setState('countdown'); let n = 3; setCount(n)
    const id = setInterval(() => {
      n--; setCount(n)
      if (n > 0) return
      clearInterval(id)
      cap.current = newCapture(name.trim() || 'Captura', { source })
      if (withCam) dev.zero()
      t0.current = Date.now(); lastCam.current = 0
      setState('rec')
    }, 1000)
  }
  const stop = async () => {
    const c = cap.current; setState('saving')
    if (!c || c.body.frames.length < 5) { setState('idle'); return }
    if (!c.camera.keys.length) c.camera.keys.push({ t: 0, pos: DEFAULT_CAM, rot: [0, 0, 0], fov: 60 })
    const saved = await saveCapture(c)
    go('editor', saved.id)
  }
  const vw = width, vh = Math.min(height * 0.62, width * 1.4)
  return (
    <View style={{ flex: 1 }}>
      <View style={st.bar}>
        <Btn small kind="ghost" title="‹ Biblioteca" onPress={() => go('home')} disabled={state === 'rec'} />
        <Seg value={source} onChange={setSource} options={[['camera', 'Cámara'], ['sim', 'Simulado']]} />
        {source === 'camera' ? <Seg value={facing} onChange={setFacing} options={[['back', 'Trasera'], ['front', 'Frontal']]} /> : null}
      </View>
      <View style={{ width: vw, height: vh, backgroundColor: '#000' }}>
        {source === 'camera' && cameraSupported() ? (
          <>
            <CameraPose style={{ width: vw, height: vh }} facing={facing} onPose={onPose} onError={(e) => console.warn(e)} />
            <OverlayStick image={image} width={vw} height={vh} mirror={false} />
          </>
        ) : source === 'camera' ? (
          <View style={st.center}><Text style={{ color: C.warn, textAlign: 'center', padding: 20 }}>La cámara con IA necesita la app instalada como APK o build de desarrollo (no Expo Go).{'\n'}{cameraError()}</Text></View>
        ) : (
          <StickView frame={preview} floor={preview ? floorOf([preview]) : -1} width={vw} height={vh} />
        )}
        {state === 'countdown' ? <View style={st.center}><Text style={st.count}>{count}</Text></View> : null}
        {state === 'rec' ? <View style={st.recTag}><View style={st.dot} /><Text style={st.recT}>{elapsed.toFixed(1)} s · {nFrames} fot.</Text></View> : null}
        <Text style={st.fps}>{fps} fps</Text>
      </View>
      <View style={{ padding: 12, gap: 10 }}>
        <Input value={name} onChangeText={setName} placeholder="Nombre de la captura" editable={state === 'idle'} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Seg value={withCam} onChange={setWithCam} options={[[false, 'Solo cuerpo'], [true, 'Cuerpo + cámara del móvil']]} />
        </View>
        <Muted>{withCam ? 'Se grabará también hacia dónde apunta el móvil (cámara virtual en mano).' : 'Deja el móvil quieto a 2–3 m, con todo el cuerpo a la vista. La cámara virtual puedes grabarla después en el editor.'}</Muted>
        {state === 'rec' ? <Btn kind="danger" title="■ Parar y guardar" onPress={stop} /> : <Btn testID="rec" kind="primary" title={state === 'idle' ? '● Grabar (cuenta atrás 3 s)' : state === 'saving' ? 'Guardando…' : '…'} disabled={state !== 'idle' || (source === 'camera' && !cameraSupported())} onPress={start} />}
      </View>
    </View>
  )
}
const st = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, flexWrap: 'wrap' },
  center: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  count: { color: '#fff', fontSize: 96, fontWeight: '800', textShadowColor: '#000', textShadowRadius: 8 },
  recTag: { position: 'absolute', left: 10, top: 10, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#000a', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.rec },
  recT: { color: '#fff', fontSize: 12, fontWeight: '600' },
  fps: { position: 'absolute', right: 8, top: 8, color: '#fffa', fontSize: 11 },
})

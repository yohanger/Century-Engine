// Fuente «Cámara»: MediaPipe Pose (react-native-mediapipe + react-native-vision-camera) sobre la cámara del móvil.
// Necesita una build de desarrollo o un APK (no funciona en Expo Go): ver README. Si los módulos nativos no están, la app
// lo detecta y ofrece la fuente «Simulado».
import React, { useEffect, useMemo, useRef } from 'react'
import { Text, View } from 'react-native'
import { C } from '../theme.js'

export const MODEL = 'pose_landmarker_full.task' // copiado a android/app/src/main/assets por plugins/withPoseModel.js

let MP = null, VC = null, loadError = ''
try {
  MP = require('react-native-mediapipe')
  VC = require('react-native-vision-camera')
  if (!MP?.usePoseDetection || !MP?.MediapipeCamera) throw new Error('react-native-mediapipe sin detección de pose')
} catch (e) { MP = null; loadError = String(e?.message || e) }

export const cameraSupported = () => !!MP
export const cameraError = () => loadError

/** Landmarks de MediaPipe → p plano [x,y,z,vis]×33 (los worldLandmarks están en metros, centrados en la cadera). */
export function toFlat(lms) {
  const p = new Array(33 * 4)
  for (let i = 0; i < 33; i++) {
    const l = lms[i] || {}
    p[i * 4] = +l.x || 0; p[i * 4 + 1] = +l.y || 0; p[i * 4 + 2] = +l.z || 0
    p[i * 4 + 3] = l.visibility ?? l.presence ?? 1
  }
  return p
}

/**
 * Vista de cámara con detección de pose. onPose(world:number[132], image:number[132]) por cada resultado.
 * `image` son las coordenadas normalizadas (0–1) sobre la imagen, para dibujar el esqueleto encima de la vista.
 */
export function CameraPose({ onPose, onError, facing = 'back', style }) {
  const perm = VC.useCameraPermission()
  useEffect(() => { if (!perm.hasPermission) perm.requestPermission() }, [perm.hasPermission])
  const cb = useRef({ onPose, onError }); cb.current = { onPose, onError }
  const callbacks = useMemo(() => ({
    onResults: (r) => {
      const res = r?.results?.[0]
      const w = res?.worldLandmarks?.[0], n = res?.landmarks?.[0]
      if (w && w.length >= 33) cb.current.onPose?.(toFlat(w), n && n.length >= 33 ? toFlat(n) : null)
    },
    onError: (e) => cb.current.onError?.(e),
  }), [])
  const solution = MP.usePoseDetection(callbacks, MP.RunningMode.LIVE_STREAM, MODEL, {
    numPoses: 1, delegate: MP.Delegate.GPU, mirrorMode: 'mirror-front-only', fpsMode: 30,
    minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
  })
  if (!perm.hasPermission) return <View style={[style, { alignItems: 'center', justifyContent: 'center' }]}><Text style={{ color: C.muted }}>Hace falta permiso para usar la cámara.</Text></View>
  return <MP.MediapipeCamera style={style} solution={solution} activeCamera={facing} resizeMode="cover" />
}

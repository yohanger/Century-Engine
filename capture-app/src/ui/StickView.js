// Muñeco de palitos en SVG con suelo y la cámara virtual.
import React from 'react'
import Svg, { Line, Circle, Rect, Text as SvgText } from 'react-native-svg'
import { STICKS, J } from '../core/format.js'
import { stagePoints, projector } from './stage.js'
import { C } from '../theme.js'

const SIDE = (a, b) => (a.startsWith('left') || b.startsWith('left') ? C.accent2 : a.startsWith('right') || b.startsWith('right') ? C.warn : C.text)
const GRID = []
for (let i = -3; i <= 3; i++) { GRID.push([[i, 0, -3], [i, 0, 3]]); GRID.push([[-3, 0, i], [3, 0, i]]) }

export default function StickView({ frame, floor = -1, view = 'front', camKey, width, height, letterbox = 0, caption = '', fade = 0 }) {
  const pr = projector(view, width, height, camKey)
  const pts = frame ? stagePoints(frame, floor) : null
  const seg = (a, b, key, color, sw) => {
    const A = pr(a), B = pr(b)
    if (!A || !B) return null
    return <Line key={key} x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]} stroke={color} strokeWidth={sw} strokeLinecap="round" />
  }
  const head = pts && pr(pts[J.nose])
  const bar = (height * letterbox) / 100
  return (
    <Svg width={width} height={height}>
      <Rect x={0} y={0} width={width} height={height} fill="#101215" />
      {GRID.map((g, i) => seg(g[0], g[1], 'g' + i, '#2a2e35', 1))}
      {view !== 'camera' && camKey ? (() => { const P = pr(camKey.pos); return P ? <Circle cx={P[0]} cy={P[1]} r={6} fill={C.cam} /> : null })() : null}
      {pts && STICKS.map(([a, b], i) => seg(pts[J[a]], pts[J[b]], 's' + i, SIDE(a, b), 3))}
      {head ? <Circle cx={head[0]} cy={head[1]} r={Math.max(4, height * 0.025)} fill={C.text} /> : null}
      {fade > 0 ? <Rect x={0} y={0} width={width} height={height} fill="#000" opacity={fade} /> : null}
      {bar > 0 ? <><Rect x={0} y={0} width={width} height={bar} fill="#000" /><Rect x={0} y={height - bar} width={width} height={bar} fill="#000" /></> : null}
      {caption ? <SvgText x={width / 2} y={height * 0.86} fill="#fff" fontSize={15} fontWeight="600" fontFamily="sans-serif" stroke="#000" strokeWidth={0.6} textAnchor="middle">{caption}</SvgText> : null}
      {!frame ? <SvgText x={width / 2} y={height / 2} fill={C.muted} fontSize={13} fontFamily="sans-serif" textAnchor="middle">Sin cuerpo detectado</SvgText> : null}
    </Svg>
  )
}

/** Esqueleto sobre la imagen de la cámara (coordenadas normalizadas 0–1 de MediaPipe). */
export function OverlayStick({ image, width, height, mirror }) {
  if (!image) return null
  const P = (j) => [(mirror ? 1 - image[j * 4] : image[j * 4]) * width, image[j * 4 + 1] * height]
  return (
    <Svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }}>
      {STICKS.map(([a, b], i) => { const A = P(J[a]), B = P(J[b]); return <Line key={i} x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]} stroke={SIDE(a, b)} strokeWidth={4} strokeLinecap="round" /> })}
    </Svg>
  )
}

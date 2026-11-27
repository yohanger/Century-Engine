import * as THREE from 'three'
import { registerNode } from './registry.js'
import { makeRoot, applyBase } from './three-helpers.js'
import { CANVAS_PPU, normalizeCanvas } from './canvas.js'

// Sprites: una IMAGEN del proyecto como nodo.
//   · Sprite 3D (sprite3d): un plano con la imagen en el mundo (de frente, o siempre mirando a la cámara). Su tamaño sale de la
//     imagen: ancho = píxeles × «Tamaño del píxel» (m). Para planos de referencia (el plano de una casa para modelar), carteles,
//     personajes planos al estilo RPG Maker…
//   · Sprite 2D (sprite2d): una imagen en la PANTALLA. Vive dentro de un Canvas (si no hay, se crea uno): en el editor se dibuja
//     sobre el rectángulo del Canvas (50 px = 1 unidad) y al jugar se pinta encima del juego, escalada como el Canvas.
// Los dos tienen la variante «Lienzo de píxeles»: nacen con una imagen en blanco y Tab (con el nodo elegido) entra a PINTAR en
// ella con herramientas de pixel art (core/paint/). Una imagen importada también se puede pintar.
// Nada de esto depende de un motor externo: el juego exportado usa los mismos datos.

export const SPRITE3D_DEFAULTS = { image: '', pixelSize: 0.01, billboard: 'none', doubleSided: true, unshaded: true, filter: 'smooth', alphaCut: 0.05, flipX: false, flipY: false, pivotX: 0.5, pivotY: 1, paintW: 64, paintH: 64 }
export const SPRITE2D_DEFAULTS = { image: '', layer: 10, filter: 'smooth', flipX: false, flipY: false, paintW: 64, paintH: 64 }
export const BILLBOARD = [['none', 'No (plano fijo)'], ['y', 'Gira en vertical hacia la cámara'], ['full', 'Siempre de frente a la cámara']]
export const FILTERS = [['smooth', 'Suave'], ['pixel', 'Píxeles nítidos (pixel art)']]

const num = (v, d, min = -Infinity, max = Infinity) => (Number.isFinite(+v) ? Math.min(max, Math.max(min, +v)) : d)
export function normalizeSprite(p = {}, two = false) {
  const D = two ? SPRITE2D_DEFAULTS : SPRITE3D_DEFAULTS
  const o = { ...D }
  o.image = typeof p.image === 'string' ? p.image : ''
  o.filter = FILTERS.some(([k]) => k === p.filter) ? p.filter : D.filter
  o.flipX = !!p.flipX; o.flipY = !!p.flipY
  o.paintW = Math.round(num(p.paintW, D.paintW, 1, 2048)); o.paintH = Math.round(num(p.paintH, D.paintH, 1, 2048))
  if (two) o.layer = num(p.layer, D.layer, -100, 1000)
  else {
    o.pixelSize = num(p.pixelSize, D.pixelSize, 0.0001, 10)
    o.billboard = BILLBOARD.some(([k]) => k === p.billboard) ? p.billboard : D.billboard
    o.doubleSided = p.doubleSided !== false; o.unshaded = p.unshaded !== false
    o.alphaCut = num(p.alphaCut, D.alphaCut, 0, 1)
    o.pivotX = p.pivotX == null ? D.pivotX : num(p.pivotX, D.pivotX, 0, 1)
    o.pivotY = p.pivotY == null ? D.pivotY : num(p.pivotY, D.pivotY, 0, 1)
  }
  return o
}

/** Tamaño en unidades de la escena de un sprite con una imagen de w×h píxeles (sin la escala del nodo). */
export const spriteSize = (obj, w, h) => (obj.type === 'sprite2d' ? [w / CANVAS_PPU, h / CANVAS_PPU] : [w * normalizeSprite(obj.props).pixelSize, h * normalizeSprite(obj.props).pixelSize])

/**
 * Posición en la pantalla de un Sprite 2D: centro en píxeles de la resolución de referencia de su Canvas (origen arriba a la
 * izquierda). El origen del Canvas está en el centro de su borde inferior; sin Canvas se usa uno de 1920×1080 en el origen.
 */
export function sprite2dScreen(obj, canvasObj) {
  const c = canvasObj ? normalizeCanvas(canvasObj.props) : { refW: 1920, refH: 1080 }
  const [x, y] = obj.position
  return { refW: c.refW, refH: c.refH, x: c.refW / 2 + x * CANVAS_PPU, y: c.refH - y * CANVAS_PPU, rot: -(obj.rotation?.[2] || 0), sx: obj.scale?.[0] ?? 1, sy: obj.scale?.[1] ?? 1 }
}

/** Mesh del sprite (plano 1×1 que se escala al tamaño de la imagen). Lo usan los dos nodos y el gráfico «Sprite» de un evento. */
export function makeSpriteMesh() {
  const mat = new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, alphaTest: 0.05, color: 0xffffff })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat)
  mesh.userData.ownMaterial = true
  mesh.userData.isSprite = true
  return mesh
}

const _q = new THREE.Quaternion(), _e = new THREE.Euler()
/** Aplica imagen, tamaño, filtro, volteo, sombreado y «mirar a la cámara» al mesh de un sprite. */
export function applySprite(mesh, obj, tex) {
  const two = obj.type === 'sprite2d'
  const p = normalizeSprite(obj.props, two)
  const w = tex?.image?.width || p.paintW, h = tex?.image?.height || p.paintH
  const [sw, sh] = spriteSize(obj, w, h)
  mesh.scale.set(sw * (p.flipX ? -1 : 1), sh * (p.flipY ? -1 : 1), 1)
  // Origen normalizado arriba a la izquierda. El valor legado (0.5, 1) conserva el pie del sprite.
  // Flip altera la orientación de la imagen, pero no mueve el anclaje respecto al nodo.
  mesh.position.set(two ? 0 : (0.5 - p.pivotX) * sw, two ? 0 : (p.pivotY - 0.5) * sh, 0)
  const wantBasic = two || p.unshaded
  if (wantBasic !== mesh.material.isMeshBasicMaterial) {
    mesh.material.dispose()
    mesh.material = wantBasic ? new THREE.MeshBasicMaterial({ transparent: true }) : new THREE.MeshStandardMaterial({ transparent: true, roughness: 0.9 })
  }
  const m = mesh.material
  if (tex) {
    const nearest = p.filter === 'pixel'
    tex.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter
    tex.minFilter = nearest ? THREE.NearestFilter : THREE.LinearMipmapLinearFilter
    tex.generateMipmaps = !nearest
    tex.needsUpdate = true
  }
  m.map = tex || null
  m.color.set(tex ? (two ? '#ffffff' : obj.color || '#ffffff') : '#7a8496') // el 2D no lleva tinte (en pantalla se ve la imagen tal cual)
  m.opacity = obj.opacity ?? 1
  m.side = two || p.doubleSided ? THREE.DoubleSide : THREE.FrontSide
  m.alphaTest = two ? 0.01 : p.alphaCut
  m.depthWrite = !two
  m.needsUpdate = true
  // sin imagen: un rectángulo gris con borde (se ve dónde está)
  mesh.userData.empty = !tex
  // mirar a la cámara (editor y juego): se orienta justo antes de dibujarse
  const bb = two ? 'none' : p.billboard
  mesh.onBeforeRender = bb === 'none' ? () => {} : (r, s, cam) => {
    const parent = mesh.parent
    if (!parent) return
    parent.getWorldQuaternion(_q).invert()
    if (bb === 'full') mesh.quaternion.copy(_q.multiply(cam.quaternion))
    else { _e.setFromQuaternion(cam.quaternion, 'YXZ'); mesh.quaternion.copy(_q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, _e.y, 0)))) }
    mesh.updateMatrixWorld(true)
  }
  if (bb === 'none') mesh.quaternion.identity()
}

function frameFor(mesh) {
  const g = new THREE.EdgesGeometry(new THREE.PlaneGeometry(1, 1))
  const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x9fb4d0, transparent: true, opacity: 0.6 }))
  l.raycast = () => {}
  mesh.add(l)
  return l
}

function def(type, two) {
  return {
    type,
    label: two ? 'Sprite 2D' : 'Sprite 3D',
    icon: two ? 'sprite2d' : 'sprite3d',
    category: two ? 'Interfaz' : 'Visuales',
    scalable: true,
    visualAnimationFields: {
      image: {label:'Imagen',kind:'string',def:''},
      filter: {label:'Filtro',kind:'enum',def:'smooth',options:['smooth','pixel']},
      flipX: {label:'Voltear X',kind:'bool',def:false},
      flipY: {label:'Voltear Y',kind:'bool',def:false},
      ...(two ? {
        layer: {label:'Capa',kind:'number',def:10,min:-100,max:1000},
      } : {
        pixelSize: {label:'Tamaño del píxel',kind:'number',def:0.01,min:0.0001,max:10},
        billboard: {label:'Mirar cámara',kind:'enum',def:'none',options:['none','y','full']},
        doubleSided: {label:'Doble cara',kind:'bool',def:true},
        unshaded: {label:'Sin sombreado',kind:'bool',def:true},
        alphaCut: {label:'Recorte alfa',kind:'number',def:0.05,min:0,max:1},
        pivotX: {label:'Pivote X',kind:'number',def:0.5,min:0,max:1},
        pivotY: {label:'Pivote Y',kind:'number',def:1,min:0,max:1},
        color: {label:'Tinte',kind:'color',def:'#ffffff',scope:'object'},
      }),
    },
    kinds: two
      ? { sprite2d: { label: 'Sprite 2D (imagen en pantalla)', icon: 'sprite2d' }, paint: { label: 'Lienzo de píxeles 2D', icon: 'pixel' } }
      : { sprite3d: { label: 'Sprite 3D (imagen en el mundo)', icon: 'sprite3d' }, paint: { label: 'Lienzo de píxeles 3D', icon: 'pixel3d' } },
    create(kind) {
      const paint = kind === 'paint'
      const props = { ...(two ? SPRITE2D_DEFAULTS : SPRITE3D_DEFAULTS), ...(paint ? { filter: 'pixel', ...(two ? {} : { pixelSize: 1 / 32 }) } : {}), newCanvas: paint }
      return { name: paint ? (two ? 'Lienzo 2D' : 'Lienzo 3D') : two ? 'Sprite 2D' : 'Sprite 3D', color: '#ffffff', collision: false, castShadow: false, props }
    },
    build(obj, ctx) {
      const { root, visual } = makeRoot(obj)
      const mesh = makeSpriteMesh()
      visual.add(mesh)
      root.userData.body = mesh
      root.userData.frame = frameFor(mesh)
      root.userData.ctx = ctx
      return root
    },
    update(root, obj) {
      applyBase(root, obj, true)
      const u = root.userData
      const p = normalizeSprite(obj.props, two)
      // al pintar, la imagen viva del lienzo (core/paint) sustituye a la guardada
      const tex = u.liveTex || (p.image && u.ctx?.getSpriteTexture ? u.ctx.getSpriteTexture(p.image) : null)
      applySprite(u.body, obj, tex)
      u.frame.visible = !tex || !!u.liveTex
    },
  }
}

export const Sprite3D = registerNode(def('sprite3d', false))
export const Sprite2D = registerNode(def('sprite2d', true))

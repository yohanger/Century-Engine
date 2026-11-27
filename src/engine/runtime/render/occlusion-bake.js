import * as THREE from 'three'
import { OCCLUSION_BAKE_VERSION, occluderMesh, occluderSide, visitStaticMeshes, worldBounds } from './occlusion-static.js'
import { meshOcclusionPatches, meshOcclusionSignature } from './occlusion-patches.js'

const MAX_CELLS = 4096
const MAX_PAIRS = 2_000_000
const MAX_PROJECTIONS = 24_000_000
const INITIAL_CELL_SIZE = 2
const GRID_PADDING = 8
const GPU_BATCH_PATCHES = 64
const GPU_BATCH_MESHES = 512

const vertexShader = /* glsl */ `
  in vec3 position;
  void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`

// El volumen del oclusor es una superficie interior acreditada por triángulos,
// no la caja envolvente de una malla posiblemente recortada.
const fragmentShader = /* glsl */ `
  precision highp float;
  precision highp int;
  precision highp sampler2D;
  uniform sampler2D boundsData;
  uniform sampler2D inverseData;
  uniform int occluderCount;
  uniform int firstMesh;
  uniform int firstCell;
  uniform int cellCount;
  uniform ivec3 dimensions;
  uniform vec3 gridOrigin;
  uniform float cellSize;
  out vec4 result;

  void toLocal(vec3 center, vec3 extent, mat4x3 inverseBox, out vec3 mid, out vec3 rad) {
    mid = inverseBox * vec4(center, 1.0);
    mat3 basis = mat3(abs(inverseBox[0]), abs(inverseBox[1]), abs(inverseBox[2]));
    rad = basis * extent + vec3(0.0001) +
      0.000002 * (basis * (abs(center) + extent) + abs(inverseBox[3]));
  }

  bool covers(vec3 eye, vec3 eyeRad, vec3 target, vec3 targetRad) {
    // Solo el plano de la superficie real bloquea; los laterales del proxy no lo hacen.
    int axis = 2;
    float side = sign(eye[axis]);
    float eyeDistance = side * eye[axis] - 0.5;
    float targetDistance = 0.5 - side * target[axis];
    if (eyeDistance <= eyeRad[axis] || targetDistance <= targetRad[axis]) return false;
    float s0 = eyeDistance - eyeRad[axis];
    float s1 = eyeDistance + eyeRad[axis];
    float t0 = s0 / (s0 + targetDistance + targetRad[axis]);
    float t1 = s1 / (s1 + targetDistance - targetRad[axis]);
    vec3 low = min(mix(eye - eyeRad, target - targetRad, t0), mix(eye - eyeRad, target - targetRad, t1));
    vec3 high = max(mix(eye + eyeRad, target + targetRad, t0), mix(eye + eyeRad, target + targetRad, t1));
    return low.x > -0.499 && low.y > -0.499 && high.x < 0.499 && high.y < 0.499;
  }

  void main() {
    int mesh = int(gl_FragCoord.x);
    int cell = firstCell + int(gl_FragCoord.y);
    result = vec4(0.0);
    if (cell >= cellCount) return;
    result.a = 1.0;

    int layerSize = dimensions.x * dimensions.y;
    ivec3 coord = ivec3(cell % dimensions.x, (cell / dimensions.x) % dimensions.y, cell / layerSize);
    vec3 eye = gridOrigin + (vec3(coord) + 0.5) * cellSize;
    vec3 area = vec3(cellSize * 0.5) + 0.000002 * (abs(gridOrigin) + abs(eye) + vec3(cellSize));
    vec3 target = texelFetch(boundsData, ivec2(mesh, 0), 0).xyz;
    vec3 extent = texelFetch(boundsData, ivec2(mesh, 1), 0).xyz;
    for (int i = 0; i < occluderCount; ++i) {
      vec4 first = texelFetch(inverseData, ivec2(i, 0), 0);
      if (int(first.w) == mesh + firstMesh) continue;
      vec4 second = texelFetch(inverseData, ivec2(i, 1), 0);
      vec4 third = texelFetch(inverseData, ivec2(i, 2), 0);
      vec3 offset = texelFetch(inverseData, ivec2(i, 3), 0).xyz;
      mat4x3 box = mat4x3(first.xyz, second.xyz, third.xyz, offset);
      vec3 localEye, eyeRad, localTarget, targetRad;
      toLocal(eye, area, box, localEye, eyeRad);
      if (int(second.w) == 0 && localEye.z < 0.5 + eyeRad.z) continue;
      toLocal(target, extent, box, localTarget, targetRad);
      if (covers(localEye, eyeRad, localTarget, targetRad)) {
        int id = i + 1;
        result = vec4(float(id % 256) / 255.0, float(id / 256) / 255.0, 0.0, 1.0);
        return;
      }
    }
  }
`

function gridFor(box, budget) {
  let size = INITIAL_CELL_SIZE
  const origin = box.min.toArray().map(value => value - GRID_PADDING)
  const extents = box.getSize(new THREE.Vector3()).toArray()
  for (;;) {
    const dimensions = extents.map(extent => Math.ceil((extent + 2 * GRID_PADDING) / size))
    const count = dimensions.reduce((product, dimension) => product * dimension, 1)
    if (count <= budget) return { origin, dimensions, size, count }
    size *= 2
  }
}

function dataTexture(width, height) {
  const texture = new THREE.DataTexture(new Float32Array(width * height * 4), width, height, THREE.RGBAFormat, THREE.FloatType)
  texture.needsUpdate = true
  return texture
}

export function sceneOcclusionInputs(graph) {
  const bounds = new THREE.Box3()
  const meshBounds = new THREE.Box3()
  const meshes = [], patches = []
  graph.vp.scene.updateMatrixWorld(true)
  visitStaticMeshes(graph, (id, path, mesh) => {
    worldBounds(mesh, meshBounds, true)
    const limits = [...meshBounds.min, ...meshBounds.max]
    if (meshBounds.isEmpty() || !limits.every(n => Number.isFinite(n) && Math.abs(n) < 1e7)) return
    const index = meshes.length
    meshes.push({ id, path, limits, matrix: mesh.matrixWorld.toArray(), signature: meshOcclusionSignature(mesh) })
    bounds.union(meshBounds)
    if (!occluderMesh(mesh) || Math.abs(mesh.matrixWorld.determinant()) <= 1e-12) return
    const side = occluderSide(mesh)
    for (const surface of meshOcclusionPatches(mesh)) {
      const matrix = new THREE.Matrix4().fromArray(surface)
      if (Math.abs(matrix.determinant()) <= 1e-12) continue
      const elements = matrix.elements
      const u = new THREE.Vector3(elements[0],elements[1],elements[2])
      const v = new THREE.Vector3(elements[4],elements[5],elements[6])
      patches.push({ mesh: index, surface, side, area: u.clone().cross(v).length() })
    }
  })
  patches.sort((a,b) => b.area - a.area)
  return { meshes, occluders: patches.map(({ area, ...entry }) => entry), bounds }
}

/** Horneado GPU por lotes: ninguna malla estática se elimina por superar el tamaño de una textura. */
export async function bakeStaticOcclusion(graph, { onProgress = () => {}, signal } = {}) {
  const renderer = graph.vp.renderer
  const { meshes, occluders, bounds } = sceneOcclusionInputs(graph)
  const grid = meshes.length ? gridFor(bounds, Math.max(1,Math.min(MAX_CELLS,
    Math.floor(MAX_PAIRS / meshes.length),
    Math.floor(MAX_PROJECTIONS / Math.max(1, meshes.length * occluders.length))))) :
    { origin: [0,0,0], dimensions: [1,1,1], size: INITIAL_CELL_SIZE, count: 1 }
  const cells = Array(grid.count).fill(null)
  if (!meshes.length || !occluders.length) {
    onProgress(1)
    return { version: OCCLUSION_BAKE_VERSION, grid, meshes, occluders, cells, covered: 0 }
  }

  const maxSize = renderer.capabilities.maxTextureSize
  const meshSize = Math.max(1, Math.min(maxSize, GPU_BATCH_MESHES))
  const patchSize = Math.max(1, Math.min(maxSize, GPU_BATCH_PATCHES))
  const geometry = new THREE.PlaneGeometry(2,2)
  const material = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader, fragmentShader, depthTest:false, depthWrite:false,
    uniforms: {
      boundsData:{ value: null }, inverseData:{ value: null }, occluderCount:{ value:0 },
      firstMesh:{ value:0 }, firstCell:{ value:0 }, cellCount:{ value:grid.count },
      dimensions:{ value:new Int32Array(grid.dimensions) },
      gridOrigin:{ value:new THREE.Vector3(...grid.origin) }, cellSize:{ value:grid.size },
    },
  })
  const scene = new THREE.Scene(), quad = new THREE.Mesh(geometry, material)
  quad.frustumCulled = false
  scene.add(quad)
  const camera = new THREE.Camera()
  let covered = 0
  try {
    for (let meshStart = 0; meshStart < meshes.length; meshStart += meshSize) {
      const columns = Math.min(meshSize, meshes.length - meshStart)
      const boundsData = dataTexture(columns,2)
      for (let i=0; i<columns; i++) {
        const { limits } = meshes[meshStart+i]
        for (let axis=0; axis<3; axis++) {
          boundsData.image.data[i*4+axis] = (limits[axis]+limits[axis+3])/2
          boundsData.image.data[(columns+i)*4+axis] = (limits[axis+3]-limits[axis])/2
        }
      }
      boundsData.needsUpdate = true
      material.uniforms.boundsData.value = boundsData
      material.uniforms.firstMesh.value = meshStart
      try {
        for (let patchStart=0; patchStart<occluders.length; patchStart += patchSize) {
          const patchCount = Math.min(patchSize, occluders.length-patchStart)
          const inverseData = dataTexture(patchCount,4)
          const inverse = new THREE.Matrix4()
          for (let i=0; i<patchCount; i++) {
            const patch=occluders[patchStart+i]
            inverse.fromArray(patch.surface).invert()
            for (let col=0; col<4; col++) {
              const [x,y,z]=inverse.elements.slice(col*4,col*4+3)
              inverseData.image.data.set([x,y,z,col===0?patch.mesh:col===1?patch.side:0], (col*patchCount+i)*4)
            }
          }
          inverseData.needsUpdate = true
          material.uniforms.inverseData.value = inverseData
          material.uniforms.occluderCount.value = patchCount
          const rows = Math.max(1,Math.min(64,grid.count,Math.floor(200000/(columns*patchCount))))
          const target = new THREE.WebGLRenderTarget(columns,rows,{depthBuffer:false,stencilBuffer:false})
          const pixels = new Uint8Array(columns*rows*4)
          try {
            for (let start=0; start<grid.count; start+=rows) {
              signal?.throwIfAborted()
              const context=renderer.getContext()
              if (context.isContextLost()) throw new Error('Se perdió el contexto WebGL durante el horneado.')
              const previous=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel()
              const clearColor=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha()
              material.uniforms.firstCell.value=start
              try {
                renderer.setRenderTarget(target); renderer.setClearColor(0,0); renderer.clear(); renderer.render(scene,camera)
              } finally {
                renderer.setClearColor(clearColor,alpha); renderer.setRenderTarget(previous,face,mip)
              }
              const count=Math.min(rows,grid.count-start)
              pixels.fill(0)
              await renderer.readRenderTargetPixelsAsync(target,0,0,columns,count,pixels)
              signal?.throwIfAborted()
              for (let row=0;row<count;row++) {
                const cell=start+row
                for (let i=0;i<columns;i++) {
                  const offset=(row*columns+i)*4
                  if (pixels[offset+3]!==255) throw new Error('La GPU no pudo completar la pasada de oclusión.')
                  const witness=pixels[offset]+256*pixels[offset+1]
                  if (!witness || witness>patchCount) continue
                  const pair=cells[cell] ?? (cells[cell]=[]), meshIndex=meshStart+i
                  if (!pair.includes(meshIndex)) {pair.push(meshIndex,patchStart+witness-1);covered++}
                }
              }
              const fraction=(meshStart*occluders.length*grid.count + patchStart*columns*grid.count + columns*(start+count))/
                (meshes.length*occluders.length*grid.count)
              onProgress(Math.min(1,fraction))
            }
          } finally {target.dispose(); inverseData.dispose()}
        }
      } finally {boundsData.dispose()}
    }
  } finally {geometry.dispose();material.dispose()}
  onProgress(1)
  return { version:OCCLUSION_BAKE_VERSION,grid,meshes,occluders,cells,covered }
}

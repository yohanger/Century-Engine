import * as THREE from 'three'

const VERTEX = `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const FRAGMENT = `
  uniform float uCell;
  uniform vec3 uLineColor;
  uniform vec3 uMajorColor;
  varying vec3 vWorld;

  float gridCoverage(float spacing) {
    vec2 coordinate = vWorld.xz / spacing;
    vec2 footprint = max(fwidth(coordinate), vec2(0.00001));
    vec2 distanceToLine = abs(fract(coordinate - 0.5) - 0.5);
    vec2 coverage = 1.0 - smoothstep(vec2(0.0), footprint * 1.25, distanceToLine);
    return max(coverage.x, coverage.y);
  }

  void main() {
    float pixelFootprint = max(fwidth(vWorld.x), fwidth(vWorld.z));
    float minorWeight = smoothstep(1.5, 4.0, uCell / max(pixelFootprint, 0.00001));
    float minor = gridCoverage(uCell) * minorWeight;
    float major = gridCoverage(uCell * 10.0);
    float coverage = max(minor * 0.7, major);
    if (coverage < 0.005) discard;
    vec3 color = mix(uLineColor, uMajorColor, step(minor * 0.7, major));
    gl_FragColor = vec4(color, coverage * 0.55);
    #include <colorspace_fragment>
  }
`

export function createInfiniteGrid(cell = 1) {
  const geometry = new THREE.PlaneGeometry(2, 2)
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uCell: { value: 1 },
      uLineColor: { value: new THREE.Color(0x3a4150) },
      uMajorColor: { value: new THREE.Color(0x6a7385) },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    toneMapped: false,
  })
  const grid = new THREE.Mesh(geometry, material)
  grid.name = 'EditorGrid'
  grid.rotation.x = -Math.PI / 2
  grid.frustumCulled = false
  grid.renderOrder = -1
  const worldCameraPosition = new THREE.Vector3()
  grid.onBeforeRender = (_, __, camera) => {
    camera.getWorldPosition(worldCameraPosition)
    grid.position.set(worldCameraPosition.x, 0.002, worldCameraPosition.z)
    const orthoSpan = camera.isOrthographicCamera
      ? Math.hypot(camera.right - camera.left, camera.top - camera.bottom) / Math.max(camera.zoom || 1, 0.001)
      : 0
    const radius = Math.max(camera.far * 2, orthoSpan * 1.5, 2)
    grid.scale.set(radius, radius, 1)
    grid.updateMatrixWorld(true)
  }
  grid.setCellSize = (step) => {
    const cellSize = Number(step)
    material.uniforms.uCell.value = Number.isFinite(cellSize) && cellSize > 0 ? cellSize : 1
  }
  grid.setCellSize(cell)
  return grid
}

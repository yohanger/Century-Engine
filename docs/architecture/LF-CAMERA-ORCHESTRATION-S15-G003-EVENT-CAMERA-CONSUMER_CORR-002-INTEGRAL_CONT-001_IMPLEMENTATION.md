# LevelForge S15-G003 CORR-002 CONT-001 — Implementación de active/visible

**Gate autorizado literalmente:** `LF-CAMERA-ORCHESTRATION-S15-G003-EVENT-CAMERA-CONSUMER_CORR-002-INTEGRAL_CONT-001` (2026-11-09).  
**SOURCE_BASELINE de partida:** `LF_CAMERA_ORCHESTRATION_S15_G003_CORR002_PRELTS_CONTRACT_AMEND_G001_SOURCE_BASELINE.zip`.  
**Autoridad:** `LF-NODE-ACTIVE-VISIBLE-PRELTS-CA-001`, ratificado por usuario; no se permiten migradores ni QA de formatos históricos.  
**Estado:** implementado en fuentes, pendiente de compilación y QA local. **NO CERRADO**.

## Auditoría y reconciliación

**OBSERVADO:** el proyecto anterior expone `visible` para la cabecera del Inspector y para valores `Object3D.visible`; el render de gizmos de cámara se oculta al entrar a Play. `NodeHandle.visible` leía el objeto Three.js y podía informar `false` aunque la casilla siguiera marcada. La física Jolt, los eventos, scripts de nodo, Timeline, Camera3D, Terrain y audio también tenían ramas ligadas a visibilidad. La implementación previa, detenida por el usuario, contenía lógica de migración pre-LTS descartada.

**MECANISMO ACTUAL:** se reutiliza la jerarquía de nodos, el registro `NodeLifecycle`, `PlayMode`, la autoridad de cámara G002, la física `JoltWorld/BodySet/NodeSpatialRuntime` y la escena Terrain existente; no hay nuevos managers ni un segundo loop. La propiedad local `active` controla habilitación funcional; `visible` controla representación visual. Los padres determinan estados efectivos sin reescribir los hijos. En Play, los setters del handle son temporales y no serializan cambios del juego al editor.

### Reglas implementadas

| Área | active = false | visible = false, active = true |
|---|---|---|
| Inspector | Casilla azul desmarcada; subárbol efectivamente inactivo | Casilla Active intacta; control Visible independiente |
| NodeHandle | Getter/setter separados; consulta estado lógico, no gizmo | Getter lee propiedad lógica, no `Object3D.visible` editorial |
| Three.js | La representación propia no dibuja | La representación propia no dibuja |
| Scripts de nodo | `NodeLifecycle` excluye callbacks periódicos y cierra entradas | `_process` / `_physics_process` permanecen elegibles |
| Eventos | Se omiten disparadores normales de nodos inactivos | Los eventos siguen operativos |
| Jolt | Cuerpos planificados se retiran temporalmente del mundo físico y se reinsertan al reactivar | Los cuerpos y colisiones permanecen habilitados |
| Terrain | Malla, follaje, altura, raycast y colisión quedan excluidos | Malla y follaje no se dibujan; consulta de terreno y física se conservan |
| Camera3D | No elegible como fuente de salida | Elegible sin mostrar su representación editorial |
| AudioSource | La voz se suspende y reanuda mediante el sistema existente | El audio continúa |
| FOV / Shake / VFX | Se respetan predicados de activación existentes | Visibilidad no reemplaza activación |

**NOTA TÉCNICA:** la construcción de cuerpos Jolt no se omite por `active=false`; debe existir un BodyID para que `setNodeEnabled` pueda reactivarlo sin recrear forma/cuerpo. El coste de mantener memoria reservada no equivale a ejecutar física. `TriMeshShape3D` puede usar geometría de una malla invisible. CSG utiliza activación para decidir participación geométrica.

## Compatibilidad y límites

Se descartan migraciones `visible` → `active` y adaptadores históricos. Solo se exige coherencia del SOURCE_BASELINE vigente y de los datos actuales, sin sobrescribir cambios locales. No se toca la modernización futura del personaje FPS ni las políticas de transición de cámaras G004–G007. La API `game.camera.active` no equivale a `node.active`.

## QA en el entorno de implementación

- `scripts/test-node-active-visible-s15-g003-corr002-cont001.mjs`: **15/15 PASS**.
- Batería seleccionada (nodos, cámaras G002/G003, eventos, física planificada, Terrain, Inspector): **354 PASS, 0 FAIL, 1 SKIP**; los tests históricos con fixtures de PlayMode se adaptaron para usar los nuevos puntos de integración reales.
- `node --check`: previsto para todas las fuentes JavaScript modificadas; registrar resultado en QA.
- `npm run build`: **NO VERIFICADO** porque falta `vite` en este entorno (`sh: vite: not found`).
- Electron, Jolt WASM, GPU/draw calls, ejecución independiente del runtime exportado y QA del usuario: **NO VERIFICADOS**.

**CAUSA RAÍZ anterior:** había acoplamiento entre `Object3D.visible` editorial y propiedades de gameplay. **No se declara que toda la semántica haya pasado QA funcional** solo con lectura de código y dobles de prueba. En particular, el comportamiento de cuerpos dinámicos, Terrain, AudioSource y la transición Play→Edit requiere QA con dependencias reales.

## Riesgos y reglas de cierre

La reactivación Jolt debe comprobarse con cuerpos realmente simulados, no solamente objetos de prueba. La exclusión de draw calls debe observarse con estadísticas de render del Editor/Player. No afirmar mejora de FPS numérica sin benchmark. El Gate permanece abierto si aparece una regresión visual, de colisión, persistencia o ciclo de vida.

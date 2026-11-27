# QA — S15-G003 CORR-002 CONT-001 · Active / Visible

**Estado:** fuentes implementadas, prueba automatizada parcial; QA LOCAL PENDIENTE. No cerrar Gate antes de recibir evidencia y aprobación.

## Instalación

Descargar solo CHANGE desde la entrega. Aplicarlo en la carpeta de trabajo vigente de LevelForge, normalmente `~/Desktop/LF_S15_G001_REVISION` con `package.json`; comparar previamente cada archivo afectado si hubo cambios locales. Conservar el SOURCE_BASELINE anterior y no extraer el ZIP completo sobre el proyecto.

## Automatización

Desde la raíz de LevelForge:

```bash
node --test scripts/test-node-active-visible-s15-g003-corr002-cont001.mjs
node --test scripts/test-node-physics-runtime-s03-g001.mjs scripts/test-node-physics-s02-g001.mjs scripts/test-node-character-area-s04-g001.mjs scripts/test-node-character-area-s04-corr001.mjs scripts/test-node-reference-resolution-s01-g001.mjs scripts/test-node-script-lifecycle-dispatch-corr-g001.mjs scripts/test-node-script-s05-g001.mjs scripts/test-node-script-s05-corr001.mjs scripts/test-camera-orchestration-s15-g002.mjs scripts/test-camera-orchestration-s15-g003.mjs scripts/test-event-order.mjs scripts/test-event-match.mjs scripts/test-terrain-node-s01-g001.mjs scripts/test-terrain-extents-s03-g001.mjs scripts/test-terrain-transform-s02-g001.mjs scripts/test-inspector-terrain-cleanup-s13-g005-g002.mjs
npm run build
npm run electron
```

Esperado: nueva batería **15 PASS**, selección ampliada **354 PASS, 1 SKIP, 0 FAIL** en este entorno (puede variar si cambian dependencias). `npm run build` debe compilar Editor y runtime; **un build no prueba** integración visual ni WASM.

## Matriz de QA local obligatoria

| Caso | Procedimiento | Evidencia esperada |
|---|---|---|
| Inspector | Activar/desactivar la casilla azul en Camera3D y Primitive | La casilla representa `active`, no `visible` |
| Visibility | Desmarcar Visible manteniendo Active | Geometría se oculta; scripts se ejecutan y las colisiones siguen |
| Script runtime | Leer/escribir `game.node(ID).active` y `.visible` | Devuelven estado lógico, no `false` por frustum editorial |
| Jerarquía | Padre inactivo con dos hijos activos | Los hijos suspenden operaciones sin cambiar su valor propio; vuelven al reactivar padre |
| NodeLifecycle | Script `_process` y `_physics_process` muestra contador | Inactivo: no incrementa; invisible y activo: incrementa |
| Jolt rigid/static | Cuerpo dinámico sobre suelo y shape colisionable | `visible=false` no pierde colisión; `active=false` suspende física; reactivar recupera |
| CharacterBody/Area | Desactivar y reactivar sensor/personaje | No persisten overlaps ni se crean cuerpos duplicados |
| Terrain | Active/Visible independientes | Ocultar evita draw; desactivar omite terreno físico y raycasts, reactivar recupera |
| Camera3D | Invisible/activa y luego inactiva | Invisible mantiene control de cámara; inactiva deja de ser elegible |
| AudioSource | Invisibilidad, desactivación y reactivación | Audio sigue al ocultar; se suspende al inactivar y recupera al activar |
| Play Mode | Iniciar, detener y volver al Inspector | Cambios temporales de scripts no quedan escritos en proyecto por error |
| Timeline / G003 | Secuencia y comando «Controlar cámara» | Sin regresiones, referencias por ID conservadas |
| Estadísticas render | Comparar nodos visibles e invisibles con geometría propia | El invisible no aporta draw calls propios; no prometer mejora de FPS sin medir |
| Runtime exportado | Ejecutar juego exportado independiente | Mismo contrato de activación en el runtime final |

**Evidencia a devolver:** salida Node, `npm run build`, errores de consola, capturas o descripción de pruebas Electron, prueba física Jolt y, si procede, ejecución exportada. Informar cualquier caso que no se pudo ejecutar: NO VERIFICADO. **Aprobación del usuario y cierre del ledger se harán únicamente después.**

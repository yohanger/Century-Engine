# LevelForge — QA local S15-G007 · Camera Orchestration

**Estado:** PENDIENTE DE EJECUCIÓN DEL USUARIO en Electron embebido y Player independiente. El harness instalado no equivale a PASS.

## 1. Aplicación segura

Raíz: carpeta de LevelForge que contiene `package.json`. Requiere G006 técnico ya aplicado y **sin cambios locales no reconciliados** en los archivos afectados. Listar contenido con `unzip -l` y comparar antes de `unzip -o`; no sobrescribir Assets, escenas, proyectos, Database ni `node_modules`. Nunca extraer SOURCE_BASELINE encima del proyecto activo.

## 2. Node, compilación y Electron

Desde la raíz de LevelForge:

```bash
node --test scripts/test-camera-orchestration-s15-g007.mjs
node --test scripts/test-camera-orchestration-s15-g006.mjs scripts/test-camera-orchestration-s15-g005-corr001.mjs scripts/test-camera-orchestration-s15-g005.mjs scripts/test-camera-orchestration-s15-g002.mjs scripts/test-camera-orchestration-s15-g003.mjs scripts/test-cinematics-player-integration-s05-g004.mjs scripts/test-event-order.mjs scripts/test-node-active-visible-s15-g003-corr002-cont001.mjs scripts/test-game-manager-g001.mjs
npm run build
node --test scripts/test-camera-orchestration-s15-g007-electron.mjs
node --test scripts/test-cinematics-player-integration-s05-g004-electron.mjs scripts/test-player-camera-motion-electron-s01-g001.mjs
npm run electron
```

**Esperado:** G007 Node **19 PASS / 0 FAIL**; batería seleccionada **170 PASS / 0 FAIL** con `jszip` instalado (según G006 local); Editor y Player completan Vite; harness G007 Electron emite verificaciones WebGL (mínimo 20) sin fallos. Cada comando tiene evidencia propia. Un fallo de JSZip, Vite, Electron o GPU se registra con mensaje exacto y NO se transforma en PASS.

La ejecución de `npm run electron` sin excepción de shell prueba lanzamiento, **no** prueba por sí misma los escenarios manuales.

## 3. Matriz de aceptación funcional

Registrar cada ID como **PASS, FAIL o NO VERIFICADO**. Incluir contexto de escena y evidencia.

| ID | Escenario | Resultado exigido | Estado antes de QA local |
|---|---|---|---|
| VIS-01 | Sin jugador, Camera3D activa pero invisible en Jerarquía | Produce imagen; `visible=false` no desactiva autoridad | NO VERIFICADO |
| VIS-02 | Camera3D inactiva/ancestro inactivo | No se usa para una nueva solicitud; diagnóstico seguro | NO VERIFICADO |
| VIS-03 | Evento «Controlar cámara»: activar/cambiar/liberar | Mismo propietario cambia, otro no roba | NO VERIFICADO |
| VIS-04 | `game.camera.acquire/use/release` desde JS | Misma fuente efectiva que eventos y misma política | NO VERIFICADO |
| VIS-05 | Cut con perfiles y FOV distintos | Sin interpolación residual ni cambio de perfil incorrecto | NO VERIFICADO |
| VIS-06 | Blend `linear`, 2 segundos | Continuidad de pose, rotación y FOV vertical | NO VERIFICADO |
| VIS-07 | Blend `inOut`, 2 segundos | Easing diferenciado, imagen y orientación correctas | NO VERIFICADO |
| VIS-08 | Mover Camera3D destino durante blend | Seguir fuente viva; sin reposición a origen previo | NO VERIFICADO |
| VIS-09 | Interrupción del mismo lease | La nueva mezcla parte de la última salida dibujada | NO VERIFICADO |
| VIS-10 | Solicitud concurrente ajena | Rechazo atómico sin modificar frame o controles | NO VERIFICADO |
| VIS-11 | Liberación `keep` y `pose` | `keep` sigue nodo; `pose` queda fija | NO VERIFICADO |
| VIS-12 | `base`, `previous`, `camera3d`, `player` | Solo salidas explícitas y fuentes válidas; sin FPS falso | NO VERIFICADO |
| VIS-13 | Timeline nuevo natural/Stop/Skip | Políticas diferenciadas y persistidas en proyecto | NO VERIFICADO |
| VIS-14 | Timeline existente sin `cameraExit` | Mantiene comportamiento vigente | NO VERIFICADO |
| VIS-15 | FilmMaker junto con Timeline | FilmMaker conserva ownership; no escritor posterior indebido | NO VERIFICADO |
| VIS-16 | Camera Shake, DOF, agua, audio espacial | Una única cámara efectiva; sin Shake cinematográfico duplicado | NO VERIFICADO |
| VIS-17 | Timeline abierto, Camera3D seleccionada | Gizmos Move/Rotate; edición cede Preview sin crear claves | NO VERIFICADO |
| VIS-18 | Piloto, Preview, pausa y vista ortográfica | Restauración editorial coherente | NO VERIFICADO |
| VIS-19 | Cámara destruida/desactivada/cambio de escena | Lease, blend y referencias anteriores invalidados | NO VERIFICADO |
| VIS-20 | Plantilla FPS existente | Input movement/look y locks regresan; no se modifica plantilla | NO VERIFICADO |
| VIS-21 | Editor Play Mode y export de juego Sin jugador | Misma cámara por ID/escena/FOV/perfil | NO VERIFICADO |
| VIS-22 | Juego FPS exportado independientemente | Mismas transiciones, eventos y políticas que Play Mode | NO VERIFICADO |
| VIS-23 | Registro temporal/fotogramas | FPS, frametime p50/p95, draw calls y hardware/carga reales, si se instrumentan | NO VERIFICADO |
| VIS-24 | `cameraExit.interrupted` entre propietarios | **NO DISPONIBLE** el emisor hoy; no declarar PASS del consumo | PENDIENTE CONTRACTUAL |

## 4. Verificación real de AppImage

1. En Electron abre un proyecto de prueba **Sin jugador** con dos Camera3D y escena con GameManager. Conserva el proyecto original; usa una copia de QA.
2. Configura evento de Cut/Blend, Timeline nuevo con salidas natural/Stop/Skip y una Camera3D invisible pero activa.
3. Usa la ventana **Build** de LevelForge: selecciona escena(s), exporta como **AppImage** y anota **nombre y ruta reales** de salida. No asumir ruta fija ni nombre inventado.
4. Sal del Play Mode del Editor. Ejecuta el AppImage de juego fuera del Editor; si Linux solicita permiso, concede ejecución **solo** a ese archivo. Compara con Play Mode y anota escenas, GameManager, FOV, perfil, transición y respuesta de salida.
5. Repite con plantilla FPS vigente sin modernizarla. Reporta diferencias de audio, cámaras y controles, no ocultes errores ni cambios de escena.

Una compilación exitosa de `dist-player` NO constituye el paso 4; un AppImage empaquetado sin abrirse tampoco. Si falla exportación, devolver log y ruta de salida; registrar FAIL/NO VERIFICADO según evidencia.

## 5. Evidencia a devolver y cierre

- Salida completa del test G007 Node (19 tests), batería seleccionada y test Electron WebGL.
- Salidas de `npm run build` (Editor/Player), errores o warnings y resultado de `npm run electron`.
- Capturas/vídeo o notas reproducibles por VIS-01..VIS-24.
- Nombre y ruta del AppImage real, confirmación de ejecución independiente y diferencias frente a Play Mode.
- FPS y frametime medidos en tu N5030/4 GB solo si se dispone de medición válida; no exigencia de 60 FPS sin benchmark.

**No cerrar S15** antes de analizar esta evidencia, corregir FAIL dentro del contrato, resolver cualquier contradicción contractual y recibir aprobación del usuario. `interrupted` no tiene un evento emitido entre propietarios: la interrupción del blend de un mismo lease es otra prueba.

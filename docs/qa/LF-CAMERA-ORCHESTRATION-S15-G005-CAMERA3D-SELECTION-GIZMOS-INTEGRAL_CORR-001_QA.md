# LevelForge — QA S15-G005 CORR-001 · Gizmos con Timeline abierto

**Estado:** IMPLEMENTADO EN FUENTES, NODE PASS; COMPILACIÓN/QA LOCAL NO VERIFICADOS. **NO APROBADO, NO CERRADO.**

## 1. Instalación incremental

**Prerrequisito:** proyecto local con el CHANGE de G005 original aplicado sobre su baseline G004. No aplicar CORR-001 si existen cambios locales posteriores sin comparar `src/App.vue`, `src/components/TimelinePanel.vue`, `src/core/timeline/playback-session.js` y `src/core/editor/selection.js`.

Aplicar solo CHANGE sobre la carpeta raíz vigente (`package.json`), conservando Assets, proyectos, Database, `node_modules`, scripts propios y respaldos. SOURCE_BASELINE completo es para continuidad del asistente, no para descargar/descomprimir continuamente.

## 2. Pruebas reproducibles

```bash
node --test scripts/test-camera-orchestration-s15-g005-corr001.mjs
node --test \
  scripts/test-camera-orchestration-s15-g005-corr001.mjs \
  scripts/test-camera-orchestration-s15-g005.mjs \
  scripts/test-editor-camera-state-fix-g001.mjs \
  scripts/test-editor-camera-continuous-grab-g001.mjs \
  scripts/test-editor-camera-continuous-objectmode-g001.mjs \
  scripts/test-editor-camera-editmode-corr-g001.mjs \
  scripts/test-timeline-visual-preview-s08-g001-integral.mjs \
  scripts/test-timeline-visual-preview-s08-g001-corr001.mjs \
  scripts/test-timeline-unity-replacement-s10-g006-integral.mjs \
  scripts/test-camera-orchestration-s15-g002.mjs \
  scripts/test-camera-orchestration-s15-g003.mjs \
  scripts/test-node-active-visible-s15-g003-corr002-cont001.mjs
npm run build
npm run electron
```

En el entorno del asistente: **14/14** pruebas CORR-001 PASS y **141 PASS / 0 FAIL / 3 SKIP** en la regresión seleccionada. Los SKIP pueden pasar con dependencias instaladas. Build aquí **NO VERIFICADO** (`vite not found`). No declarar un cambio de estado sin comprobar la salida local.

**Limitaciones de suites adicionales históricas:** `test-timeline-camera-node-binding-s11-g002.mjs` requiere Vue/Three reales; `test-timeline-interpolation-s04-g002.mjs` tiene un import relativo no válido desde una URL `data:` en su harness actual; S09-06 de `test-timeline-advanced-direction-s09-g001-integral.mjs` busca un patrón textual `newCommand` antiguo. Estos tres fallos no se modifican en CORR-001 porque no son evidencia de un defecto funcional introducido por G005. No se contabilizan como PASS.

## 3. Matriz de QA en Electron embebido

| ID | Acción | Resultado esperado |
|---|---|---|
| CORR-V01 | Seleccionar Camera3D en Jerarquía y abrir Timeline con una pista Camera3D vinculada | La vista de edición recupera los gizmos; el botón «Vista previa» queda desactivado |
| CORR-V02 | Abrir Timeline, activar Preview y después seleccionar Camera3D desde Jerarquía | Preview cede la vista, gizmo Move/Rotate vuelve a aparecer |
| CORR-V03 | Con Camera3D seleccionada y Preview activado, cambiar de herramienta a Move/Rotate | La herramienta espacial cede Preview y habilita el gizmo |
| CORR-V04 | Activar explícitamente «Vista previa» | Muestra la cámara del Timeline; deshabilita los gizmos mientras gobierna la vista |
| CORR-V05 | Iniciar reproducción con Camera3D seleccionada | Preview cinematográfico no cede ni modifica poses base por el mero hecho de estar seleccionado |
| CORR-V06 | Pausar reproducción | Retorna la cámara editorial y sus gizmos sin perder el cabezal ni las claves |
| CORR-V07 | Reanudar reproducción | Timeline recupera la cámara cinematográfica vigente |
| CORR-V08 | Elegir clave de Timeline y después mover Camera3D desde Jerarquía | La clave permanece seleccionada; solo cambia la pose base del nodo, sin keyframe automático |
| CORR-V09 | Editar Camera3D con un padre rotado, local/global | Transformación correcta; Undo/Redo mantiene el historial existente |
| CORR-V10 | Pasar perspectiva → Preview → selección → ortográfica → Preview → pausa | Restituye la cámara editorial correspondiente, sin bloquear OrbitControls |
| CORR-V11 | Pilotar Camera3D, activar Preview y volver a editar | Pilotaje y Preview no compiten ni producen doble commit |
| CORR-V12 | Detener, cambiar pestaña y volver a Timeline con nodo seleccionado | Los gizmos están disponibles cuando Preview no está reproduciendo |
| CORR-V13 | Ejecutar Play Mode después de editar Camera3D | G002/G003/G004 sin regresiones de autoridad; sin cambios no autorizados en Player FPS |
| CORR-V14 | Bloquear Camera3D o seleccionar una clave sin nodo espacial | No manipular un nodo bloqueado ni atribuir gizmos a una clave temporal |

**A observar:** el Inspector puede seguir mostrando una clave de Timeline mientras un nodo está seleccionado espacialmente. Esta distinción ya existía y el rediseño UX de fuentes/poses/keyframes está reservado para después del Sprint 15; no debe registrarse como resuelto por CORR-001.

## 4. Evidencia y cierre

Devolver la salida de Node, `npm run build`, capturas o descripción V01–V14 y cualquier error en consola Electron. Adjuntar particularmente las pruebas V01/V02/V06/V08 y de Undo/Redo. Indicar casos no ejecutados como NO VERIFICADOS. G005 CORR-001 se cerrará solo con QA local satisfactorio y aprobación del usuario. G004 sigue esperando AppImage independiente para cierre integral de S15.

# LevelForge — QA local S15-G005

**Estado:** IMPLEMENTADO EN FUENTES; Node PASS; **QA LOCAL NO VERIFICADO** y G005 NO CERRADO.  
**Instalación:** aplicar CHANGE sobre el proyecto que ya contiene G004, sin borrar assets, escenas, Database, `node_modules` ni cambios locales. Comparar los archivos afectados antes de reemplazar. SOURCE_BASELINE completo es para continuidad, no para instalar cada Gate.

## Pruebas Node

Desde la raíz de LevelForge (`package.json`):

```bash
node --test scripts/test-camera-orchestration-s15-g005.mjs
node --test \
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

**Salida local esperada:** nueva batería **12 PASS**. Regresión seleccionada: **127 PASS, 3 SKIP, 0 FAIL** en el entorno de implementación; los SKIP por dependencias opcionales pueden convertirse en PASS si están disponibles. Editor y Player deben compilar, pero esa compilación no equivale a QA visual. Si fallan pruebas, adjuntar salida completa.

## Matriz visual (Electron embebido)

| ID | Acción | Resultado obligatorio |
|---|---|---|
| G005-V01 | Añadir Camera3D desde editor, seleccionarla en Jerarquía y luego viewport | Mismo nodo, Inspector y selección espacial coherentes |
| G005-V02 | Gizmo Mover/Rotar en cámara, selección con padre rotado | Transformaciones locales y mundiales correctas, sin saltos |
| G005-V03 | Escala y gizmo Universal en Camera3D | No permite escalar Camera3D |
| G005-V04 | Mover y rotar; Ctrl+Z / Ctrl+Shift+Z | Un Undo/Redo real restaura transformaciones |
| G005-V05 | Pilotar Camera3D y terminar la sesión | Guarda pose una sola vez en historial; vuelve el modo de navegación |
| G005-V06 | Seleccionar clave de cámara de Timeline; luego seleccionar Camera3D desde Jerarquía | La clave temporal permanece seleccionada, sin abrir otra Timeline ni perder referencias |
| G005-V07 | Con Preview activado, probar selección de Camera3D y manipulación con gizmos | La selección se mantiene; no hay escritura de poses temporales con gizmo |
| G005-V08 | Arrancar Preview desde vista perspectiva y salir | Recupera perspectiva y habilitación de controles previa |
| G005-V09 | Arrancar Preview desde vista ortográfica y salir | Recupera la MISMA cámara ortográfica; no cambia a perspectiva |
| G005-V10 | Comenzar pilotaje, activar Preview de Timeline, luego salir | Pilotaje termina coherentemente; sin competición de controles, sin doble commit |
| G005-V11 | Modificar posición/rotación de un nodo desde Inspector durante Preview y detener | Prevalece la edición actual; no se revierte a snapshot temporal antiguo |
| G005-V12 | Timeline con Camera3D + padre animado, scrubbing + stop | Pose visual evaluada y restauración exacta; ningún keyframe nuevo |
| G005-V13 | Play Mode tras editar Camera3D; detener | G002/G003/G004 sin regresiones ni alteración de selección previa |
| G005-V14 | Camera3D bloqueada / invisible / inactiva | Respeta los estados `locked`, `active`, `visible` aprobados |

**Prueba Electron existente opcional:** `node --test scripts/test-timeline-camera-node-binding-s11-g002-electron.mjs` (requiere dependencias locales y display). No equivale a las verificaciones manuales de pilotaje y Preview.

## Pendiente transversal G004

La ejecución de un AppImage independiente permanece **NO VERIFICADA**. Debe presentarse evidencia en QA de integración G007; no declarar G004 CERRADO con solo `vite build --mode player`.

## Evidencia a devolver

Salida Node, resultado de build Editor/Player, capturas o breve descripción de V01–V14, capturas/logs si hay errores, prueba de restitución ortográfica y de Undo/Redo. Indicar explícitamente casos no ejecutados. El cierre exige tu aprobación después de analizar esa evidencia.

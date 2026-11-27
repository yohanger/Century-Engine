# QA — Cámara Continuous Grab G001

**Fuente:** SOURCE_BASELINE `LevelForge_EDITOR_EDITMODE_SHIFT_SNAP_CORR_G001_SOURCE_BASELINE.zip`.
**Contrato:** `LF-EDITOR-CAMERA-CONTINUOUS-GRAB-G001` autorizado literalmente por el usuario.
**Estado:** IMPLEMENTADO · NODE PASS · ELECTRON/BUILD/QA LOCAL PENDIENTES.

## Evidencia automatizada

`node --test scripts/test-editor-camera-continuous-grab-g001.mjs`: 16/16 PASS.

Regresión de 17 suites de Editor, Continuous Grab, Shift/Snap, Bevel, Edit Mode, LoopCut, transformación numérica, cámara y TriMesh: 288/288 Node PASS (ver log adjunto). La regresión final debe ejecutarse sobre los ZIP finales.

El runner Electron usa `OrbitControls` oficial, WebGL2 y eventos de puntero simulados; el Pointer Lock se simula porque no se puede solicitar de forma fiable sin un gesto humano. **Intento Electron:** el runner finalizó antes de abrir Chromium (`Falta Vite; ejecutar npm ci antes del QA`). **Intento build:** `vite: not found` (código 127). No constituyen fallo de producto ni PASS gráfico. Ninguna observación de QA visual en vivo se atribuye al asistente.

## Comandos de QA local (raíz de SOURCE_BASELINE)

Si faltan dependencias: `npm ci`.

```
node --test scripts/test-editor-camera-continuous-grab-g001.mjs
node --test scripts/test-editor-camera-continuous-grab-electron-g001.mjs
node --test scripts/test-editor-continuous-grab-corr-g001.mjs
node --test scripts/test-editor-editmode-shift-snap-corr-g001.mjs
npm run build
npm run electron
```

## Inspección manual obligatoria

1. Entrar a Edit Mode en una escena con geometría y verificar MMB al cruzar los bordes izquierdo, derecho, superior e inferior repetidamente, con cámara en perspectiva y ortográfica.
2. Repetir con Shift+MMB y Alt+LMB; comprobar desplazamiento y órbita respectivamente. Probar también Espacio+LMB y Shift+RMB.
3. Volar con botón derecho + WASD; cruzar varios bordes y liberar al soltar el botón.
4. Un clic derecho corto, sin arrastrar, conserva el menú contextual. Navegar con Alt+LMB no debe seleccionar una arista accidentalmente.
5. Durante G/R/S, Bevel, extrusión o gizmos no debe activarse otra navegación ni perderse Continuous Grab de transformación.
6. Pulsar Escape, perder el foco, cambiar de modo y detener Play; Cursor/Pointer Lock se deben liberar sin quedarse atascados.
7. Verificar fuera de Edit Mode que la navegación y selección originales siguen intactas.
8. Registrar tipo de sesión Linux (X11/Wayland) y, si está disponible, prueba Windows. Adjuntar vídeo del cruce de bordes y salidas de Electron/build.

**Cierre:** usuario aporta QA LOCAL PASS y decide aprobación; corregir bajo este Gate si falla. El menú «…» de Transformación en Inspector permanece fuera de alcance.

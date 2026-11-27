# Evidencia QA — Edit/Play Docking y Loop Cut desde cámara

**Gate:** `CENTURY-EDITOR-UX-S02-G001-DOCKABLE-EDIT-PLAY-VIEWS-AND-CAMERA-ORIENTED-LOOPCUT`

## Baseline

`CENTURY-EDITOR-UX-S01-G001-SELECTION-HIGHLIGHT-AND-MULTI-OBJECT-VISIBILITY_SOURCE_BASELINE.zip`: 3.248 archivos originales, sin eliminaciones. No se modificaron archivos de la biblioteca independiente TriangHor ni se ejecutaron operaciones Git.

## Resultados acreditados

| Verificación | Resultado | Evidencia |
| --- | --- | --- |
| Docking y Loop Cut, suite de Gate | **62/62 PASS**, 0 FAIL | `qa-gate-node.log` |
| Docking histórico con expectativas actualizadas | 50 PASS, 2 FAIL | `docking-legacy-work.log` |
| Docking histórico, baseline exacto | 50 PASS, 2 FAIL | `docking-legacy-baseline.log` |
| Cámara Runtime histórica | 15 PASS, 1 FAIL | `camera-baseline.log`, `legacy-runtime-work.log` |
| Loop Cut histórico con harness antiguo | Fallos presentes antes y después del Gate | `loop-legacy-baseline.log`, `loop-legacy-work.log` |
| Smoke, SOURCE_BASELINE | 29 PASS, 1 FAIL (TOOL-08) | `smoke-baseline.log` |
| Smoke, Gate actual | 29 PASS, 1 FAIL (TOOL-08) | `smoke-work.log` |
| Sintaxis de fuentes JS y scripts de componentes Vue | PASS | `source-syntax.log` |
| Build Vite Editor/Runtime | **NO COMPILADO**: `vite: not found` | `build.log` |
| UI de docking/segundo contexto WebGL/Electron | **NO VERIFICADO** | Requiere ejecución local |
| Rendimiento de CPU/GPU/memoria y oclusión real | **NO VERIFICADO** | Solo se han establecido límites teóricos y tests Node |
| Aprobación/Cierre | **PENDIENTE/NO** | Usuario debe validar |

**Fallos históricos sin resolver:** DOCK-30, DOCK-C09, G005-16 y TOOL-08; las mismas pruebas fallan en la fuente anterior. Las pruebas antiguas de interacción Loop Cut contienen supuestos de `snapStep` no disponibles en su fixture; el mismo fallo se reproduce en baseline. No se cambian pruebas ajenas para hacerlas pasar.

## Reproducción

```bash
node scripts/qa-suite.mjs dockable-edit-play-camera-loopcut
node --test scripts/test-editor-docking-s03-g001-integral.mjs
npm ci
npm run build
npm run electron
```

`npm ci` requiere disponibilidad de las dependencias habituales del proyecto. La compilación o ejecución no se afirma como completada a partir de las pruebas Node.

## QA local que condiciona la aprobación

1. En Editor, reorganizar Edit Mode y Play Mode como dos pestañas, divididas horizontal/verticalmente y flotantes; guardar y recuperar el layout.
2. Entrar en Play Mode, mantener Edit Mode visible, observar el mismo jugador y objetos de escena; mover la cámara editorial sin mover la del jugador.
3. Revisar la indicación «Oclusión del jugador» desde la cámara editorial, alternando entre observar y controlar el juego; confirmar pausa, Step y entrada con foco.
4. Cambiar de viewmode, probar arrastre de archivos, foco, redimensionado, maximización, desmaximización y retorno al Editor.
5. En Edit Mesh, apuntar a distintas caras quad desde perspectivas y ortográficas; confirmar que el Loop Cut comienza en la cara visible y conserva anillo, rueda, Slide, Undo/Redo.
6. Comprobar en hardware objetivo el consumo extra de CPU, GPU y memoria del segundo contexto WebGL.

**Estado:** IMPLEMENTADO · QA NODE PASS · COMPILACIÓN, ELECTRON, WEBGL2 Y RENDIMIENTO NO VERIFICADOS · NO APROBADO · NO CERRADO.

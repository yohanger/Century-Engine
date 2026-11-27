# LF-TERRAIN-CAMERA-FRAME-S04-G001-INTEGRAL — QA

## Evidencia en entorno de autoría

- `scripts/test-terrain-camera-frame-s04-g001-integral.mjs`: 11 PASS, 0 FAIL; una comprobación adicional de compilador Vue **SKIP** por dependencias ausentes. Incluye aceptación, cancelación, resolución, límite de parámetros, sincronización, commit y conservación de cámara en cuerpo ejecutado de `applySize()`.
- Regresión focal con S01, S02, S03 y S04A: 114 PASS, 0 FAIL, 2 SKIP (compiladores Vue históricos).
- Regresión ampliada con Signals: **200 PASS, 0 FAIL, 2 SKIP**, en 12 suites.
- `node scripts/gen-docs.mjs --check`: PASS.
- `scripts/test-terrain-camera-frame-electron-s04-g001-integral.mjs`: creado, **NO VERIFICADO**; se intentó ejecutar, pero no existe `node_modules/vite/bin/vite.js` en este entorno.
- `npm run build`: **NO VERIFICADO**, termina `vite: not found`. No atribuir PASS a Editor ni Player.
- **QA LOCAL USUARIO PENDIENTE; NO CERRADO.**

## Comandos en la carpeta SOURCE_BASELINE nueva

```bash
npm ci
node --test scripts/test-terrain-camera-frame-s04-g001-integral.mjs
node --test scripts/test-terrain-camera-frame-electron-s04-g001-integral.mjs
node --test scripts/test-terrain-node-s01-g001.mjs scripts/test-terrain-node-s01-corr001.mjs scripts/test-terrain-transform-s02-g001.mjs scripts/test-terrain-extents-s03-g001.mjs scripts/test-terrain-extents-s03-corr001.mjs scripts/test-terrain-inspector-context-s04a-g001.mjs
node scripts/gen-docs.mjs --check
npm run build
npm run electron
```

## Aceptación local

1. Seleccionar Terreno desde la jerarquía y abrir su Inspector contextual.
2. Antes de usar **Aplicar tamaño**, guardar una referencia visible de cámara (posición, orientación, centro y distancia de órbita).
3. Cambiar lado y aceptar: se remuestrea la misma pieza, sin reencuadre ni salto de cámara.
4. Cambiar solo resolución y aceptar: se mantiene encuadre.
5. Cancelar una modificación: no remuestrear ni mover cámara, preservar pintura y relieve.
6. Terreno rectangular (de S03): advertencia destructiva; tras aceptar conserva el contrato de convertir a cuadrado, no modifica el funcionamiento de extensión por bordes.
7. Verificar Undo/Redo de tamaños, alturas y capas; guardar/reabrir y comprobar persistencia.
8. Verificar que **Enfocar** manual continúa funcionando y que añadir una pieza mantiene su comportamiento previo.
9. Ejecutar Electron WebGL2/Jolt (fixture prevista 30 comprobaciones, mínimo exigido 26) y build Editor + Player.
10. Confirmar que no hay regresiones de colisiones en Player. Los problemas Edit Mesh y Consola permanecen diferidos.

**Evidencia a devolver:** salidas Node/Electron/build, captura de cámara antes/después con terreno seleccionado, resultado de Undo/Redo y cualquier fallo reproducible. Compilar no equivale a QA visual.

## 2026-11-02 — Aprobación posterior y cierre documental

El usuario respondió **«Aprobado. Sigamos.»** después de la entrega S04. Se registra **QA LOCAL PASS declarado por usuario · APROBADO · CERRADO DOCUMENTAL** durante `LF-EDITOR-CONSOLE-SCRIPT-OUTPUT-CORR-G001`. Las seis hojas del ledger reflejan ese estado. Los resultados de autoría anteriores se conservan como histórico; no se inventan resultados individuales de Electron o compilación del usuario. No se solicita repetir el QA aprobado.

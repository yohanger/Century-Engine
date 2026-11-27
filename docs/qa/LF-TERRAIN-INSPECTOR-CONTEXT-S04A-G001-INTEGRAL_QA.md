# LF-TERRAIN-INSPECTOR-CONTEXT-S04A-G001-INTEGRAL — QA

## Evidencia automatizada en el entorno de autoría

- `node --test scripts/test-terrain-inspector-context-s04a-g001.mjs`: **18 PASS, 0 FAIL, 1 SKIP**, compilación Vue real omitida al no estar instalado `@vue/compiler-sfc`.
- Regresión ampliada (`test-terrain*.mjs` no Electron/Jolt + suites Signals S01/S04/S07): **172 PASS, 0 FAIL, 2 SKIP**.
- Fixture Electron real: `scripts/test-terrain-inspector-context-electron-s04a-g001.mjs` / `scripts/fixtures/terrain/inspector-context-s04a-g001.html`; **NO VERIFICADO** aquí por falta de Vite.
- `npm run build`: **NO VERIFICADO** (`vite: not found`). No equivale a compilación PASS.
- `node scripts/gen-docs.mjs --check`: pendiente de validación antes de empaquetar.
- **QA LOCAL DEL USUARIO: PENDIENTE. GATE NO CERRADO.**

## Comandos QA local (en carpeta recién extraída)

```bash
npm ci
node --test scripts/test-terrain-inspector-context-s04a-g001.mjs
node --test scripts/test-terrain-inspector-context-electron-s04a-g001.mjs
node --test scripts/test-terrain-node-s01-g001.mjs scripts/test-terrain-node-s01-corr001.mjs scripts/test-terrain-transform-s02-g001.mjs scripts/test-terrain-extents-s03-g001.mjs
node scripts/gen-docs.mjs --check
npm run build
npm run electron
```

## Matriz de aceptación local

1. Terreno desde jerarquía abre Inspector, **no** pestaña Terreno.
2. Inspector muestra cabecera y Scripts de Nodo; Señales muestra catálogo del tipo Terrain.
3. Escena y otro nodo recuperan su propio Inspector.
4. No hay segunda copia de las herramientas de terreno.
5. Posición Y, tamaño y tiradores de los cuatro bordes siguen funcionando.
6. Pincel, alturas, capas, vegetación e hidrología conservan datos después de guardar y abrir.
7. Escenas con 0, 1 y varias piezas: sin nodos fantasma, selección del ID físico exacto.
8. Ocultar/mostrar y renombrar modifican pieza y reflejo, sin desincronización tras Undo/Redo.
9. Play/Stop restituye selección y gizmo correcto.
10. Preferencia antigua `rightTab='terrain'` vuelve al Inspector.
11. Electron (WebGL2/Jolt) y build Editor + Player sin errores.
12. Los defectos de Edit Mesh y Consola se mantienen fuera del Gate.

Si cualquiera falla, registrar evidencia concreta antes de corregir o aprobar. Node PASS no equivale a QA visual.

## Adenda de aprobación local — 2026-11-02

El usuario respondió «Aprobado. SIgamos.» a la entrega S04A-G001-INTEGRAL. Registrar **QA LOCAL PASS declarado por el usuario** y aprobación; no asumir automáticamente PASS de Electron o compilación no acompañados de logs. La dependencia S04 de `frameAll()` permanece reservada al Gate independiente `LF-TERRAIN-CAMERA-FRAME-S04-G001-INTEGRAL`.

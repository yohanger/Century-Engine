# LevelForge — LF-TERRAIN-EXTENTS-S03-G001_CORR-001

**Autorización:** `Listo. LF-TERRAIN-EXTENTS-S03-G001_CORR-001 autoriza comenzar`.

**SOURCE_BASELINE de entrada:** `LevelForge_TERRAIN_EXTENTS_S03_G001_SOURCE_BASELINE.zip` (1.400 archivos). La captura aportada por el usuario constituye **QA LOCAL FAIL de S03 original**. La aprobación de S02 y el historial S01–S03 se preservan.

## Diagnóstico y corrección

**Observado:** los cuatro tiradores del viewport trasladaban su propia representación, mientras el terreno seguía inmóvil hasta `pointerup`. Las dos rutas de reducción (Inspector y viewport) abrían `askConfirm()` sin opción persistente de no volver a preguntar.

**Causa raíz:** `gizmo.js` solo almacenaba `d.cells` y movía el handle; la mutación del terreno se hacía al soltar. La confirmación de S03 era genérica y no ofrecía preferencia vinculada a Terrain.

**Mecanismo autorizado implementado:**

- `Terrain._edgeData()` es la única ruta para calcular el borde nuevo y copiar alturas y splat sin deformar el área conservada.
- `Terrain.previewEdge(side,cells)` cambia **temporalmente la geometría que renderiza la misma malla**, con su material de pintura original y posición compensada. Los arrays `heights`, `splat`, dimensiones, vegetación, persistencia y colisión no se modifican durante el arrastre. No se crea un segundo renderer, World, nodo Terrain ni sistema de colisiones.
- Solo recalcula la vista previa cuando cambia el número entero de celdas. Los límites originales de 8 a 1.024 celdas por eje y 262.144 vértices por pieza se aplican también a la vista previa.
- `clearEdgePreview()` restituye geometría, posición y libera buffers cuando se cancela con Esc, `pointercancel`, pérdida de foco, cambio de pieza/selección, al soltar, hacer Undo/Redo o destruir Terrain/Editor.
- Soltar el ratón restaura antes el estado estable. Si la reducción se confirma, `extendEdge()` aplica el único cambio real; Undo/Redo mantiene una única transacción por gesto.
- La confirmación reutiliza el diálogo `AskWindows.vue`, con una casilla exclusiva **«No volver a mostrar este aviso»**. No omite el siguiente diálogo hasta que el usuario **acepta y marca** la casilla. Cerrar o cancelar no modifica la preferencia.
- La preferencia `terrainCropWarning` se guarda en las preferencias existentes (almacenamiento local del editor) y se revierte desde **Preferencias del editor → Interfaz → Advertir antes de recortar datos del terreno**. No afecta las demás advertencias, confirmaciones de eliminación ni el remuestreo por «Aplicar tamaño».

## Pruebas automatizadas ejecutadas

- `node --test scripts/test-terrain-extents-s03-corr001.mjs`: **16/16 PASS**. Comprueba buffers y pintura temporal, geometría visible, integridad del mapa y vegetación, memoria y liberación, los cuatro bordes, cancelación y confirmación persistente.
- `node --test scripts/test-terrain-extents-s03-corr001.mjs scripts/test-terrain-extents-s03-g001.mjs scripts/test-terrain-transform-s02-g001.mjs scripts/test-terrain-node-s01-corr001.mjs scripts/test-terrain-node-s01-g001.mjs`: **85/85 PASS**.
- Regresión ampliada de 39 suites: **654/661 PASS; 7 FAIL**, de los cuales 5 son fallos preexistentes de Water S03 (3) y Weather Unification S02 (2), y 2 son runners Jolt no ejecutables sin dependencias locales. No declarar suite completa PASS.
- Runner `test-terrain-extents-electron-s03-corr001.mjs` y fixture `extents-s03-corr001.html` creados para verificar píxeles reales WebGL2 antes/durante/después, render intacto al cancelar y ausencia de geometría duplicada. **NO VERIFICADO** en este entorno sin Vite/Electron.
- Build Editor/Player, Jolt WASM real y QA visual de usuario **NO VERIFICADOS**; no confundir ausencia de error de Node con validación gráfica.

## QA local obligatorio (usuario)

Desde la raíz del **nuevo SOURCE_BASELINE**, con Node/Electron del proyecto:

```bash
npm ci
node --test scripts/test-terrain-extents-s03-corr001.mjs
node --test scripts/test-terrain-extents-s03-g001.mjs
node --test scripts/test-terrain-extents-electron-s03-corr001.mjs
node --test scripts/test-terrain-extents-electron-s03-g001.mjs
node --test scripts/test-terrain-extents-jolt-s03-g001.mjs
npm run build
npm run electron
```

**Esperado:** 16/16 Node nuevos; 21/21 S03; Electron CORR-001 1/1 con al menos 16 verificaciones internas; Electron S03 1/1 con 17; Jolt WASM real 1/1, build Editor y Player completo. **Son resultados esperados, no realizados aquí**.

**Escenarios visuales:**

1. Con relieve irregular y pintura de varias capas, arrastrar +X, −X, +Z y −Z. Cada tirador debe arrastrar la superficie visible, no únicamente el cuadrado. Comprobar que la vegetación original no se desplaza.
2. Mantener pulsado sobre un borde y desplazar varias celdas; la vista previa debe seguirlo sin que la cámara se reencuadre. Soltar una vez, esperar una única operación Undo.
3. Arrastrar hacia adentro y pulsar Esc: restauración exacta, sin cuadro de recorte y sin modificaciones persistidas. Repetir con recorte e indicar **Cancelar** en el diálogo: el mismo resultado.
4. Marcar **No volver a mostrar este aviso**, pulsar **Aceptar**, reducir después desde Inspector y viewport. No deben reaparecer confirmaciones de recorte. Cerrar y reabrir LevelForge: la preferencia debe conservarse. Activar **Preferencias → Interfaz → Advertir antes de recortar datos del terreno** y comprobar que el diálogo vuelve.
5. Guardar, cerrar, abrir, Undo/Redo y probar relieve/vegetación, agua física, Player exportado y colisiones Jolt en los nuevos límites. Ninguna prueba de render confirma por sí sola física.
6. Verificar que las confirmaciones de borrar escena/proyecto y de remuestrear tamaño siguen apareciendo normalmente. Registrar cualquier error `setPointerCapture` aparte: sigue pendiente de su Gate.

**Fuera de alcance:** la corrección del `frameAll()` del botón «Aplicar tamaño» sigue en S04; no introducir un cambio silencioso de cámara. No crear otra malla persistente ni escena auxiliar.

## Estado y cierre

IMPLEMENTADO · 16/16 NODE PASS · 85/85 TERRAIN PASS · REGRESIÓN AMPLIADA PARCIAL · BUILD/ELECTRON/JOLT REAL NO VERIFICADOS · **QA LOCAL PENDIENTE, NO CERRADO**.

Exactamente dos ZIP: A CHANGE con solo nuevos/modificados del Gate, B SOURCE_BASELINE completo acumulado. Conservar el baseline anterior y los proyectos del usuario; no sobrescribir cambios locales ni incluir `node_modules`, build o cachés.

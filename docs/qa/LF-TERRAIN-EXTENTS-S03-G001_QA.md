# LF-TERRAIN-EXTENTS-S03-G001 — Implementación y QA

**Proyecto:** LevelForge 0.26.13. **Autorización:** `Listo. LF-TERRAIN-EXTENTS-S03-G001 autoriza comenzar` (31 octubre 2026).

**SOURCE_BASELINE de entrada:** `LevelForge_TERRAIN_TRANSFORM_S02_G001_SOURCE_BASELINE(1).zip`, proporcionado por el usuario, 1.395 archivos, integridad ZIP comprobada. La entrega no modifica archivos del proyecto privado del usuario.

**Estado:** IMPLEMENTADO EN CÓDIGO · 21/21 PRUEBAS NODE DE EXTENTS PASS · COMPILACIÓN/ELECTRON/JOLT REAL/QA LOCAL NO VERIFICADOS · NO CERRADO.

## Contrato técnico efectivo

- **Una pieza, una geometría y una autoridad:** el objeto `Terrain` conserva `size` y `segments` como dimensiones **X**, y añade `depth` y `segmentsZ` como dimensiones **Z**. No existen dos mapas para la misma pieza. Escenas cuadradas heredadas se interpretan con `depth=size` y `segmentsZ=segments`.
- `extendEdge(side,cells)` admite `px`, `nx`, `pz`, `nz` y un número entero de celdas (positivo para extender, negativo para recortar). Copia por índice las alturas Float32 y los ocho pesos de pintura originales sin interpolación ni estiramiento. Las nuevas filas/columnas extrapolan el borde más próximo. Mantiene espaciado y ajusta solo el centro de la pieza afectado por el borde. Conserva `oy`.
- Los datos de vegetación se almacenan en coordenadas locales y se compensan al desplazar el centro. La vegetación recortada se descarta solo tras confirmación para reducir el borde.
- Se amplían mesh/índices, normales, raycast, terreno pintado/esculpido, rampa, consultas, costura entre piezas, fusión para exportación, Jolt triangulado, generación procedural y guardado/Undo/Redo para admitir `segmentsZ` y `depth`.
- Inspector Terrain existente: cuatro bordes y controles de distancia; el viewport existente incorpora cuatro tiradores naranjas solo con terreno seleccionado. El arrastre muestra el tirador en previsualización y reconstruye malla **una vez al soltar**, no por fotograma. El recorte solicita confirmación. Sin segunda malla de terreno ni un gestor genérico.
- **Límite:** mínimo 8 y máximo 1.024 celdas por eje, y máximo 262.144 vértices totales para una operación de borde. El límite es por pieza; no significa que el resto de subsistemas estén validados a ese máximo en el hardware objetivo.
- El mapa de agua, que usa una textura cuadrada, utiliza el camino de fusión existente en piezas rectangulares. La exportación existente consolida un terreno rectangular a una malla cuadrada compatible. No se mueve automáticamente el nivel mundial del agua.
- S02 permanece: traslación vertical en Editor, raycast, Jolt, save/load y Player (según evidencia pendiente).

## Alcance delimitado y restricciones

- No cambia el contrato de crear una segunda pieza al usar los botones tradicionales de «Añadir otra pieza». Son operaciones diferentes, etiquetadas claramente.
- El viejo «Aplicar tamaño» continúa siendo una operación de **remuestreo destructivo** que transforma el terreno a cuadrado tras confirmación. S03 corrige su lectura de matrices rectangulares, pero **no elimina su `frameAll()`**: esto sigue asignado a S04. El ajuste por borde S03 nunca llama `frameAll()`.
- No se recrean el sistema de suelo, World, Jolt, editor de vegetación, exportador ni renderizadores.
- No se cambian otros bugs existentes: error de `setPointerCapture`, falla antigua del runner Water S03 y pruebas WU2. Estas incidencias no se marcan PASS ni se resuelven indirectamente.

## Evidencias automatizadas ejecutadas

- `node --test scripts/test-terrain-extents-s03-g001.mjs`: **21/21 PASS**, incluyendo los cuatro bordes, ampliación, reducción, mapas de altura y splat, centro mundial, vegetación, límites de memoria, persistencia estructural, modelo rectangular, Jolt y exportación como dependencias de código, edición y generación procedural.
- `node --test scripts/test-terrain-transform-s02-g001.mjs scripts/test-terrain-node-s01-g001.mjs scripts/test-terrain-node-s01-corr001.mjs`: **48/48 PASS** tras actualizar el fixture legado de S02 para los campos que exige S03.
- Regresión ampliada focal: **637/642 PASS; 5 FAIL**, los mismos cinco documentados en S02 (tres en fixtures de salpicaduras de `test-water-s03-corr001.mjs`, dos en `test-weather-unification-s02-g001.mjs`). No confundirlos con regresiones nuevas ni con suite completa PASS.
- `npm ci --offline` falló porque faltaba `zip-stream-4.1.1.tgz` en la caché local. `npm run build` no se ejecutó correctamente: `vite: not found`. **No se acredita compilación.**
- Runners Electron WebGL2 y Jolt WASM real incluidos y **NO EJECUTADOS/NO VERIFICADOS** en este entorno. La prueba de Jolt sobre una malla rectangular es obligatoria antes del cierre.

## Comandos locales desde SOURCE_BASELINE

```bash
npm ci
node --test scripts/test-terrain-extents-s03-g001.mjs
node --test scripts/test-terrain-transform-s02-g001.mjs scripts/test-terrain-node-s01-g001.mjs scripts/test-terrain-node-s01-corr001.mjs
node --test scripts/test-terrain-extents-electron-s03-g001.mjs
node --test scripts/test-terrain-extents-jolt-s03-g001.mjs
npm run build
npm run electron
```

**Resultados esperados:** 21/21 Node S03; 48/48 Node S01/S02; Electron S03 1/1 con 17 verificaciones y Jolt S03 1/1 con colisión a la elevación correcta. Hasta recibir los registros reales, Electron/Jolt/build siguen NO VERIFICADOS.

## QA visual obligatorio del usuario

1. En una escena de prueba, seleccionar el nodo Terreno. Comprobar que aparecen cuatro tiradores de bordes en el viewport y los controles X±/Z± en el Inspector.
2. Elevar o pintar relieve irregular y añadir vegetación a la pieza; tomar capturas antes y después de extender los cuatro bordes. Las montañas, pintura y plantas de la región original no deben moverse ni estirarse.
3. Arrastrar un tirador; la vista previa no debe congelar el Editor ni reconstruir el terreno en cada píxel. Soltar confirma la extensión sin reencuadrar la cámara. Medir con la misma escena y perfil.
4. Reducir un borde. Debe pedir confirmación; cancelar no modifica nada. Aceptar recorta datos fuera del límite. Comprobar Undo/Redo completo.
5. Crear terreno rectangular, esculpir/pintar/costura con otra pieza y guardar. Cerrar y volver a abrir sin pérdida de alturas, pintura, vegetación, dimensiones ni posición Y.
6. En Play y Player exportado, caminar por los bordes nuevos, saltar, aterrizar y comprobar colisiones Jolt. Validar agua, carreteras, lluvia y relieve costero generado en un terreno rectangular.
7. Verificar que S01/S02 continúan funcionales, sin nodos fantasma ni errores de `footstep`. Reportar aparte `setPointerCapture` si aparece.

**Evidencia a devolver:** stdout íntegro de pruebas, build y Electron; capturas antes/después con dimensiones en Inspector; prueba visual del Player; cualquier error WebGL/Jolt; cambios locales si existen.

## Entrega y conservación

Exactamente dos ZIP: `LevelForge_TERRAIN_EXTENTS_S03_G001_CHANGE.zip` (nuevos/modificados) y `LevelForge_TERRAIN_EXTENTS_S03_G001_SOURCE_BASELINE.zip` (árbol completo, acumulado). No sobrescribir escenas, Assets ni `the_room`; extraer el baseline en carpeta nueva. Conservar S02 y S03 hasta aprobación y cierre. Excluir `node_modules`, `dist*`, builds y caches. Se verificará el diff binario contra el ZIP subido.

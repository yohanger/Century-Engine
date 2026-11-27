# LF-MESH-BEVEL-EDGE-CORR-G001 — QA y aceptación

**Estado:** IMPLEMENTADO · TEST AUTOMATIZADO NODE PASS · BUILD/QA LOCAL PENDIENTES.

## Evidencia local ejecutada por el asistente

- `node --test scripts/test-mesh-bevel-edge-corr-g001.mjs`: **15/15 PASS**.
- Regresión de 13 suites de modelado/edición y TriMesh, incluyendo la nueva suite: **262/262 PASS**.
- `node --check` en cinco archivos JS modificados/nuevos: PASS.
- No se ejecutó Electron, compilación Vite ni render real; sin `node_modules` del proyecto. No se declara PASS de esos controles.

## Pruebas exigidas al usuario

1. En un cubo, Edit Mode → aristas, seleccionar **dos aristas contiguas de una esquina** y pulsar `Ctrl+B`. Mover el ratón, rueda para 1, 4 y 8 segmentos. Comprobar continuidad y ausencia de huecos.
2. Repetir con **tres aristas convergentes**; observar el parche del vértice, normales y redondeo.
3. Crear un plano aislado y biselar **dos aristas de contorno consecutivas**. Comprobar que el centro mantiene una sola cara y que las tiras comparten la esquina sin costuras ni triángulos negros.
4. Iniciar `Ctrl+B`, escribir un ancho superior al máximo conservador, pulsar `C` y comprobar que `Clamp ON` pasa a `OFF` y cambia realmente el resultado visual. Volver a pulsar `C` y observar que se limita el ancho. Con un ancho demasiado grande se permite rechazo con mensaje, nunca malla dañada.
5. Confirmar con Enter; `Ctrl+Z` deshace una única operación y rehacer la restaura. Repetir y cancelar con Escape, sin cambios persistentes.
6. Probar aristas de contorno e interiores mezcladas: la operación debe rechazarse y no cambiar el proyecto.
7. Comprobar `Ctrl+Shift+B` sobre vértices; no debe romperse.
8. Guardar y reabrir `.lfproj`; comprobar bisel, UV/material y TriMesh. Si usa la malla como collider, probar Play y Player exportado.
9. Repetir en Windows si se dispone y vigilar respuesta del modal en hardware N5030/4 GB.

**Evidencia a devolver:** captura de dos y tres aristas, captura del plano con dos contornos, resultado con Clamp ON/OFF, salida de `npm run build`, y cualquier error de consola. No atribuir QA PASS hasta ver dicha evidencia.

## QA UPDATE — CORRECCIÓN DEL REMATE SUPERIOR

**QA LOCAL anterior:** FAIL PARCIAL. La captura del usuario demuestra que las caras superiores/esquinas no terminan correctamente después de biselar aristas laterales. Se conserva el resto de Bevel aprobado parcialmente.

**Corrección candidata dentro del mismo Gate:** las caras terminales consumen el perfil curvo sin tapones superpuestos, y las uniones con dos bandas coincidentes se sueldan para evitar polígonos sin área.

**Pruebas del asistente:** `node --test scripts/test-mesh-bevel-edge-corr-g001.mjs` **18/18 PASS**; regresión Node de modelado **258/258 PASS**; exploración geométrica adicional **3.172 selecciones/segmentos sin caras invertidas ni bordes abiertos**. La exploración es diagnóstico, no sustituye al QA visual.

**Repetir QA del usuario:** abrir el cubo en Edit Mode, biselar una arista vertical con 6 segmentos y observar **desde arriba y de lado** la cara donde termina el bisel; comprobar que el contorno redondeado se une sin tapa invertida, esquina cuadrada conservada ni triángulos negros. Repetir con dos aristas convergentes, tres y las cuatro aristas del perímetro superior; probar Ctrl+B, C, Escape y Undo. Guardar/reabrir la escena y ejecutar `npm run build`. Adjuntar capturas lateral y superior, junto con consola si falla.

**Estado:** IMPLEMENTADO (QA UPDATE) · NODE PASS · BUILD/ELECTRON/QA VISUAL NO VERIFICADOS · **GATE NO CERRADO**.

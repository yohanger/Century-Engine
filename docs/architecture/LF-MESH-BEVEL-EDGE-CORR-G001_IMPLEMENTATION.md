# LF-MESH-BEVEL-EDGE-CORR-G001 — Implementación

**Autorización:** `Listo. LF-MESH-BEVEL-EDGE-CORR-G001 autoriza comenzar`.
**BASE:** `LevelForge_WEATHER_TORNADO_NATURAL_S04_G001_CORR_002_SOURCE_BASELINE.zip`.
**Estado:** IMPLEMENTADO · pruebas Node PASS · Electron/build/QA visual NO VERIFICADOS · NO CERRADO.

## Hallazgos antes de corregir

- `session-modal.js` consumía `C` durante Bevel sin alterar el estado del bisel.
- `bevel-boundary.js` rechazaba aristas de contorno conectadas, aunque pertenecieran a la misma cara aislada.
- `bevel.js` limitaba recortes por un factor constante del 45% sin exponer al usuario Clamp Overlap.
- El Bevel de vértices aprobado (`Ctrl+Shift+B`) y el Bevel de aristas son operaciones distintas; no se reemplaza una por otra.

## Mecanismo aplicado

- `bevel-boundary.js`: bandas por niveles, con vértices compartidos en los extremos de aristas consecutivas de una misma cara aislada. Un único polígono interior reemplaza la cara original. Valida contorno, orientación y validez antes de aplicar cambios.
- `bevel.js`: usa el límite conservador de longitud solo cuando Clamp está activo; no crea otra herramienta geométrica.
- `ops-edit.js`: validación explícita de parámetros, cálculo del ancho uniforme permitido, generación sobre una copia y aplicación atómica si la topología obtenida es válida.
- `session-modal.js`: `C` alterna Clamp ON/OFF; el HUD informa el estado y el ancho efectivo. El ancho, perfil, número de segmentos, cancelar/confirmar y Undo siguen usando el modal existente.
- `ShortcutsModal.vue`: ayuda del atajo actualizada.

## Compatibilidad y límites

- No se mezcla en una misma operación un grupo de aristas de contorno con otro de aristas compartidas por dos caras. Se muestra error y se conserva la malla.
- El bisel de contorno conectado admite una o varias aristas consecutivas sobre caras **aisladas**; para una superficie compartida por caras adyacentes se usa la ruta de aristas interiores ya existente. No se promete compatibilidad con contornos no manifold.
- Desactivar Clamp elimina el límite conservador, pero no garantiza que cualquier ancho sea geométricamente válido. La previsualización debe rechazar selecciones que no pueda reconstruir sin dañar la malla.
- El límite geométrico no sustituye a un detector exhaustivo de intersecciones tridimensionales de superficies complejas. Debe verificarse el aspecto de cada caso real en QA usuario.
- La prueba histórica BA-04 exigía rechazar aristas de contorno consecutivas. Esa expectativa queda **SUPERSEDIDA por este Gate**: ahora se verifica que la operación funciona en una cara aislada sin mutaciones parciales.
- Continuous Grab / cursor de movimiento ilimitado es otro Gate y permanece fuera de alcance.
- No se modificaron escenas del juego, sistema de física, runtime Player ni otros módulos de modelado.

## Archivos de producción afectados

- `src/core/mesh/bevel.js`
- `src/core/mesh/bevel-boundary.js`
- `src/core/mesh/ops-edit.js`
- `src/core/mesh/session-modal.js`
- `src/components/ShortcutsModal.vue`

## QA UPDATE — remate superior de esquinas (31-10-2026)

**Evidencia de usuario:** aprobación parcial con captura `image(20261031-234704).png`. El redondeo lateral era visible, pero la unión con la parte superior no respetaba el bisel. El Gate sigue abierto; no constituye un Gate nuevo.

**Causa raíz reproducida:** `bevel.js` generaba un tapón al final de una arista biselada mientras mantenía el vértice original dentro de la cara terminal. El tapón quedaba coplanar y superpuesto, con orientación opuesta a esa cara. Cuando dos aristas biseladas convergían, ciertos tapones se construían con dos perfiles geométricamente coincidentes y área cero; la validación anterior solo descartaba vértices repetidos por ID, no coincidencias geométricas.

**Corrección acotada en `bevel.js`:**

- Si un bisel termina sobre una única cara coplanar, el contorno curvo sustituye el rincón en esa cara y no se crea un tapón adicional.
- Si dos perfiles de una misma unión tienen posiciones coincidentes, se sueldan sus vértices compartidos y se elimina la cara degenerada, manteniendo la orientación de las bandas.
- Los casos complejos no coincidentes siguen utilizando el parche anterior. No se modifica el bisel de contorno, la física, la persistencia, el modal ni la selección.

**Validación:** BE-16..BE-18 añaden control de remate superior/inferior, ausencia de esquinas originales residuales, normales coherentes y malla cerrada. 18/18 pruebas focales PASS; 258/258 Node PASS en regresión de modelado; exploración auxiliar de 3.172 selecciones/segmentos válidos de cubo sin bordes abiertos ni caras invertidas. **NO VERIFICADO:** render Electron, build Editor/Player y QA visual local sobre la escena del usuario.

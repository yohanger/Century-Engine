# LF-THREE-S05-G001 — BatchedMesh selectivo

**Fuente de entrada:** `LevelForge_THREE_S04_G002_CORR_001_SOURCE_BASELINE.zip` (720 archivos).  
**Autorización:** `Listo. LF-THREE-S05-G001 autoriza comenzar` — 2026-10-25.  
**Estado:** implementado en código; **QA visual/WebGL/Player y aceptación pendientes**.  
**Three.js:** r170 sin actualización.

## Arquitectura y alcance

- `BatchedMesh` oficial (`THREE.BatchedMesh`) se integra como ciclo temporal dentro de `LodManager`, únicamente durante Play Mode / Player. No se crea otro gestor permanente ni cambia el guardado de objetos.
- **Dos opt-ins:** Ajustes → Render → `Batching de decoración` (apagado por defecto) y checkbox `Decoración estática (batch)` en cada primitiva/malla editable. El valor se conserva en el `props` del objeto; proyectos antiguos mantienen ambas opciones inactivas.
- Solo admite mallas únicas sin hijos de proyecto, material PBR físico **simple opaco compatible**, índices/atributos de geometría compatibles, transformaciones sin escala reflejada, sin lightmaps, texturas, sondas, shader personalizado, skinning, morph, grupos de materiales ni CSG. Los objetos dinámicos, interactivos o que deban moverse **no deben marcarse**. Los `model`/GLB, Gameplay Objects, eventos, triggers, vegetación y geometría animada están excluidos. La comprobación técnica rechaza además los tipos no permitidos.
- Agrupación por firma de atributos de geometría y valores visuales de material. Solo agrupar tres o más instancias compatibles; máximo 64 por grupo, 65 535 vértices y 180 000 índices. Varias geometrías distintas se almacenan en una sola malla cuando son compatibles, y la misma geometría no se copia varias veces dentro del batch.
- No se activa si falta la extensión `WEBGL_multi_draw` del WebGLRenderer. No forzar la ruta alternativa del addon que podría ser más lenta. Un grupo pequeño, incompatible o demasiado grande conserva los objetos originales.
- El batch se añade a `vp.scene` conservando matrices de mundo originales. **No modifica identidad, árbol de nodos, colisiones Jolt ni modelos fuente**. Las mallas visuales originales se ocultan para dibujar solo el batch y se restauran al detener Play, cambiar escena o disponer del gestor; el batch destruye exclusivamente sus buffers internos (no materiales/objetos originales).
- El ciclo de vida y perfilador existentes son autoridad. Los contadores `batchedMeshes` y `batchedObjects` se añaden a `vp.perf.stats.extra` y se restablecen al salir de Play. `LOD` sigue independiente; puede estar apagado mientras el batching está encendido. Los originales ocultos se excluyen de simplificación LOD.
- **Limitación contractual:** el marcado significa decoración fija. Si un script mueve una malla después de entrar en Play, el batch no sigue automáticamente ese movimiento. No se marcan objetos que deban desplazarse, animarse o cambiar visibilidad dinámicamente. Las colisiones de Jolt siguen ligadas a los originales; requieren QA in situ.

## Auditoría S05 — componentes oficiales evaluados, no integrados

| Componente | Hallazgo | Decisión |
|---|---|---|
| `InstancedMesh` | Vegetación y chunks ya lo utilizan | Conservar, no duplicar |
| `THREE.LOD` | Intercambio por distancias; `LodManager` ya usa tamaño proyectado, histéresis y culling por terreno | No sustituir sin medición |
| `SimplifyModifier` | r170 puede descartar atributos adicionales; `lodgeo.js` ya simplifica geometría según ratios | Evaluación documental, no sustitución |

Documentación de r170: https://github.com/mrdoob/three.js/blob/r170/src/objects/BatchedMesh.js ; https://threejs.org/docs/pages/BatchedMesh.html

## Pruebas ejecutadas (entorno de entrega)

- `node --test scripts/test-three-s05.mjs`: **13 PASS, 0 FAIL, 1 SKIP** (prueba dinámica con Three.js real pendiente de `npm ci`).
- Regresión ejecutable `scripts/test-*.mjs`, excepto `test-starcat.mjs` que no puede importar Three.js en este entorno: **841 PASS, 0 FAIL, 15 SKIP**.
- Comprobación de sintaxis de los módulos JS modificados: PASS.
- `npm run build`: **NO VERIFICADO** (`vite: not found`). Compilación Editor/Player, calidad visual WebGL y medidas GPU no ejecutables aquí. No se atribuye PASS a pruebas ausentes.

## QA local de aceptación

- [ ] Guardar copia de los archivos locales que difieran del baseline; **no** extraer CHANGE sobre modificaciones nuevas sin reconciliación.
- [ ] `node --test scripts/test-three-s05.mjs` y `npm run build`: compilación tanto Editor como Player.
- [ ] Abrir un proyecto antiguo y confirmar que el render no cambia y `batchStatic` es false.
- [ ] Crear ≥3 primitivas/mallas opacas del mismo material con Geometrías compatibles; marcar cada una como `Decoración estática (batch)`, activar `Batching de decoración` global.
- [ ] Validar que con GPU y `WEBGL_multi_draw` compatibles disminuyen las draw calls; si la extensión falta, confirmar fallback intacto sin avisos GL.
- [ ] Probar con colores distintos, texturas, shader personalizado, lightmap, objetos con hijos, no marcados, escala negativa y geometrías demasiado grandes: todos excluidos sin cambios de aspecto.
- [ ] Probar la colisión Jolt con primitivas marcadas, `game.raycast`, selección del Editor antes/después y eventos no marcados.
- [ ] Comprobar detener Play, reanudar, cambiar de escena y guardar/abrir: nodos originales y colisiones conservados y sin crecimiento de memoria.
- [ ] Verificar con SSR, Lensflare, OutlinePass, DOF, sombras, cielo, WATER y modo Clásico/Realista, sin regresión.
- [ ] Comparar con PerfStats el tiempo de fotograma P95, draw calls y memoria con batching OFF/ON, manteniendo cámara, render y geometrías equivalentes. Un valor menor de draw calls sin mejora de P95 no implica aprobación de rendimiento.
- [ ] Ejecutar y revisar el Player exportado. No declarar soporte verificado solo porque compile el Editor.

## Entrega

**Exactamente dos ZIP**: `LF-THREE-S05-G001_CHANGE.zip` y `LevelForge_THREE_S05_G001_SOURCE_BASELINE.zip`. Sin SHA separado ni scripts `.sh`. Mantener SOURCE_BASELINE como referencia para el siguiente Gate; no extraerlo encima de la instalación existente.

# LF-PERFORMANCE-S17-G003-CORR-003 — QA y trazabilidad

**Fecha:** 2026-11-18. **Autorización literal recibida:** `Listo. LF-PERFORMANCE-S17-G003-CORR-003-TRIANGHOR-SPATIAL-AND-REAL-COMPLEXITY-DIAGNOSTICS autoriza comenzar`.

**Estado de la entrega:** IMPLEMENTADO EN FUENTES · TEST PASS (Node) · COMPILACIÓN NO VERIFICADA · QA LOCAL ELECTRON/PLAYER NO VERIFICADO · APROBACIÓN PENDIENTE · CIERRE PENDIENTE.

## 1. Fuentes y autoridad

- SOURCE_BASELINE de entrada: `LF_PERFORMANCE_S17_G003_CORR002_VIEWPORT_OVERLAYS_AND_DIAGNOSTIC_UX_CLEANUP_SOURCE_BASELINE(1).zip` adjuntado por el usuario. 3.649 entradas; CRC PASS. Cambios hechos exclusivamente sobre copia aislada.
- Usuarios no han aportado un archivo de escena con el terreno fotografiado dentro de esta entrega. La captura de 32.768→4.780 triángulos, 85,4 % de reducción es evidencia de la UI del usuario, **no** una escena que podamos medir directamente aquí.
- Contratos anteriores de Terrain, Clusters, LOD, World/Clouds, proyecto pre-1.0 y horneado de iluminación se mantienen; no se introducen migraciones ni eliminación de archivos.
- Referencia oficial Meshoptimizer: API de `simplifyWithAttributes`, LockBorder, etc., investigada. Existe integración previa de Meshopt a través de Three para otras mallas. **No se añadió dependencia nueva ni se copió otra implementación de Meshoptimizer**: TriangHor extiende el simplificador actual de Terrain.

## 2. OBSERVADO

- `terrain-adaptive.js` horneaba parches con un fan desde vértice central, que generaba triángulos estrechos en algunos bordes.
- `bakeSceneTerrain()` ejecutaba la simplificación síncronamente en la UI.
- `_updateTerrain()` repetía `partitionTriangles()` cuando cambiaba `stride`, al construir otra vez las páginas y sus esferas. Cuando Terrain proyectaba sombras incluía todas las páginas en el índice activo, aunque no intersectaran el frustum principal.
- Shader Complexity pintaba Terrain por el número de lecturas GLSL **potenciales del código compilado**, aunque el splat pudiera descartar capas de peso cero. El color no es un tiempo de GPU.
- `PerfMonitor` ya proporciona `EXT_disjoint_timer_query_webgl2`, si el controlador lo permite, y el pase `Cielo atmosférico`. No se añade otra consulta GPU ni se simulan tiempos.

## 3. IMPLEMENTADO

1. Módulo `src/engine/runtime/render/trianghor/` con núcleo y Worker CPU de horneado, protocolo de cancelación, triangulación, árbol espacial y estimación del coste por capa en Shader Complexity. No hay un segundo renderer.
2. Triangulación convexa de contornos de parches que elimina el centro artificial cuando es válido, preserva los vértices de borde y respeta orientación de triángulos. El solver **existente** certifica errores geométricos y de pintura sobre el índice FINAL; si falla, subdivide o rechaza el resultado. Se sigue priorizando fidelidad sobre porcentaje.
3. `ClusterMeshes`: conserva hasta tres variantes de páginas producidas por `partitionTriangles()`, consulta esas páginas mediante árbol espacial y emite un índice real por selección. Aplica unión de frusta de cámara y luces Direccionales/Spot cuando están disponibles; para puntos/otros pases no soportados conserva páginas de sombra (fallback seguro). Evita reconstruir páginas únicamente porque la cámara se mueve.
4. `Terrain`/estado de escena: botón llama a Worker; conserva fuente, se verifica que el terreno no cambió antes de publicar, cancelación por reemplazo/Restaurar, rollback de cambios parciales, metadatos compactos en `store.pieces` sin duplicar arrays grandes de índices en la reactividad Vue.
5. Cambios de edición o recarga sin índice válido recalculan en Worker. Mientras no finaliza, se utiliza la geometría de origen; no se ejecuta el solver pesado en el render loop de `ClusterMeshes` ni en la ruta LOD fallback.
6. Shader Complexity para Terrain usa pesos interpolados y presencia de texturas por **fragmento**. Un terreno con una capa de color no puede volverse rojo solo por ocho capas escritas en el shader. Para materiales ajenos a Terrain sigue la estimación GLSL estática; nubes siguen mostrando iteraciones de raymarch. Son criterios distintos y deben interpretarse por su leyenda, NO como ms GPU.
7. Se incorpora modo Overdraw: acumulación aditiva de fragmentos geométricos sin depth test (cobertura visual conservadora; nubes excluidas de este modo). El pase `Cielo atmosférico` sigue teniendo tiempos GPU reales solo cuando la extensión y F3 están activos. HUD muestra `Cielo GPU` exclusivamente si hay medida.
8. El Inspector identifica **TriangHor** y expone progreso y botón inactivo mientras el Worker procesa. PerfPanel incorpora recuentos de páginas activas/totales, nodos consultados, pruebas espaciales y tiempo de horneado CPU del Worker.

## 4. Evidencia cuantitativa: fixtures sintéticos, NO escena del usuario

| Terreno sintético | Triángulos fuente | Triángulos calculados | Reducción | Acotación |
|---|---:|---:|---:|---|
| Plano 128×128 | 32.768 | 510 | 98,44 % | Altura y pintura constantes; se conservan todos los vértices de borde |
| Bulto local suave 64×64 | 8.192 | 636 | 92,24 % | Error de altura 0,08; pintura 0,06; otros perfiles pueden variar |
| Bulto local suave 128×128 | 32.768 | 864 | 97,36 % | Mismas tolerancias |
| Bulto local suave 176×176 | 61.952 | 1.136 | 98,17 % | Mismas tolerancias |

Los tiempos de la CPU de este entorno no son transferibles al Pentium Silver N5030 ni prueban FPS o memoria GPU. El 90 % es **objetivo condicionado** a tolerancia y escena, no garantía universal. Los bordes densos siguen pudiendo generar triángulos estrechos: la triangulación no promete calidad isotrópica perfecta.

## 5. Evidencia de QA de código

- 12/12 pruebas nuevas `scripts/test-trianghor-s17-g003-corr003.mjs` PASS. Incluye prueba REAL del Worker en `node:worker_threads` importando el mismo `bake.worker.js` a través de adaptador QA, cancelación, árbol espacial, prueba de unión conservadora de camera/shadows, certificación de topología, pintura y estimación por píxel.
- 55/55 PASS batería focal (nuevas + G003 original + CORR-001/002 + ViewModes).
- 99/99 PASS batería ampliada con pruebas de cielo/tormenta. No se reporta fallo nuevo en ese subconjunto.
- Sintaxis de módulos JS Node: PASS (archivos modificados con extensión `.js`).
- `npm run build`: BLOQUEADO (`vite: not found`), ya que `node_modules` no está instalado en este entorno. Compilación real de Vue, importación Vite `?worker&inline`, GLSL WebGL2, Electron/Play/Player, shader visuals, sombras y FPS: **NO VERIFICADOS**.
- Registros reproducibles dentro de `docs/qa/evidence/LF_PERFORMANCE_S17_G003_CORR003/`.

## 6. Criterios de QA LOCAL obligatorios

1. Aplicar CHANGE sobre exactamente el SOURCE_BASELINE original anterior o utilizar el SOURCE_BASELINE nuevo. No sobrescribir cambios locales sin comparar.
2. `npm install`, `npm run build`, `npm run electron`. Probar los runtimes y renderer WebGL2/Player según perfil realmente disponible.
3. En Escena: Hornear Mapa · TriangHor, grabar tiempo CPU del Worker, progreso, cancelación, reducción y números de páginas, antes/después de guardar/recargar y editar pincel/terreno. Revisar que una escena eliminada durante el Worker no reciba resultados obsoletos.
4. En ViewModes Triangles/Clusters/Wireframe/LOD: acercarse y alejarse, comprobar visualmente topología sin grietas, triángulos efectivos y caché de páginas; medir p50/p95, no solo FPS instantáneo.
5. Con sol/cámaras y sombras activas: comparar sombras de Terrain con baseline; alternar Directional, Spot y Point. Verificar que las páginas fuera de cámara necesarias para sombras no desaparecen.
6. Shader Complexity: un terreno con una sola capa de color debe aparecer en rango bajo del mapa de estimación; con varias capas texturizadas debe aumentar. Activar modo Overdraw, verificar que informa sobre acumulación de fragmentos **geométricos** y no sobre ms de GPU. Comparar con pass GPU real de `Cielo atmosférico` en F3.
7. Reproducir el proyecto y cámara exacta del screenshot con 32.768→4.780 triángulos. **No declarar meta 90 % PASS hasta medir error, forma, sombras y resultado real**. Si no es viable sin perder calidad, registrar porcentaje alcanzado y limitación.

## 7. Contradicciones y deuda controlada

- **Sin GPU independiente:** toda selección de TriangHor conserva un único índice de dibujo para la cámara y las sombras. La selección en sombras se mantiene conservadora si falta información frustum fiable; no afirmar oclusión total, HZB, Nanite, meshlets GPU ni un 90 % universal.
- **Primer acceso a un LOD nuevo:** aún debe particionar una vez sus índices en CPU; el caché evita repetirlo cada movimiento. La partición geométrica está en `partitionTriangles()` de ClusterMeshes, no dentro de un sistema duplicado.
- **Shader Complexity:** el color Terrain se basa en capas/texturas efectivas; no son tiempos reales del fragment shader. La GPU timer mide pases completos, no objetos individuales. Overdraw visual excluye nube volumétrica.
- **Build/QA visual:** sin evidencia, permanece NO VERIFICADO; ningún Gate aprobado o cerrado.

**SIGUIENTE ACCIÓN:** QA gráfico en el equipo del usuario y contraste con su terreno antes de aprobación o cierre. No iniciar un Gate adicional sin autorización.

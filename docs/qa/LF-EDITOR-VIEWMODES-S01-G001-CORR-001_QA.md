# QA — View Modes CORR-001 · Native Clusters / Terrain

## Estado de evidencia (18-11-2026)

| Actividad | Evidencia | Resultado |
|---|---|---|
| SOURCE_BASELINE G001 | 3.601 archivos originales extraídos sin modificar | SOURCE DISPONIBLE |
| Pruebas Node específicas | `node --test scripts/test-editor-native-clusters-corr001.mjs scripts/test-editor-viewmodes-s01-g001.mjs scripts/test-shader-source-metrics-corr001.mjs` | **35/35 PASS**, 0 FAIL, 0 SKIP |
| JavaScript syntax | `node --check` en módulos alterados y runners nuevos | PASS |
| npm ci offline | `npm ci --offline --ignore-scripts --no-audit --no-fund --prefer-offline` | **BLOQUEADO:** `ENOTCACHED zip-stream-4.1.1.tgz` |
| Vite build | No ejecutado al faltar dependencias | **NO VERIFICADO** |
| Fixture Electron/WebGL2 | `scripts/test-editor-viewmodes-electron-s01-g001.mjs` (mínimo 25 checks) | **PREPARADO, NO EJECUTADO** |
| Compatibilidad WebGL2 / Player / sombras | Requiere usuario local | **NO VERIFICADO** |
| Rendimiento 4 GB / GPU | Sin medición actual comparable | **NO VERIFICADO** |

## Escenarios programados para Electron

VM01–VM16: WebGL2, Unlit, Lighting, Wireframe, Depth, Normals, luces candidatas, LOD, fuente GLSL, IBL, estado de material y errores GL. NC17–NC25: Triangles indexados, Terrain con páginas, edición de alturas, Clusters directos, mesh de 1 triángulo, restauración. La fixture no acredita todos esos escenarios hasta ejecutarse con renderer real.

## QA manual obligado antes de aprobación

1. Abrir Edit Mode **Lit** y comprobar que `clusterSources` y `clusterTerrainPages` se alimentan sin activar clústeres en Ajustes.
2. Alternar Triangles y Clusters con malla de un triángulo, cubo de 12 caras y Terrain; comparar caras visibles, índices seleccionados, contadores y paginación. Conservar geometría y materiales originales.
3. Mover cámara y editar altura y pintura de Terrain; verificar que no aparecen páginas antiguas ni grietas, que culling/LOD son coherentes y que las sombras permanecen correctas.
4. Entrar y salir de PlayMode; verificar restitución de índices, geometrías, shaders de Terrain, `frustumCulled`, batching y workers.
5. Repetir con WebGL2 Compatibility y, si está habilitado, WebGPU. Diferenciar selección de índice Terrain CPU y clústeres compute GPU.
6. Comparar escena de referencia (24 FPS / 37,9 ms GPU): medir cielo, terreno, sombras y coste por pasada sin inferir causas a partir de draw calls o triángulos aislados.
7. No aprobar como completos Shader Complexity ni ScreenBounce desglosado mientras falten salidas reales. No cambiar tests para hacerlos pasar mediante un fallback Lit.

**Conclusión:** IMPLEMENTADO EN FUENTES, TEST NODE PASS; QA LOCAL, COMPILACIÓN, GPU y aprobación de usuario PENDIENTES. Gate NO CERRADO. Ninguna mejora de FPS afirmada.

# LevelForge · LF-RENDER-PIPE-S01-G001

**Gate:** autorizado el 2026-10-25 mediante `Listo. LF-RENDER-PIPE-S01-G001 autoriza comenzar`.
**Estado:** IMPLEMENTADO EN FUENTE · QA VISUAL/COMPILACIÓN LOCAL PENDIENTE · NO CERRADO.
**Fuente de entrada:** `LevelForge_AUDIO_S02_G001_CORR-001_SOURCE_BASELINE.zip` (689 archivos).

## 1. Objetivo y alcance

Corregir la composición del shader del terreno, que insertaba las capas de pintura y WaterFX sustituyendo `#include <color_fragment>` y después trataba de insertar `WET_COLOR` sobre el mismo marcador, ya inexistente. Además, limitar el aspecto especular de tierra húmeda y reservar los reflejos concentrados para charcos bien delimitados. Preservar MeshStandardMaterial, el material PBR del resto de objetos, iluminación, WaterFX, datos guardados y exportación.

## 2. Implementación

- `src/engine/runtime/geometry/terrain.js`: un solo punto de inyección para color de capas → interacción con agua → humedad; rugosidad WaterFX → humedad → nieve. `WET_NORMAL` queda después de `normal_fragment_maps`. No se añaden parámetros persistidos ni se cambia `MeshStandardMaterial({ roughness: 0.95, metalness: 0 })`.
- `src/engine/runtime/render/wetlib.js`: con `uWet=1` y sin charcos, tierra base 0.95 conserva rugosidad aproximada 0.8075. Solo donde hay charcos la máscara permite llegar a 0.09; se exige humedad alta, terreno plano y una región de ruido restringida. Se corrige el `smoothstep` de onda que estaba escrito con límites inversos. Se omiten cálculos de ruido de charcos y ondas cuando el suelo está seco o las condiciones de lluvia/pendiente no los requieren.
- Se mantienen `WETU`, `patchTerrainWet`, `WM`, `WFX_TERRAIN_*`, `NatureFX`, nodos Point/Spot, parámetros de luz, ACES/Bloom, PBR general y esquema de proyecto.

**Naturaleza de los valores:** son parámetros de calibración inicial para evitar el aspecto de espejo en tierra, no una validación fotométrica ni una garantía de realismo. Requieren comparación visual en GPU.

## 3. Pruebas ejecutadas en entorno de elaboración

| Prueba | Evidencia | Estado |
|---|---|---|
| Nueva suite `node --test scripts/test-render-pipe-s01.mjs` | 7 PASS, 0 FAIL, 0 SKIP | PASS |
| Regresión combinada (nueva suite + Audio S01/S02/CORR + DB + THREE S01) | 447 PASS, 0 FAIL, 9 SKIP | PARCIAL |
| `node --check` de ambos JS modificados | Exit 0 | PASS |
| `npm run build` | `vite: not found`, exit 127 | NO VERIFICADO |
| Shader WebGL compilado / GPU visual | Dependencias y ejecución gráfica ausentes | PENDIENTE |
| Editor y Player exportado | No ejecutados aquí | PENDIENTE |

Las 9 pruebas SKIP son casos dependientes de Three.js ausente en este entorno; no equivalen a pruebas superadas. La suite nueva reconstruye el `onBeforeCompile` real con un harness ligero y comprueba inserciones GLSL, orden de etapas y resultados numéricos de rugosidad. **No sustituye una compilación GLSL/WebGL real**.

## 4. Instrucciones de aplicación y comprobación

Ruta del proyecto del usuario: `$HOME/ENGINES/lf-0.26.13/lf`.

Comparar antes de sobreescribir si se han realizado cambios manuales en:

- `src/engine/runtime/geometry/terrain.js`
- `src/engine/runtime/render/wetlib.js`
- `docs/qa/LevelForge_DB_Ledger.xlsx`

El CHANGE contiene también la prueba nueva y este documento. Aplicar con `unzip -o` **solo después de reconciliar archivos locales**. El SOURCE_BASELINE es para custodia y futuros Gates; no extraerlo encima del proyecto activo.

Desde la raíz del proyecto:

```bash
node --test scripts/test-render-pipe-s01.mjs
node --test scripts/test-audio-s01.mjs scripts/test-audio-s02.mjs scripts/test-audio-s02-corr001.mjs
node --test scripts/test-db-contract.mjs scripts/test-three-s01.mjs
npm run build
npm run electron
```

Se espera 7 PASS / 0 FAIL en la suite nueva. Con node_modules presentes deben ejecutarse los casos Three.js antes omitidos. El build del Editor y Player debe finalizar sin errores; advertencias no fatales deben registrarse, no ignorarse.

## 5. QA visual obligatorio (mismos cámara, luz y terreno)

- [ ] **Seco:** sin lluvia ni nieve: terreno iluminado de manera difusa y sin reflejo tipo espejo; comprobar que el color de las capas y texturas permanece correcto.
- [ ] **Húmedo:** lluvia sostenida durante suficiente tiempo: el terreno se oscurece moderadamente, pero no refleja como un charco continuo.
- [ ] **Charcos:** después de humedad alta, solo zonas pequeñas y planas muestran reflejos definidos; los taludes no se convierten en espejos.
- [ ] **Ondas:** con lluvia activa y charcos, no aparecen artefactos de normales, puntos NaN ni fallos de GLSL.
- [ ] **Agua / costa:** conservan el tinte y oscurecimiento del mapa de interacción existente.
- [ ] **Point Light:** comparar suelo seco/húmedo/charcos sin mover la luz ni la cámara; no modificar su energía como solución de la anomalía.
- [ ] **Spot Light:** repetir comparaciones sin cambios de comportamiento fuera del terreno.
- [ ] **Bloom ON/OFF:** evaluar cuánto amplifica el brillo sin utilizarlo para ocultar un defecto de humedad.
- [ ] **Materiales primitivos:** ninguna diferencia funcional en materiales PBR no pertenecientes al terreno.
- [ ] **Compatibilidad:** cargar proyecto previo, guardar, reabrir y confirmar que los datos no cambian ni se pierden.
- [ ] **Editor / Player:** igualdad visual en `npm run electron` y juego exportado.
- [ ] **QA del usuario:** compartir captura(s), resultado de `npm run build` y pruebas; cierre solamente tras aprobación explícita.

## 6. Fuera de alcance

Selector de color, Point/Spot globales, bloom/exposición global, CSM/SSR, sustitución de Terrain/WaterFX, baking PBR, incorporación de dependencias, parámetros nuevos por capa de tierra/roca/hierba y refactorización de render.

## 7. Entrega y comparación

**EXACTAMENTE DOS ZIP:**

1. `LF-RENDER-PIPE-S01-G001_CHANGE.zip`: únicamente los archivos modificados/nuevos de este Gate, incluidos QA, test y ledger.
2. `LevelForge_RENDER_PIPE_S01_G001_SOURCE_BASELINE.zip`: fuente completa acumulada; no incluir node_modules, dist o caches.

Sin archivo SHA independiente ni script de verificación no solicitado. Comparar los archivos del CHANGE con los homólogos del SOURCE_BASELINE. El ledger `docs/qa/LevelForge_DB_Ledger.xlsx` conserva las seis hojas: ROADMAP, BACKLOG, DEPENDENCIES, GATES, EVIDENCE, TRACEABILITY, con evidencia real y QA pendiente documentado.

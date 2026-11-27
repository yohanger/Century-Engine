# Matriz de QA — S13-G008-G007 temporal

**Estado actual:** 15/15 pruebas nuevas puras/de estructura PASS; G006 26/26 PASS; geometría 24/24 PASS; total selección 65/65 PASS. **Pruebas runtime Three.js y Vite: NO VERIFICADAS aquí** por dependencias no instaladas. **AppImage/Jolt WASM: NO VERIFICADOS.**

## Comandos locales (raíz con package.json)

1. `node --test scripts/test-timeline-property-animation-s13-g008-g007.mjs` — 15 pruebas, 0 fallos esperados.
2. `node --test scripts/test-timeline-property-animation-s13-g008-g007-runtime.mjs` — 10 pruebas con Three.js real, 0 fallos esperados.
3. `node --test scripts/test-timeline-property-animation-s13-g008-g006.mjs scripts/test-timeline-temporal-geometry-s13-g008-g002.mjs` — 50 pruebas, 0 fallos esperados.
4. `npm run build` — dos builds (Editor y Player); Vite no debe terminar con error. Las advertencias históricas de chunks no acreditan fallos de render.
5. `npm run electron` — QA visual del usuario, usando Electron embebido y no navegador externo.

## Escenarios de editor y Play Mode

| ID | Escenario | Evidencia exigida |
|---|---|---|
| QA-01 | Nueva pista `light.energy` con claves 0→4 | La luz cambia realmente en Play Mode, no solo en Inspector |
| QA-02 | Nueva pista `light.color` con colores extremos | Color interpolado de forma visible y estable |
| QA-03 | Seek y scrub con diferentes instantes | Misma muestra al regresar al mismo tiempo; sin comandos de reproducción |
| QA-04 | Preview y vuelta a edición | Valores de luz originales restaurados sin cambio del proyecto |
| QA-05 | Stop con energía/color modificados | Se restituye el snapshot de la sesión |
| QA-06 | Skip y fin natural | Sin snapshots obsoletos, restauración segura |
| QA-07 | Pause/Resume | Misma muestra y única posesión, sin duplicación |
| QA-08 | Loop | Sin acumulación de energía ni duplicación de snapshots |
| QA-09 | Segundo Timeline mismo canal | Se rechaza; primera sesión conserva su autoridad |
| QA-10 | Dos Timelines en canales distintos | Ambos funcionan sin interferencia |
| QA-11 | Script `game.node(...).light.energy` durante Timeline | Rechazo observable; no modifica el canal reservado |
| QA-12 | Script `game.node(...).light.color` | Rechazo si está reservado; otros canales operativos |
| QA-13 | Animation Clip que anima mismo canal y otro distinto | Canal reservado permanece en Timeline; el otro sigue animándose |
| QA-14 | Desactivar/eliminar luz durante la sesión | Posesión invalidada, sin restauración sobre nodo inválido |
| QA-15 | Cambio de escena y repetición | Sin referencias/canales de la escena anterior |
| QA-16 | Pistas antiguas position/rotation/scale/visible | Comportamiento y salida histórica intactos |
| QA-17 | Bake Jolt y rigidbody dinámico | Sin nuevas mutaciones físicas por pistas de luz; Jolt WASM requiere prueba real |
| QA-18 | Guardar, duplicar, cargar y exportar | IDs de escena/nodo y valores tipados persistidos sin cambios destructivos |
| QA-19 | Preview con Inspector editado | Restauración respeta edición autoral y Undo/Redo |
| QA-20 | Game exportado y AppImage independiente | Paridad con Play Mode; proporcionar salida/log de ejecución |
| QA-21 | `object3D` o escritura directa Three.js durante posesión | **NO CERTIFICADO**: documentar si existe un bypass que contradiga TB01-03; no dar PASS sin evidencia |
| QA-22 | Mutación de `light.fadeTo/turnOff` concurrente | Debe rechazar los canales ocupados sin afectar a los demás |

**Evidencia a devolver:** salidas completas de ambos `node --test`, `npm run build`, comportamiento visual observado y, si se prueba, ruta/log del AppImage exportado. No marcar `CERRADO` hasta resolución de bloqueos, aprobación y sincronización posterior del ledger.

# LF-CLOUD-EVOLUTION-S01-G001 — Evidencia y QA

**Sistema:** LevelForge 0.26.13 (versión de proyecto, no garantía LTS). **Fuente de referencia:** SOURCE_BASELINE G003. **Tipo:** implementación autorizada S01-G001; resultados medidos en contenedor (Node), NO QA visual local.

## 1. Cambios sometidos a QA

Formas continuas, identidad de celda, transporte por viento, CloudVolume cold-start remoto sin frame vacío, reloj meteorológico compartido, Edit Mode congelado con previsualizaciones, guardado de evolución y compatibilidad de escenas `classic`. El volumen GPU conserva RG8. Se actualizaron runners previos que codificaban comportamientos reemplazados; los fallos históricos de otros subsistemas permanecen documentados.

## 2. Runners y comandos reproducibles

```bash
node --test scripts/test-cloud-evolution-s01-g001.mjs
node --test scripts/test-cloud-evolution-integral-validation-g001.mjs
node --test scripts/test-clouds.mjs
node --test scripts/test-atmosphere.mjs
node --test scripts/test-cloud-altitude-horizon-corr002.mjs
node --test scripts/test-cloud-natural-scale-corr003.mjs
node --test scripts/test-weather-unification-s04-g001.mjs
node --test scripts/test-weather-lightning-world-s11-g001.mjs
node --test scripts/test-weather-tornado-natural-s02-g001.mjs
node --test scripts/test-weather-tornado-natural-s04-g001.mjs
node --test scripts/test-cloud-evolution-electron-s01-g001.mjs
npm run electron
```

En el entorno de entrega no existe `node_modules` ni Vite; se intentó el runner Electron y se detuvo antes de iniciar con `Falta Vite; ejecutar npm ci antes del QA`. Eso es bloqueo de entorno, NO fallo de GLSL/Frame ni QA gráfico PASS.

## 3. Resultados Node constatados

**Corrida consolidada final: 121/121 subpruebas PASS, 0 FAIL, 0 SKIP, 14.57 s** (`scripts/test-cloud-evolution-s01-g001.mjs`, caracterización G001, CloudField, atmósfera, CORR-002/003, Weather S04, Lightning S11, Tornado S02/S04). Ver `LF_CLOUD_EVOLUTION_S01_G001_NODE_EVIDENCE.log` con TAP íntegro. `node --check` de 13 módulos/runners modificados: PASS.

| Runner | Resultado |
|---|---|
| S01-G001 nuevo | 14 PASS, 0 FAIL |
| S00-G001 caracterización actualizada | 9 PASS, 0 FAIL |
| `test-clouds.mjs` | Runner PASS; 103 verificaciones internas |
| `test-atmosphere.mjs` | Runner PASS; 31 comprobaciones internas |
| CORR-002 escala/horizonte | 8 PASS, 0 FAIL |
| CORR-003 escala natural | 8 PASS, 0 FAIL |
| Weather unification S04 | 14 PASS, 0 FAIL |
| Weather lightning S11 | 36 PASS, 0 FAIL |
| Tornado natural S02 | 16 PASS, 0 FAIL |
| Tornado natural S04 | 14 PASS, 0 FAIL |

**Fallos históricos contrastados con G003:** Weather unification S01 13 PASS/1 FAIL, S03 15 PASS/1 FAIL (test apunta a `src/engine/runtime/player/fps/movement.js`, archivo retirado del proyecto); Tornado natural S01 12 PASS/6 FAIL (harness GLSL incompleto); Weather unification S02 10 PASS/2 FAIL (`stormCoverFromFrame` no definido en fixture). No se atribuyen a S01 cambios nuevos. Los runners basados en paquetes `three` o runtime físico no ejecutan en ausencia de dependencias.

**Microbenchmark exclusivamente CPU:** `node scripts/bench-cloud-natural-scale-corr003.mjs`, mediana de cinco repeticiones de 120.000 evaluaciones con calentamiento: 63.211 ms en G003 y 69.000 ms en S01; medición no estabilizada, NO es FPS ni perfil GPU. Repetir en hardware objetivo.

## 4. QA local de usuario — pendiente

1. Instalar dependencias según procedimiento habitual y ejecutar `npm run electron`. No confundir compilación Vite con validación visual.
2. Ejecutar runner WebGL2 S01 de 14 verificaciones, no el resultado histórico G001 12/12. Guardar consola, video de formación/transformación y sin errores shader.
3. Edit Mode: mover la cámara 20 km, cambiar cobertura y clima; no debe avanzar la meteorología con el tiempo ni modificar el proyecto. Agua, lluvia visual, vegetación y luces conservan sus previews previas.
4. PlayMode: despejado→parcial→cubierto→tormenta→despejado con viento y lluvia; observar 30–120 s continuos, crecimiento sin reemplazos instantáneos, varias morfologías, pausa, relámpagos, embudo, cielo y luz coherentes.
5. Player: mismo escenario y seed/tiempo, guardar a mitad de transición, cargar y verificar condensado/rayos/lluvia y teletransporte 20 km sin nubes vacías.
6. Perf: mismo escenario/cámara/resolución en Forward+, Mobile, Compatibility; FPS p50/p95, memoria y temperatura hardware. Revisión también desde cámara a nivel de suelo y aérea; horizonte y base de nubes naturales.

**No verificado:** build Vite, Electron gráfico real en entorno de entrega, Player exportado, Jolt, 60 FPS, integración visual de nubes con toda la geometría, A/B de fidelidad Nubis. La aprobación y cierre de Gate siguen pendientes.

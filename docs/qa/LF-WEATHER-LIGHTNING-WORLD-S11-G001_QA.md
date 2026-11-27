# QA — LF-WEATHER-LIGHTNING-WORLD-S11-G001

**Gate autorizado:** LF-WEATHER-LIGHTNING-WORLD-S11-G001.
**Estado:** IMPLEMENTADO · TEST NODE PASS · QA LOCAL PENDIENTE · NO CERRADO.

## Evidencia automática real

- `npm run test:weather-lightning-world`: 392 tests, **383 PASS, 0 FAIL, 9 SKIP**. Los nueve omitidos dependen de paquetes no instalados (Three.js/Jolt). No se cuentan como PASS.
- `node --test scripts/test-weather-lightning-world-s11-g001.mjs`: **36/36 PASS**. Valida generación determinista, canal/impacto compartidos, prioridad de Terrain/objeto/agua, ninguna colisión inventada, identidad y posición estables, evento único, antiguos modelos, opt-in, Jolt y ondas con mocks de runtime.
- `node --test scripts/test-lightning.mjs scripts/test-thunder.mjs`: **PASS**. Regresión física y acústica original.
- `node --check` de módulos JS modificados: PASS.
- `npm run build`: **NO VERIFICADO** en este entorno, `vite: not found`.
- `npm run docs:build`: **NO VERIFICADO**, dependencia de generador HTML no instalada.
- Editor Electron/Player, física real Jolt, audiopercepción, rendimiento y exportación: **PENDIENTE**.

## QA local obligatoria del usuario

1. En el SOURCE_BASELINE S10 vigente, respalda el ledger, revisa todos los archivos CHANGE frente a los locales e instala solo CHANGE si no hay conflictos. Ejecuta `npm ci`, `npm run test:weather-lightning-world`, `npm run docs:build`, `npm run docs:check`, `npm run build`, `npm run electron`.
2. Escena con Terrain y `Clima → Tormenta → Tipo de rayos: Físicos`. Habilita **Impactos físicos sobre el mundo**; pon la cámara en posiciones distintas. Comprueba que la descarga termina en su punto físico, sin traslación al mover la cámara luego.
3. Coloca una primitiva alta como techo y suelo bajo ella. Comprueba que el punto del evento corresponde a la primera superficie impactada y que no emite doble evento. Comprueba el comportamiento para objetos retirados.
4. Crea agua visible sobre Terrain, activa **Perturbar agua**. Verifica ondulación visual y que el inventario de `WaterWorld` y snapshots conserve volumen (no solo shader bonito).
5. Con `RigidBody3D` registrado, activa **Impulsos Jolt**. Verifica radio y fuerza acotados. Repítelo desactivado: no debe recibir impulso. No debe empujar estáticos ni generar daño automáticamente.
6. Script `game.on('lightningImpact', (impact) => { ... })`: inspecciona ID, seed, punto, normal, tipo de superficie, ownerId y corriente; comprueba una llamada por descarga. `game.on('lightning')` y `game.on('thunder')` deben continuar con su retardo.
7. Repite con rayos sencillos, impactos desactivados, sin Terrain y con edificios de diferentes alturas; no debe haber impactos falsos ni errores de runtime.
8. Guarda/reabre `.lfproj`, reproduce Play/Stop, cambia escena y exporta Player Linux y Windows según el pipeline vigente. Verifica PBR/PSX, FPS y memoria con varios rayos.

**Evidencia a devolver:** logs tests/build/docs, captura Inspector del clima, video comparando rayo y superficie golpeada, registro de evento y reproducción Player. No declarar PASS visual por compilar.

## Incidencia separada (no modificar en este Gate)

El registro local facilitado de `npm run dist:linux` muestra compilación Vite de Editor/Player, pero el preflight posterior se detiene por cuatro iconos de distribución ausentes (`build/icon.png`, `build/icon.ico`, `build/icons/256x256.png`, `build/icons/512x512.png`). No se ha auditado ni corregido en S11: requiere tratamiento independiente si persiste en el baseline local. No utilizar este log antiguo como evidencia de compilación S11.

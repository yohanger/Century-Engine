# LF-NODE-CHARACTER-AREA-S04-G001_CORR-001 — Coordinación física central

**Autorización:** 2026-10-28. **Baseline:** `LevelForge_NODE_CHARACTER_AREA_S04_G001_SOURCE_BASELINE.zip` (929 archivos).
**Estado de entrega:** IMPLEMENTADO / REGRESIÓN AUTOMATIZADA PASS; QA Jolt WASM, Editor y Player pendientes.

## Defecto verificado

Antes de CORR-001, `player/fps/movement.js` invocaba `ph.step(dt)` únicamente al mover el jugador FPS. `events/play-bodies.js` tenía un respaldo `ph.step(Math.min(dt,1/30))` solo si había cuerpos dinámicos especiales y el mundo no se había marcado como `stepped`. Por tanto, una escena con CharacterBody3D o Area3D sin FPS ni cuerpos dinámicos podía omitir la simulación. Ese respaldo, además, dependía de los fotogramas en lugar de consumir los pasos físicos fijos pendientes.

## Resolución

- `events/play-controls.js` ahora llama `this.phys?.step(fdt)` **una vez por cada iteración física fija** dentro de `_simStep` después de `game.fixedUpdate(fdt)` y antes de `player.update(fdt)`. Si `n===0`, no hay paso Jolt.
- `player/fps/movement.js` conserva la creación/teletransporte del `CharacterVirtual` del FPS y todo su movimiento, **sin impulsar Jolt**: el paso común ocurre antes del controlador. En el primer paso de la escena la cápsula FPS puede crearse durante `player.update`, como ocurría antes, y se incorpora al siguiente avance del mundo; el movimiento del personaje sigue utilizando `moveCharacter` en su actualización actual.
- `events/play-bodies.js` conserva la lectura/sincronización de cuerpos, efectos de agua, estados y la API `game.physics`, pero retira el paso físico de respaldo y el uso de la bandera `stepped`.
- `physics/jolt.js` conserva un único `JoltWorld`, `BodySet.beforeStep` y `nodeSpatial.tick` dentro de `step(dt)`; elimina únicamente la bandera de coordinación `stepped`, ya innecesaria.
- `frame()` sigue administrando el acumulador, pausa, avance manual, Film Maker y `n` pasos de `fdt`. Se reutiliza también en el juego exportado mediante PlayMode; no se introduce otro bucle ni temporizador.

## Orden vigente (sin cambio de Event Order Flow)

`timers → timeline → game.update → world → [snapshot → water → game.fixedUpdate → JoltWorld.step → player.update (si hay) → player.late] × n → profiles/lights/animation → events → inputTriggers → bodiesTick → waterFx/sense → game.lateUpdate`.

La llamada física antes se realizaba desde el inicio del movimiento FPS; ahora se efectúa explícitamente desde la coordinación, antes de actualizarlo. Los comandos de eventos y el intérprete no se modifican. La dependencia `nodeSpatial.tick()` continúa dentro de JoltWorld.step, una sola vez por paso.

## Alcance y protección

**Archivos autorizados modificados:**
- `src/engine/runtime/events/play-controls.js` (coordinación física fija)
- `src/engine/runtime/events/play-bodies.js` (retirada de respaldo por fotograma)
- `src/engine/runtime/player/fps/movement.js` (retirada de paso duplicado)
- `src/engine/runtime/physics/jolt.js` (retirada de bandera `stepped`)
- Test específico, contrato, QA y ledger.

Los **otros 47 archivos protegidos** de eventos siguen idénticos byte a byte contra S04. No se introducen ECS, World adicional, cola de físicas, API de scripts, nuevas formas físicas ni compatibilidad de escenas heredadas.

## Criterios, evidencia y limitaciones

Las 13 pruebas automatizadas del Gate examinan 4 configuraciones (sin FPS/dinámicos, FPS solo, dinámicos solos, ambos), varios pasos fijos, `n=0`, pausa, step manual, acumulador fraccional, Film Maker, falta de Jolt, orden de eventos y ausencia de otras llamadas al paso. Resultado: **13 PASS / 0 FAIL / 0 SKIP**.

Regresión seleccionada de 102 scripts (`test-starcat*` y `test-clouds*` excluidos): **2194 PASS / 0 FAIL / 19 SKIP**.

**NO VERIFICADO:** Jolt WASM real, colisiones/contactos reales entre nodos, Editor Electron, build Vite y Player exportado. Los tests usan dobles de dependencias de UI/Jolt para aislar el método real de coordinación. El bloqueo de cadencia se considera resuelto **en código**, pero la aceptación física integral de S04 necesita QA local. Las pruebas existentes simplifican la detección de pared/techo de CharacterBody3D: este Gate no modifica esos algoritmos.

# LF-CAMERA-SHAKE-S01-G003 — QA de API de reproducción

**Estado:** IMPLEMENTADO · TEST AUTOMATIZADO PASS · APROBACIÓN Y QA LOCAL PENDIENTES.

**SOURCE_BASELINE de entrada:** `LevelForge_CAMERA_SHAKE_S01_G002_SOURCE_BASELINE.zip` (830 entradas, íntegro).
**Autorización:** `Listo. LF-CAMERA-SHAKE-S01-G003 autoriza comenzar` (2026-10-27).

## Contrato ejecutado

El nodo Camera Shake Base sigue siendo la receta persistente. La API `game.cameraShake` controla únicamente su reproducción durante Play, en cámaras de escena o FPS:

- `game.cameraShake.play(nodo, { intensity: 1 })` → `boolean`. Inicia o reinicia a t=0; admite referencia por ID, nombre o handle. La intensidad opcional admite 0–1.
- `game.cameraShake.stop(nodo)` → `boolean`. Detiene la reproducción sin reactivar AutoPlay; Blend Out conserva su salida suave.
- `game.cameraShake.setIntensity(nodo, valor)` → `boolean`. Multiplicador temporal 0–1; no cambia amplitudes guardadas.
- `game.cameraShake.isPlaying(nodo)` → `boolean`. Consulta el estado de reproducción; durante Blend Out ya devuelve `false`.

Los nodos inexistentes, de otro tipo, ocultos o deshabilitados no reproducen efectos. Las referencias de clip inválidas no inician reproducción. Los efectos sin Loop se detienen al llegar al final. El reloj se congela durante pausa y se limpia al entrar en otra escena y al detener Play. La pose física, la cámara persistida, los raycasts, FPS, Jolt, Timeline y Film Maker conservan sus responsabilidades anteriores.

## Verificación automatizada — realizada en esta entrega

`node --test scripts/test-camera-shake-s01-g001.mjs scripts/test-camera-shake-s01-g002.mjs scripts/test-camera-shake-s01-g003.mjs`: **68 PASS / 0 FAIL** (21 + 25 + 22).

Regresión Node disponible (todos los `scripts/test-*.mjs`, excepto `test-starcat.mjs` por no estar instalado `three`): **1627 PASS / 0 FAIL / 18 SKIP**. `test-starcat.mjs` quedó fuera de la ejecución y no se contabiliza como PASS.

`node --check` de módulos JavaScript afectados: **PASS**.

`npm run build`: **NO VERIFICADO**, el entorno devuelve `vite: not found`. Electron, render Player GPU, Jolt real, exportación y QA visual del usuario: **NO VERIFICADOS**.

## Pruebas locales del usuario

1. Instalar dependencias en copia separada del SOURCE_BASELINE: `npm ci`, `npm run build`, `npm run electron`.
2. Crear Camera Shake Base con **Reproducir al iniciar** desactivado. Elegir la cámara del jugador y comprobar que, sin activar scripts, no se mueve.
3. Desde un script/evento, llamar a `game.cameraShake.play("Camera Shake Base")` y comprobar que comienza; repetir para reiniciarlo.
4. Probar `game.cameraShake.setIntensity("Camera Shake Base", 0.25)` y después `stop`. Con Blend Out mayor que cero, comprobar salida progresiva y que AutoPlay no reinicia el efecto.
5. Repetir con una cámara de escena. Verificar que la otra cámara no recibe el efecto. Probar Loop desactivado, pausa, escena distinta y referencia eliminada.
6. Confirmar que no cambian las colisiones, la mirada usada por interacciones, ni los movimientos FPS. Probar Timeline y Film Maker sin contaminación.

**Evidencia que debe devolver el usuario si encuentra un fallo:** instrucciones de reproducción, vídeo/captura, salida de `npm run build` y consola Electron/Player.

La aprobación del Gate no equivale a QA visual PASS. La guía funcional final de Game Feel y la aclaración de herencia de escala siguen reservadas para el cierre del Sprint.

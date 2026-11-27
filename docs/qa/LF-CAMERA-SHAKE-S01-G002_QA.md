# LevelForge — LF-CAMERA-SHAKE-S01-G002 — QA

Fecha: 2026-10-27. Estado: IMPLEMENTADO / TEST AUTOMATIZADO PASS / PENDIENTE APROBACIÓN DEL USUARIO.

## Contrato autorizado

- Extender **Camera Shake Base** dentro del nodo y runtime de G001, sin segundo editor de animaciones.
- Patrón `sine`: preserva todas las recetas anteriores sin campo `pattern`.
- Patrón `noise`: ruido continuo, determinista, sin aleatoriedad por fotograma. Usa amplitud XYZ, frecuencia, loop y fundidos existentes.
- Patrón `clip`: vincula por ID un Animation Clip ya guardado en `project.animations`. Evalúa exclusivamente pistas raíz (`path: ''`) de `position` y `rotation`, mediante `sampleTrack()` existente. Respeta la duración y velocidad del clip; `loop` y blend vienen del nodo Camera Shake Base. Las rotaciones del clip se interpretan en grados.
- El clip actúa como **desplazamiento local visual**, no pose absoluta del jugador. No se ejecutan comandos ni eventos de las animaciones, ni pistas de otros nodos.
- Las amplitudes se limitan a ±1 m y ±15° por eje, en consonancia con G001. Se suaviza la unión de bucle para clips con primera y última pose distintas durante los últimos 0.1 s (o 1/4 de su duración, si es menor).
- El nodo sigue aplicándose al final del fotograma; se restaura la pose base antes de raycasts/audio/control.
- No se modifica el FPS, jerarquía, herencia de escala, API de scripts, Timeline ni Film Maker.

## Pruebas ejecutadas en el entorno

`node --test scripts/test-camera-shake-s01-g002.mjs`: **25 PASS / 0 FAIL**.

Pruebas nuevas G002-01..25: compatibilidad G001; normalización; ruido reproducible/continuo/multieje; límites y no-loop; interpolación del clip, Bézier, pistas raíz, eventos ignorados, clip ausente o inválido, velocidad/duración, bucle, fundidos, composición, pausa y cámara activa; enlace UI y nodo persistente; ausencia de cambios G003; reloj no avanza si falta clip.

Regresión disponible (`node --test` sobre archivos `scripts/test-*.mjs`, excluyendo **solo** `test-starcat.mjs`): ver log de entrega. Esta exclusión requiere instalar `three`; no es un resultado PASS de esa prueba. Los SKIP declarados por otras pruebas se contabilizan separadamente.

`npm run build`: **NO VERIFICADO** (`vite: not found`; faltan dependencias npm en este entorno). Electron, Player GPU, Jolt y QA visual: **NO VERIFICADOS**.

## Procedimiento de QA local (usuario)

1. Extraer el SOURCE_BASELINE en una carpeta independiente, instalar dependencias con `npm ci` y ejecutar `npm run build`, `npm run electron`.
2. Crear un nodo **Camera Shake Base**; en Inspector asociar una cámara de escena o `Cámara del jugador`. Verificar primero `Sinusoidal` y comparar con G001.
3. Elegir **Ruido suave**, habilitar reproducir al iniciar, variar amplitud XYZ, frecuencia y fundidos. Verificar que el desplazamiento es suave, que la cámara física permanece estable y que el mismo tiempo reproduce el mismo movimiento.
4. Crear un clip en la pestaña **Animación** con dos pistas raíz: **Posición** y/o **Rotación**. Para un impulso de agacharse, utilizar claves con desplazamiento Z local negativo y retorno a cero. Seleccionar `Curvas de animación` en Camera Shake y vincular el clip. El botón `Editar animación…` debe abrir el editor existente.
5. Comprobar loop/no-loop, velocidad y duración del clip, fundidos, referencia eliminada, guardar/reabrir, varios Camera Shake en una cámara y cámara inactiva.
6. Confirmar que la animación no dispara eventos del clip ni mueve cápsula de Jolt, raycasts o el nodo de cámara persistido. Comprobar que Timeline y Film Maker no reciben shakes involuntarios.

Recopilar logs, capturas o vídeo de incidencias, pasos de reproducción, y versión/entorno local. No marcar QA LOCAL PASS sin evidencia.

## Siguiente Gate planificado

`LF-CAMERA-SHAKE-S01-G003`: API de reproducción manual, detención e intensidad. **No autorizado por G002**. La documentación funcional definitiva (incluida aclaración de herencia de escala) se actualizará al cierre del Sprint Camera Shake S01, no durante G002.

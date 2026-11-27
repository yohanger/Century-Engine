# LF-CAMERA-SHAKE-S01-G001 — Camera Shake Base, nodo nativo

## Contrato y autorización

Autorización exacta recibida el **2026-10-27**: `Listo. LF-CAMERA-SHAKE-S01-G001 autoriza comenzar`.

**SOURCE_BASELINE de entrada:** `LevelForge_STAIRS_SPRINT_CLOSURE_SOURCE_BASELINE.zip` (824 entradas, ZIP íntegro). El alcance de G001 es nodo Camera Shake Base, selección de cámara de escena por ID o cámara FPS, propiedades editables y oscilación básica funcional. Quedan fuera G002 (curvas y patrones adicionales), G003 (API manual), G004 (integración final). La guía general de uso y aclaración documental de escala se actualizarán al final del Sprint, como decidió el usuario; este documento QA y el ledger sí se actualizan por Gate.

## Arquitectura implementada

- `nodes/camera-shake.js` registra un nodo nativo no escalable en la categoría Gameplay, con representación exclusiva del editor y sin colisión.
- `Inspector.vue` ofrece selección por ID estable de cámara de escena o valor reservado `player`, activación, autoPlay, loop, posición/rotación XYZ, frecuencia y fundidos.
- `events/play-camera-shake.js` valida valores, muestrea una oscilación sinusoidal determinista y suma offsets locales a la cámara activa tras Timeline, Film Maker, indicadores, LOD y actualizaciones de juego. La cámara seleccionada debe ser la activa; una referencia inválida no altera otra cámara. Film Maker y cámaras propias de Timeline se respetan sin aplicar Shake.
- El fotograma siguiente restaura primero la pose de cámara previa al efecto, antes de procesar entrada/raycasts/audio. No altera nodos persistidos, colisiones, cápsula, física, jerarquía ni escala.
- El reloj por nodo se reinicia al comenzar o salir de Play. La pausa congela la fase; el paso manual avanza una unidad de tiempo acotada. El patrón no repetido termina después de un ciclo (duración derivada de la frecuencia).
- `autoPlay=false` conserva la receta sin reproducirla. La reproducción manual se añadirá únicamente en G003. No existe API nueva durante G001.

## Evidencia automatizada

Ejecución desde la raíz:

```bash
node --test scripts/test-camera-shake-s01-g001.mjs
node --test $(find scripts -maxdepth 1 -name 'test-*.mjs' ! -name 'test-starcat.mjs' | sort)
node --check src/engine/runtime/events/play-camera-shake.js
npm run build
```

La suite SHAKE-01..21 cubre normalización, límites, fase determinista, rotaciones, blends, fin de ciclo, activación, ID de cámara, FPS, referencias inválidas, Timeline/Film Maker, mezcla, pausa, falta de foco, visibilidad, registro, Inspector, orden de composición y restauración de la cámara base. Parte de la cobertura de integración es inspección estructural, no prueba visual ejecutada.

Los resultados precisos de regresión/build se consignan en el ledger y al entregar. La exclusión de `test-starcat.mjs` por ausencia de Three.js debe registrarse separada de los SKIP. Compilación, interacción Electron, Player y QA visual no se declaran PASS cuando no se ejecutan.

## QA local — responsabilidad del usuario

1. En copia aislada, `npm ci`, `npm run build`, `npm run electron`.
2. Añadir un nodo **Camera Shake Base** al árbol. Asignar cámara principal de escena. Marcar autoPlay y comprobar oscilación de posición y rotación cuando empieza Play.
3. Deshabilitar el nodo. Verificar cámara inmóvil. Cambiar amplitud, frecuencia, loop y fundidos. Cambiar a otra cámara activa; la anterior no debe agitarse.
4. Comprobar cámara FPS con Spawn, sin cámara principal. Seleccionar **Cámara del jugador**. El efecto debe afectar la vista, no desplazar cápsula ni interacciones.
5. Borrar la cámara vinculada, guardar/reabrir la escena y ejecutar Play: la referencia inválida no debe dar un efecto sobre otra cámara ni lanzar excepciones.
6. Activar un Timeline con cámara y Film Maker: deben conservar su cámara sin Shake. Pausar y avanzar un fotograma; comprobar que no se acumulan movimientos.
7. Confirmar que las ayudas editoriales del nodo no se renderizan en Player/exportado y que una escena anterior conserva su comportamiento.

**Evidencias a devolver si aparece un defecto:** pasos reproducibles, captura o vídeo, log de consola, escena mínima, salida de compilación. Diferenciar OBSERVADO, INFERENCIA y CAUSA RAÍZ antes de proponer correcciones. G001 no queda aprobado ni cerrado hasta la aceptación del usuario.

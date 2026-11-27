# LF-PLAYER-CAMERA-MOTION-S01-G001 — Implementación y QA

Estado: IMPLEMENTADO / NODE PASS / ELECTRON NO VERIFICADO / QA LOCAL PENDIENTE / NO CERRADO.

## Propósito

Exponer movimiento visual calibrable para locomoción FPS usando las recetas **Camera Shake Base** existentes, sin afectar cápsula física, raycasts, apuntado, Timeline ni cámara principal de escena.

## Configuración

1. En la escena, crea uno o varios nodos **Camera Shake Base** (Gameplay). En cada uno elige **Cámara del jugador**, `Reproducir al iniciar = desactivado`. Para Caminar y Correr usa Bucle activado; Salto/Aterrizar pueden quedar con Bucle desactivado, ya que el conector los reproduce como impulsos.
2. En **Base de datos → Jugador → Movimiento de cámara**, marca **Activar movimiento de cámara** y asigna un nodo a Caminar, Correr, Saltar, Caer y Aterrizar según necesites. Son referencias opcionales; sin nodo no hay efecto.
3. Ajusta intensidades por acción, respuesta de entrada/salida, cadencia dependiente de velocidad y velocidad mínima de impacto. Calibra desplazamiento/rotación XYZ, frecuencia/fase XYZ y duración del impulso en **Camera Shake Base**, no en el jugador.
4. La configuración se normaliza en el registro Jugador y se incluye en el proyecto/exportación por la ruta existente de Base de datos.

## Contratos

- Reutilización: `sampleShake()` sigue siendo el único evaluador de patrones; no se crean materiales, cámaras, overlays ni mezcladores alternativos. La suma se realiza en `_shakeFrame()` junto con las reproducciones manuales preexistentes.
- La locomoción se basa en distancia física horizontal por paso Jolt; se ignora un teletransporte. La emisión de movimiento de cámara no depende del audio ni de `footsteps`.
- Los saltos son impulsos iniciados por `_jump()`. El aterrizaje requiere transición real de aire a suelo y umbral vertical. El efecto de caída se ajusta a velocidad de descenso; no se activa al nadar.
- Una receta asignada a locomoción no se ejecuta a la vez mediante AutoPlay. La reproducción manual por scripts mantiene su reloj independiente y puede sumarse.
- La pose visual se restaura antes de cualquier lógica física/raycast en el siguiente fotograma. Film Maker y una cámara principal independiente tienen prioridad.
- De forma predeterminada, `cameraMotionEnabled=false`; proyectos antiguos no reciben nueva oscilación. No se crea ningún nodo automáticamente.

## QA

- Node: `node --test scripts/test-player-camera-motion-s01-g001.mjs`
- Regresión: `node --test scripts/test-camera-shake-s01-g00*.mjs` (o cada suite por separado)
- Electron: `node --test scripts/test-player-camera-motion-electron-s01-g001.mjs`
- Build: `npm run build` (Editor + Player)
- Visual: `npm run electron`, probar FPS real, caminar, correr, detenerse, saltar, aterrizar suave/fuerte, caer, muro, colisiones, escalón, sonido de pasos desactivado, pausa, scripts con Shake simultáneo, escena y Player exportado. Comparar encuadres/impactos y comfort a distintas tasas de FPS.

No afirmar PASS gráfico ni aceptación de usuario antes de contar con la evidencia correspondiente.

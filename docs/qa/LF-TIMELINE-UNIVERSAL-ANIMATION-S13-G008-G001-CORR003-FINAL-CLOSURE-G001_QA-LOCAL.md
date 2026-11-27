# LevelForge — FINAL-CLOSURE-G001 · Matriz de QA local del usuario

**Estado inicial de todos los casos:** NO VERIFICADO. Ninguna casilla rellenada en este archivo constituye evidencia sin ejecución. Probar una copia del proyecto; conservar SOURCE_BASELINE anterior y cualquier proyecto propio. Esta matriz corresponde al Gate **autorizado** `LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-CORR003-FINAL-CLOSURE-G001`.

## A. Preparación en Linux

Extraer **solo** el ZIP `...FINAL-CLOSURE-G001_SOURCE_BASELINE.zip` en una carpeta nueva, desde la raíz que contiene `package.json`. No aplicar CHANGE sobre esa misma copia. Si se desea aplicar CHANGE, hacerlo en una **copia limpia del FINAL-COVERAGE SOURCE_BASELINE** y comparar antes las modificaciones locales. No tocar la carpeta de proyectos existentes, los assets del usuario ni el baseline 012.

Ejecutar en terminal **desde la raíz de esa copia**:

```bash
npm ci
node --test scripts/test-timeline-universal-animation-s13-g008-g001-corr003*.mjs scripts/test-camera-orchestration-s15-g007.mjs scripts/test-camera-shake-s01-g004.mjs
node --test scripts/test-camera-shake-s01-g001.mjs scripts/test-camera-shake-s01-g002.mjs scripts/test-camera-shake-s01-g003.mjs scripts/test-camera-orchestration-s15-g005.mjs
npm run build
npm run electron
```

**Esperado para las dos baterías Node focales** en este baseline: sin FAIL (la primera arrojó 264 PASS en el entorno de auditoría; la segunda 80 PASS, no necesariamente misma duración). **Esperado para build:** Vite termina compilación de Editor y Player sin error; el resultado **no está acreditado** en el entorno de auditoría. **Esperado para Electron:** aparece el Editor nativo sin errores. Guardar logs íntegros de terminal. No considerar PASS si alguno de estos pasos falla.

## B. Matriz por nodo (34 tipos)

En una escena de prueba local, seleccionar un ejemplar del tipo; verificar las llaves **que existan bajo el contrato vigente**, pasar el cabezal, reproducir, pausar, hacer seek y pulsar STOP. Comprobar que los valores originales se recuperan, que la escena guardada no se altera por previsualización y que un segundo nodo del mismo tipo no recibe las modificaciones de forma accidental. No crear llaves para operaciones excluidas por CA-003/004, Prefab o postprocesamiento de cámara.

| # | Tipo | Qué verificar | Editor | Player | Evidencia |
|---:|---|---|---|---|---|
| 1 | Node | visible/activo y otras propiedades comunes; estructura excluida | NO VERIFICADO | NO VERIFICADO | — |
| 2 | Node3D | transformaciones y recipiente permitido por CA-003 | NO VERIFICADO | NO VERIFICADO | — |
| 3 | Camera3D | FOV, cámara activa y restauración tras STOP | NO VERIFICADO | NO VERIFICADO | — |
| 4 | Camera Shake Base | receta, Play/Stop, no duplicar offsets Film/Timeline/pose | NO VERIFICADO | NO VERIFICADO | — |
| 5 | Light | temperatura, flare, volumen, estilo; dos luces aisladas | NO VERIFICADO | NO VERIFICADO | — |
| 6 | Trigger | propiedades temporales permitidas y activación | NO VERIFICADO | NO VERIFICADO | — |
| 7 | AtmosphereVolume | efectos de volumen y restauración | NO VERIFICADO | NO VERIFICADO | — |
| 8 | PostProcessVolume | canales previstos; postproceso **de cámara** excluido | NO VERIFICADO | NO VERIFICADO | — |
| 9 | Audio | propiedades de audio, reproducción, niveles y STOP | NO VERIFICADO | NO VERIFICADO | — |
| 10 | Canvas | propiedades UI temporales, orden y restauración | NO VERIFICADO | NO VERIFICADO | — |
| 11 | Decal | propiedades visuales sin mutación cruzada | NO VERIFICADO | NO VERIFICADO | — |
| 12 | Nature | color/sombra/viento y restauración | NO VERIFICADO | NO VERIFICADO | — |
| 13 | Sprite2D | canales de visibilidad/visual/posición | NO VERIFICADO | NO VERIFICADO | — |
| 14 | Sprite3D | canales visuales en Editor/Player | NO VERIFICADO | NO VERIFICADO | — |
| 15 | Text | texto y demás propiedades temporales válidas | NO VERIFICADO | NO VERIFICADO | — |
| 16 | VFX | canales temporales sin reinicios indebidos | NO VERIFICADO | NO VERIFICADO | — |
| 17 | CharacterBody3D | movimiento/propiedades física con Jolt real | NO VERIFICADO | NO VERIFICADO | — |
| 18 | Area3D | detección de área y valores temporales | NO VERIFICADO | NO VERIFICADO | — |
| 19 | StaticBody3D | colisión y propiedades temporales | NO VERIFICADO | NO VERIFICADO | — |
| 20 | RigidBody3D | Jolt, propiedades y recipiente/combustión permitidos | NO VERIFICADO | NO VERIFICADO | — |
| 21 | CollisionShape3D | formas y cambio de estado seguro | NO VERIFICADO | NO VERIFICADO | — |
| 22 | Primitive | materiales por instancia; escaleras: **pendiente contractual** | NO VERIFICADO | NO VERIFICADO | — |
| 23 | Mesh | materiales PBR por instancia y recursos compartidos | NO VERIFICADO | NO VERIFICADO | — |
| 24 | Model | canales vigentes; sin GI/generación editorial | NO VERIFICADO | NO VERIFICADO | — |
| 25 | Group | solo canales comunes, sin cambiar jerarquía | NO VERIFICADO | NO VERIFICADO | — |
| 26 | Subtract | CSG, cortes y restauración | NO VERIFICADO | NO VERIFICADO | — |
| 27 | Road | propiedades de carretera permitidas | NO VERIFICADO | NO VERIFICADO | — |
| 28 | Water | propiedades del mundo acuático, masa conservada | NO VERIFICADO | NO VERIFICADO | — |
| 29 | Terrain | canales autorizados sin generación/topología/pintura | NO VERIFICADO | NO VERIFICADO | — |
| 30 | Spawn | comportamiento temporal sin tags excluidos | NO VERIFICADO | NO VERIFICADO | — |
| 31 | Event | ejecución de comandos y estados | NO VERIFICADO | NO VERIFICADO | — |
| 32 | GameplayObject | estado interactivo, scripts y restauración | NO VERIFICADO | NO VERIFICADO | — |
| 33 | Critters | propiedades y rendimiento | NO VERIFICADO | NO VERIFICADO | — |
| 34 | Navigation | parámetros de región, bake y rutas de IA | NO VERIFICADO | NO VERIFICADO | — |

## C. Integración obligatoria

| Caso | Prueba | Estado inicial | Evidencia mínima |
|---|---|---|---|
| I-01 | Camera3D activa y cambio de cámara; Camera Orchestration | NO VERIFICADO | vídeo y estado al pulsar STOP |
| I-02 | Preview automático sin destruir cámara editorial | NO VERIFICADO | vídeo corto |
| I-03 | Shake bajo política de prioridades, sin offsets duplicados | NO VERIFICADO | vídeo y configuración del nodo |
| I-04 | Cinematics/FilmMaker importado, reproducción y Preview | NO VERIFICADO | vídeo, archivo de proyecto de prueba si falla |
| I-05 | Audio clips, fades, automation y routing | NO VERIFICADO | captura de pista y grabación audible |
| I-06 | Eventos, métodos, comandos y scripts del usuario | NO VERIFICADO | game.log/consola y resultado |
| I-07 | Jolt WASM real, rigid/character/shape; STOP | NO VERIFICADO | vídeo de física y comparación antes/después |
| I-08 | Subtract/CSG, Navigation y recálculo temporal permitido | NO VERIFICADO | vídeo o capturas de geometría/ruta |
| I-09 | FPS de Timeline, seek, pausa, step, loop, STOP y restore | NO VERIFICADO | vídeo del transporte y valores |
| I-10 | Guardar, cerrar, abrir proyecto, reproducir y restaurar | NO VERIFICADO | archivo de prueba/capturas y valores |
| I-11 | Exportar juego AppImage desde **Archivo ▸ Exportar juego (AppImage)…** y ejecutarlo independientemente del Editor | NO VERIFICADO | salida de exportación, consola y vídeo de Player |
| I-12 | FPS/RAM local y estabilidad de escenas con varias pistas | NO VERIFICADO | captura de métricas en hardware local |

## D. Cómo devolver evidencia y aprobar el cierre

Indicar por caso `PASS / FAIL / NO VERIFICADO`, adjuntar terminal de Node, build, consola/game.log, vídeo o capturas y el resultado del **Player AppImage externo**. Si falla, reproducir sobre una copia y devolver pasos exactos, nodo/tipo, keyframes y lo esperado frente a lo observado. No enviar proyectos privados completos si basta una escena mínima sin datos sensibles.

Tras examinar esa evidencia, corregir únicamente fallos verificables mediante Gate autorizado cuando excedan el alcance actual. **No registrar QA LOCAL PASS ni CERRADO en el ledger hasta que el usuario confirme pruebas satisfactorias y cierre expresamente.**

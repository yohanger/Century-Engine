# QA mínimo de cierre — S13, S15 y S16

**Estado:** PENDIENTE DE PRUEBA LOCAL. El usuario conserva la autoridad sobre QA Electron y ejecución de Player independiente.

## Preparación y comandos

Extraer `SOURCE_BASELINE` nuevo en **carpeta independiente**, con `package.json` en raíz. No extraerlo encima de una carpeta con cambios locales ni combinarlo con CHANGE. Conservar baseline G008, proyectos originales y saves. Trabajar sobre copias de prueba.

```bash
npm ci
node --test scripts/test-timeline-universal-animation-s13-g008*.mjs
node --test scripts/test-camera-orchestration-s15-g*.mjs
node --test scripts/test-fps-native-player-s16-g*.mjs scripts/test-game-manager-g001.mjs scripts/test-hub-templates-s01-g001.mjs
npm run build
npm run electron
```

**Referencia del entorno de auditoría:** S13 288/288 PASS; S15 111/115 debido a `jszip`/`@vue/reactivity` ausentes; S16 286/286 PASS. Con `npm ci` exitoso, S15 deberá repetirse y evaluarse según su resultado **real**, sin prometer un total incondicional. Build debe mostrar Vite Editor y Player completados; compilar no equivale a QA visual.

## Evidencia de integración por área

| ID | Área | Caso local | Evidencia solicitada |
|---|---|---|---|
| CL-TL-01 | S13 | Timeline en Editor: seek, loop, pausa, Stop/restore de nodo/Camera3D y pistas de tipos representativos | vídeo y salida Node, antes/después |
| CL-TL-02 | S13 | Audio, Cinematics y Jolt: sin doble escritor ni cambios autorales al terminar Play | vídeo/captura, `game.log` si falla |
| CL-TL-03 | S13 | Timeline exportado a Player independiente y reproducción/cambios de escena | AppImage ejecutado fuera del Editor, log/resultado |
| CL-TL-04 | S13 | Verificar los casos de la matriz histórica de 34 tipos; documentar explícitamente opciones escalera/Luz sin canal | matriz por tipo PASS/FAIL/NO VERIFICADO |
| CL-CAM-01 | S15 | Dos Camera3D, Cut/Blend, owner/acquire/release, prioridad FilmMaker/Timeline, invisible activa/inactiva | vídeo del Editor y notas por caso |
| CL-CAM-02 | S15 | NGM Runtime exportado: cámara, FOV, blend y salida entre escenas | AppImage independiente y comparación con Editor |
| CL-CAM-03 | S15 | `cameraExit.interrupted` entre propietarios | PENDIENTE CONTRACTUAL; no reportar PASS sin emisor o Amendment |
| CL-FPS-01 | S16 | Crear First Person nuevo: sol sin Spawn, Prefab en Assets, arrastrar/designar CharacterBody3D; caminar, salto y cámara | jerarquía, Assets, vídeo corto |
| CL-FPS-02 | S16 | `game.spawnPlayer()`, Database, manos/slots/armas, Drop/Throw, save/load repetido y STOP | `game.log`, vídeo y prueba física Jolt |
| CL-FPS-03 | S16 | Escena Sin jugador y copia de proyecto antiguo con Spawn: preservar datos sin fallback | captura y resultado de escena |
| CL-FPS-04 | S16 | Exportar y ejecutar NGM Runtime fuera del Editor; comparar con Play Mode | nombre/ruta real de AppImage y logs |

No sustituir las matrices detalladas previas: `docs/qa/LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-CORR003-FINAL-CLOSURE-G001_QA-LOCAL.md`, `docs/qa/LF-CAMERA-ORCHESTRATION-S15-G007-INTEGRATION-QA-INTEGRAL_QA.md` y `docs/qa/LF-FPS-NATIVE-PLAYER-S16-G008-INTEGRAL-LEGACY-REMOVAL_QA.md`.

## Devolución

Enviar resultados `PASS / FAIL / NO VERIFICADO` por escenario, salida de Node y build, capturas/vídeos de Player y Editor, `game.log` si hubo errores, y aprobación expresa de cierre después de analizar la evidencia. **Sin datos: NO VERIFICADO, no PASS.**

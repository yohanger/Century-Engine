# LF-NODE-SIGNALS-AUDIO-S02-G001 — Contrato

**Fecha:** 2026-11-02 · **Autorización:** `Listo. LF-NODE-SIGNALS-AUDIO-S02-G001 autoriza comenzar` · **Estado:** IMPLEMENTADO, QA LOCAL PENDIENTE, NO CERRADO.

**SOURCE_BASELINE vinculante:** `LevelForge_NODE_SIGNALS_TREE_S01_G003_SOURCE_BASELINE(1).zip` adjuntado por usuario (1.575 archivos, integridad CRC PASS). Parent: Signals S01 G001–G003, Multiscript Amendment y auditoría Godot S00. G003 aprobado por QA local declarado, registrar esa aprobación sin inventar nuevos logs Electron.

## Objetivo y contrato de señal

El tipo de nodo existente `audio` (variantes Audio 3D y Audio UI) publica una sola señal nativa `finished`, `source: audio-voice`, `phase: natural-end`, sin argumentos. Solo se emite cuando una voz asociada **a ese nodo** llega a fin natural; no se emite en `stop`, fade, `pause`, bucle activo, reemplazo de clip, Stop del Player, escena saliente ni reproducción independiente `game.audio.play`/`game.audio.ui`.

Para respetar identidad estable, AudioScene captura objeto emisor, token de reproducción y `Voice` antes de registrar finalización: exige `finishedNaturally=true`, instancia exacta del objeto todavía en el proyecto, fuente actual, voz actual, token actual y escena activa. `NodeScriptRuntime` exige además pertenencia al NodeLifecycle actual, identidad de Object3D y receptor con método público activo. Un ID igual con objeto nuevo no es el mismo emisor. Nodos audio sin scripts propios también emiten.

La promesa `Voice.done` mantiene su contrato histórico (termina natural o por stop); `Voice.finishedNaturally` es el nuevo discriminante de causa y solo se establece en el `onended` de la fuente actual cuando no está en pausa ni deteniéndose. No se alteran el mezclador, oclusión, posicionamiento, grupos, configuración, almacenamiento de assets o APIs de `game.audio`.

## Orden de inicialización y exclusiones

El `AudioScene.start({deferSources:true})` configura el motor Web Audio sin iniciar `playOnStart`. `NodeLifecycle.start()` prepara y conecta métodos de Scripts de Nodo; inmediatamente después `AudioScene.resetSources()` inicia la reproducción automática. El arranque ordinario `AudioScene.start()` sin opción mantiene el comportamiento existente para otros llamadores. Para cambios de escena, la reanudación y reset de fuentes conservan la ruta existente y los tokens invalidan voces antiguas.

**Alcance producción:** `src/engine/runtime/nodes/audio.js`, `audio/engine.js`, `audio/scene.js`, `scene/node-scripts.js`, `events/play.js`. **QA:** nuevas pruebas Node/Electron, fixture Electron, ajuste estrictamente del regex de la prueba de integración Audio A11; tres documentos y ledger. **Exclusiones:** componentes Vue, render, física, serialización, audio global, consolas, Terreno, renombrado de APIs, nuevo EventBus y señales ficticias.

**Cierre:** requiere automatizados Node, Electron Web Audio real y WebGL2, compilación Editor/Player, QA local explícito y ledger al día. No atribuir compilación o Electron PASS a pruebas que no pudieron ejecutarse.

### Adenda de aprobación

El usuario aprobó el QA local del Gate el 2026-11-02 («Aprobado. Sigamos»). Estado funcional **APROBADO**; las pruebas Electron/build de este Gate siguen sin logs propios en el contexto disponible, por lo que el cierre administrativo con verificación de todos los medios permanece **PENDIENTE DE EVIDENCIA**. No confundir esa ausencia con un defecto de audio observado.

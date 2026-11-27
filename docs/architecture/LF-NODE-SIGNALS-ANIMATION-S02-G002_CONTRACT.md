# LF-NODE-SIGNALS-ANIMATION-S02-G002 — Contrato técnico

**Fecha:** 2026-11-02. **Autorización exacta:** `Listo. LF-NODE-SIGNALS-ANIMATION-S02-G002 autoriza comenzar`.

**SOURCE_BASELINE vinculante:** `LevelForge_NODE_SIGNALS_AUDIO_S02_G001_SOURCE_BASELINE.zip` (1.581 archivos, CRC PASS). Parents: Amendment Signals/Multiscript, auditoría comparativa Godot S00, Signals S01 G001–G003, Audio S02-G001 aprobado por QA local declarado.

## Objetivo y arquitectura

Todo tipo de Nodo registrado puede publicar **`animation_finished(clipName: string)`** desde los reproductores existentes **`AnimRunner`** (clips LevelForge por claves) y **`ModelRunner`** (clips incorporados a modelos GLB/GLTF, reproducidos en `THREE.AnimationMixer`). Esto no representa una nueva clase Godot AnimationMixer ni una señal global de `game.animation`: es la señal del nodo raíz sobre el que se ejecuta cada clip. Los slots del ViewModel sin objeto Nodo quedan excluidos.

Metadata única en `nodes/registry.js`: `{name: 'animation_finished', source: 'animation-runner', phase: 'natural-end', args:[{name:'clipName', type:'string'}]}`. La etiqueta se integra en `nativeSignals` del registro existente de todos los tipos, junto con las cuatro señales de NodeLifecycle. El Inspector actual obtiene la metadata a través de `getNativeSignals`; NO se altera la interfaz.

## Contrato de finalización

- Un único evento por instancia de clip que **termine naturalmente** (`stopped === false` en callback `host.end`). El argumento es exactamente `runner.clip.name` (descripción del clip reproducido).
- `stopAnimation`, `stopAll`, sustitución del mismo clip, fundido de reemplazo, pausa, bucles activos, Stop del Player y cambio de escena **no pueden crear eventos falsos**. Una pausa puede terminar más adelante tras reanudar; las capas concurrentes emiten individualmente al concluir.
- Cuando la animación no se ejecuta sobre un Nodo (`ViewModel.slot`) no se emite `animation_finished` de un nodo ficticio.
- Conexión por script `node.connect('animation_finished', receptor, 'metodo')` y conexiones persistentes de `signalConnections` utilizan exclusivamente `NodeScriptRuntime.nativeSources`, `sceneConnections`, `_dispatchSignal`. Ningún EventBus nuevo, ningún polling extra.
- Se conserva la identidad de sesión (`_referenceSession` capturada al iniciar), identidad del **objeto real** `project.objects.includes(obj)` y Object3D `_lfNodeOwner`, pertenencia de `NodeLifecycle.entered` y validez del receptor; otro objeto con mismo `id` **no recibe** el resultado. Los clips pendientes de una escena desmontada no deben notificar.
- Se mantiene Multiscript (orden de callbacks y métodos públicos), signos y argumentos de las señales existentes, Jolt, Audio, Editor y Player. Se reutiliza el tick de Animación para emitir, sin otro scheduler.

## Colisiones con Custom Signals

`node.define_signal('animation_finished')` era legal antes de S02-G002. La nueva señal nativa **reserva ese nombre**: si un script la declara, `NodeScriptRuntime` produce el error explícito `Señal nativa reservada`, identifica el nodo y el recurso, sin eliminar el código, escena ni conexión almacenada. **No se convierte de forma silenciosa una señal personalizada preexistente a una nativa.** Los scripts de usuario de proyectos externos no están disponibles en este baseline; su existencia debe comprobarse en QA al abrir cada proyecto. Una colisión real requerirá un Contract Amendment o decisión de migración antes de tratar ese proyecto como compatible. No adaptar el contrato a un proyecto sin auditar.

## Alcance autorizado

Producción solo: `src/engine/runtime/nodes/registry.js`, `src/engine/runtime/events/play-anim.js`, `src/engine/runtime/scene/node-scripts.js`. `events/play.js` estaba permitido condicionalmente, pero no requirió cambios. `anim/eval.js` y `anim/modelclips.js` son los productores existentes de finalización y permanecen intactos.

Medios autorizados: `scripts/test-node-signals-animation-s02-g002.mjs`, `scripts/test-node-signals-animation-electron-s02-g002.mjs`, fixture HTML bajo `scripts/fixtures/nodes`, ajustes necesarios de expectativas históricas de catálogo, contrato/implementación/QA y seis hojas ledger. Fuera de alcance: serializadores, Inspector, Timeline, animación nueva, archivo de dependencias y limpieza de Consola.

## Aceptación y cierre

Requiere pruebas de casos naturales y cancelados, nodo y sesión, dos tipos de reproductores, capas concurrentes, Custom Signals, Node/Audio/Jolt/Multiscript, Electron embebido con `AnimationMixer` real, Editor/Player build, QA funcional local del usuario y evidencia. En ausencia de Vite, Electron y compilación son **NO VERIFICADOS**, nunca PASS.

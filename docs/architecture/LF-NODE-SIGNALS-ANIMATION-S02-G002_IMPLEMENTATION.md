# LF-NODE-SIGNALS-ANIMATION-S02-G002 — Implementación y auditoría

**Fecha:** 2026-11-02 · **Estado:** IMPLEMENTADO / TEST NODE PASS / QA LOCAL PENDIENTE.

## Observaciones verificadas del SOURCE_BASELINE Audio S02-G001

1. `anim/eval.js`: `AnimRunner.finish(stopped)` llama `host.end(runner, stopped)` y resuelve `done` tanto al completar como al parar; la finalización natural se distingue por `stopped === false`.
2. `anim/modelclips.js`: `ModelRunner` recibe el evento `THREE.AnimationMixer.finished` por acción, filtra la acción pertinente y llama `finish(false)`; Stop usa `finish(true)`.
3. `events/play-anim.js`: alojaba callbacks `end` exclusivamente para retirar runners de `_anims`; el cambio reutiliza esos callbacks sin duplicar tick o productor.
4. `scene/node-scripts.js`: ya admitía emisores `node-lifecycle`, `jolt-area` y `audio-voice` con un solo registro `nativeSources`; su adaptación a `animation-runner` conserva este mismo contenedor.
5. `nodes/registry.js`: todos los tipos registrados recibían 4 señales comunes; se agrega un metadato más sin inventar jerarquías Godot. No existe un nodo AnimationMixer separado en LevelForge.

## Cambios ejecutados (solo tres archivos de producción)

- **`registry.js`:** constante `NODE_ANIMATION_FINISHED_SIGNAL` que añade `animation_finished(clipName)` como nativa común en todos los tipos. Se valida con la metadata existente; no se ejecutan scripts para descubrirla.
- **`node-scripts.js`:** acepta `animation-runner` en la validación de adaptadores y conexiones vigentes; expone `emitNativeAnimationFinished(obj, clipName)` que usa `_dispatchSignal()` y sus receptores existentes. `node.define_signal('animation_finished')` se rechaza explícitamente por el mecanismo común de nombre nativo reservado.
- **`play-anim.js`:** añade `_animFinished(root,runner,stopped,session)` y lo invoca al final natural desde los dos callbacks `host.end` existentes. Filtra interrupción, slot ViewModel, sesión antigua, nodo retirado/recreado, Object3D de otra identidad y falta de pertenencia activa a `NodeLifecycle`.

No se modificaron mezcladores, clips, UI, persistencia ni el ciclo de vida. El mismo `animationPlay`, `animationStop`, `ModelRunner`, `AnimRunner` y `_animTick` conservan el contrato y la API previa.

## Regresión y compatibilidad

Las expectativas históricas en `scripts/test-node-signals-native-catalog-s01-g001.mjs` y `scripts/test-node-signals-tree-s01-g003.mjs` cambiaron de 4 a 5 señales comunes. No se relajaron las comprobaciones físicas de Area3D ni las de Audio. Son cambios de tests, no de producción.

**Colisión con Custom Signals:** no se han migrado nombres de scripts de usuarios externos. Una declaración dinámica del nombre reservado provoca error explícito, sin mutación de datos. Si un proyecto real declara dicha señal, hay incompatibilidad que requiere autorización adicional y no debe considerarse migrado.

**Limitaciones de QA:** el runner Electron con Three.js WebGL2/AnimationMixer/Jolt WASM está incluido; sin `node_modules/vite` en el entorno no fue ejecutable. Una instancia de `THREE.AnimationClip` en esa fixture ejercita el mismo `ModelRunner` que usa clips GLB/GLTF; no constituye una prueba de importación GLTFLoader ni del pipeline completo de importación de modelos. El usuario debe validar visualmente un clip de un modelo GLB/GLTF real.

Las siguientes fases de Signals siguen siendo descubrir Custom Signals sin ejecutar código en Edit Mode, rediseño UX Godot y prueba final Editor + Player. Terreno y después Consola permanecen para Gates posteriores.

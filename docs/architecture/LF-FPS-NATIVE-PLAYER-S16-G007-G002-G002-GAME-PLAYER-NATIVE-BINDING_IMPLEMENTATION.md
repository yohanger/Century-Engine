# S16-G007-G002-G002 — Vinculación de game.player a CharacterBody3D

**Gate autorizado:** `LF-FPS-NATIVE-PLAYER-S16-G007-G002-G002-GAME-PLAYER-NATIVE-BINDING`.
**Estado:** IMPLEMENTADO EN FUENTES; QA LOCAL, BUILD, JOLT WASM Y NGM RUNTIME NO VERIFICADOS. No cerrado.
**SOURCE_BASELINE de entrada:** `LF_FPS_NATIVE_PLAYER_S16_G007_G002_G001_SCENE_PLAYER_IDENTITY_SOURCE_BASELINE.zip`.

## Autoridad y transición

- Una escena con `playerNodeId` válido usa **esa instancia de CharacterBody3D**: su nodo espacial y Jolt son propietarios de posición, velocidad y contacto.
- PlayMode conserva el mecanismo de selección del controlador (`createPlayer`) existente. Para la escena nativa escoge el controlador **inerte** `NoPlayer`, evitando otra cápsula FPS o una segunda actualización de movimiento. No se añade un manager ni un controlador nuevo.
- Sin identidad explícita, una escena de juego conserva temporalmente la ruta FPS heredada. Una identidad explícita inválida no selecciona otro cuerpo ni inicia FPS de respaldo. Un GameManager configurado `Sin jugador` deshabilita el control sin tratarlo como error físico. FilmMaker no adquiere personaje nativo.
- El cambio de escena vuelve a resolver identidad y configuración; invalida handles anteriores por sesión, escena e identidad, incluso cuando dos escenas reutilizan un ID de nodo.
- `game.player` en escena nativa accede al handle del cuerpo ordinario. Posición mundial, velocidad, suelo, dirección del cuerpo y algunos accesos de compatibilidad se leen del nodo y de `NodeSpatialRuntime`. La asignación de posición convierte coordenadas mundiales a locales y sincroniza Jolt. Rutas y teletransporte utilizan esa misma escritura.
- El tamaño para inicializar Jolt se lee de la forma autoral de colisión **antes** de que exista el cuerpo físico, sin mantener otro estado de cuerpo.
- Los sensores de Jolt usan el CharacterVirtual vinculado cuando está presente. El cuerpo heredado se usa únicamente en la ruta heredada.

## Límites contractuales abiertos

Esta intervención **NO** equivale a paridad completa del jugador heredado:

- La API Spawn Player basada en Prefabs se reserva a `S16-G007-G002-G003`.
- Operaciones de Database, ViewModel, manos, slots, guardado avanzado y consumidores FPS especializados siguen sujetas a la auditoría/integración de G007-G003 y posteriores. Las escrituras de configuración que aún no tienen propietario nativo fallan expresamente en lugar de duplicar estado. No se eliminó `FpsPlayer`.
- No se introdujo `move_and_slide()` ni un segundo paso de Jolt. Camera Orchestration, Input Map, Timeline y FilmMaker conservan sus propietarios.
- La extensión VS Code está actualizada en fuentes y el paquete 0.1.9 offline está verificado por integridad, **no** por instalación real ni empaquetado oficial `vsce`.
- El bloque de cámara/ciclo Play, persistencia de acciones y paridad Editor/NGM Runtime requiere QA local; la suite con dobles no prueba Jolt WASM real.

## Evidencia automática

- Regresión nueva: **18/18 PASS** (incluye configuración Jolt antes de inicializar el cuerpo).
- Regresión focal S16 G003–G007: **101/101 PASS**.
- `node --check` de archivos JS/MJS modificados: PASS.
- `npm run build`: **NO COMPILADO** (`vite: not found`). Instalación offline incompleta, faltan dependencias.
- Suite adicional de extensión: **25 PASS / 1 FAIL** por dependencia `jszip` no disponible; no atribuirlo a ejecución del motor.
- Pruebas reales Editor, NGM Runtime y Jolt WASM: **NO VERIFICADAS**.

Ver `docs/qa/evidence/LF-FPS-S16-G007-G002-G002_*.log` y la guía de QA local.

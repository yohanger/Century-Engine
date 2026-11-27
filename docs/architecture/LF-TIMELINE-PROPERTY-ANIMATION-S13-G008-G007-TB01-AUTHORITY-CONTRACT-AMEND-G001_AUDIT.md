# S13-G008-G007 · Auditoría de autoridad temporal TB-01

**Gate documental autorizado:** `LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G007-TB01-AUTHORITY-CONTRACT-AMEND-G001`  
**Autorización literal:** `Listo. LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G007-TB01-AUTHORITY-CONTRACT-AMEND-G001 autoriza comenzar`  
**Baseline:** `LF_TIMELINE_PROPERTY_ANIMATION_S13_G008_G006_CATALOG_PERSISTENCE_INTEGRAL_SOURCE_BASELINE.zip`; 2.998 entradas, ZIP verificado antes de auditar.  
**Naturaleza:** auditoría y propuesta contractual, sin modificar producción ni crear un nuevo runtime.  
**Fecha de corte:** 2026-11-10.

## 1. Autoridad documental y límites

- `LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G005-AUDIT-CONTRACT_CONTRACT.md`: marco **RATIFICADO**; TA-01, TA-02, TA-04, TA-11 y TA-12 son obligatorios; TB-01 permanece expresamente abierto hasta ratificar este Amendment.
- G006 catálogo/persistencia tiene **26/26 Node PASS, 50/50 regresión directa, builds Editor 849 y Player 415 módulos PASS** en el log local entregado. El usuario confirmó «Aprobado… todo funciona». **AppImage independiente NO VERIFICADO**.
- `LF-NODE-PHYSICS-RUNTIME-S03-G001_CONTRACT.md`: un único JoltWorld y sincronización existente de cuerpos.
- `LF-CAMERA-ORCHESTRATION-S15-G006-CA-001_AMENDMENT.md`: autoridad sobre **la cámara de render**, diferente de propiedad de transformaciones; no introducir CameraManager nuevo.
- `LF-NODE-ACTIVE-VISIBLE-PRELTS-CA-001_AMENDMENT.md`: sin migradores pre-LTS especulativos; preservar los proyectos actuales.
- Ownership de FilmMaker/Cinematics: Timeline no se convierte en autor de `.nfm` ni en nuevo player.

**No se ha ejecutado el juego ni Jolt WASM en este entorno.** Las conclusiones de orden y rutas son inspección estática del código real. Los PASS locales históricos proceden de la evidencia presentada por el usuario.

## 2. Inventario OBSERVADO de escrituras y orden real

| Ref | Archivo/punto concreto | Observado | Implicación contractual |
|---|---|---|---|
| AU-01 | `src/engine/runtime/timeline/player.js:80-103` | `_apply()` evalúa pistas `node`, luego `bake`, luego cámara; el host de edición usa `eventsOnly`. | Reutilizar orden, sin mezclar propiedad de nodos con cámara de render. |
| AU-02 | `src/engine/runtime/timeline/player.js:107-159` | Pause llama `_apply()` sin avanzar tiempo; `seek()` aplica sin disparar calendario de comandos; Stop/Skip/Natural llaman `_finish`, sin restauración general de nodos. | Prescribir política explícita por tipo de canal, sin afirmar restauración ya implementada. |
| AU-03 | `src/engine/runtime/events/play-controls.js:198-256` | `_simStep`: `_tlUpdate` antes de `game.update`/scripts, Jolt fijo, `_animTick`, eventos, `lateUpdate` y `_tlBakeHold` final. | Fuera de bake pueden existir escrituras múltiples a un mismo valor por frame. |
| AU-04 | `src/engine/runtime/events/play-timeline.js:285-292` | Host Timeline aplica `visible`, `position`, `rotation`, `scale` sobre runtime; `syncNode` cuando corresponde. No escribe claves persistentes. | Extender puntos actuales; identificar `sceneId,nodeId,propertyId`. |
| AU-05 | `src/engine/runtime/events/play-anim.js:82-121,194` | `AnimRunner` lee/aplica `position`, `rotation`, `scale`, `visible`, `light.energy` y `light.color`; transforma ciertos nodos a cinemático con `makeKinematic`. | Los clips son consumidores que pueden competir con pistas Timeline. No alterar su autoría. |
| AU-06 | `src/engine/runtime/events/play-nodes.js:78-90` | API de nodo permite escribir `rotation`, `visible`, `position`; sincroniza física en pose. | Los escritores de scripting requieren reglas explícitas de rechazo/cesión en canales ocupados. |
| AU-07 | `src/engine/runtime/events/play-timeline.js:34-43,157-214,274-284` | Reservas de bake por ID, transición explícita a cinemático, retorno a dinámico con velocidades, `bakeHold`; impide doble bake simultáneo. | Reutilizar esa propiedad física; no sustituirla con un lock universal. |
| AU-08 | `src/engine/runtime/events/play-bodies.js:193-214` | `_bodiesTick` sigue Jolt y excluye cuerpos reservados por bake. | Jolt es dueño natural de la pose de cuerpos dinámicos no horneados. |
| AU-09 | `src/core/timeline/preview.js:51-76,209-266` | Preview guarda pose visual, restaura sobre cada aplicación/Stop y detecta modificaciones autorales durante la vista previa. No dispara comandos ni scripts. | La evaluación editorial debe ser reversible y no tocar proyectos persistidos. |
| AU-10 | `src/engine/runtime/anim/model.js:13-45` | Metadatos `PROPS`/`validatePropertyValue` para `vec3/number/bool/color`; G006 solo habilita almacenamiento tipado en Timeline. | Un canal tipado almacenado no equivale a un aplicador temporal. |
| AU-11 | `src/engine/runtime/anim/eval.js:91-148` | `AnimRunner` conserva su propia base por pista, aplica muestras en cada tick; `finish()` comunica fin, sin contrato universal de reversión. | No reutilizar indiscriminadamente su `base` como snapshot de Timeline. |
| AU-12 | `src/engine/runtime/events/play-timeline.js:22-61,149-155,235-250` | Puede haber varios Timeline activos; se bloquea repetición del mismo ID, no los conflictos entre pistas de distintos recursos; la salida de cámara es independiente. | Autoridad por **canal**, no por orden de pistas ni ID arbitrario. |

## 3. Diagnóstico diferencial

**OBSERVADO:** el orden de `_simStep` permite que Timeline, scripts y Animation Clips alcancen los mismos objetos; solo bake tiene reserva y reafirmación física especial. La restauración automática de todas las pistas de nodo no existe actualmente.

**INFERENCIA:** al activar reproducción tipada nueva sobre los mismos canales que scripts/clips, el valor visible podría depender del orden de actualización, y los snapshots podrían restaurar valores obsoletos si no existe una única autoridad por canal.

**CAUSA RAÍZ ARQUITECTÓNICA PROPUESTA:** no existe un contrato transversal y verificable de adquisición/liberación de los canales que permita resolver esas escrituras concurrentes. **No se declara un fallo funcional reproducido para todas las combinaciones**.

**NO VERIFICADO:** que las rutas reales de script, Animation Clips, plugin interno y Jolt puedan interceptarse exhaustivamente sin efectos colaterales; alcance de clips anidados/modelo, escenas con varios Timeline activos y apps exportadas. La implementación deberá demostrarlo o BLOQUEAR la capacidad concreta.

## 4. Riesgos de compatibilidad y no alcance

- La política actual de las cuatro pistas (`position`, `rotation`, `scale`, `visible`) deja generalmente el último valor aplicado en runtime tras `_finish`; convertirlo automáticamente en restauración destruiría semántica vigente. El Amendment deberá fijar política explícita y tratar ese comportamiento por separado.
- `bake` tiene restauración de posición, cuaternión, estado dinámico y velocidades; **nunca** debe sustituirse por interpolación normal de `position`/`rotation` de un RigidBody dinámico.
- Animation Clips puede usar `makeKinematic` actualmente; no inferir que restaura todos los modos de movimiento al finalizar. Su ciclo físico completo requiere pruebas reales y un Gate pertinente si aparece un defecto.
- Los scripts y componentes internos no autorizados a editar directamente `project.objects` no deben forzar cambios persistentes durante Play.
- `visible`, `active`, `Canvas.opacity`, perfil Camera3D y propiedad de cámara de render son conceptos diferentes; aquí no se autoriza modificar sus contratos.
- La animación de color necesita validar por separado su espacio/interpolación antes de G007 técnico; este Amendment no lo presume resuelto.

## 5. Próximo paso documental

Presentar `LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G007-TB01-CA-001_AMENDMENT.md` al usuario para **ratificación expresa**. Mientras no se ratifique, TB-01 y el Gate técnico G007 continúan BLOQUEADOS. No usar la aprobación del Gate documental como autorización de producción.

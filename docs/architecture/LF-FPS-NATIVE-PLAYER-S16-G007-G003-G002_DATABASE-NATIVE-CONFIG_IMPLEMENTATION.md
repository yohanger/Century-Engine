# LevelForge S16-G007-G003-G002 — Player nativo consume Database existente

**Gate autorizado:** `LF-FPS-NATIVE-PLAYER-S16-G007-G003-G002-DATABASE-NATIVE-CONFIG`  
**SOURCE_BASELINE de partida:** `LF_FPS_NATIVE_PLAYER_S16_G007_G003_G001_INTEGRATION_CONSUMER_AUDIT_SOURCE_BASELINE.zip`.  
**Estado:** IMPLEMENTADO; QA automatizado PASS; QA local Editor/Jolt WASM/NGM Runtime y compilación NO VERIFICADOS. NO CERRADO.

## 1. Autoridad y límites

El usuario aprobó cinco Gates finales de S16 y decidió expresamente **conservar Database como está**: el Player consume sus contratos, no al revés. S16-G002, S15 Camera Orchestration, CA-001-DEFERRED-SPAWN y G007-G003-G001 son vinculantes. No se modificó `database/player.js`, el esquema ni el Editor de Database. `FpsPlayer`, ViewModel, el backend de guardado y NGM Runtime siguen siendo sus propietarios actuales.

## 2. Cambios realizados

- `play-player.js`: la API nativa expone `MOVE_KEYS` existentes, más altura/radio/ojos/escalón, como getters y setters compatibles con el registro `game.db.player` **normalizado de la sesión**, no con `project.database` autoral. Reutiliza `PLAYER_PARAMS`, `clampPlayerField`, `pickMove`, `this.g` y validación de Jolt. Un fallo físico deja el registro anterior intacto. El actor, las coordenadas y la velocidad siguen en los propietarios actuales.
- `node-spatial.js`: `configurePlayerShape()` usa `CharacterVirtual.SetShape` y libera referencias Jolt al reemplazar una cápsula; evita crear otro CharacterVirtual. Los demás nodos físicos mantienen gravedad y propiedades propias. Solo el ID de jugador nativo consume en cada tick `jumpAuto`, `jumpHeight/jumpTime`, gravedad, `fallGravity`, `terminalSpeed`, `slopeLimit` y escalón de Database. Timeline conserva su mecanismo de valores físicos transitorios.
- `play.js`: aplica el registro después de registrar el cuerpo nativo en Jolt. `game.spawnPlayer()` invoca el mismo ajuste después de materializar el Prefab y **antes** de ejecutar `_ready`, manteniendo rollback del Gate anterior.
- `play-camera.js`: conserva la selección, solicitudes y prioridad de Camera Orchestration. Cuando la fuente base seleccionada coincide con la Camera3D **hija del jugador nativo**, aplica su FOV horizontal de Database; si hay Timeline FOV o una cámara externa, mantiene esa autoridad.
- `FPS-Locomocion.js` y los fixtures: eliminan constantes de velocidad, aceleración y salto. El script toma valores de `game.player` en cada paso de física, respeta Input Map, límites de nivel y la identidad del cuerpo. Jolt sigue integrando el movimiento. Salto automático y buffer/coyote utilizan valores del mismo registro; no se implementaron nuevas variantes de agua/agacharse/manos en este Gate.
- `FPS-Camara.js`: aplica `sensitivity` del Player al script de orientación ordinario, manteniendo el control de la fuente de cámara seleccionada.
- Prefab creado por la plantilla First Person: sitúa el `CharacterBody3D` en el origen (pies), la cámara a la altura inicial de los ojos y la cápsula con dimensiones iniciales coherentes con `PLAYER_DEFAULTS`. **No se migran ni reescriben Prefabs ya guardados**. La cápsula efectiva en Play sigue viniendo de Database para el jugador designado, no se fuerza en otros personajes.

## 3. Precedencia verificable

| Dominio | Propietario único | Precedencia operativa |
|---|---|---|
| Campos de movimiento del jugador | Database normalizada de sesión (`game.db.player`) y cache runtime `this.g` ya existente | Datos de proyecto al entrar en Play; setter `game.player.*` ajusta solo la sesión y aplica clamping existente |
| Posición, velocidad y contactos | `CharacterBody3D` / `NodeSpatialRuntime` / Jolt | Los Scripts de Nodo asignan velocidad deseada; Jolt integra una vez por tick |
| Geometría física del jugador | `CharacterVirtual` existente | Database de la sesión ajusta forma sin cambiar `CollisionShape3D` persistido; interpenetración rechazada, sin commit de config |
| Cámara y FOV | Camera Orchestration | Camera3D activa y fuentes Timeline/solicitudes externas siguen teniendo prioridad. La lente de la cámara base propia del jugador consume Database |
| Script personalizado | Recurso Script original | Puede sobreescribir el comportamiento usando la API, sin duplicar perfiles persistidos |

**Nota funcional:** `MOVE_KEYS` incluye controles de agua, cámara animada, agacharse y otros subsistemas históricos. Sus valores son ahora accesibles de forma mutable en la API nativa, **pero sus efectos completos siguen pendientes** de la integración ambiental/ViewModel de los Gates siguientes. Exponer un campo no constituye evidencia de paridad.

## 4. Regresiones y restricciones

- Los proyectos creados antes de este Gate y las escenas legacy no se reescriben. `FpsPlayer` permanece en las escenas que todavía lo usan.
- Un script de Prefab no mueve cuerpos secundarios cuyo ID no sea `game.player.node.id`.
- El sistema no admite una cápsula físicamente imposible (altura menor que dos veces el radio) y no la aplica silenciosamente.
- El formato del proyecto, la serialización de Database, la API de guardado y el modelo de ViewModel **no** cambian.
- Jolt WASM real, reproducción visual, cámara en múltiples configuraciones, Editor y NGM Runtime no han podido probarse aquí. No se afirma paridad completa.

## 5. Estado de continuidad

El siguiente Gate integral aprobado en el plan es **G003-G003 — ViewModel/manos/armas/objetos/inventario 3D**. No está autorizado aún. G003-G004 se ocupará de guardado/restauración, incluido Spawn Player. G008 retira heredados solo después de paridad; G009 cierra S16 con integración.

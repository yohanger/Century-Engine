# LF-DB-S00-G001 — Contratos propuestos y puntos bloqueantes

**Naturaleza:** documento de propuesta técnica. **No es un Contract Amendment aprobado** ni sustituye SRS, URS o TDD externos. Su producción está autorizada por LF-DB-S00-G001; la aprobación de cada decisión nueva corresponde al usuario.

## 1. Contratos preexistentes verificables (no cambiados en S00)

- **DB-RUNTIME-01:** fuente de registros: `normalizeDatabase()` (`src/engine/runtime/database/schema.js:215-229`); evitar segundo esquema paralelo.
- **DB-RUNTIME-02:** inventario/actores/equipos y efectos: clase `Party` (`src/engine/runtime/database/rules.js`); no crear un segundo inventario.
- **DB-RUNTIME-03:** ejecución de eventos: `Game` crea `Party`, expone `game.party`, `useItem` y `useSkill` (`events/interpreter.js:24-53`; `events/exec-commands.js:214-215`).
- **DB-RUNTIME-04:** representación de manos: `viewModel` acopla nodos/instancias a slots declarados (`database/player.js`, `player/fps/hands.js`); no equiparar automáticamente `etype` con `right`/`left`.
- **DB-RUNTIME-05:** guardado: `SaveManager.snapshot()/restore()` conserva `Party`; `captureWorld()/restoreWorld()` conserva objetos físicos sujetos por ID de escena (`events/saves.js:63-86`, `events/play-saves.js:11-34`).
- **DB-RUNTIME-06:** animaciones: reutilizar `play-anim.js` y los clips existentes; una animación opcional no debe crear su propio motor de efectos.

## 2. Propuesta de contrato de acción de objeto — NO APROBADA

Una **acción de objeto** vincularía una referencia estable `items/id` con contexto de ejecución y, opcionalmente, un objetivo, representación de mano y animación. Se recomienda que la autoridad de inventario y efectos siga siendo `Party`.

| Fase conceptual | Regla propuesta | Falta resolver antes de implementar |
|---|---|---|
| 1. Identificar | Resolver por `kind` + `id` de Database, no solo nombre visual o nodo | Si se permiten instancias únicas con atributos por objeto |
| 2. Validar | Comprobar posesión, disponibilidad, usuario, objetivo y restricciones | Diferencias precisas `menu`, `event`, `always` y acciones 3D |
| 3. Presentar (opcional) | Sostener y reproducir clip o sonido cuando estén configurados | Duración, interrupción y momento de aplicación del efecto |
| 4. Ejecutar | Invocar reglas existentes una sola vez por uso confirmado | Transacción ante error, doble activación y objetivos inválidos |
| 5. Persistir | Actualizar inventario/equipo/estado y partidas guardadas | Identidad persistente del objeto mostrado en mano |
| 6. Extender | Ejecutar eventos comunes sin duplicar intérprete | Política de fallos y orden frente a consumo |

**Prohibido inferir como aprobado:** consumo al inicio/final de animación; gastar ítem cuando el efecto no cambia HP; prioridad al pulsar Mouse0; si una llave se consume o no por defecto; cómo se serializa un arma individual. Son decisiones por cerrar con el usuario.

## 3. Contrato de fórmula — restricciones propuestas, NO APROBADAS

**Actual:** `Party.formula(src,a,b)` usa expresiones JavaScript dentro de `new Function()` y recibe `Math`, proxies de variables (`rules.js:211-214`). **RPG Maker MZ** evalúa JavaScript con `eval` (`js/rmmz_objects.js:1959+`); copiar esta técnica no es obligatorio.

Para un runtime apto para proyectos de procedencia desconocida, se propone un **subconjunto de expresiones permitido**; antes de diseñar el evaluador se necesita decidir:

1. Operadores permitidos y compatibilidad con las fórmulas ya almacenadas.
2. Acceso limitado a `a`, `b`, `v` y funciones matemáticas necesarias.
3. Semántica de error: rechazar en editor, registrar en runtime y definir efecto nulo; no ocultar un fallo como daño válido.
4. Coerciones, división por cero, límite numérico, aleatoriedad y redondeo.
5. Migración de fórmulas antiguas: no reescribir silenciosamente registros del usuario.

Hasta resolver estas decisiones, el Gate que cambie el evaluador **permanece bloqueado** y no se afirma que la fórmula actual sea segura.

## 4. Contexto de uso y estados (pendiente de Contract Amendment)

- **Contexto:** MZ distingue menú/batalla. LevelForge propone `always`, `menu`, `event`, `never`. Debemos definir si la interacción de primera persona cuenta como evento, contexto separado o ambos. La semántica no está aprobada.
- **Instancia de enemigo:** `enemy(id)` crea estado temporal. Elegir identidad por entidad de escena, por encuentro u otra clave existente; integrar con snapshot/save antes de alterar el contrato.
- **Estados:** `duration` actualmente significa ticks/turnos. Definir origen del tick en juegos narrativos 3D y si el veneno afecta HP por tiempo, por acción o por evento.
- **Ranura de equipo:** `etype` (lógica de actor) y `slot` del View Model (anclaje físico) son espacios diferentes; definir asignación permitida y conflicto de manos, sin acoplar inventario a meshes de escena.
- **Entrada:** revisar `interact`/`drop` y futuros comandos de `use`, sin agregar binding global que rompa proyectos anteriores.

## 5. Decisiones obligatorias antes de S01 (bloqueos)

| ID | Condición pendiente | Resolución necesaria |
|---|---|---|
| CA-DB-001 | Existen o no SRS/TDD/URS/Amendments/ledger externos aprobados | Consultar/reconciliar; detener implementación ante contradicción |
| CA-DB-002 | Contextos y condiciones de uso | Decisión expresa antes de S01-G002 |
| CA-DB-003 | Gramática, seguridad y compatibilidad de fórmulas | Decisión expresa antes del Gate de fórmulas |
| CA-DB-004 | Identidad de enemigos y persistencia | Decisión expresa antes del Gate de enemigos |
| CA-DB-005 | Tiempo de estados periódicos | Decisión expresa antes del Gate de estados |

**Prioridad de autoridad:** último Gate aprobado → Amendments/parents → SRS/URS/TDD/QA → histórico → hipótesis. Si dos fuentes aprobadas chocan, el Gate siguiente queda **BLOQUEADO** hasta Amendment.

## 6. No implementado por este Gate

Ningún `src/`, `scripts/`, `package.json`, archivo de proyectos ni runtime fue modificado. No se generó un nuevo runner porque S00 es un Gate de documentación. Su creación y pruebas corresponden a S01-G001 si se autoriza.

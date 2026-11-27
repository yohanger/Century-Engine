# LF-DB-S00-G001 — Auditoría Database–Runtime (LevelForge)

**Fecha del corte:** 2026-10-22  
**Estado:** AUDITORÍA ESTÁTICA COMPLETADA; VALIDACIÓN Y CIERRE DEL GATE PENDIENTES DE QA DEL USUARIO.  
**Fuente LevelForge:** `levelforge(3).zip`, `package.json` declara versión `0.26.13`.  
**Comparativo:** `rpg-maker-carpeta data-y-js.zip` (`data/*.json`, `js/rmmz_objects.js`).  
**Alcance:** inventario, Database, reglas, eventos, manos, animaciones, estado de partida y mecanismos de QA. Sin cambios de código de producción.

## 1. Fuentes de autoridad y limitaciones

1. Autorización exacta recibida: `Listo. LF-DB-S00-G001 autoriza comenzar`.
2. Los archivos de LevelForge y de RPG Maker MZ sirven como **evidencia técnica**, no autorizan por sí solos copiar todas las mecánicas de MZ.
3. No se identificaron SRS, URS, TDD, Contract Amendments ni un ledger de proyecto en el ZIP. **No se afirma que no existan fuera del ZIP**. Antes de convertir las propuestas de este Gate en requisitos vinculantes, contrastar cualquier documento externo aprobado.
4. Las rutas de línea citadas son relativas a la raíz de los respectivos ZIP y se refieren exclusivamente al corte indicado.
5. La comparación es **estática**. No se ejecutó QA funcional en el editor, WebGL o AppImage. Los resultados de compilaciones de Gates anteriores no sustituyen QA de Database.

## 2. Inventario existente — EXTEND BEFORE DUPLICATE

| Componente | Evidencia en LevelForge | OBSERVADO |
|---|---|---|
| Esquema | `src/engine/runtime/database/schema.js:17-53,68-160` | Colecciones `actors`, `classes`, `skills`, `items`, `weapons`, `armors`, `enemies`, `states`, `commonEvents`, `quests` y `lore`; descriptores declarativos. |
| Migración y defaults | `database/schema.js:213-229` | `normalizeDatabase()` completa campos faltantes y normaliza `player`; contrato de compatibilidad existe, sin batería de regresión localizada. |
| Inventario | `database/rules.js:37-60` | Conteos para items/weapons/armors, límite por objeto y notificación de cambios. |
| Actores y parámetros | `database/rules.js:63-143` | Estado de actores, equipo, rasgos y cálculos derivados de clase y nivel. |
| Equipamiento | `database/rules.js:171-185` | Equipar/desequipar exige posesión y ranura; la primera ranura se trata como arma y el resto como armadura. |
| Estados | `database/rules.js:187-208` | Aplicar/quitar estados y descontar turnos; sin aplicación general de daño por periodo en `tick()`. |
| Fórmulas, efectos | `database/rules.js:210-243` | Fórmula (`new Function`), elemento, variación, recuperación, estados, crecimiento y eventos comunes. |
| Uso | `database/rules.js:244-276` | `useSkill`, `useItem` y entrega de solicitudes de eventos comunes. |
| Intérprete | `events/interpreter.js:24-53,349-350` | `Game` instancia `Party`, expone `game.party` y opera sobre eventos y scripts. |
| Comandos de autoría | `events/cmd-party.js`, `events/exec-commands.js:206-215` | Comandos para usar item/skill, equipar y cambiar estados reutilizan `Party`. |
| Interfaz inventario | `ui/defaults.js:136-169` | Puede usar objetos desde interfaz; ruta diferente de la mano física. |
| View Model | `database/player.js:4-6,47-80`, `player/fps/hands.js:148-181,338-380` | Slots de mano/cámara; acoplamiento de nodos de escena, no de registros de inventario. |
| Animaciones | `events/play-anim.js`, `components/AnimationPanel.vue:372-373` | Reproducción de clips en modelos y slots; vínculo declarativo de animación por objeto no localizado. |
| Input | `input/inputmap.js:17-30` | `interact` y `drop` incluyen `Mouse0` por defecto; la acción de usar item debe definir prioridad. |
| Guardado | `events/saves.js:63-86`, `events/play-saves.js:11-34` | Serializa `Party` y reconstituye objetos sostenidos por IDs de escena. No almacena identidad persistente de items 3D de inventario. |
| Exportación | `package.json` (`build`) | Editor y Player compilados separadamente, con mismo código fuente de runtime. La equivalencia funcional requiere prueba real. |

## 3. Comparación concreta con RPG Maker MZ

Se inspeccionaron las tablas `data/Actors.json`, `Classes.json`, `Items.json`, `Weapons.json`, `Armors.json`, `Skills.json`, `States.json`, `Enemies.json`, `CommonEvents.json`, `System.json` y los métodos de `js/rmmz_objects.js`. Las columnas de la hoja `TRACEABILITY` del ledger presentan el mapeo por capacidad, evidencia y estado.

| MZ (referencia) | LevelForge (estado observado) | Diferencia por resolver |
|---|---|---|
| `Items.json`: `consumable`, `occasion`, `scope`, `effects`, `damage` | El esquema incorpora campos equivalentes. | `Party.useItem()` rechaza `occasion='never'` pero no recibe contexto menú/evento/acción 3D (`rules.js:264-273`). |
| `Game_BattlerBase.meetsItemConditions()` / `Game_Party.consumeItem()` (`rmmz_objects.js:3244-3254,5671-5675`) | `Party.has()`, `Party.useItem()` y descuento de una unidad. | Sin transacción única uso–animación–efecto–consumo–mano. |
| `Game_Action.apply()` (`rmmz_objects.js:1914-1934`) | `_apply()`, `_damage()`, `_effects()` | No se identificó resolución general de acierto/evasión/crítico/guardia. |
| `Game_Action.evalDamageFormula()` (`rmmz_objects.js:1959-1971`) | `Party.formula()` (`rules.js:210-214`) | Evalúa texto arbitrario con `new Function`, riesgo técnico si el proyecto no es confiable. MZ usa `eval`, lo que **no** obliga a replicar ese mecanismo. |
| `Skills.json`: `mpCost`, `tpCost`, `successRate`, `repeats`, `animationId` | Coste MP, fórmula, efectos, scope y mensajes. | TP, repetición, probabilidad de éxito y animación vinculada no están plenamente representados; decidir aplicabilidad antes de portar. |
| `States.json`: reglas de eliminación y rasgos | Estados con `duration`, `restriction`, `removeOnDamage` y traits | Falta contrato de unidades de tiempo/turno y efectos periódicos para juegos en tiempo real. |
| `Weapons.json`, `Armors.json`: ranuras, parámetros, rasgos | Esquema de equipo y `Party.equip()` | Ranura RPG no equivale a mano izquierda/derecha; equipamientos y objetos de manos no se sincronizan. |
| `Game_Actor.changeEquip()` (`rmmz_objects.js:4267+`) | `Party.equip()` (`rules.js:171-185`) | Reglas de compatibilidad de tipos de equipo requieren revisión; el código asume posición 0=arma. |
| `CommonEvents.json` | `commonEvents` y `Party.runEvents()` | Reutilizable; falta QA de eventos disparados por acciones de objeto. |
| Guardado de grupo e inventario | `SaveManager.snapshot()/restore()` | Ya persiste estado de grupo; cualquier nueva identidad de instancia debe diseñarse con compatibilidad hacia atrás. |

### Defectos y riesgos priorizados

- **DB-R01 / OBSERVADO:** `Party.enemy(x)` construye nuevo estado (`rules.js:102-112`) cada llamada. **INFERENCIA:** al pasar únicamente `{enemy: id}` a `battler()`, el daño podría no persistir entre usos independientes. No afirmar cómo se gestionan enemigos 3D sin QA adicional.
- **DB-R02 / OBSERVADO:** fórmula evaluada con `new Function()` (`rules.js:211-214`). **RIESGO:** código arbitrario en fórmulas de proyectos no confiables; no hay un lenguaje restringido verificado. **CAUSA RAÍZ de fallo de seguridad:** no evaluada con prueba de explotación (no corresponde a este Gate).
- **DB-R03 / OBSERVADO:** `occasion` declarada en `schema.js:53`; `useItem()` solo verifica `never` (`rules.js:267-270`). **RIESGO:** uso fuera de contexto.
- **DB-R04 / OBSERVADO:** el estado predeterminado `Veneno` describe pérdida de vida, pero `tick()` solo reduce duración (`schema.js:200`, `rules.js:198-203`). **RIESGO:** inconsistencia entre descripción y ejecución.
- **DB-R05 / OBSERVADO:** primera ranura de equipo = arma, resto = armaduras (`rules.js:7,171-185`), sin tipificación individual de clase de ítem en cada ranura. **RIESGO:** configuraciones avanzadas de equipamiento.
- **DB-R06 / OBSERVADO:** UI llama a `game.party.useItem()`, mientras que las manos colocan entidades de escena en slots (`ui/defaults.js:169`, `fps/hands.js:148-181`). **BRECHA DE INTEGRACIÓN:** falta acción nativa consistente.
- **DB-R07 / OBSERVADO:** `interact` y `drop` contienen `Mouse0` (`inputmap.js:17-30`). **RIESGO:** conflicto al introducir `usar objeto` sin política de prioridad.
- **DB-R08 / OBSERVADO:** `README.md` enumera scripts de pruebas para inventario, View Model y guardado que no se encuentran en `scripts/` de este ZIP. `package.json` no tiene script `test`. **BLOQUEO:** no declarar QA funcional automático sin incluir el runner pertinente en un Gate autorizado.

## 4. No confundir con causa raíz

Los hallazgos anteriores proceden de lectura de código. **Ninguno demuestra por sí mismo un fallo de runtime en el equipo del usuario.** El objetivo del programa de trabajo es pasar de contratos fragmentados a comportamientos completos medidos con pruebas reproducibles.

## 5. Criterios de aceptación de la consolidación (a largo plazo)

1. Un objeto consumible recupera HP una vez, descuenta una unidad y preserva sus efectos tras guardar/cargar.
2. Un objeto no consumible puede usarse sin desaparecer.
3. Un objeto narrativo puede requerir un objetivo (p. ej. llave y puerta) sin forzar estadísticas RPG.
4. El mismo registro de Database puede representar y actualizar la posesión y la mano equipada cuando se autorice esa integración.
5. Las animaciones/sonidos son opcionales; el resultado lógico no depende de que exista un clip.
6. Las fórmulas y los efectos producen resultados definidos bajo un contrato validado de contexto, fallo y límites.
7. Las pruebas de integración se ejecutan en editor **y** AppImage exportado; ninguna compilación sustituye la evidencia visual/funcional.

**Fuera del Sprint actual:** combate por turnos obligatorio, TP obligatorio, editor nuevo de animaciones, nuevo sistema de inventario, nueva máquina de eventos, manos físicas nuevas, IA de NPC, FrostEngine/PSX, refactorización general.

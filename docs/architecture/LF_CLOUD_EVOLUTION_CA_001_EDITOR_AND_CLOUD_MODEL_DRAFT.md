# LF-CLOUD-EVOLUTION-CA-001 — Propuesta de Amendment de evolución atmosférica

**Estado: BORRADOR NO RATIFICADO · SIN EFECTO SUSTITUTIVO.**  
**Gate que autoriza únicamente la redacción:** `LF-CLOUD-EVOLUTION-S00-G002-ALGORITHM-DESIGN-AND-AUTHORITY-CONTRACT`.  
**Fecha:** 2026-11-17.

## Autoridad y alcance

Este texto **no** modifica obligaciones aprobadas por su mera existencia. Se propone para reconciliar las decisiones actuales del usuario con el código y los contratos anteriores, antes de cualquier Gate de implementación. Fuentes contrastadas: `LF-WEATHER-UNIFICATION-CLOUD-TORNADO-CA-001.md`, `LF-WEATHER-TORNADO-LIFECYCLE-CA-001.md`, `LF-VFX-WEATHER-DECOUPLING-CA-001.md`, `world/params.js`, `world/world.js`, `scene-graph.js`, `scene/environment.js`, `render/viewport.js`, `world/api.js`, `core/events/game-api.d.ts`.

**Dependencia bloqueante:** se conoce por la continuidad de decisiones la ratificación de `LF-VOLUMETRIC-CLOUDS-REPLACEMENT-CA-001`, pero el texto íntegro no se encuentra en `docs/architecture` del SOURCE_BASELINE G001. Debe localizarse y compararse antes de ratificar cualquier supersesión relacionada. Este borrador no lo recrea ni lo sustituye.

## Propuesta de cláusulas, sujetas a ratificación

**CA-01 · Simulación únicamente en PlayMode/Runtime.** Edit Mode muestra el resultado del estado autoral de World como vista estable. Cambiar los ajustes puede recalcular el cielo sin avanzar el condensado temporal. El modo Play y Player son los únicos consumidores que hacen avanzar el reloj meteorológico normal. La pausa detiene evolución atmosférica.

**CA-02 · `liveFx` no es autoridad meteorológica.** Quedaría sustituida exclusivamente la obligación/expectativa previa que permite `World.update(dt,{clock:false})` en el editor solo porque `liveFx` está activo. Se preservan previsualizaciones independientes de agua, viento visual, naturaleza, lluvia y luces tras auditar sus consumidores; no se desactiva la bandera global por atajo.

**CA-03 · Morfologías generadas automáticamente.** El usuario configura el estado del clima y su variabilidad, sin tener que escoger manualmente forma o categoría para cada nube. La clasificación morfológica puede mantenerse para script/consultas/diagnóstico, pero no autoriza cambiar súbitamente la geometría visible.

**CA-04 · `classic`/`cells` y valores existentes.** La configuración `cloudModel` y `game.weather.cloudModel` existen y son públicas; su eventual consolidación se aprobará con un plan de consumidores y persistencia y QA. No se declara que `classic` esté retirado ni que las escenas actuales deban ser migradas a un formato histórico inventado. El futuro UX único no supone borrar campos o archivos de usuario.

**CA-05 · World, nube madre y efectos.** World conserva el estado y fase de tornados, control del viento y fenómenos; CloudField/Sky continúan como responsables de la condensación de nube madre y embudo conforme a `LF-WEATHER-UNIFICATION-CLOUD-TORNADO-CA-001`. VFX3D no se convierte en motor meteorológico alternativo, y el agua/fuego/Jolt/vegetación conservan sus autoridades.

**CA-06 · Conservación de APIs y estado existente.** No romper `game.weather`, `effectivePrecipitationAt`, `lightningOrigin`, `opticalDepthAlongRay`, `sunTransmission`, `moonTransmission`, ni el guardado de CloudVolume sin un contrato de cambio y QA de consumidor. No eliminar datos reales de proyectos, independientemente de la condición pre-1.0.

**CA-07 · QA vinculante propuesto.** Solo puede aprobarse implementación cuando la evolución de nubes, iluminación, lluvia, relámpagos, tornado, ciclo Edit/Play/Stop, persistencia, teletransporte y Player satisface pruebas locales reproducibles. El G001 aprobado **no acredita** todavía esas capacidades futuras.

## Cláusulas anteriores: situación

| Fuente | Hecho | Tratamiento |
| --- | --- | --- |
| `LF-WEATHER-UNIFICATION-CLOUD-TORNADO-CA-001` | World es único; el embudo visual no usa VFX meteorológico paralelo | **PRESERVAR** |
| `LF-WEATHER-TORNADO-LIFECYCLE-CA-001` | fases/tornados, física Jolt y eventos con dueño definido | **PRESERVAR** |
| `LF-VFX-WEATHER-DECOUPLING-CA-001` | `.vfx` genérico, no dato meteorológico | **PRESERVAR en lo compatible** |
| Comportamiento `scene-graph.js` | `liveFx` avanza Weather sin reloj | **CONFLICTO** con decisión posterior; ratificar propuesta CA-02 |
| Contratos/UX de `params.js`, `game-api.d.ts` | `cloudModel='classic'` predeterminado y `cells` opcional | **NO SUSTITUIR** antes de inspeccionar consumidores y ratificar CA-04 |
| `LF-VOLUMETRIC-CLOUDS-REPLACEMENT-CA-001` | nombre/ratificación constan en continuidad, texto completo ausente del baseline | **BLOQUEADO** para comparación de cláusulas |

## Estado jurídico/técnico de este borrador

- No contiene una autorización de implementación ni de cambio del editor.
- No se considera Amendment vigente hasta ratificación expresa del usuario y reconciliación del texto ausente.
- Las cláusulas que lleguen a sustituirse deberán nombrar exactamente la obligación, el documento y el alcance; el histórico del ledger permanecerá intacto.
- Si no se recupera el Amendment ausente, se bloquea la aprobación contractual de toda supersesión que lo afecte, sin bloquear el análisis documental.

# Contract Amendment UPA-CA-002 — Consolidación técnica de la animación universal

**ID:** `LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-UPA-CA-002`

**RATIFICACIÓN:** mensaje literal del usuario: `Ratifico LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-UPA-CA-002`.

**Gate técnico autorizado en el mismo mensaje:**
`LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-INTEGRAL_CORR-003-ALL-NODES-INSPECTOR-COVERAGE` mediante frase literal `Listo. LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-INTEGRAL_CORR-003-ALL-NODES-INSPECTOR-COVERAGE autoriza comenzar`.

## 1. Cambio contractual autorizado

Se sustituyen exclusivamente las disposiciones de **UPA-05** que exigían *Gates distintos* para integrar propietarios especializados y de **UPA-06** que exigían *otro Gate correctivo* para certificar G007. Se admite una **única intervención integral CORR-003**, con subpruebas aisladas por propietario, que incorpore dentro de su propio alcance los medios técnicos indispensables (Editor, Player, Jolt, Camera Orchestration, Canvas/UI, audio, materiales, geometría, fixtures, harness, runner, documentación y ledger).

No se modifica la arquitectura de autoridad de TB01, G007, S15, FilmMaker, Jolt ni la propiedad de los datos. **La consolidación de Gates no es certificación automática de G007 ni permiso para utilizar `object3D` como atajo.** Los puntos de integración siguen sujetos a sus invariantes y pruebas.

## 2. Cobertura y exclusiones

El objetivo contractual es cada valor funcional editable del Inspector para los **34 tipos de nodo registrados**, incluidas variantes y controles de componentes. Cada campo deberá declarar identidad, lectura, valor tipado, aplicador de su dueño, validación, evaluación temporal, restauración, persistencia y paridad Editor/Player.

Se excluyen los botones y operaciones de prefab, las operaciones editoriales sin valor temporal (p. ej. hornear, crear o restaurar una geometría como acción única) y las funcionalidades **de postprocesamiento de cámara** que el usuario reservó expresamente para trabajo futuro. No se excluyen Camera3D/FOV/cámara principal, Camera Shake, Trigger, Gameplay, Canvas, audio o física solo por su complejidad.

## 3. Impedimentos de cierre

Si falta un aplicador certificado, no se ofrece una llave ficticia para fingir animación universal; se declara la propiedad **PENDIENTE o BLOQUEADA** y el Gate **NO CERRADO**. No cambiar contratos para encubrir fallos. Mantener todas las pistas antiguas, proyectos actuales y dos artefactos LevelForge exactos: CHANGE y SOURCE_BASELINE actualizado. No borrar historial del ledger.

Cualquier conflicto entre propietarios aprobados exige una enmienda de autoridad antes de modificar su semántica. No se autorizan loops, managers, runners o catálogos paralelos permanentes de runtime.

## 4. Autoridad y estado

UPA-CA-001 continúa vigente excepto por la secuenciación de Gates indicada; UA-CA-001, TA/TB01 y contratos Camera Orchestration permanecen vinculantes. Esta enmienda se registra documentalmente en el Gate CORR-003 ya autorizado. **La ratificación no constituye QA local, COMPILADO ni APROBADO/CERRADO.**

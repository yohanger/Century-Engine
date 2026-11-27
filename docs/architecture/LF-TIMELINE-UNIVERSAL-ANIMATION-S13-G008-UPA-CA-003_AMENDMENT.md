# LevelForge · UPA-CA-003 — Recipientes: alcance temporal y conservación de masa

**ID:** `LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-UPA-CA-003`  
**Autoridad:** ratificada por el usuario en la secuencia de CORR-003 del 2026-11-11. Se incorpora físicamente al baseline mediante `LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-CORR003-FINAL-COVERAGE-G001`, autorizado literalmente por el usuario.  
**Vinculación:** UPA-CA-001/002 y CORR-003; conserva las garantías de masa, sustancia, snapshots y propiedad de `WaterWorld`.

## Enmienda

Quedan **excluidos de animación Timeline** tres campos autorales de un recipiente (`Node3D` y `RigidBody3D`):

1. **Habilitación del recipiente** (`liquidContainer.enabled`): decisión de existencia de la fuente física; no se crea ni destruye masa por keyframe.
2. **Identidad del líquido** (`liquidContainer.liquidId`): identidad de sustancia/perfil físico; no se simula una transmutación de recursos o balances por sustancia.
3. **Volumen inicial** (`liquidContainer.initialM3`): condición de inicialización, no equivalente al volumen dinámico real después de vertidos.

Se **conservan** los canales implementados de **caudal de salida** (`pourRate`), **forma interior** (`shape`) y **dimensiones interiores** (`size`); estos últimos se ejecutan sobre el mismo recipiente de `WaterWorld`, con rechazo atómico si la capacidad resultante no contiene el líquido actual. No alteran `volumeM3`, `initialM3` ni la identidad de la sustancia. La restauración no agrega agua ya derramada.

## Efecto sobre informes y ledger

Los pendientes históricos de CONT011/012 que exigían animar los tres campos excluidos dejan de ser bloqueos de *cobertura contractual*. Su registro histórico se mantiene; las filas del ledger de FINAL-COVERAGE incorporan esta sustitución, sin borrar pruebas ni inventar QA local. **Esta enmienda no certifica por sí sola Player, Electron ni CORR-003.**

# Contrato de alcance S13-G008-G003

OBJETIVO: recorte no destructivo y reversible de Audio desde ambos extremos. MECANISMO: prolongar `model.js` y `TimelinePanel.vue` existentes; recálculo temporal en memoria; usar `offset`, `duration` y `t` persistidos, PCM y rate fuente.

PRERREQUISITOS: G008-G002 CORR-001 aprobado por usuario; controles y contratos S11/S12; SOURCE_BASELINE acumulado exacto. ALCANCE PERMITIDO: dos fuentes de producción, una prueba histórica cuyo mecanismo cambió, tests focal/fixture/runner, QA, docs y ledger. MEDIOS INDISPENSABLES: PCM/WAV de fixture, runtime Preview/Player existente, runner Electron, build Editor+Player y QA local.

EVIDENCIA: Node focal/dirigida/ampliada, Electron, build, prueba manual sonora y persistencia. CONTRADICCIONES: ninguna contractual hallada; rechazo explícito de recortes destructivos o con puntos/fundidos inválidos. SIGUIENTE ACCIÓN REAL: usuario ejecuta QA Electron, build, Preview/Player y devuelve evidencia. No iniciar Gate posterior sin aprobación.

# Diferencial G007-G001 CORR-001

SOURCE_BASELINE anterior: `LF_INSPECTOR_AUDIO_VOLUME_POINTS_S12_G007_G001_INTEGRAL_SOURCE_BASELINE.zip`.

## Modificaciones funcionales de producción

**Ninguna**: no se cambia `src/`, `package.json`, Mixer, AudioEngine, modelo, Inspector, Preview ni Player.

## Archivos QA modificados

- `scripts/fixtures/editor/inspector-audio-volume-points-s12-g007-g001.html`: cambia únicamente `checks.length===36` por `checks.length===40` al finalizar. Todas las aserciones permanecen intactas.
- `scripts/test-inspector-audio-volume-points-s12-g007-g001-electron.mjs`: cambia únicamente `minChecks:36` por `minChecks:40`.
- `docs/qa/LevelForge_DB_Ledger.xlsx`: añade registros de CORR-001 a las seis hojas, sin alterar datos ni fórmulas históricas.

## Añadidos

- `scripts/test-inspector-audio-volume-points-s12-g007-g001-corr001.mjs`: seis pruebas Node de regresión para contrato QA, conteo y colector.
- `docs/qa/*CORR-001*`: contrato QA, diff, inventario y evidencias originales y de ejecución.

La documentación histórica del Gate original se conserva sin reescribirla; el contrato de contador `36` queda **superado** por esta corrección y ahora exige `40`.

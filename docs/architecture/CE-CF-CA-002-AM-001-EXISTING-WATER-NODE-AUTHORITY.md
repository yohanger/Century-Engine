# CE-CF-CA-002-AM-001 — Existing Water Node Authority

**Estado:** ratificado por el usuario. **Gate:** `CENTURY-ENGINE-FLUIDS-S01-G001-CORR-001-EXISTING-WATER-NODE-REUSE` autorizado. Sustituye la parte de CE-CF-CA-002 que proponía crear un tipo nuevo.

## Decisión

- Reutilizar exclusivamente el identificador persistente `water`, con nombre visible «Agua»; no registrar `fluidwater3d`, `Water3D` ni «Agua 3D».
- `fluidcontainer3d` conserva sus datos históricos y no se registra como un tipo adicional. Su funcionamiento físico sigue sujeto a los contratos previos; no se reinterpreta automáticamente durante esta corrección.
- Mantener la creación mediante el registro de nodos, Inspector actual y serialización existente.
- La simulación se resuelve por Century Fluids en `vendor/century-fluids/`, conectada al Runtime y al único paso Jolt del consumidor.
- Las vistas previas editoriales se ocultan durante Play y se restauran al regresar al Editor, sin ocultar la superficie física del Player.
- Mantener los recursos `.liquid` y las escenas previas; no restaurar `WaterWorld` ni crear una segunda implementación de física.

## Compatibilidad y verificación

La reactivación de `water` no equivale a una migración de los datos históricos. Los campos anteriores se conservan y la integración aplica valores predeterminados cuando sus nuevas opciones no existen. `fluidcontainer3d` continúa inerte en este baseline; no se afirma una integración física que no se ha realizado.

La implementación se considera solo **implementada en fuente** hasta QA completo. Los resultados y límites constan en `docs/qa/CENTURY-ENGINE-FLUIDS-S01-G001-CORR-001-EXISTING-WATER-NODE-REUSE_QA.md`.

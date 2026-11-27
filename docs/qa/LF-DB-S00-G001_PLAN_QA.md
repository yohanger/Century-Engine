# LF-DB-S00-G001 — Plan de Sprint y QA de integración

**Estado:** propuesta de Gates. Ningún Gate S01 está autorizado. Solo LF-DB-S00-G001 recibió autorización de ejecución documental.

## 1. Antes del primer Gate de código

1. Revisar documentos autoritativos externos (URS/SRS/TDD/Amendments/Gates) si los hay y reconciliar diferencias.
2. Aceptar o enmendar los contratos propuestos en `LF-DB-S00-G001_CONTRATOS.md`.
3. Aceptar el `LevelForge_DB_Ledger.xlsx` como **ledger inicial** o integrarlo al ledger autoritativo externo si existe; no mantener dos fuentes de verdad.
4. Conservar `levelforge(3).zip` y comprobar de nuevo que el proyecto local no ha cambiado en las rutas objetivo antes de aplicar posteriores Change ZIP.
5. Trabajar solo el Sprint S01, no construir S02-S05 por adelantado.

## 2. Roadmap funcional (sin prometer fechas)

- **S00 / DOCUMENTACIÓN:** matriz de equivalencias MZ→LevelForge, bloqueos, trazabilidad y ledger inicial. Gate G001 autorizado; cierre sujeto a aceptación de la documentación.
- **S01 / REGLAS DATABASE:** runner, contratos de uso, fórmulas, estados/objetivos, pruebas de integración de inventario y guardado. **Refinamiento exclusivo del Sprint actual.**
- **S02 / OBJETOS 3D:** identidad Database ↔ inventario ↔ View Model, recoger/usar/soltar y acciones contextuales. PENDIENTE PLANIFICADO.
- **S03 / ARMAS Y EQUIPAMIENTO:** manos, tipo de acción, efectos/daño y reglas especializadas. PENDIENTE PLANIFICADO.
- **S04 / ANIMACIÓN OPCIONAL:** enlazar clips existentes a acciones, interrupciones y presentación. PENDIENTE PLANIFICADO.
- **S05 / INTEGRACIÓN DE PRODUCTO:** autoría sin scripts obligatorios, compatibilidad, guardado, exportación y AppImage. PENDIENTE PLANIFICADO.

## 3. Descomposición S01 (Gates técnicos pequeños)

| Gate propuesto | Objetivo verificable | Medios indispensables dentro del Gate | Dependencias y estado |
|---|---|---|---|
| LF-DB-S01-G001 | Crear baseline de pruebas de `Party` y guardado sin cambiar reglas | `scripts/test-db-contract.mjs` (**nuevo en G001**), `node --test`, fixtures de DB mínima, validación de valores/resultados; QA usuario | RECOMENDADO; depende de decisión sobre documentos externos |
| LF-DB-S01-G002 | Respetar `occasion` y condiciones de uso sin duplicar vías menú/evento | Corregir `database/rules.js` y adaptadores originales necesarios; ampliar `test-db-contract.mjs` con contextos/consumo | PENDIENTE PLANIFICADO; requiere CA-DB-002 y G001 aprobado |
| LF-DB-S01-G003 | Endurecer evaluación de fórmulas preservando contratos aprobados | Evaluación/restricción acotada en archivo original o módulo pequeño solo si demostrado necesario; fixtures de formulas legales/ilegales | PENDIENTE PLANIFICADO y BLOQUEADO por CA-DB-003 |
| LF-DB-S01-G004 | Estado persistente de enemigos por instancia sin cambiar el registro de catálogo | Identificación/vida/estado estable, integrar con `saves.js` y el test del Gate; migración de save si indispensable | PENDIENTE PLANIFICADO y BLOQUEADO por CA-DB-004 |
| LF-DB-S01-G005 | Semántica verificable de estados temporales y daño periódico opcional | Ajustes específicos en `rules.js`, pruebas de ticks, efectos y serialización | PENDIENTE PLANIFICADO y BLOQUEADO por CA-DB-005 |
| LF-DB-S01-G006 | **QA de integración S01:** poción, llave no consumible, habilidad, estado y guardado/restauración | Fixtures integradas, `npm run build`, QA usuario en editor y AppImage; sin depender de scripts faltantes | PENDIENTE PLANIFICADO; depende de G001–G005 pertinentes aprobados |

> No declarar G002–G006 listos para implementar sin cerrar las decisiones que indican sus dependencias. Ninguno de esos Gates autoriza crear un nuevo editor, un sistema de manos paralelo o un combate completo.

## 4. Evidencia de QA exigida

**Automatizada:** cada prueba documentará entrada, acción, estado antes/después y resultado real (sin PASS prefabricados). El primer runner todavía no existe, pero su archivo y mecanismo forman explícitamente parte del alcance de S01-G001.

**Usuario local:** construir y arrancar LevelForge con `npm run build` y `npm run electron`; ejecutar el caso de prueba en editor; exportar AppImage y repetir. Adjuntar terminal, evidencia visual y acciones observadas.

**Regla de cierre:** un Gate puede estar autorizado o aplicado sin estar aprobado. Solo se cierra cuando QA y evidencia sustentan su objetivo, se analizan fallos y el ledger se actualiza.

## 5. Validación S00 actual (sin instalación)

El Change ZIP de S00 contiene **únicamente** archivos nuevos bajo `docs/qa/`:

- `LF-DB-S00-G001_AUDITORIA.md`
- `LF-DB-S00-G001_CONTRATOS.md`
- `LF-DB-S00-G001_PLAN_QA.md`
- `LevelForge_DB_Ledger.xlsx` (6 hojas: ROADMAP, BACKLOG, DEPENDENCIES, GATES, EVIDENCE, TRACEABILITY)

No hay reemplazos en el baseline de `levelforge(3).zip`. Verificación de usuario: integridad ZIP; listado de rutas; lectura de los contratos y el ledger, y confirmación de que no contradicen decisiones previas. **No se requiere compilar el motor ni ejecutar AppImage para cerrar un Gate exclusivamente documental.**

## 6. Salida de S00 y siguiente acción real

El usuario revisa y aprueba/corrige estos documentos. Si existen documentos autoritativos que contradicen el contenido, detener y resolver con Amendment. Después se define y autoriza por separado `LF-DB-S01-G001` con runner propio de QA. Hasta entonces no modificar código.

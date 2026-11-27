# S00-G001 — QA documental de la continuación CONT003 (pausa Century / playground)

**Fecha:** 2026-11-19. **Gate:** `CENTURY-FLUIDS-S00-G001-INTEGRAL-PROJECT-FOUNDATION-AND-CONTRACT` (autorizado; sin cierre). **Fase:** documental / pre-implementación.

## Fuente e integridad

- Fuente primaria `century(1).zip` recibida del usuario, SHA-256 `deee62669c452c805fd96b8dc951bf0650a3510206f7af029c50ec9bc6c67822`.
- ZIP Century: 3.994 entradas, CRC PASS. Auditoría directa sobre `package.json`, `package-lock.json` y fuentes de runtime/Jolt/nodos/editor; sin extracción para implementación, sin copia del código ajeno al proyecto Century Fluids.
- Evidencia central: `docs/06_SOURCE_AUDIT.md` con observaciones, líneas, inferencias, decisiones, bloqueos y alcance. Ledger actualizado sin borrar el bloqueo histórico previo a recibir la fuente.

## Resultado acreditable

- Source audit estática: **PASS**, identificados Century 0.26.13, lock Jolt 1.1.0, Three 0.186.1, ciclo físico 20–240 Hz, ownership `JoltWorld`/`BodySet`, callback `onForces`, desacople Editor/Runtime y legado agua inerte.
- Esquema del nuevo proyecto: se preservan cinco carpetas (`src`, `tests`, `qa`, `docs`, `ledger`), ocho documentos técnicos, README y seis hojas de ledger con **11 Sprints / 11 Gates únicos G001**. Sin nuevos crates, dependencias, builds ni modificaciones a Century.
- `README`, contratos de arquitectura e interoperabilidad, fuentes y ledger actualizados conforme al código real observado.
- QA de física Rust: **NO IMPLEMENTADO / NO VERIFICADO**. Jolt WASM real, instalación Node, builds Century, pruebas Electron, compilación Rust y rendimiento: **NO EJECUTADOS**. No se afirma QA local de esos subsistemas.

## Runner y comparación de paquetes

Comandos para comprobar en un directorio que contenga `CENTURY_FLUIDS` y los ZIP respectivos:

`python3 CENTURY_FLUIDS/qa/verify_s00.py --project CENTURY_FLUIDS --previous-baseline CENTURY_FLUIDS_S00_G001_CONT002_SOURCE_BASELINE.zip --baseline CENTURY_FLUIDS_S00_G001_CONT003_SOURCE_BASELINE.zip --change CENTURY_FLUIDS_S00_G001_CONT003_CHANGE.zip`

`unzip -t CENTURY_FLUIDS_S00_G001_CONT003_SOURCE_BASELINE.zip`

`unzip -t CENTURY_FLUIDS_S00_G001_CONT003_CHANGE.zip`

El runner comprueba directorios, número de documentos, seis hojas/11 Gates, SHA-256 del manifiesto y que CHANGE contenga **únicamente** el delta de archivos frente a CONT002 (no todos los archivos del baseline). No inspecciona ejecutabilidad de Rust/Jolt.

## Continuidad CONT003: evidencia, límites y decisión del usuario

- Autoridad usuario 2026-11-19: S08 en pausa sin cambio de número ni cierre por omisión; playground de agua como herramienta de QA independiente, y la integración Century solo después de su valoración positiva.
- Contratos actualizados `CF-CA-001`, `CF-ARCH-001`, `CF-PHYS-001`, `CF-INTEROP-001`, `CF-ROADMAP-001`, `CF-QA-001` y ledger. La regla permanece exactamente 11 Sprints / 11 Gates G001.
- Propuestas numéricas `CF-PHYS-ACC-001` = **umbral pendiente de ratificación**, NO medición física ni benchmark realizado. Jolt real y Rust siguen NO VERIFICADOS; el contenedor de ejecución documental carece de `rustc/cargo`, dato **no extrapolable** al equipo del usuario.
- Contradicción v1.0 explicitada: si S08 permanece pausado al liberar, es imprescindible Amendment del alcance o reactivación; el QA documental no puede sustituir autorización contractual.
- `CHANGE CONT003` debe contener solo diferencias sobre `CONT002`; `SOURCE_BASELINE CONT003` contiene el proyecto íntegro. Comparación de manifest/ZIP por el runner.

## Dictamen

**AUDITORÍA ESTÁTICA DEL CÓDIGO CENTURY: PASS. QA DOCUMENTAL Y ESTRUCTURAL: PASS (verificado con runner y, al empaquetar, comparación con los ZIP de la continuación CONT003).** El usuario todavía debe ratificar contratos y métricas S00 antes de declararlo APROBADO/CERRADO. No procede S01 ni integración sobre Century sin su Gate autorizado.

# QA documental — S15-G006 CONTRACT-AMEND-G001

**Gate:** `LF-CAMERA-ORCHESTRATION-S15-G006-CONTRACT-AMEND-G001`  
**Amendment:** `docs/architecture/LF-CAMERA-ORCHESTRATION-S15-G006-CA-001_AMENDMENT.md`  
**Estado:** REDACTADO / RECOMENDADO; **RATIFICACIÓN PENDIENTE**. Producción intacta, no se ejecuta prueba de gameplay.

## 1. Objetivo y evidencia permitida

Revisar la resolución de D03/D04/D06/D09/D12 y decidir si puede vincular el Gate técnico. La autorización de este Gate solo cubre documentación, auditoría y ledger. El QA automático de G005 y los builds aportados por el usuario son **antecedentes**, no PASS del nuevo blend.

## 2. Matriz documental de aceptación

| ID | Verificación | Resultado del documento |
|---|---|---|
| DOC-01 | Parent CAM-01..16 y CA active/visible sin sustitución encubierta | DOCUMENTADO |
| DOC-02 | D03: separación FilmMaker autoría / Cinematics consumidor / Preview editorial / Play-Player | DOCUMENTADO |
| DOC-03 | D04: autoridad vigente, rechazo de tercero, cesión por dueño, `held` | DOCUMENTADO |
| DOC-04 | D06: input y pointer lock distintos de salida de cámara | DOCUMENTADO; implementación futura condicionada a auditoría |
| DOC-05 | D09: Shake cinematográfico externo OFF por defecto; opt-in futuro explícito | DOCUMENTADO |
| DOC-06 | D12: Cut, duración, ease, pose mundial, quaternion, FOV vertical, perfil dominante | DOCUMENTADO |
| DOC-07 | D12: interrupción desde pose efectiva sin Shake; rechazo atómico | DOCUMENTADO |
| DOC-08 | Fin natural/Stop/Skip/interrupción/fuente perdida/scene switch diferenciados | DOCUMENTADO |
| DOC-09 | Salida `keep` viva, `base` explícita, fuente anterior, jugador y snapshot no confundidos | DOCUMENTADO |
| DOC-10 | Identificación de nuevas interfaces y separación recursos vigentes/nuevos | **REQUISITO BLOQUEANTE PARA GATE TÉCNICO** |
| DOC-11 | QA independiente Editor/Player exportado no confundido con compilación | DOCUMENTADO, NO VERIFICADO EN JUEGO |
| DOC-12 | Seis hojas del ledger conservadas y actualizadas con hechos, no expectativas | A VERIFICAR EN EL PAQUETE |

## 3. Condiciones de bloqueo

- **BLOQUEAR implementación G006** hasta ratificación explícita de este Amendment.
- Si el Gate técnico propone política por recurso nuevo sin declarar cómo se diferencia de datos actuales, **BLOQUEAR la rama**; no asignar campos ocultos ni modificar `project.timelines` por omisión.
- Si un contrato S05/S10 ratificado contradice una regla nueva, no adaptarlo silenciosamente: tramitar CA adicional.
- Sin cambios a `src/`, `scripts/`, `electron/`, `package.json`, `vendor/`, SceneGraph, `.nfm`, Player o proyectos.
- No hay tests de integración ni build para este Gate **documental**: no declarar IMPLEMENTADO FUNCIONAL, PASS DE RUNTIME, QA LOCAL PASS ni CERRADO de G006 técnico.

## 4. Aprobación y evidencia a devolver

Usuario revisa el Amendment y confirma qué cláusulas ratifica o qué correcciones solicita. Guardar esa ratificación como evidencia en el **siguiente Gate autorizado** para que el ledger refleje la realidad. Hasta entonces el CA es **RECOMENDADO** y G006 técnico **NO AUTORIZADO**.

## 5. Entrega

Exactamente dos ZIP: `CHANGE` (solo Amendment, QA, inventario y ledger) y `SOURCE_BASELINE` (todos los archivos vigentes). El usuario **solo extrae CHANGE** en la raíz del proyecto, después de comparar cambios locales. SOURCE_BASELINE es continuidad acumulativa, no instalación por sustitución. No borrar `node_modules`, proyectos ni assets. No se necesitan comandos de Node ni `npm run electron` para este Gate documental.

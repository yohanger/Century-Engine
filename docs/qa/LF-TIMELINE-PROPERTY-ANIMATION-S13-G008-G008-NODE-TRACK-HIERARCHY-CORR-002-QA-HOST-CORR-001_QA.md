# QA — LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-NODE-TRACK-HIERARCHY-CORR-002-QA-HOST-CORR-001

**Tipo:** corrección acotada del fixture existente de S11-G002.  
**Estado al empaquetar:** prueba Camera S11-G002 NO VERIFICADA aquí por falta de `vue`/`three`; NODE regresión 157 PASS; Electron 24 checks PASS en evidencia previa del usuario (pre-corrección). QA LOCAL PENDIENTE.

## Aplicación segura

Raíz de LevelForge actualizada a CORR-002 (directorio con `package.json`). Antes de extraer, comparar el CHANGE con tus cambios locales y respaldar cualquier modificación en `scripts/test-timeline-camera-node-binding-s11-g002.mjs` o el ledger. **No sobrescribir** cambios locales no comparados. Mantener SOURCE_BASELINE CORR-002 como respaldo anterior, y conservar el nuevo como baseline acumulativo. No tocar `src/`, escenas, Assets, `.ui`, scripts propios ni `node_modules`.

## Prueba principal — después de aplicar CHANGE

```bash
node --test scripts/test-timeline-camera-node-binding-s11-g002.mjs
```

**Esperado, aún no comprobado:** 8 PASS, 0 FAIL; especialmente el escenario `host de PlayMode/Player usa ID y transformación animada sin convertir ausencias en poses libres`. Verificar que seek y stop funcionan sin simular métodos de audio vacíos. El smoke aislado de `audioSeek/audioLoop/audioStop` con métodos del archivo original pasó en este entorno, pero **no sustituye esta prueba completa**.

## Regresión de CORR-002 y de G006/G007/G008/CORR-001

```bash
node --test scripts/test-timeline-property-animation-s13-g008-g006.mjs scripts/test-timeline-property-animation-s13-g008-g007.mjs scripts/test-timeline-temporal-geometry-s13-g008-g002.mjs scripts/test-timeline-property-animation-s13-g008-g008.mjs scripts/test-timeline-property-animation-s13-g008-g008-universal-corr001.mjs scripts/test-timeline-property-animation-s13-g008-g008-node-hierarchy-corr002.mjs scripts/test-timeline-hierarchy-dnd-s04-g001.mjs
```

**Ejecutado en este entorno:** 157 PASS, 0 FAIL.

## Electron, build y QA visual

```bash
node --test scripts/test-timeline-property-animation-s13-g008-g008-node-hierarchy-corr002-electron.mjs
npm run build
npm run electron
```

**Esperado:** Electron 24 comprobaciones PASS; `npm run build` compila Editor y Player; comprobar visualmente Camera3D con un solo encabezado, toma de cámara y pistas hijas, selección al primer clic, multi-cámara, colapso, Undo/Redo y alineación. Electron 24 PASS fue reportado para CORR-002 antes de aplicar esta corrección; no presume nueva ejecución.

## Aceptación específica

| ID | Verificación | Estado al entregar |
|---|---|---|
| HQA-01 | El fixture reproduce `timelineMethods` en prototipo del host, igual que PlayMode | IMPLEMENTADO EN TEST ORIGINAL; SINTAXIS PASS |
| HQA-02 | No sustituir `_tlAutomationStop` ni `_tlAutomationSync` por stubs | IMPLEMENTADO; sin stubs |
| HQA-03 | `seek()` en host Camera3D y `stop()` | PENDIENTE QA LOCAL (8/8 esperado) |
| HQA-04 | G006/G007/G008/UA/CORR-002/DnD | NODE 157/157 PASS |
| HQA-05 | Electron, jerarquía + cámara, 24 checks | PASS ANTERIOR EN EQUIPO USUARIO; REVALIDACIÓN PENDIENTE |
| HQA-06 | Editor y Player | COMPILACIÓN NO VERIFICADA AQUÍ |
| HQA-07 | Estado del ledger refleja hechos sin cerrar CORR-002 ni G007 | ACTUALIZADO, CIERRE PENDIENTE |

## Evidencias a devolver

Enviar salida íntegra de S11-G002, resumen de 157 pruebas, Electron y build; indicar si se observaron regresiones visuales de Timeline. No declarar PASS o FIXED del test S11 hasta confirmación local. No hacer `npm audit fix --force` como parte de este QA.

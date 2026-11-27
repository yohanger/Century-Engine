# QA · S11-G004 Audio Mixer Routing CORR-001

**Gate:** `LF-TIMELINE-AUDIO-MIXER-ROUTING-S11-G004-INTEGRAL_CORR-001`.
**Autorización literal:** recibida el 2026-11-07. **Base de trabajo:** SOURCE_BASELINE G004 original (NO APROBADO); preservado G003 CORR-002 APROBADO.

## Incidencia demostrada

El usuario reportó 22/22 PASS Node y 1 FAIL en Electron. Dentro de la fixture Electron, las 32 verificaciones de ruteo/Inspector/WebAudio/Preview/Player eran `pass:true` y WebGL `gl:true`, pero el resultado final era `false !== true`. El runner oficial esperaba **dos** valores verdaderos: `result.pass==='true'` (DOM) y `parsed.pass===true` (JSON). La fixture escribía `report.dataset.pass='true'` pero devolvía `{ok:true,...}`; el campo requerido `pass` no existía. La rama de error tenía el mismo defecto simétrico. Esta es la causa raíz demostrada del FAIL del contrato, **no prueba de fallo funcional de audio**.

El usuario interrumpió `npm run build` y `npm run electron`; no se puede atribuir fallo a Vite ni marcar compilación PASS desde esas ejecuciones.

## Intervención mínima

- `scripts/fixtures/editor/timeline-audio-mixer-routing-s11-g004.html`: tanto JSON de éxito como de error emplean `pass` en lugar de `ok`, de acuerdo con el runner compartido. Se preservan `checks`, `gl`, `error`, DOM y los 32 checks; no se cambia el runner.
- `scripts/test-timeline-audio-mixer-routing-s11-g004-corr001.mjs`: 3 pruebas Node contractuales para impedir regresión entre `dataset.pass` y `parsed.pass`.
- QA, evidencia y ledger: actualización documental; sin cambios en producción, exportación ni datos de usuario.

## Verificaciones efectuadas en el entorno de generación CORR-001

| Prueba | Resultado | Evidencia |
| --- | --- | --- |
| G004 Node 22 + CORR-001 Node 3 | **25 PASS / 0 FAIL / 0 SKIP** | `docs/qa/evidence/LF_S11_G004_CORR001_NODE.log` (incluye ambas suites en regresión) |
| Regresión focal G004/G001/AudioS02/SAFE + CORR-001 | **80 PASS, 0 FAIL, 6 SKIP** de 86 | `docs/qa/evidence/LF_S11_G004_CORR001_NODE.log` |
| Electron embebido real | **NO VERIFICADO tras la corrección**, ejecución impedida por falta de Vite local; comando acaba con error de infraestructura, no de audio | `docs/qa/evidence/LF_S11_G004_CORR001_ELECTRON_ENV_BLOCKED.log` |
| Compilación Editor/Player | **NO VERIFICADA**: falta Vite local (`vite: not found`) | `docs/qa/evidence/LF_S11_G004_CORR001_BUILD_ENV_BLOCKED.log` |
| QA local visual/auditivo de usuario tras corrección | **PENDIENTE** | Ninguna evidencia recibida todavía |

Los 6 SKIP pertenecen a dependencias del entorno de generación; no son FAIL. Se conservan por separado los seis fallos preexistentes de la **suite histórica diferente** de G003 CORR-002 (504/510), sin reetiquetarlos como PASS. La evidencia del error Electron original está en `docs/qa/evidence/LF_S11_G004_LOCAL_ELECTRON_FAIL_REPORTED.md`.

## QA que debe ejecutar el usuario desde su proyecto existente

Trabajar en la carpeta **real** con `package.json` y la aplicación vigente. Comparar y respaldar modificaciones locales antes de extraer el CHANGE CORR-001. No eliminar escenas, Assets, datos ni código local. Una vez aplicada la corrección:

```bash
node --test scripts/test-timeline-audio-mixer-routing-s11-g004-corr001.mjs scripts/test-timeline-audio-mixer-routing-s11-g004.mjs
node --test scripts/test-timeline-audio-mixer-routing-s11-g004-electron.mjs
npm run build
npm run electron
```

- Esperado Node: **25/25 PASS** (3 del contrato CORR-001 + 22 de G004).
- Esperado Electron: **1 test PASS**, mensaje de `Electron WebGL` con **32 comprobaciones** internas. Si falla, devolver el JSON y salida íntegra de la terminal, no declarar arreglado.
- Esperado build: ambos builds Vite para **Editor y Player** completados sin `Ctrl+C`. Compilación no sustituye QA visual ni auditivo.
- Después, verificar el ruteo en el Mixer, Preview y flujo real del Player con buses personalizados, mute/solo/FX y Stop. G004 permanece abierto hasta QA local y aprobación explícita.

No repetir G003 CORR-002 aprobado salvo nueva incidencia concreta. No se han autorizado FX por clip, automatización, envolventes ni refactors del motor.

## Estado

**CORR-001 AUTORIZADO, IMPLEMENTADO EN FIXTURE; NODE PASS; ELECTRON NO VERIFICADO tras corrección; COMPILACIÓN NO VERIFICADA; QA LOCAL PENDIENTE; NO APROBADO / NO CERRADO.**

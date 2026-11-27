# Evidencia · TriangHor npm lockfile y clean install

**Gate:** `CENTURY-TRIANGHOR-INTEGRATION-S01-G001-CORR-001-NPM-LOCKFILE-AND-CLEAN-INSTALL`

## Reproducción comparativa (Node 22.16.0, npm 10.9.2)

| Verificación | SOURCE_BASELINE anterior | Corrección |
| --- | --- | --- |
| `npm ci --dry-run --offline --ignore-scripts --no-audit --no-fund` | FAIL: `Missing: trianghor@0.0.1 from lock file` | PASS; reconoce 587 paquetes y TriangHor |
| Entrada `node_modules/trianghor` | `resolved: file:vendor/trianghor`, sin enlace | `resolved: vendor/trianghor`, `link: true` |
| Entrada `vendor/trianghor` | Ausente | `version: 0.0.1` |
| Otras entradas del lockfile | 587 | 587 idénticas |
| `npm ci` real en fixture local sin red | No ejecutado | PASS; enlace simbólico instalado |
| Suite de lockfile y contrato Century | No ejecutada | 16/16 PASS |
| Suite integral de integración Century | 59/59 PASS en el Gate original | 59/59 PASS |
| Smoke Century | 29/30 PASS | 29/30 PASS; mismo fallo histórico `TOOL-08` |
| `npm ci` completo sin conexión, sin caché | Bloqueado por metadatos incorrectos | BLOQUEADO `ENOTCACHED` al pedir `zip-stream` al registro |
| Build, QA Electron y Player | NO VERIFICADO | NO VERIFICADO |

No se ha modificado el algoritmo de TriangHor. Las verificaciones de Node usaron un enlace temporal `node_modules/trianghor` hacia el módulo incluido en el SOURCE_BASELINE, no empaquetado en los ZIP. La instalación completa necesitará una ejecución posterior de `npm ci` con disponibilidad de las dependencias del registro npm.

## Logs

- `baseline-npm-ci.log`: falla original reproducida.
- `work-npm-lock.log`: regeneración sin red.
- `work-npm-ci-dry.log`: validación de consistencia correcta.
- `work-npm-ci-full-offline.log`: impedimento ambiental `ENOTCACHED`.
- `qa-lock.txt`: contrato y fixture npm real.
- `qa-integration.txt`: regresión de Century.
- `qa-smoke.txt` y `baseline-smoke.txt`: comparación smoke.

**Estado:** IMPLEMENTADO · QA NODE PASS · LOCKFILE VALIDADO · `npm ci` COMPLETO NO VERIFICADO · QA ELECTRON/PLAYER NO VERIFICADO · PENDIENTE DE APROBACIÓN · NO CERRADO.

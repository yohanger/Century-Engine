# LF-NODE-SCRIPT-METHOD-CALL-S02-G001_QA-CORR-001 — Resultados de QA

**Estado:** IMPLEMENTADO · TEST AUTOMATIZADO NODE PASS · QA USUARIO PENDIENTE · NO CERRADO.

**SOURCE_BASELINE:** `LevelForge_NODE_SCRIPT_METHOD_CALL_S02_G001_SOURCE_BASELINE.zip`.

## Evidencia reproducible

| Comprobación | Evidencia observada | Estado |
|---|---|---|
| Reproducción antes de corregir NS-13 | 23 PASS / 1 FAIL, `node --test scripts/test-node-script-s05-g001.mjs`, exit 1 | FAIL previo confirmado |
| NS-13 corregido y NS-25 nuevo | 25 PASS / 0 FAIL, `node --test scripts/test-node-script-s05-g001.mjs`, exit 0 | NODE PASS |
| Regresión focal conjunta S05 + S02 + S01 + Lifecycle + S05-CORR + Groups + Scene Fade | 139 PASS / 0 FAIL / 0 SKIP, exit 0 | NODE PASS |
| Archivos de producción | Ninguno modificado | SIN CAMBIOS |
| Electron, build, QA local Editor/Player | No ejecutados ni aportados en este Gate documental/de pruebas | NO VERIFICADOS |

Comando focal completo ejecutado desde la raíz del SOURCE_BASELINE corregido:

```bash
node --test scripts/test-node-script-s05-g001.mjs \
  scripts/test-node-script-method-call-s02-g001.mjs \
  scripts/test-node-reference-resolution-s01-g001.mjs \
  scripts/test-node-script-lifecycle-dispatch-corr-g001.mjs \
  scripts/test-node-script-s05-corr001.mjs \
  scripts/test-groups-api-s03-g001.mjs \
  scripts/test-scene-fade-transitions-s01-g001.mjs
```

## Casos relevantes

- **QA-CORR-01/02:** NS-13 elimina `a`, conserva referencia original `b` y solo registra `a:exit`.
- **QA-CORR-03:** NS-13 comprueba que el objeto de instancia de `b` es el mismo y su `_process` continúa con contador 1 (sin reiniciar).
- **QA-CORR-04:** NS-25 reemplaza deliberadamente `b` y observa salida/entrada/ready, nueva instancia y contador reiniciado.
- **QA-CORR-05:** test S02 existente conserva verificación de invalidez y protección frente a reutilización de ID; PASS dentro de la batería conjunta.
- **QA-CORR-06/07/08:** S05, S01, S02 y Lifecycle junto a otras regresiones: 139/139 PASS.

## Límites y evidencia pendiente

Las pruebas Node no ejecutan render WebGL ni comprueban el Player exportado. No se afirma compilación PASS, QA Electron PASS ni QA LOCAL PASS. S02 aprobado por usuario permanece NO CERRADO por estas verificaciones. S03 ya autorizado sigue BLOQUEADO para ejecución hasta cumplir sus prerrequisitos previamente declarados.

El usuario debe ejecutar la QA local Editor/Player prevista en `docs/qa/LF-NODE-SCRIPT-METHOD-CALL-S02-G001_QA.md`, guardar salida Electron, compilación, pruebas de Play/Stop, escenas y Prefabs. Solo entonces corresponde examinar el desbloqueo de S03.

## Actualización de la aprobación local (2026-11-01)

El usuario ha aclarado expresamente que sus respuestas «Aprobado» se emiten **después de ejecutar QA local exhaustivo**, incluidos intentos de provocar fallos. La aprobación previamente comunicada para este Gate se registra por ello como **QA LOCAL PASS DECLARADO POR USUARIO · APROBADO**. No se recibieron logs adicionales de compilación o de Electron en esta conversación; esos resultados permanecen **NO VERIFICADOS AQUÍ**. Esta actualización no elimina la evidencia ni los errores documentados anteriormente y no equivale automáticamente a declarar el Gate CERRADO. La dependencia funcional de S03 queda desbloqueada por esta confirmación.

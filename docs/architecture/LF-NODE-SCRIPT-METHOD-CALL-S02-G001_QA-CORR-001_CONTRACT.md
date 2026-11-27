# LF-NODE-SCRIPT-METHOD-CALL-S02-G001_QA-CORR-001 — Contrato de corrección de QA

**Gate parent:** `LF-NODE-SCRIPT-METHOD-CALL-S02-G001`.

**Autorización literal:** `Listo. LF-NODE-SCRIPT-METHOD-CALL-S02-G001_QA-CORR-001 autoriza comenzar`.

**SOURCE_BASELINE vinculante:** `LevelForge_NODE_SCRIPT_METHOD_CALL_S02_G001_SOURCE_BASELINE.zip` (1.491 entradas). No se incorpora ninguna rama local alternativa.

**Estado:** IMPLEMENTADO (solo fixture/documentación/ledger); TEST NODE PASS; REVISIÓN DEL USUARIO PENDIENTE; NO CERRADO. El Gate parent sigue APROBADO POR USUARIO, sin QA local Editor/Player ni compilación verificada.

## Objetivo y causa raíz

`NS-13` en `scripts/test-node-script-s05-g001.mjs` comprobaba que eliminar el nodo `a` ejecutase únicamente su salida y no reinicializase `b`. Sin embargo, actualizaba `project.objects` a `[node('b')]`, fabricando un nuevo registro JS de `b` con el mismo ID. Desde S02, `NodeLifecycle.sync()` protege la identidad del registro original: sustituirlo intencionadamente desmonta y recrea su instancia de script. Por eso S02 producía 23/24 PASS en la batería histórica, aunque sus pruebas de identidad pasaban.

La **causa raíz observada es el dato de entrada de la fixture**, no una falla demostrada de `NodeLifecycle`. No se modifica producción ni se debilita la regla de identidad.

## Mecanismo aprobado y aplicado

- `NS-13` conserva el mismo objeto JS de `b` en `project.objects` al eliminar `a`, y verifica que la instancia sobreviva, el registro de scripts siga en tamaño uno y la cuenta de `_process` continúe sin reinicio.
- `NS-25` comprueba de forma explícita la otra operación: sustituir el registro de `b` por un objeto nuevo con el mismo ID provoca exactamente `b:exit`, `b:enter`, `b:ready`, instancia de script nueva y reinicio legítimo del contador de `_process`.
- No se crean runners, intérpretes, controladores ni servicios nuevos.

## Alcance máximo y exclusiones

Archivos intervenidos: `scripts/test-node-script-s05-g001.mjs`, este contrato, `docs/qa/LF-NODE-SCRIPT-METHOD-CALL-S02-G001_QA-CORR-001_QA.md`, actualización del historial QA del parent y `docs/qa/LevelForge_DB_Ledger.xlsx`.

Prohibido modificar `src/`, la API pública, `NodeLifecycle`, `NodeScriptRuntime`, Scenes, Jolt, Editor, Player, Groups, contratos parent o cualquier prueba ajena a NS-13/NS-25. La evidencia de QA automatizada NO reemplaza Electron/compilación/QA local pendientes.

## Prerrequisitos y dependencias

- S01 referencias: implementado y aprobado por el usuario, QA local no verificado.
- S02 métodos: implementado y aprobado por el usuario, QA local y compilación no verificadas.
- S03 `LF-NODE-GROUP-CALL-S03-G001`: autorización literal recibida previamente, **ejecución BLOQUEADA** por prerrequisitos de QA del Gate parent S02, aunque se elimine la discrepancia NS-13.
- Sin contradicción contractual nueva: la corrección no altera la política de identidad de S01/S02.

## Criterios de aceptación

1. NS-13 no reconstruye `b` durante la eliminación de `a`; su instancia no cambia y su callback periódico mantiene continuidad.
2. NS-25 exige que una sustitución deliberada de registro conserve ID pero no identidad lógica ni instancia de script.
3. Batería histórica S05 y regresiones focales S01/S02/Lifecycle/Groups/Scene Fade: todas PASS sin desactivar casos.
4. Cambios exclusivamente en el alcance declarado, ledger actualizado en sus seis hojas; dos ZIP (CHANGE + SOURCE_BASELINE) íntegros.
5. Cierre del correctivo solo tras aprobación del usuario de esta evidencia; **no** cierra S02 ni autoriza saltar el QA local requerido para S03.

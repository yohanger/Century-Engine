# LF-EDITOR-SAFETY-S01-G002 — QA y trazabilidad

**Fecha:** 2026-10-29. **Estado:** IMPLEMENTADO; NO VERIFICADO en Electron real; NO CERRADO.

## Verificaciones ejecutadas

- `node --check` en los nuevos módulos y módulos JS editados.
- `node --test scripts/test-editor-safety-s01-g002.mjs`: 17 pruebas de integridad, sesión, diff, aislamiento, transacción simulada y consumo de copia (PASS si lo indica el log de esta entrega).
- Regresión: `node --test scripts/test-editor-safety-s01-g001.mjs scripts/test-vfx-editor-s03-g001.mjs scripts/test-vfx-simulation-s02-g001.mjs scripts/test-project-safe.mjs scripts/test-resource-history-corr-g001.mjs`. El harness de G001 se actualizó para admitir la tabla v5 y el consumo de snapshot sin cambiar el código productivo de cierre.
- Se excluyen de PASS pruebas no ejecutadas: Vite Editor/Player, renderer real Electron, efectos VFX de GPU y sistema operativo tras terminación abrupta.

## QA local obligatorio

1. Instalar CHANGE después de comprobar diferencias locales, hacer copia de seguridad del ledger y usar un proyecto **de prueba**.
2. `npm run build` y `npm run electron`; anotar toda la salida. Comprobar que los diálogos de G001 aún bloquean un cierre cancelado.
3. Crear y guardar un proyecto de prueba; editar dos escenas y un asset, esperar 3 segundos, y **sin guardar** terminar el proceso desde un mecanismo de prueba controlado. No usar proyectos de trabajo real.
4. Abrir LevelForge. Debe mostrar el aviso antes de entrar al proyecto. Comprobar nombre, fecha y cantidades; elegir Restaurar y comprobar las escenas y el asset. `project.lfproj` debe conservar el último estado confirmado hasta Guardar.
5. Guardar el trabajo recuperado, cerrar normalmente, reabrir y confirmar que ya no se ofrece esa misma copia.
6. Repetir el fallo, elegir Descartar: deben quedar los datos del checkpoint confirmado y no reaparecer la copia consumida.
7. Repetir, elegir Posponer: no se debe entrar a un proyecto sin resolver, pero puede cerrarse desde la bienvenida y volver a ofrecerse en el siguiente arranque.
8. Ensayar un archivo de copia corrupto desde un perfil **aislado de pruebas**, no desde tu perfil real; no debe restaurarse ni destruir la versión confirmada.
9. Ensayar cuota de almacenamiento / excepción simulada; un snapshot anterior válido debe permanecer disponible.
10. Revisar varias copias de proyectos distintos, falta de permisos de carpeta, rutas con scripts VS Code, exportación Player y regresión VFX/PSX.

**Evidencia solicitada:** log Node, log build, captura del aviso, resultado de restaurar/descartar/posponer, estado del archivo `.lfproj` y cualquier error de consola. La compilación no sustituye QA visual ni la prueba destructiva controlada.

# LF-EDITOR-SAFETY-S01-G001 — QA y evidencia

Fecha: 2026-10-29. Estado: IMPLEMENTADO; QA LOCAL NO VERIFICADO; APROBACIÓN NO REGISTRADA; CERRADO: NO.

## Evidencia obtenida en el entorno de desarrollo

- `node --check` en Electron main/preload y módulos JS editados: sintaxis válida.
- `scripts/test-editor-safety-s01-g001.mjs`: 13/13 PASS con funciones reales aisladas y dobles de IPC/IndexedDB.
- Regresión combinada (13 nuevas + 8 VFX editor + 13 VFX simulation + 12 project-safe + 15 history): 61/61 PASS, 0 FAIL.
- ZIP CHANGE y SOURCE_BASELINE: validar CRC y equivalencia por comparación de hashes al generar.
- **NO VERIFICADO:** build Vue/Vite, render real de Electron, QA visual del diálogo y comportamiento con archivos reales; los tests del proceso principal usan EventEmitter, no un Electron activo.

## Pruebas locales obligatorias

1. Abrir un proyecto existente y modificar un componente; esperar más de 5 segundos: debe aparecer Sin guardar y el archivo confirmado `project.lfproj` no debe cambiar solo por autosave.
2. Cerrar con X: mostrar Guardar y salir / Salir sin guardar / Cancelar. Cancelar y Escape deben mantener ventana y datos.
3. Volver a cerrar y elegir Guardar y salir: escritura confirmada, cierre, reapertura y modificación conservada.
4. Abrir y modificar una escena y un recurso VFX, sin guardar; elegir Salir sin guardar: al reabrir desde la carpeta confirmada, deben verse los valores anteriores en escenas y assets.
5. Repetir descartando escenas creadas/eliminadas y recursos importados; no dejar registros de trabajo nuevos.
6. Simular fallo de escritura (ubicación sin permisos o disco lleno), elegir Guardar y salir: la ventana debe permanecer abierta con error; no declarar guardado.
7. Intentar cerrar mientras el guardado está pendiente: el cierre se mantiene bloqueado, sin timeout que destruya la ventana.
8. Revisar el funcionamiento previo de VS Code: ediciones de scripts desde el editor y desde VS Code. Confirmar que descartar no reintroduce una versión que no se confirmó; reportar cualquier problema como bloqueo.
9. Abrir un proyecto heredado, comprobar que sus escenas, materiales, VFX, eventos y Player se mantienen; comprobar guardado posterior.
10. Confirmar comportamiento de `Ctrl+S` y cambio de proyecto. Estos últimos flujos no equivalen a QA de cierre y pueden requerir un Gate de corrección si aparecen regresiones.

## Comandos

```bash
node --test scripts/test-editor-safety-s01-g001.mjs scripts/test-vfx-editor-s03-g001.mjs scripts/test-vfx-simulation-s02-g001.mjs scripts/test-project-safe.mjs scripts/test-resource-history-corr-g001.mjs
npm run build
npm run electron
```

No se declaran PASS, COMPILADO o CERRADO para pruebas que no se han ejecutado. Las 15 vulnerabilidades de npm informadas previamente siguen fuera de este Gate.

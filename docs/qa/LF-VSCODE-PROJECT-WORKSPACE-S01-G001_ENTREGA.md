# Workspace de VS Code · S01 G001

**Estado:** IMPLEMENTADO · 240/240 Node PASS (7 controles focales) · COMPILADO Editor (827 módulos) y Player (414 módulos) · QA LOCAL PENDIENTE.

## Auditoría y decisiones

- **Observado en el baseline:** el menú «Abrir proyecto» enviaba el script activo. Electron ya añadía la raíz, y declaraba éxito al recibir `spawn` sin esperar el resultado del CLI. La reconciliación absorbía el error antes de llegar a la apertura.
- **Causa confirmada en código:** la ruta de menú mezclaba carpeta y archivo. El reporte de éxito prematuro y la pérdida del error de sincronización son defectos independientes. La causa de la apertura de archivo aislado en el equipo del usuario queda sin reproducir.
- **Implementación:** la raíz y el script opcional llegan al CLI como argumentos absolutos. En Windows se usa el ejecutable y el CLI de la instalación, con descubrimiento desde PATH y ubicaciones habituales. En Linux se prueban `code`, `code-insiders` y `codium`. El error se devuelve al Editor si el CLI termina sin éxito.
- **Sincronización:** reutiliza el manifiesto y el plan existentes, invalida pasadas antiguas al cambiar de proyecto, refresca los tipos antes del lanzamiento e importa cambios externos antes de capturar la revisión del guardado explícito.
- **Extensión:** 0.1.1 selecciona el proyecto según el recurso o editor activo. Mantiene la configuración personalizada y prefiere la API generada.
- Referencia del CLI al final de este documento.

## Inventario

**Modificados (8)**

- `docs/qa/LevelForge_DB_Ledger.xlsx`
- `electron/main.cjs`
- `src/components/ScriptEditor.vue`
- `src/core/commands.js`
- `src/core/state/project.js`
- `src/core/state/vscode.js`
- `src/core/vscode/sync.js`
- `vscode-extension/extension.js`

**Modificados en la extensión (2)**

- `vscode-extension/README.md`
- `vscode-extension/package.json`

**Nuevos (7)**

- `electron/vscode.cjs`
- `scripts/test-vscode-project-workspace-s01-g001.mjs`
- `docs/qa/LF-VSCODE-PROJECT-WORKSPACE-S01-G001_QA.md`
- `docs/qa/LF-VSCODE-PROJECT-WORKSPACE-S01-G001_ENTREGA.md`
- `docs/qa/evidence/LF-VSCODE-PROJECT-WORKSPACE-S01-G001/node-240-pass.log`
- `docs/qa/evidence/LF-VSCODE-PROJECT-WORKSPACE-S01-G001/build-editor-player.log`
- `docs/qa/evidence/LF-VSCODE-PROJECT-WORKSPACE-S01-G001/electron-regression-no-verificado.log`

**Eliminados:** 0. **Cambios inesperados:** 0.

## QA y entregables

El chequeo Electron de regresión no produjo un resultado de fixture en este entorno. VS Code real, Windows y el ciclo visual de reapertura y Play están **NO VERIFICADOS**. La suite Node incluye integración del estado real con Vite y archivos de prueba, con puente Electron simulado. El resultado histórico de S06 CORR-004 permanece abierto.

Extrae el SOURCE_BASELINE en una carpeta nueva. CHANGE se aplica únicamente a una extracción limpia de `lf(7).zip` después de comparar los cambios locales. Conserva el ZIP de entrada y tus proyectos. La matriz de QA indica los pasos de instalación y las evidencias a devolver.

[Documentación del CLI de Visual Studio Code](https://code.visualstudio.com/docs/configure/command-line)

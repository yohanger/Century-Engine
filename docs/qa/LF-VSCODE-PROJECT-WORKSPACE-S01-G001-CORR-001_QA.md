# LF-VSCODE-PROJECT-WORKSPACE-S01-G001-CORR-001

## Diagnóstico y alcance

La captura de QA de G001 muestra que LevelForge devuelve un error al intentar iniciar el VS Code instalado desde Flathub. El lanzador de Linux solo consultaba `code`, `code-insiders` y `codium` como ejecutables del sistema. El paquete de Flathub declara `code` como comando dentro de su entorno y expone la aplicación con ID `com.visualstudio.code`. [Manifiesto de Flathub](https://github.com/flathub/com.visualstudio.code/blob/master/com.visualstudio.code.yaml)

Se amplió el lanzador de G001 para intentar `flatpak run com.visualstudio.code` en Linux después de los comandos ya disponibles. Flatpak resuelve la instalación del usuario o del sistema y entrega los argumentos al CLI empaquetado. LevelForge conserva las rutas absolutas de la carpeta y del archivo en argumentos separados. La detección no requiere crear un alias, modificar el PATH ni cambiar los permisos de Flatpak. [Referencia de Flatpak](https://docs.flatpak.org/en/latest/flatpak-command-reference.html)

La corrección parte de `LevelForge_VSCODE_PROJECT_WORKSPACE_S01_G001_SOURCE_BASELINE.zip`. G001 conserva el estado de QA local pendiente. El alcance cubre las dos acciones de apertura ya existentes y la ayuda para Flathub. Se mantiene la precedencia de los comandos nativos y el flujo de Windows.

## QA local con Electron y VS Code de Flathub

Desde la raíz de la extracción de CORR-001, ejecuta:

```bash
flatpak run com.visualstudio.code --version
npm ci
node --test scripts/test-vscode-project-workspace-s01-g001.mjs
npm run build
npm run electron
```

La suite debe devolver 9 PASS. Ambos builds deben completarse. Usa una copia del proyecto en una carpeta con espacios y deja cerrado VS Code para la primera comprobación.

| Comprobación | Resultado esperado |
| --- | --- |
| Juego → Abrir proyecto en VS Code, con un script seleccionado | Flathub abre la carpeta activa. En el Explorador aparecen `project.lfproj` y `Assets/`. |
| Botón VS Code del editor de scripts | Abre la misma carpeta y enfoca el `.js` seleccionado. |
| Segundo proyecto con un script del mismo nombre | Cada raíz y archivo activo corresponden al proyecto solicitado. |
| Guardar el script en VS Code, Ctrl+S en LevelForge, reabrir y Play | Se conserva la edición y el script se ejecuta en el proyecto correcto. |

Si ocurre un fallo, devuelve la salida de la comprobación de versión, la acción que falló y el mensaje mostrado. Si hay un VS Code nativo disponible en el mismo PATH, el lanzador lo intenta primero. Realiza la comprobación de Flathub en un entorno donde los comandos nativos no estén disponibles.

## Resultados de esta entrega

- Node focal 9/9 y regresión 242/242 PASS.
- Compilados Editor (827 módulos) y Player (414 módulos).
- Electron embebido de regresión no llegó al fixture por falta de display. Apertura con Flathub real NO VERIFICADA.
- QA local pendiente. Las pruebas automatizadas sustituyen el proceso externo para validar los argumentos y el orden de lanzamiento.

## Entrega

**Modificados (4)**

- `electron/vscode.cjs`
- `scripts/test-vscode-project-workspace-s01-g001.mjs`
- `vscode-extension/README.md`
- `docs/qa/LevelForge_DB_Ledger.xlsx`

**Nuevos (4)**

- Este documento.
- `docs/qa/evidence/LF-VSCODE-PROJECT-WORKSPACE-S01-G001-CORR-001/node-242-pass.log`
- `docs/qa/evidence/LF-VSCODE-PROJECT-WORKSPACE-S01-G001-CORR-001/build-editor-player.log`
- `docs/qa/evidence/LF-VSCODE-PROJECT-WORKSPACE-S01-G001-CORR-001/electron-no-verificado.log`

**Eliminados:** 0. **Inesperados:** 0. Usa SOURCE_BASELINE en una carpeta nueva o aplica CHANGE sobre una copia limpia del SOURCE_BASELINE de G001. Conserva el baseline previo y los proyectos locales.

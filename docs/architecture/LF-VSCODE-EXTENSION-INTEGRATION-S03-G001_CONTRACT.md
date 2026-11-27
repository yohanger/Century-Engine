# LF-VSCODE-EXTENSION-INTEGRATION-S03-G001

Autorización: «Listo. LF-VSCODE-EXTENSION-INTEGRATION-S03-G001 autoriza comenzar» (2026-11-04).
Base: SOURCE_BASELINE CINEMATICS PLAYER INTEGRATION S05 G004, 2.007 archivos, aprobado por QA local declarado. Los contratos anteriores de workspace, sincronización y editor externo siguen vigentes.

## Auditoría y contrato ejecutable

OBSERVADO: electron/vscode.cjs únicamente lanzaba el editor; main.cjs valida raíz y script; state/vscode.js sincroniza antes de abrir. La extensión levelforge.levelforge 0.1.2 existe y los tipos y snippets ya cubren Signals. La distribución no incluía VSIX y el README exigía copias manuales.
CAUSA RAÍZ: falta el paso de gestión de la extensión entre preparación del proyecto y lanzamiento del CLI.
INFERENCIA a verificar localmente: una instalación CLI verificada debe activar la extensión en la ventana del proyecto; ventanas previamente abiertas, perfiles personalizados y extensiones deshabilitadas requieren QA real y no se presumen activados por listar la extensión.

Objetivo: abrir proyecto/script desde LevelForge con la extensión instalada o actualizada, sin terminal ni manipulación de VSIX por el usuario.
Mecanismo: extender el lanzador y puente existentes; seleccionar un CLI disponible, consultar versiones, instalar el VSIX incluido cuando falta o es anterior, consultar de nuevo y abrir con ese mismo CLI. Fallar en instalación no autoriza cambiar silenciosamente a otro VS Code.

| Caso | Obligación |
| --- | --- |
| Ausente / anterior | Instalar / actualizar y verificar antes de abrir |
| Igual / superior | No reinstalar / no degradar |
| Varias instalaciones | Prioridad existente: code, code-insiders, codium, Flathub; Windows resuelve ejecutable y cli.js juntos |
| Fallo | Mostrar fase y causa; Reintentar/Cancelar desde LevelForge; no marcar éxito |
| Flatpak | Copiar VSIX fuera de ASAR/AppImage a caché propia de com.visualstudio.code y comprobar lectura dentro del sandbox |
| Distribución | VSIX y metadatos incluidos como recursos; preparación reproducible con vsce oficial, sin publicar |
| Concurrencia | Compartir únicamente preparación en curso de una instalación; cada petición abre su propio destino |
| Seguridad del proyecto | Preservar jsconfig, scripts, identidad, sincronización y autorizaciones de carpetas existentes |

Prerrequisitos: Node/npm del proyecto, CLI de VS Code instalado, permisos locales. No instalar VS Code ni ampliar permisos persistentes de Flatpak. Perfil: predeterminado del CLI seleccionado, sin cambiar preferencias del usuario ni habilitar extensiones deshabilitadas deliberadamente.

Alcance: electron/vscode.cjs, puente main existente, mensajes de apertura, empaquetado del Editor/extensión, dependencias indispensables, scripts de preparación, fixtures/runners Node/Electron/VS Code real, documentación y seis hojas del ledger. Extensión 0.1.3 identifica esta revisión de distribución; API de gameplay sin cambios.
Fuera de alcance: UI nueva de selección de editores/perfiles, Marketplace, instalación de VS Code, Timeline dinámico, renombrado seguro, runtime/Player/Jolt.

Evidencia: pruebas de estados/versiones/errores/rutas y concurrencia; VSIX real; Electron embebido; activación con VS Code real cuando esté disponible; compilación Editor/Player; QA de Flathub y Windows separado. No confundir CLI simulado, extensión instalada y extensión activa. QA local y aprobación del Gate pendientes hasta declaración del usuario.
No se detectan contradicciones con contratos anteriores: sus exclusiones eran locales a esos Gates. Este contrato sustituye únicamente las instrucciones operativas de instalación manual del README.

Fuentes consultadas: https://code.visualstudio.com/docs/configure/command-line ; https://code.visualstudio.com/api/working-with-extensions/publishing-extension ; https://github.com/flathub/com.visualstudio.code/blob/master/com.visualstudio.code.yaml .

Entrega: exactamente CHANGE y SOURCE_BASELINE; sin node_modules, dist, cachés ni instaladores. El VSIX es un recurso indispensable de distribución y se incluye junto con su descriptor. Cierre G004 por declaración del usuario sin reinterpretar pruebas históricas no ejecutadas. Próxima acción tras entrega: QA local de S03-G001.

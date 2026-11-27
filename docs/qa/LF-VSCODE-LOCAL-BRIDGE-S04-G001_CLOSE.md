# S04: cierre aprobado

Fecha: 2026-11-04. Gate: `LF-VSCODE-LOCAL-BRIDGE-S04-G001`, incluidas CORR-001 y CORR-002. Estado: APROBADO, QA LOCAL PASS declarado por el usuario y CERRADO.

## Evidencia de aprobación

El usuario respondió «Aprobado.» después de la entrega CORR-002 y sus instrucciones de revalidación real y QA manual. Según la convención del proyecto, esa aprobación declara QA local completo. No se solicitan de nuevo logs, ni se inventan cifras, tiempos o nuevas ejecuciones locales. La observación anterior «Pues abre, y funciona» permanece como evidencia histórica separada; la aprobación actual es la que autoriza este cierre.

Se conservan las evidencias automatizadas anteriores: 62/62 Node, docs 12/12, reproducción que falla antes y pasa después, sintaxis CommonJS e inclusión del backend en el paquete Linux. Se conservan el PASS local recibido del fixture Electron y los fallos anteriores del runner real. No se transforma un fallo histórico en PASS ni se atribuye al asistente una ejecución real de VS Code/Flatpak que no realizó. Windows real no dispone de evidencia específica de ejecución en este entorno.

## Resultado aceptado

El puente local autenticado por raíz abre y confirma scripts mediante la extensión activa; las aperturas conectadas reutilizan el canal. CORR-002 permite enviar solicitudes y recibir ACK mientras el CLI sigue pendiente, conserva la cancelación del arranque aún no conectado y evita invalidar aperturas por errores tardíos del CLI. La extensión permanece en 0.1.4. Los avisos se retiran con confirmación, fallo, cancelación o cambio de proyecto.

No hay implementación ni revalidación adicional pendiente conocida dentro del alcance de S04 tras la aprobación. No se amplía este cierre a otros Sprints o a todas las plataformas. Se sincronizan ROADMAP, BACKLOG, DEPENDENCIES, GATES, EVIDENCE y TRACEABILITY, preservando el historial de incidencias y correcciones.

Este cierre solo modifica documentación y ledger. El código, los tests, el VSIX, las dependencias, el renderer y el runtime son idénticos a CORR-002 aprobado. No se repiten pruebas, instalación ni compilación al no haber cambios ejecutables.

## Entrega y conservación

Exactamente dos ZIP: `LevelForge_VSCODE_LOCAL_BRIDGE_S04_G001_CLOSE_CHANGE.zip` y `LevelForge_VSCODE_LOCAL_BRIDGE_S04_G001_CLOSE_SOURCE_BASELINE.zip`. Inventario en `LF-VSCODE-LOCAL-BRIDGE-S04-G001_CLOSE_FILES.md`. Sin SHA separado ni scripts .sh.

CHANGE contiene únicamente documentos y ledger de cierre; aplicarlo sobre una copia exacta de CORR-002, comparando cualquier modificación local antes de reemplazar esas rutas. No hay eliminaciones. No tocar código, proyectos, Assets, datos o perfiles de VS Code, node_modules ni builds. No hace falta ejecutar comandos para validar este cierre documental ni repetir el QA ya aprobado.

SOURCE_BASELINE es la base completa acumulada para el próximo Gate: extraer en una carpeta nueva `~/Desktop/LevelForge_VSCODE_LOCAL_BRIDGE_S04_G001_CLOSE_SOURCE_BASELINE`, con package.json en la raíz. No aplicar ambos ZIP uno sobre otro. Para ejecutar una extracción nueva se mantienen los comandos normales npm ci, npm run build y npm run electron; no son requisitos nuevos para aprobar este cierre.

Conservar el SOURCE_BASELINE de cierre como autoridad del siguiente Gate y los proyectos del usuario. Las bases anteriores y los diagnósticos temporales pueden conservarse como respaldo; no se elimina ningún dato automáticamente. El diagnóstico temporal concreto lf-vscode-real-O5zkEo ya puede retirarse si el usuario no lo necesita; nunca eliminar su carpeta general de caché o perfiles habituales.

La intención expresada de conectar la app móvil al editor de Nether FilmMaker mediante red local queda como trabajo futuro, sin implementación ni Gate nuevo autorizados en este cierre.

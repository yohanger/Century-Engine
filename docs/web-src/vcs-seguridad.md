# Seguridad, respaldos y límites de Git

El control de versiones no sustituye un sistema de copias de seguridad. Git registra versiones de los **archivos confirmados**; las modificaciones sin guardar, los recursos no registrados y los archivos excluidos no están protegidos por un commit.

## Protección de las operaciones

- **Commit:** guarda primero y registra solo los archivos seleccionados, no todos los elementos que alguna otra herramienta haya preparado.
- **Cambio de rama o restauración:** exige estado limpio, preparación, lista de archivos, confirmación y respaldo dentro de `.git/levelforge-backups/`.
- **Fetch:** consulta el remoto sin cambiar los archivos de trabajo.
- **Pull:** necesita un árbol limpio; solo actualiza por avance rápido y solicita confirmación antes de recargar.
- **Push:** no ejecuta una actualización forzada.
- **Clone:** solo admite carpeta vacía elegida desde la interfaz y valida el contenido antes de abrir el proyecto manualmente.

El respaldo local de cambios afectados está limitado a **1.000 archivos / 128 MiB**. La recuperación automática puede rechazarse si detecta modificaciones posteriores. Para proyectos importantes conserva además una copia externa verificada del directorio de trabajo.

## Credenciales y transporte

La conexión acepta únicamente URL HTTPS sin secretos incrustados. Los procesos Git se lanzan desde Electron sin intérprete de comandos y con un catálogo cerrado de operaciones. Los tokens pueden almacenarse mediante `safeStorage` de Electron **solo cuando existe un backend de cifrado seguro**; nunca se considera seguro el backend de texto básico.

El token temporal se pasa a Git mediante el entorno del subproceso; este enfoque evita incluirlo en los argumentos de línea de comandos o en los archivos del proyecto, pero presenta un riesgo residual frente a procesos con acceso al entorno del usuario. Usa tokens de alcance mínimo y revócalos si sospechas exposición.

## Funciones no disponibles

No hay shell Git integrada, SSH, OAuth en navegador, Git LFS, merge de conflictos, rebase ni comparación semántica de `.lfproj`. Los procedimientos documentados se limitan a las operaciones del panel.

## Comprobaciones recomendadas antes de entregar un juego

Verifica que los commits estén completos, que el `.lfproj` abra correctamente y que el Player exportado cargue recursos y scripts. Prueba también el juego exportado.

Consulta [Problemas frecuentes](#/vcs-problemas).

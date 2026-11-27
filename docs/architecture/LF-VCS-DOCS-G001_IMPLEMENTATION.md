# LF-VCS-DOCS-G001 — Manual web de Git integrado

**Estado:** implementación documental entregada; no cerrada hasta QA del usuario. **BASE:** `LevelForge_EDITOR_SNAP_SHIFT_G001_SOURCE_BASELINE.zip`.

## Alcance y autoridad

Se documentan exclusivamente operaciones implementadas en `src/components/VersionControlPanel.vue`, `electron/vcs.cjs`, `electron/vcs-remote.cjs` y `electron/vcs-credentials.cjs`, conforme a `LF-VCS-S01-G001`…`LF-VCS-S04-G001`. No se modifica comportamiento del Editor/Player, IPC Git, `.lfproj`, sistema de eventos, ni identidad del repositorio.

Se amplió la lista `categories` de `scripts/gen-docs-web.mjs` con siete páginas de `docs/web-src/` y el grupo de navegación **Control de versiones Git**, después de **Editor y escenas**. Se enlazan desde `inicio.md`, `primeros-pasos.md`, `editor.md` y `problemas.md`. La búsqueda de `public/docs/app.js` ya indexa automáticamente `pages[].search`; **no se añadió otro buscador ni una segunda UI**.

## Páginas publicadas

| ID | Tema | Fuentes |
|---|---|---|
| `vcs-intro` | Conceptos, iniciación y flujo recomendado | S01, S04, VersionControlPanel.vue |
| `vcs-commits` | Cambios, selección y commits | S01, S02 |
| `vcs-historial` | Historial, revisión A/B y diff | S02 |
| `vcs-ramas` | Crear/cambiar rama y restauración protegida | S03 |
| `vcs-remotos` | origin, credenciales, Clone, Fetch, Push, Pull | S04 |
| `vcs-seguridad` | límites, seguridad, distribución y licencias | S01–S04 |
| `vcs-problemas` | Diagnóstico y recuperación | S01–S04 |

## Persistencia y publicación

`public/docs/content.js` se distribuye con el portal autónomo y permite lectura local `file://`, sin requests ni CDN. La fuente de autoría son los Markdown y el generador oficial; **el JavaScript generado no se edita como fuente**. Este paquete incluye una compilación estática offline provisional de las páginas nuevas y enlaces del manual. El generador oficial utiliza `marked@12.0.2`, pero esta dependencia no estaba disponible en el contenedor; se creó la instantánea compilada con un conversor Markdown externo de QA, **sin incorporarlo como dependencia ni código de producción**. Debe ejecutarse `npm ci` y luego `npm run docs:build && npm run docs:check` localmente para validar y regenerar el resultado canónico. No marcar esos comandos PASS sin su ejecución.

Durante la regresión se detectó una página ausente del contenido generado heredado (`node-vfx`), aunque el nodo está registrado. Se incorpora al `content.js` offline provisional; el generador fuente ya recorre ese registro y la incluirá al regenerar. No se modificó el runtime VFX.

## Limitaciones documentadas

- HTTPS solamente, sin SSH/OAuth/LFS; Pull por avance rápido y repositorio limpio, no merge de conflictos.
- Backup protegido con máximo de 1.000 archivos y 128 MiB, sujeto a manifest y validaciones.
- El token no se persiste si el cifrado seguro del SO no está disponible; existe riesgo residual de inspección de entorno durante subprocess Git.
- AppImage/DEB y MinGit Windows sin Git del sistema, TLS de GitHub/GitLab real, interfaz Electron y obligaciones GPL-2.0 todavía requieren QA y revisión de distribución.

## Límites del Gate

No se modifica la implementación S01–S04 ni se implementan funciones Git nuevas. Se añaden Markdown, índice del generador, contenido web publicado, referencias desde el manual, prueba documental y ledger. La revisión de `LF-EDITOR-SNAP-SHIFT-G001` registra la aprobación explícita del usuario pero conserva el QA Electron pendiente.

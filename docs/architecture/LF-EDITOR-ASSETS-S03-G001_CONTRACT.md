# LF-EDITOR-ASSETS-S03-G001 — Contrato

Gate autorizado para extender el Assets Browser existente sin duplicar gestores de archivos. Lista compacta y cuadrícula; ordenación por nombre o tipo; navegación, búsqueda, arrastre, importación y renombrado preservados. Estructura inicial: `Assets` y `Assets/Scenes`; `ensureFs` conserva carpetas de proyectos existentes y añade rutas de recursos reales (incluida UI nativa). La importación en la raíz no crea carpetas por categoría.

El cambio de interfaz está limitado a `ProjectPanel.vue` y preferencias persistidas. No se modifican el HUB, los nodos, los scripts ni los eventos. QA local Electron y Player pendiente.

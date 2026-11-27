# LF-EDITOR-HUB-S02-G001 — Project Browser

**Gate autorizado:** 2026-10-28. **Base:** S01 iconografía de nodos, 980 archivos.

## Objetivo y límites

Rediseñar el HUB en `src/components/WelcomeScreen.vue` como aplicación de escritorio compacta, sin miniaturas simuladas mediante CSS ni contenido promocional. Mantener el mismo gestor de proyectos, plantillas, importación y renderizadores. No alterar Event Order Flow, runtime, física, scripts, Assets Browser o datos persistidos.

## Solución

- Navegación lateral sobria con Proyectos y Plantillas.
- Proyectos recientes con vista de lista predeterminada, cuadrícula opcional, búsqueda y orden.
- Miniatura real cuando está disponible; fallback neutral de carpeta cuando no.
- Panel de detalles con ubicación, escenas, nodos, última edición y acciones existentes.
- Plantillas como filas compactas con iconos semánticos; sin escenas 3D ficticias, cuadrículas CSS ni tarjetas de marketing.
- Panel de configuración con nombre, ubicación y renderizador existentes.
- Responsive en 1000, 760 y 480 px; etiquetas, selección, teclado y foco conservados.

## Garantías

No se añaden dependencias ni nuevos stores. Las llamadas a `createProject`, `openRecent`, `duplicateProject`, `removeProject`, `openFromFolder`, `openLfprojDialog`, `importBundle` y `askConfirm` siguen intactas. La edición se limita a presentación, pruebas, documentación y ledger.

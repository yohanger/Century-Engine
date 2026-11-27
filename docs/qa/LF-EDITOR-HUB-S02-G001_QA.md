# LF-EDITOR-HUB-S02-G001 — QA

**Estado:** implementado; pruebas automatizadas PASS; QA visual Electron pendiente.

## Evidencia automática

- `node --test scripts/test-editor-hub-s02-g001.mjs`: 9 PASS, 0 FAIL.
- Regresión general disponible, excluyendo `test-starcat.mjs` y `test-clouds.mjs`: 2283 PASS, 0 FAIL, 19 SKIP en 108 archivos.
- Pruebas anteriores del HUB adaptadas al nuevo contrato visual: lista predeterminada, cuadrícula opcional, sin sección promocional, breakpoints actuales.
- `npm run build`: NO VERIFICADO en este contenedor sin dependencias Vite instaladas.
- QA real en Electron, dimensiones de ventana, interacción y apertura/creación de proyectos: NO VERIFICADO.

## QA local obligatorio

1. `npm run build`, `npm run electron` con dependencias instaladas.
2. Abrir HUB, cambiar lista/cuadrícula, buscar, ordenar, seleccionar y abrir un proyecto.
3. Confirmar que una miniatura real aparece cuando existe y que los proyectos sin miniatura usan un icono neutral.
4. Crear proyectos con cada plantilla y renderizador; comprobar nombre y ubicación.
5. Importar .lfproj/.zip/.json y abrir carpeta existente; duplicar proyecto; comprobar confirmación de Quitar.
6. Probar navegación por teclado y foco, 1280x720, 1024x768, 760x600 y 480x700.
7. Verificar que no hay efectos CSS que simulen escenas ni mensajes promocionales.
8. Confirmar que el Scene Tree, los scripts, la física y el Player no presentan regresiones.

No declarar QA local PASS ni Gate cerrado hasta aprobación del usuario.

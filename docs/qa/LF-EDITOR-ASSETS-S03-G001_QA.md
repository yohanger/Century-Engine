# LF-EDITOR-ASSETS-S03-G001 — QA

**Implementado; QA local pendiente.**

- `node --test scripts/test-editor-assets-s03-g001.mjs`: 10 PASS, 0 FAIL.
- Regresión disponible: 2293 PASS, 0 FAIL, 19 SKIP (109 archivos).
- Vite/Electron/Player: NO VERIFICADOS en este entorno sin dependencias.

## QA local requerido

1. Crear proyecto nuevo y comprobar que no aparecen categorías vacías por defecto; las carpetas de UI nativa sí se crean cuando existen recursos.
2. Abrir proyecto antiguo y confirmar que todas sus carpetas y archivos permanecen.
3. Cambiar lista/cuadrícula y ordenar por nombre/tipo; probar teclado, zoom, búsqueda y panel estrecho.
4. Crear, importar, mover, duplicar, renombrar y eliminar; verificar guardado/reapertura.
5. Importar un archivo en `Assets` y confirmar que permanece en esa carpeta.
6. Arrastrar scripts a Inspector/Scene Tree y prefabs al viewport; verificar que no se altera el flujo de eventos.
7. Compilar (`npm run build`) y abrir Electron (`npm run electron`).

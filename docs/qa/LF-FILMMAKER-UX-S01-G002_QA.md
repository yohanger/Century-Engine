# LF-FILMMAKER-UX-S01-G002 — QA

Estado: **IMPLEMENTADO** · Tests Node **109/109 PASS** · Build **NO VERIFICADO** · QA visual **PENDIENTE** · Aprobación/cierre **PENDIENTES**.

## Auditoría de continuidad

SOURCE_BASELINE verdadero: `LevelForge_FILMMAKER_FRAME_S01_G001_SOURCE_BASELINE(1).zip` (aportado por el usuario). La entrega provisional basada en `lf(3).zip` queda sustituida. No ejecutar integradores de la entrega provisional.

Comparación con baseline: `film.js`, `frame.js`, `FilmPanel.vue`, tests y dependencias G001 deben conservar identidad binaria. La diferencia debe limitarse a `FilmApp.vue`, `NleTimeline.vue`, `main.js`, hoja CSS, iconos SVG, documentación, test UX y ledger.

## Ejecutado

```bash
node --test scripts/test-filmmaker-ux-s01-g002.mjs scripts/test-filmmaker-frame-s01-g001.mjs scripts/test-road-material-s01-g001.mjs scripts/test-editor-safety-s01-g001.mjs scripts/test-editor-safety-s01-g002.mjs scripts/test-vfx-editor-s03-g001.mjs scripts/test-vfx-simulation-s02-g001.mjs scripts/test-project-safe.mjs scripts/test-resource-history-corr-g001.mjs
```

**Resultado:** 109 PASS, 0 FAIL, 0 SKIP.

## QA local indispensable

1. Inspeccionar CHANGE; respaldar ledger y componentes; extraer sobre la rama **que contenga FRAME-G001**. No usar `lf(3).zip` ni sobreescribir esta instalación con el BASELINE antiguo.
2. `npm ci` si faltan paquetes, `npm run build`, `npm run filmmaker` o el comando de lanzamiento real que use el proyecto.
3. Crear/abrir película y comprobar layout sin clipping en 1440×900, 1280×720 y 1024×768; modificar ancho de paneles y timeline.
4. Probar botones de transporte, Environment, grabación de actor y cámara, Stop, Guardar y Abrir; estados visuales y atajos originales.
5. Probar botón de acceso a **Encuadre** en la barra y cambio entre 16:9, 4:3 y vertical. El monitor debe respetar relación de aspecto y conservar PiP, gizmos y otros overlays.
6. Revisar Scene Tree (nodos, no ECS), Assets, Inspector, Color, Atmósfera y Película; contrastes y pestañas activas.
7. Editar, mover, recortar, dividir, eliminar y silenciar en timeline; comprobar pistas y selección visual sin cambios de keyframes.
8. Verificar teclado, navegación móvil, tooltips y foco visible.
9. Verificar que `.nfm` v2 se guarda y reabre intacto; comparar Editor/Player contra G001.
10. Comparar con el mockup sin asumir que un icono dibujado representa una función implementada.

**Solicitar para cerrar:** salida de build/tests, capturas del editor ejecutándose y reporte de errores o solapamientos. No se ejecutó QA gráfico en el contenedor.

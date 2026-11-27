# QA — LF-TIMELINE-LIBRARY-PICKER-UX-S12-G005-INTEGRAL

Fecha: 2026-11-08. Gate: IMPLEMENTADO · QA LOCAL PENDIENTE · NO APROBADO.

## Auditoría previa

Observado: `TimelinePanel.vue` contenía selector por ID, búsqueda por nombre y filtrado de FilmMaker; popup de hasta 340 px de **altura impuesta**, sin foco automático al buscador y Escape sin retorno al disparador. Contrato S06-G001: proyectos/IDs únicos, crear/cancelar en Assets, FilmMaker separado. Causa raíz de la queja UX: medidas y foco del popup existente. No falta un servicio.

## Pruebas ejecutadas

- `node --test scripts/test-timeline-library-picker-ux-s12-g005.mjs scripts/test-timeline-pro-ux-s07-g001-corr001.mjs scripts/test-timeline-pro-ux-s07-g001-integral.mjs`: **23 PASS, 2 SKIP, 0 FAIL**. Los 2 SKIP exigen `@vue/compiler-sfc`.
- Regresión compatible con menús S12-G004, zoom S12-G003, audio S12-G002: **71 PASS, 2 SKIP, 0 FAIL**.
- Regresión extendida que incluye S06-G001 y S06-G001 CORR-001: **71 PASS, 2 SKIP, 2 FAIL** por importación de `vite` ausente; ambas suites **NO VERIFICADAS FUNCIONALMENTE**.
- Fixture Electron independiente de G002, `scripts/fixtures/editor/timeline-library-picker-ux-s12-g005.html`: **40 comprobaciones programadas**; **NO VERIFICADA** por falta de Vite en el entorno.
- `npm run build`: **NO VERIFICADO** (`vite: not found`). Editor y Player no se atribuyen compilación exitosa.

Los logs originales están en `docs/qa/evidence/LF_S12_G005_*`. No convertir 2 fallos de infraestructura en PASS y no confundir tests de fuente Node con QA de DOM.

## Pruebas locales indispensables (raíz con `package.json`)

```
node --test scripts/test-timeline-library-picker-ux-s12-g005.mjs scripts/test-timeline-pro-ux-s07-g001-corr001.mjs scripts/test-timeline-pro-ux-s07-g001-integral.mjs
node --test scripts/test-timeline-library-picker-ux-s12-g005-electron.mjs
npm run build
npm run electron
```

Esperado: focal 23 PASS / 2 pruebas de compilación Vue adicionales PASS cuando se instalen las dependencias (25 PASS total). Electron 1 PASS y >= 32 comprobaciones, fixture diseñada para 40. Compilación Editor/Player terminada.

## QA visual del usuario

1. Abrir `Seleccionar Timeline`: foco en búsqueda; popup compacto cuando hay 1-3 elementos.
2. Buscar con mayúsculas/minúsculas, probar sin resultados, recorrer con flechas y Enter, cerrar con Escape y confirmar foco en selector.
3. Con nombres repetidos, elegir por ID correcto; comprobar nombre/carpeta/duración y marca de recurso activo.
4. Con 25+ Timelines, scroll interior sin ocupar toda la ventana; en dock estrecho, popup no sale de pantalla; cerca del límite inferior, se abre hacia arriba.
5. Abrir/cancelar `Nuevo Timeline` sin mutar proyecto; guardar/reabrir selección y comprobar integridad de proyecto; películas FilmMaker no aparecen.
6. Regresión del menú `+ Pista`, transporte, Editor, Player y Cinematics.

Entregar logs Electron/build, captura del popup con pocos y muchos resultados y declaración del usuario. No cerrar G005 antes de QA local y aprobación.

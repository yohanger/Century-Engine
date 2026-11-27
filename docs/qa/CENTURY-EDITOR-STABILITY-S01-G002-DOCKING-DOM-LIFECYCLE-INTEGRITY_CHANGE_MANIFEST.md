# CENTURY-EDITOR-STABILITY-S01-G002-DOCKING-DOM-LIFECYCLE-INTEGRITY

Base: source_baseline(9).zip, 4228 archivos, CRC válido, SHA256 76db6efc1648631a4714e1cddc518316e4a3608f9a463b8580ab2fbe54b0cbca. Comparación con source_baseline(8).zip: 280 añadidos, 110 modificados, 0 eliminados. No disponible la entrega acumulativa intermedia exacta ni el árbol local externo al ZIP. Se conserva el histórico existente; no se modifica el blockout ni Jolt. Sin dependencias nuevas. Build y Electron bloqueados por ausencia de Vite; npm no pudo acceder al registro. Las pruebas Chromium usan Vue 3.5.13 disponible, no la versión 3.5.43 fijada en el lock. Three.js 0.186.1 y Electron 44.5.1 no instalados. Ningún Gate aprobado ni cerrado.

Aplicar CHANGE ZIP en orden: puntero, DOM, foco. El catálogo de suites se amplía acumulativamente. El ledger acumulativo se entrega en foco. No se elimina ningún archivo del proyecto local.

| Archivo | Operación | SHA256 |
|---|---|---|
| `docs/architecture/CENTURY-EDITOR-STABILITY-S01-G002-DOCKING-DOM-LIFECYCLE-INTEGRITY_IMPLEMENTATION.md` | Añadido | `ceb9464f0d369faa68eb899eb42964feda7924e2fd3e22926273eee912df72d6` |
| `docs/qa/CENTURY-EDITOR-STABILITY-S01-G002-DOCKING-DOM-LIFECYCLE-INTEGRITY_QA.md` | Añadido | `50a36d1569220192cccb3f3b33ea3d368cd9a9e615a2d377ecbafbcef2d514b5` |
| `docs/qa/evidence/CENTURY-EDITOR-STABILITY-S01-G002-DOCKING-DOM-LIFECYCLE-INTEGRITY/build.log` | Añadido | `ad93033e7f39a0f04a1ed40edf91f741c64cfbf9fa5ed37ad17f38e46626cd7c` |
| `docs/qa/evidence/CENTURY-EDITOR-STABILITY-S01-G002-DOCKING-DOM-LIFECYCLE-INTEGRITY/ce9-dock-browser.py` | Añadido | `2216365644d0d7fe3340db3b17e2c7d1fac04310406754568e99e8af0f0c7217` |
| `docs/qa/evidence/CENTURY-EDITOR-STABILITY-S01-G002-DOCKING-DOM-LIFECYCLE-INTEGRITY/ce9-popup-browser.py` | Añadido | `92b8c724f2cb7e0b71cb3e156acfc782dcfe02b32dc65c34e39c1ce9bdc39979` |
| `docs/qa/evidence/CENTURY-EDITOR-STABILITY-S01-G002-DOCKING-DOM-LIFECYCLE-INTEGRITY/code-after.log` | Añadido | `720b49205a0ba1b62b56b4f6bfd51c2131b0609bd3289632cb616324511cb720` |
| `docs/qa/evidence/CENTURY-EDITOR-STABILITY-S01-G002-DOCKING-DOM-LIFECYCLE-INTEGRITY/dock-after-initial.log` | Añadido | `4d8842e3252b3acafd20ab962fe1c9d66ea6b60fdf8c09372c09e0e10ba30d23` |
| `docs/qa/evidence/CENTURY-EDITOR-STABILITY-S01-G002-DOCKING-DOM-LIFECYCLE-INTEGRITY/dock-before.log` | Añadido | `ddccd595f3ff8e7fe5fb2de5b83c6bc1b233f95f6bcec4bf95ab6cef29ab8fde` |
| `docs/qa/evidence/CENTURY-EDITOR-STABILITY-S01-G002-DOCKING-DOM-LIFECYCLE-INTEGRITY/dock-browser.log` | Añadido | `f915f63d1c0e5114c538bea5fd0858f0f9ae5327e99685c2eb6239ed6dbbcfd9` |
| `docs/qa/evidence/CENTURY-EDITOR-STABILITY-S01-G002-DOCKING-DOM-LIFECYCLE-INTEGRITY/dock-focal-before.log` | Añadido | `39016aaf4e3e5b867eacabe3095146a06677b996bac2aa1d3bdd30f106415b91` |
| `docs/qa/evidence/CENTURY-EDITOR-STABILITY-S01-G002-DOCKING-DOM-LIFECYCLE-INTEGRITY/docking-dom-lifecycle-integrity-electron.log` | Añadido | `3ec9de0ebe6db0096526e8736a9354f68e10c0a5d06d2da4d8951d805e423386` |
| `docs/qa/evidence/CENTURY-EDITOR-STABILITY-S01-G002-DOCKING-DOM-LIFECYCLE-INTEGRITY/docking-dom-lifecycle-integrity.log` | Añadido | `d305468d80abf83c6ceb144cd4b1ddd4cb8288c551198ade6293579c16443cee` |
| `docs/qa/evidence/CENTURY-EDITOR-STABILITY-S01-G002-DOCKING-DOM-LIFECYCLE-INTEGRITY/popup-browser.log` | Añadido | `75889d0e90d4d59020fdc34882ddae2e7df8446bd38293b58491c19b2ebf868b` |
| `scripts/fixtures/editor/docking-dom-lifecycle-integrity.html` | Añadido | `71c6c5b751fc246ae832c2e4b42c14302bea5ba67cbc0cc86174e1297e100842` |
| `scripts/qa-suites.json` | Modificado | `01b395ec4610c8ea2366e1418978caacd7f500599e78e7db9badfc9aa2f840e8` |
| `scripts/test-code-workspace-integration.mjs` | Modificado | `a494cfea46e58573d59537955b6bdb02406850ab7f76052f04491a404e5f05fd` |
| `scripts/test-docking-dom-lifecycle-integrity-electron.mjs` | Añadido | `fdeb5bbb15ce1e6a6d28e9c2c2322de2ef69891ed4402ab783f4a06b86f88f50` |
| `scripts/test-docking-dom-lifecycle-integrity.mjs` | Añadido | `697fdde7f1b26afb4b614ff23dc280f5f775bb986d718bc30590c5fdc773fe82` |
| `src/App.vue` | Modificado | `4beb10a680b0b3be59a764742a59e69774866a5a15aba74b1b953c22c06f85bb` |
| `src/components/AppWindow.vue` | Modificado | `4f03d979c568c5d3893df612a1411a8d9adb08b825b0672c37d5d1083bbded43` |
| `src/components/DockPanelBank.vue` | Modificado | `f969afc9efd131fb9f8fd371f6faf9d338ed74a6ae3d61b12d7941bc221bbf43` |
| `src/components/FloatingEditorWindow.vue` | Modificado | `24eb679cacc3bb54effc45a26087d411c361d33f3af5c48d45c3e30b69dfe9bf` |
| `src/core/editor/native-tool-window.js` | Modificado | `a4a0841425ed32041a3ec0b2e7a46c9e724ac05210ca27b767458bc979cfff69` |

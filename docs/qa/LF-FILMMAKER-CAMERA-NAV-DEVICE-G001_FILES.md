# LF-FILMMAKER-CAMERA-NAV-DEVICE-G001 — Inventario exacto

**Comparación:** `lf(9).zip` aportado por el usuario. Su contenido tiene los **2.192 archivos de fuente** equivalentes al SOURCE_BASELINE S03 CORR-001 y **24 archivos `dist-player` generados**, excluidos deliberadamente. SOURCE_BASELINE final **2.197 archivos**.

## Modificados (4)

- `src/filmmaker/FilmApp.vue` — botón con iconos existentes, preferencia/acciones compartidas, `wheel` en captura en pasadas PC/Laptop.
- `src/filmmaker/operator.js` — manejo de trackpad en el OperatorRig existente con sensibilidad, inversión, zoom y pan limitados.
- `src/filmmaker/panels/CameraPanel.vue` — indicaciones de controles según el modo compartido, sin cambiar fuentes de filmación.
- `docs/qa/LevelForge_DB_Ledger.xlsx` — seis hojas sincronizadas y doce tablas conservadas; S03 pausado y nuevo Gate implementado/no cerrado.

## Nuevos (5)

- `scripts/test-filmmaker-camera-nav-device-g001.mjs` — nueve regresiones de navegación, simulación de rig y rueda.
- `docs/architecture/LF-FILMMAKER-CAMERA-NAV-DEVICE-G001_IMPLEMENTATION.md` — contrato auditado y alcance real.
- `docs/qa/LF-FILMMAKER-CAMERA-NAV-DEVICE-G001_QA.md` — instrucciones QA para la PC y laptop del usuario.
- `docs/qa/evidence/LF-FILMMAKER-CAMERA-NAV-DEVICE-G001/node-s03-nav-20261105.log` — salida automática acumulada.
- `docs/qa/LF-FILMMAKER-CAMERA-NAV-DEVICE-G001_FILES.md` — este inventario.

## Eliminados (0)

Ninguno. **Cambios inesperados en fuente (0)**. No se incorpora `node_modules`, `dist`, `dist-film`, `dist-player`, cachés, archivos de compilación, APK, temporales ni scripts `.sh`.

## Pruebas

- NAV-01…NAV-09: **9 PASS, 0 FAIL**.
- Suite S01/S01A/S02/S03/editor/este Gate: **83 tests; 81 PASS, 2 SKIP, 0 FAIL**.
- `node --check` en archivos JS pertinentes: PASS.
- Vite/Electron de este Gate: **NO VERIFICADO** por fallo de resolución DNS (`EAI_AGAIN`) durante `npm ci` en el entorno de implementación. QA local de ratón/trackpad físico: PENDIENTE.

## Instalación (cambios incrementales)

1. Usar el proyecto S03 actual que ya tiene `package.json` y CORR-001 integrada. Antes de extraer, comparar y respaldar modificaciones locales de los 4 archivos existentes afectados.
2. Extraer **solo CHANGE** sobre la **raíz de ese proyecto**, preservando las rutas y reemplazando exclusivamente los cuatro archivos modificados; los cinco nuevos se incorporan sin borrar nada.
3. No modificar `.nfm`, escenas, proyectos ni `node_modules`; no hace falta reinstalar Android.
4. Validar con `node --test scripts/test-filmmaker-camera-nav-device-g001.mjs` y `npm run filmmaker -- --build` desde la raíz. Instrucciones de QA detalladas en el archivo `_QA.md`.
5. Conservar el SOURCE_BASELINE actualizado para el siguiente Gate; no usarlo para sobrescribir el proyecto del usuario sin comparar cambios locales.

**Cierre:** no concedido; solo tras pruebas visuales y autorización/aprobación del usuario.

# Entrega de S06 CORR-001 — LevelForge

Gate autorizado: `LF-SCRIPT-INTELLISENSE-JSDOC-S06-G001-INTEGRAL_CORR-001`.

## Baseline vinculante

Partir **exclusivamente** de `LevelForge_SCRIPT_INTELLISENSE_JSDOC_S06_G001_INTEGRAL_SOURCE_BASELINE.zip` (S06 original); conservar S04/S05 y las correcciones acumuladas. El ZIP fuente de CORR-001 sirve como baseline completo del siguiente Gate **después de QA y aprobación**.

## Entrega obligatoria

- `LevelForge_SCRIPT_INTELLISENSE_JSDOC_S06_G001_INTEGRAL_CORR-001_CHANGE.zip`: archivos afectados, tests, documentación y ledger.
- `LevelForge_SCRIPT_INTELLISENSE_JSDOC_S06_G001_INTEGRAL_CORR-001_SOURCE_BASELINE.zip`: proyecto íntegro y acumulado; sin builds, caches ni `node_modules`.

No extraer ambos ZIP uno sobre otro. La instalación más segura es extraer SOURCE_BASELINE CORR-001 en una carpeta nueva. Si se prefiere CHANGE, extraerlo en **una copia idéntica del baseline S06 original**, desde la raíz del proyecto y reemplazando solo las rutas del manifest. Antes de reemplazar, comparar modificaciones locales; no sobrescribir escenas, Assets o scripts del usuario. Conservar el baseline anterior como respaldo. No es necesario alterar `package.json` ni instalar Git externo.

## Comandos desde la raíz nueva

```bash
npm ci
node --test scripts/test-script-intellisense-jsdoc-s06-corr001.mjs scripts/test-script-intellisense-jsdoc-s06-g001-integral.mjs
node --test scripts/test-script-intellisense-jsdoc-s06-corr001-electron.mjs
npm run build
npm run electron
```

Esperado para Node focal: **35 PASS, 0 FAIL**. Esperado para Electron: **1 PASS y 18 verificaciones** (no se ha acreditado aquí). Compilación Editor/Player debe terminar con salida 0; actualmente NO VERIFICADA por Vite ausente en el entorno de entrega.

## Evidencia de usuario a devolver

Salida del runner Electron y build, junto con resultado visual del autocierre de `/**/` y del cambio de scripts con ventana maximizada/flotante. Si vuelve a reajustarse el **viewport 3D** real (no solo la ventana Script Editor), adjuntar antes/después y detallar el modo de edición y la resolución.

## Límites

- Código de producción: `App.vue`, `ScriptEditor.vue`, `types-jsdoc.js`.
- No se modifica Player, serialización, ejecución JS, UI Designer, core del docking ni eventos de juego.
- El fixture Electron no sustituye QA visual/GPU. No cerrar Gate hasta nueva aprobación expresa del usuario.

Inventario detallado en `LF-SCRIPT-INTELLISENSE-JSDOC-S06-G001-INTEGRAL_CORR-001_MANIFEST.md`.

# Century · Integración de TriangHor · Corrección del lockfile npm

**Gate:** `CENTURY-TRIANGHOR-INTEGRATION-S01-G001-CORR-001-NPM-LOCKFILE-AND-CLEAN-INSTALL`

**Autoridad:** `CE-TH-CA-001-INDEPENDENT-TRIANGHOR-CONSUMER-AUTHORITY`. La biblioteca independiente sigue siendo el único proveedor de los cálculos y Century conserva las responsabilidades de terreno y renderizado.

## Defecto reproducido

El manifiesto raíz define `"trianghor": "file:vendor/trianghor"`. El lockfile anterior definía `node_modules/trianghor` con `version: 0.0.1` y `resolved: file:vendor/trianghor`, sin la entrada `vendor/trianghor`. Con npm 10.9.2, `npm ci --dry-run --offline --ignore-scripts` rechazaba el lockfile con `Missing: trianghor@0.0.1 from lock file`.

## Resolución mínima

Se regeneró **solo** el metadato de dependencia local mediante `npm install --package-lock-only --offline --ignore-scripts --no-audit --no-fund`.

- `node_modules/trianghor` se registra como `{ "resolved": "vendor/trianghor", "link": true }`.
- `vendor/trianghor` se registra con `version: 0.0.1`, dependencias de desarrollo vacías y el requisito Node de su manifiesto.
- No se modificaron las otras 587 entradas de `packages`, ni `package.json`, ni archivos del módulo independiente.
- Se actualizó la aserción del contrato de integración para verificar el enlace real y se añadieron pruebas específicas de consistencia e instalación npm sin red de un fixture aislado.

## Compatibilidad y límites

La configuración usa un vínculo local reproducible: la carpeta `vendor/trianghor` debe existir junto al manifiesto raíz. No se requieren migraciones. No hay modificaciones al algoritmo, Worker, Terrain, ClusterMeshes, Player, `setPointerCapture` ni otras dependencias.

**Instalación real del proyecto:** `npm ci` completo necesita descargar los paquetes remotos ya registrados en el lockfile. En el entorno de QA sin red ni caché, la instalación se detiene con `ENOTCACHED` al descargar `zip-stream` y, por lo tanto, **no se acredita un `npm ci` completo, ni compilación ni QA Electron**. Sí se acredita la validación del lockfile por npm y la instalación real del vínculo local en un proyecto mínimo sin red.

## QA y entregables

Ver `docs/qa/CENTURY-TRIANGHOR-INTEGRATION-S01-G001-CORR-001-NPM-LOCKFILE-AND-CLEAN-INSTALL_EVIDENCE.md`. El Gate permanece implementado y pendiente de validación de `npm ci` completo en un entorno con registro npm y de aprobación del usuario.

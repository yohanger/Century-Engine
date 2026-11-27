# LF-ASSETS-LPKG-G001 — Exportación nativa .levelpackage

**Autorización:** `Listo. LF-ASSETS-LPKG-G001 autoriza comenzar` (2026-10-26).
**SOURCE_BASELINE de entrada:** `LevelForge_EDITOR_UX_S01_G005_EXT_001_SOURCE_BASELINE.zip` (751 archivos; Three.js 0.186.1).
**Estado:** implementado; pruebas Node PASS; compilación y QA visual en Linux pendientes.

## Contrato de formato

`.levelpackage` es un ZIP de recursos seleccionados, distinto de `.lfproj` (proyecto completo) y de `engine/runtime/package/format.js` (paquete de juego). Mantiene rutas físicas bajo `Assets/` y contiene `levelpackage.json`:

- `format: "levelforge-package"`, `version: 1`, `app`, `exportedAt`, identificación de proyecto de origen;
- `roots`: IDs/tipos seleccionados explícitamente;
- `entries`: ID, tipo, carpeta, nombre, ruta, metadatos y dependencias por ID;
- `folders`: carpetas ascendentes necesarias;
- `context`: copia de las configuraciones compartidas si hay escenas exportadas (base de datos, animaciones, InputMap, tags y otras configuraciones). **No se aplica ni fusiona ahora**: G002 define la resolución de conflictos.

Los contenidos de escenas (`.scene.json`), prefabs (`.prefab`), scripts (`.js/.mjs`), UI (`.ui`), shaders (`.glsl`) y perfiles (`.profile`) se guardan usando la representación actual. Modelos, texturas, sonidos y otros assets conservan los bytes de IndexedDB. El manifiesto no duplica el código ni los nodos del prefab.

## Exportación desde el Editor

- Proyecto → seleccionar uno o varios archivos con Ctrl/Shift o carpetas desde el árbol.
- Botón Exportar `.levelpackage` en la barra de Proyecto; también aparece en menús contextuales de archivo, carpeta y fondo.
- La previsualización mediante confirmación informa del número de recursos, dependencias añadidas y contexto global si corresponde.
- Al confirmar, se descargan únicamente esos recursos y dependencias; no se muta `store.project` ni se crean entradas en la base local.
- Exportar una carpeta incluye recursivamente sus entradas, deduplicadas. Las interfaces internas del motor quedan excluidas.

## Resolución y límites

- Búsqueda de dependencias transitiva sobre el contenido serializado de escenas, prefabs, shaders, scripts y perfiles, y el contexto de escena. Detecta IDs explícitos y rutas literales de recursos conocidos.
- Se bloquea si faltan escenas, binarios, referencias `modelId`, `prefabId`, `textureId`, `imageId` y otras claves de recurso con ID inequívoco, o si existen rutas/IDs duplicados o inválidos.
- Una referencia **construida dinámicamente en JavaScript** o externa al proyecto no puede descubrirse de manera fiable mediante análisis estático; revisar el contenido antes de compartir un paquete con scripts dinámicos.
- `.levelpackage` NO se importa en G001. La importación, selección previa, conflictos de ID/nombre y reescritura de referencias pertenecen a G002. Importar el archivo con el importador genérico muestra un aviso y no agrega basura al proyecto.
- No se genera .unitypackage ni se afirma interoperabilidad binaria con Unity.

## Pruebas automatizadas

- `node --test scripts/test-assets-lpkg-g001.mjs`: **14 PASS / 0 FAIL**. Pruebas funcionales del cierre de selección y manifiesto, con simulación local de JSZip porque las dependencias npm no están instaladas en este entorno. **No es una prueba real de lectura del ZIP por JSZip.**
- Regresión acumulada, scripts `test-*.mjs` excepto `test-starcat.mjs`, `--test-concurrency=1`: **990 PASS / 0 FAIL / 18 SKIP**. El primer intento en paralelo tuvo un fallo temporal en la prueba de tiempo de `test-clouds.mjs`; se repitió individualmente y luego serialmente sin fallos. No se cambió código de nubes.
- Sintaxis JavaScript modificada: PASS.
- `npm run build`: **NO VERIFICADO** (`vite: not found`); sin npm ci, Electron, WebGL ni Player ejecutado aquí.

## QA local obligatorio

- [ ] `npm ci`, `node --test scripts/test-assets-lpkg-g001.mjs`, `npm run build`, `npm run electron:dev`.
- [ ] Crear prefab con un modelo + textura; exportar solo prefab y abrir ZIP con un gestor: manifest, prefab, modelo y textura presentes, sin assets ajenos.
- [ ] Exportar selección mixta con Ctrl/Shift; comprobar número de dependencias añadido y carpetas deduplicadas.
- [ ] Exportar una carpeta que incluya subcarpetas; conservar estructura de `Assets/`.
- [ ] Exportar escena activa y otra inactiva; comprobar datos serializados y context en manifiesto.
- [ ] Probar script que nombra literalmente un ID de asset; comprobar dependencia. Anotar referencias dinámicas que requieran verificación manual.
- [ ] Exportar un modelo después de quitar sus bytes de IndexedDB en un proyecto de prueba; se debe rechazar la exportación con aviso, sin archivo parcial.
- [ ] Seleccionar carpeta UI Sistema; los assets nativos del motor no deben exportarse.
- [ ] Probar arrastrar un `.levelpackage` a «Importar archivos»: aviso de G002, sin crear archivo.
- [ ] Abrir proyecto original después de exportar; verificar que no cambió y que Edit/Play/Player siguen como antes.

**Entrega:** exactamente `LF-ASSETS-LPKG-G001_CHANGE.zip` y `LevelForge_ASSETS_LPKG_G001_SOURCE_BASELINE.zip`. Sin SHA-256 ni script de verificación adjuntos.

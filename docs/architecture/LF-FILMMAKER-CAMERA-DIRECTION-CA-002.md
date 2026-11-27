# Contract Amendment ratificado — LF-FILMMAKER-CAMERA-DIRECTION-CA-002

**Estado:** APROBADO. Ratificación textual del usuario: «Apruebo LF-FILMMAKER-CAMERA-DIRECTION-CA-002 sin modificaciones.» (2026-11-05).

**Ámbito:** `LF-FILMMAKER-CAMERA-DIRECTION-S02-G001-INTEGRAL`, enmienda exclusivamente la política de versiones/migración del formato `.nfm` de CA-001 y la obligación asociada de MC-15. CA-001 conserva autoridad en cámaras propias de FilmMaker, rigs, referencias, Camera Shake, exportación y propiedad de lectura.

## CA-002.01 — Un único formato `.nfm`

- No se registra ni se compara una versión de formato dentro de `film.json` (`version`, `schemaVersion`, `formatVersion` o equivalentes). El nombre del archivo permanece `.nfm`; no se crean archivos paralelos.
- `newFilm()` crea una película estructuralmente completa con una cámara editorial y `activeCameraId` que referencia su ID.
- `normalizeFilm()` verifica la estructura de cámaras: colección no vacía, IDs no duplicados y referencia activa válida. La ausencia de datos imprescindibles produce un error explícito; no se inventa una cámara a partir de un operador global ni se reasignan referencias por nombre.
- `packNfm()` guarda la representación normalizada. `unpackNfm()` no corrige silenciosamente datos antiguos ni modifica el archivo fuente. Los datos ajenos al esquema no actúan como discriminadores de versiones.
- No se introducen migradores históricos, bifurcaciones por versión ni convertidores de formatos pretéritos.

## CA-002.02 — Precedencia precisa

Sustituye las cláusulas de CA-001 relativas a `v4 → v5`, compatibilidad versionada, cámara `cam_legacy_*`, campo `operator` de entrada heredada para migración, comprobaciones de versiones futuras y pruebas de migración. Sustituye solamente la exigencia de migración/versionado de `.nfm` en MC-15; **permanecen** la preservación de datos, IDs, proyectos, escenas, `.lfproj`, `passes`, `takes`, recursos y el aislamiento Android.

Las estructuras incompletas no se reparan de forma automática; se informa del error y se conserva intacto el archivo de origen. No hay autorización para borrar o sobrescribir películas del usuario.

## CA-002.03 — Verificación

- Nueva película sin campo de versión y con cámara principal válida.
- Reapertura de archivo estructuralmente completo y persistencia de IDs/pasadas/edición.
- Rechazo de cámara ausente, ID duplicado o referencia activa inválida sin conversiones implícitas.
- Guardado ZIP `.nfm` sin versionado interno, con prueba binaria JSZip local pendiente cuando no esté disponible en el entorno.
- QA Electron, importación LevelForge/Cinematics y medición local conservan su condición de evidencia pendiente hasta ejecución real.

**No altera** el versionado de protocolos de red, los diagnósticos del teléfono ni otros formatos independientes. El Gate S02 integral ya está autorizado; su ejecución continúa bajo esa autorización, sin crear un Gate adicional.

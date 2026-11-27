# QA S12-G004 · Menú +Pista e iconos

## Automatizado disponible

- `node --test scripts/test-timeline-command-menu-icons-s12-g004.mjs`: 11 PASS / 0 FAIL.
- Selección Node compatible: 109 PASS / 2 SKIP / 0 FAIL; los SKIP son comprobaciones optativas del compilador Vue sin dependencias locales.
- Regresión Node extendida: 109 PASS / 2 SKIP / 2 FAIL de infraestructura histórica; `test-timeline-library-assets-s06-g001.mjs` no importa `vite` y `test-timeline-node-method-track-s04-g003.mjs` falla al resolver un import relativo desde un módulo `data:`. No atribuir a G004 ni registrar la suite extendida como PASS.
- `node --test scripts/test-timeline-command-menu-icons-s12-g004-electron.mjs`: NO VERIFICADO, no entra en fixture por ausencia de Vite; el comando falla en el prerrequisito.
- `npm run build`: NO VERIFICADO, `vite: not found`.

## Pruebas en el equipo del usuario (Electron embebido)

1. Ejecutar Node focal y Electron (los archivos de prueba están incluidos en CHANGE).
2. Abrir Timeline, pulsar `+ Pista`: debe mostrar exactamente seis acciones, sin botones de Naturaleza ni emojis.
3. Comprobar iconos de grupo, Cámara, Nodo, Audio, Comandos, Métodos; hover, foco por Tab, Escape y regreso al botón.
4. Crear un grupo y cinco pistas; comprobar Inspector y posibilidad de guardar y reabrir el recurso con los mismos IDs.
5. Abrir una pista Comandos y una clave, usar editor de eventos para agregar lluvia, relámpago y trueno. Verificar que el catálogo sigue disponible y funciona.
6. Abrir proyecto previo que tenga pista «Naturaleza» y claves meteorológicas: se conserva sin migración ni borrado.
7. Compilar Editor + Player, comprobar que Preview/Player y los comandos meteorológicos no sufrieron regresiones.

Comandos: `node --test scripts/test-timeline-command-menu-icons-s12-g004.mjs`, `node --test scripts/test-timeline-command-menu-icons-s12-g004-electron.mjs`, `npm run build`, `npm run electron`.

No se afirma QA visual PASS antes de recibir resultados del usuario.

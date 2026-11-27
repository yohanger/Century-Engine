# LevelForge — LF-HUB-TEMPLATES-S01-G001_CORR-001 · Corrección de identidad visual

**Autorización exacta:** `Listo. LF-HUB-TEMPLATES-S01-G001_CORR-001 autoriza comenzar` (2026-10-26).  
**Dirección visual:** captura facilitada por el usuario, con negro de grafito **igual al editor de LevelForge** y sin la etiqueta de versión del producto.  
**Ámbito técnico:** `src/components/WelcomeScreen.vue` y dos iconos adicionales en `src/components/Icon.vue`, sin duplicar el Hub o modificar la lógica de plantillas.

## Requisitos vinculantes

- [X] El Hub reutiliza los tokens **existentes** del editor: `--g-950 #050505`, `--g-900 #0d0d0d`, `--g-850 #141414`, `--g-800 #1d1d1d` y `--hair #2b2b2b`. `--blue` es solo el color de selección y de acciones, tal como en el editor.
- [X] Se elimina **exclusivamente** del Hub la etiqueta de la versión y su importación; no se modifica la versión técnica del proyecto.
- [X] Composición de la referencia: navegación a la izquierda, proyectos con miniaturas reales en el centro, panel derecho de acciones y detalles del seleccionado; una pantalla existente de selección/configuración de plantillas con las mismas funciones.
- [X] Vista de cuadrícula y lista, búsqueda, orden, tarjetas con nombre, renderizador, escenas, nodos, ruta y última edición; todas las propiedades proceden del registro `db.listProjects()`, no de un catálogo ficticio.
- [X] Estado sin proyectos y búsqueda sin resultados; botones operativos.
- [X] Se respetan `createProject`, `openRecent`, `openFromFolder`, `openLfprojDialog`, `duplicateProject`, `removeProject`, `askConfirm` e `isProjectOpen`. Ninguna ruta funcional se reemplaza.
- [X] Empty y First Person, identificadores existentes de TEMPLATES y renderizadores `RENDERERS` siguen intactos. No se inventan plantillas, proyectos de muestra, Marketplace ni menús vacíos.
- [X] Ajustes de anchura para pantallas estrechas, foco por teclado y etiquetas accesibles.

## Evidencia y estados

| Control | Estado | Alcance real |
|---|---|---|
| Nueva suite `node --test scripts/test-hub-templates-s01-g001-corr-001.mjs` | **10 PASS / 0 FAIL** | Auditoría automatizada de referencias CSS, controles, acciones y contratos en fuente; no es un test de píxeles |
| Suite previa Hub y protección | **39 PASS / 0 FAIL** | Contrato de plantillas y salvaguardas de proyectos |
| Continuidad de corrección Mesh Edit | **5 PASS / 0 FAIL** | Se restaura el import autorizado de `store` y sus pruebas conocidas |
| Regresión acumulada | **1306 PASS / 0 FAIL / 18 SKIP** | 1324 pruebas, excluyendo `test-starcat.mjs` por dependencias ausentes |
| Sintaxis JS del SFC | **PASS** | `node --check` del bloque `<script setup>`, no compila la plantilla Vue |
| `npm run build` | **NO VERIFICADO** | `vite: not found`; `node_modules` no está disponible en el contenedor |
| Electron, visual y responsive real | **NO VERIFICADO** | Requiere evaluación local del usuario |
| QA del Player exportado | **FUERA DEL ALCANCE** | El Hub no afecta al Player |

## Trazabilidad del SOURCE_BASELINE

**Bloqueo parcial de procedencia:** el último `LevelForge_QA_INTEGRAL_G001_CORR_001_SOURCE_BASELINE.zip` generado en el Gate previo **no está disponible en esta sesión**. Sí está disponible el SOURCE_BASELINE de Shader Graph S02-G001 de 786 archivos que el usuario eligió como base de la corrección anterior. Por eso se reproducen únicamente los cambios de continuidad aprobados y respaldados por este hilo: `store` importado en `session-input.js`, su test de cinco casos y el registro documental/ledger. **La igualdad binaria con el ZIP correcto anterior queda NO VERIFICADA.** No se incorporó el Gate `LF-QA-INTEGRAL-G001` descartado.

## QA local del usuario (resolución 1366×768)

- [ ] Extraer CHANGE sobre una copia del proyecto local y comprobar que no sobrescribe modificaciones locales de `WelcomeScreen.vue`, `Icon.vue`, `session-input.js` ni ledger.
- [ ] Ejecutar `npm ci`, `npm run build` y `npm run electron:dev`.
- [ ] Verificar que el Hub tiene **el mismo negro** que el editor (sin fondos azul marino) y que la versión no se muestra en ningún encabezado del Hub.
- [ ] Abrir proyectos que ya existían en el Hub: comprobar miniaturas reales, nombres, ruta, renderizador y fechas.
- [ ] Alternar cuadrícula/lista, ordenar, buscar y limpiar la búsqueda.
- [ ] Seleccionar proyecto, abrir con doble clic/botón, duplicar, importar y abrir carpeta.
- [ ] Confirmar que «Quitar proyecto» utiliza el diálogo de seguridad existente y no borra la carpeta del disco.
- [ ] Crear un Empty y un First Person, escoger renderizador, ubicación y nombre; comprobar contenido real de las escenas y Database.
- [ ] Probar teclado (Tab, Enter, flechas), interfaz a 1366×768 y una ventana menor sin controles ocultos o desplazamientos indebidos.
- [ ] Regresar a Edit Mesh para confirmar que el `ReferenceError: store is not defined` no reaparece; esta verificación pertenece al Gate previo restaurado.
- [ ] Devolver capturas del Hub, de las plantillas y cualquier error de consola para aceptación visual. Hasta entonces **QA LOCAL PENDIENTE**.

## Entregables

Dos ZIP: CHANGE (solo archivos nuevos/modificados respecto al SOURCE_BASELINE disponible) y SOURCE_BASELINE acumulado. No se incluyen `node_modules`, builds, cachés, scripts `.sh` ni SHA-256 separado. **No declarar CERRADO ni QA LOCAL PASS** sin aprobación visual expresa.

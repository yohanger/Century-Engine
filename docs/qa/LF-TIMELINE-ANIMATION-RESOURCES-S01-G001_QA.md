# LF-TIMELINE-ANIMATION-RESOURCES-S01-G001

## Alcance y compatibilidad

Base aprobada `LevelForge_VSCODE_DEFAULT_SCRIPT_EDITOR_S02_G001_SOURCE_BASELINE.zip`.

Las cinemáticas y clips existentes se proyectan en la **raíz de Assets**. Los modelos, IDs, referencias y formatos existentes se mantienen. Se sigue guardando el contenido en `project.timelines` y `project.animations` dentro de `project.json` del `.lfproj`. Los recursos de este Gate aparecen en el catálogo de Assets y se exportan con el proyecto completo.

En la raíz de Assets, **Crear → Cinemática** o **Crear → Clip de animación** crea un recurso vacío. **Duplicar** copia el recurso con IDs propios sin cambiar el documento abierto. El doble clic, Enter y las acciones explícitas del menú abren por ID. Sin documento válido, los editores indican que debe abrirse desde Assets. Los controles para crear y duplicar se retiran de ambos paneles y la importación de `.lfcap` se realiza desde **Juego → Importar captura de movimiento**.

Las propiedades, el renombrado y el borrado preexistentes se mantienen en sus editores en este Gate. Las nuevas entradas en Assets admiten crear, abrir y duplicar. El traslado de propiedades al Inspector, el rediseño visual y el renombrado que actualiza referencias por nombre pertenecen a Gates posteriores.

## QA local

Extrae SOURCE_BASELINE en una carpeta nueva o aplica CHANGE sobre una copia limpia del SOURCE_BASELINE de VS Code S02-G001. Conserva el ZIP anterior y los proyectos locales.

```bash
npm ci
node --test scripts/test-timeline-animation-resources-s01-g001.mjs
node --test scripts/test-timeline-animation-resources-s01-g001-electron.mjs
npm run docs:check
npm run build
npm run electron
```

1. Abre una copia de un proyecto existente con dos cinemáticas y dos animaciones. Comprueba su presencia en la raíz de Assets y abre cada una por doble clic.
2. Cambia la duración o una clave de la segunda cinemática y del segundo clip. Guarda y reabre. Comprueba que el primer recurso de cada tipo queda intacto y que las referencias de los nodos o eventos apuntan al mismo recurso.
3. En un proyecto nuevo, crea ambos tipos desde Assets y duplícalos. Comprueba que crear y duplicar conservan el documento abierto. Usa Deshacer y Rehacer con un clip duplicado.
4. Reproduce en Play y en el Player exportado. Para importar capturas usa el comando del menú Juego.
5. Devuelve qué escenario falló, si lo hubo, y el mensaje visible.

## Evidencia

Los registros de Node, Electron, documentación y compilación acompañan la entrega. El QA local del Gate queda pendiente.

- Node: 3/3 pruebas focales y 163/163 de regresión.
- Electron embebido: 20 comprobaciones del flujo Assets/editores y reproducción con el Player real a partir del paquete exportado. La escena de prueba utiliza la plantilla First Person con Jolt.
- Electron embebido: 35 comprobaciones de regresión de animación, señales y Jolt.
- En la prueba inicial, la plantilla sin controlador no pudo resolver el nodo para reproducir animación. El runtime de esa plantilla queda fuera del alcance de S01.
- Editor (825 módulos) y Player (414 módulos) compilados. Portal interno 12/12 PASS.

## Inventario frente a VS Code S02-G001

**Modificados (12)**

- `docs/qa/LevelForge_DB_Ledger.xlsx`
- `docs/web-src/audio.md`
- `public/docs/content.js`
- `src/components/AnimationPanel.vue`
- `src/components/ProjectPanel.vue`
- `src/components/TimelinePanel.vue`
- `src/core/project.js`
- `src/core/state/animation.js`
- `src/core/state/filesystem.js`
- `src/core/state/history.js`
- `src/core/state/project.js`
- `src/core/state/timelines.js`

**Nuevos (9)**

- `docs/qa/LF-TIMELINE-ANIMATION-RESOURCES-S01-G001_QA.md`
- `docs/qa/LF-VSCODE-DEFAULT-SCRIPT-EDITOR-S02-G001_CLOSE.md`
- `docs/qa/evidence/LF-TIMELINE-ANIMATION-RESOURCES-S01-G001/build-editor-player.log`
- `docs/qa/evidence/LF-TIMELINE-ANIMATION-RESOURCES-S01-G001/docs-check.log`
- `docs/qa/evidence/LF-TIMELINE-ANIMATION-RESOURCES-S01-G001/electron-55-checks-pass.log`
- `docs/qa/evidence/LF-TIMELINE-ANIMATION-RESOURCES-S01-G001/node-163-pass.log`
- `scripts/fixtures/editor/timeline-animation-resources-s01-g001.html`
- `scripts/test-timeline-animation-resources-s01-g001-electron.mjs`
- `scripts/test-timeline-animation-resources-s01-g001.mjs`

**Eliminados:** 0. **Inesperados:** 0.

# LF-EDITOR-MENUS-UX-S01-G001-INTEGRAL · Contrato autorizado

**Autorización literal recibida:** «Listo. LF-EDITOR-MENUS-UX-S01-G001-INTEGRAL autoriza comenzar» (2026-11-02).

**SOURCE_BASELINE de entrada:** archivo `lf(6).zip`, entregado por el usuario. Baseline del Gate: extracción completa e íntegra de ese ZIP, sin recurrir a fuentes anteriores ni reconstruir proyectos. Se conservan sus archivos y modificaciones históricas.

## Objeto y límites

Sprint S01, un solo Gate integral: modernizar barra principal, menús comunes, submenús y menú Añadir (Shift+A). Retirar únicamente el logotipo SVG de `MenuBar.vue`. Sustituir los resaltados azules invasivos de los menús por superficies neutras; preservar los colores semánticos de errores, foco y acciones globales. Añadir transiciones cortas, sin transformaciones que desplacen coordenadas de menús, con `prefers-reduced-motion`.

No cambiar comandos ni registros de nodos; conservar alternancia de menús, foco, Escape, clic exterior, navegación por teclado, búsqueda, preferencias de Añadir, posición en bordes y prioridades de apertura. El fondo de captura no debe simular una pantalla modal ni bloquear clics de la UI. Los cuadros verdaderamente modales permanecen ajenos a este Gate.

**Producción permitida:** `src/components/MenuBar.vue`, `ContextMenu.vue`, `MenuList.vue`, `AddModal.vue`, `src/styles.css`. **Medios indispensables incluidos:** pruebas Node, prueba/fixture Electron con runner existente, documentación, evidencia y actualización de las seis hojas del ledger. No se autorizan cambios de docking, gizmo, ViewBar Escena/Juego, FilmMaker, runtime, Player, modelos, escena, ni exportación.

## Prerrequisitos y contradicciones

- El sistema de barra de menús y el menú Añadir comparten exclusividad mediante `store.menu` y `store.addModal`; se conserva esa corrección anterior.
- La arquitectura visual anterior es una referencia conceptual. No obliga a modificar otros componentes ni a implementar nuevos sistemas.
- `LF-EDITOR-VISUAL-LANGUAGE-S00-G001_CONTRACT.md` sigue marcado como propuesta visual; el presente Gate se limita a las elecciones expresamente autorizadas para S01.
- No se han encontrado contradicciones contractuales vinculantes para este alcance.

## QA contractual y cierre

Pruebas Node focales y heredadas; fixture Electron embebido, sin navegador externo; compilación Editor/Player cuando las dependencias estén instaladas; QA visual y funcional local por el usuario. **Estado de cierre:** pendiente hasta aportación de QA local y aceptación expresa. No inferir compilación ni QA visual a partir de los tests fuente.

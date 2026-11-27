# LF-EDITOR-VIEWBAR-UX-CA-002 — Alternancia de ratón / trackpad por icono

**Estado:** APROBADO mediante autorización exacta `Listo. LF-EDITOR-VIEWBAR-NAV-DEVICE-CORR-G001 autoriza comenzar`.

**Alcance del Gate:** `LF-EDITOR-VIEWBAR-NAV-DEVICE-CORR-G001`.

**Autoridad / contradicción resuelta:** CA-002 **reemplaza íntegramente** `LF-EDITOR-VIEWBAR-UX-CA-001`, cuya incorporación de perfiles de render a ViewBar fue una interpretación errónea. CA-001 queda **SUPERSEDIDA**, se conserva como histórico y no vincula la barra. `LF-EDITOR-VIEWBAR-UX-G001` continúa vigente para FOV, gizmos, navegación avanzada y resto de opciones, con la única excepción aprobada aquí: el acceso directo al dispositivo de navegación en Escena.

## Contrato vinculante

1. En la pestaña **Escena** de `ViewBar.vue` habrá **exactamente un botón de icono**, sin etiqueta visual ni lista desplegable. El icono actual será `mouse` para ratón o `trackpad` para trackpad, ambos existentes en `Icon.vue`.
2. Pulsar el botón alternará inmediatamente `mouse ⇄ trackpad` mediante los comandos **ya existentes** `nav.mouse` y `nav.trackpad`. La autoridad única del modo será `store.prefs.navigation`; quedan prohibidos estados, gestores y configuraciones duplicadas.
3. El icono mostrará el modo activo, con tooltip y nombre accesible dinámicos. El botón conservará interacción nativa con teclado y estado `aria-pressed` para el modo trackpad.
4. `PreferencesModal.vue`, menú **Ver**, el watcher de `editor/keys.js` y `Viewport.setNavigation(mode)` permanecerán conectados al mismo valor. Se preservan sensibilidad, inversión y gestos asociados a ratón/trackpad, así como la persistencia de `levelforge:prefs`.
5. El selector erróneo de render **se elimina exclusivamente de ViewBar**. El render de trabajo seguirá disponible en **Ver → Render del viewport** mediante `store.view.renderMethod`; el render persistente del juego sigue en `project.render` y Juego → Ajustes del juego. Ni Play ni Player deben alterarse.
6. El botón aparecerá únicamente en Escena, no en Juego; la barra preserva su desplazamiento horizontal y los controles de vistas, Snap, gizmos y Edit Mesh sin duplicarlos.
7. Las aserciones históricas de G001, CA-001 y Edit Mode que prohíben el selector de navegación o exigen el selector errado de render se actualizan para este contrato **sin eliminar pruebas ni borrar evidencia**. Los resultados del Gate anterior se conservan como históricos.

## Exclusiones

No se crean nuevos gestos, automatismos de detección de hardware, un panel de navegación paralelo, nuevos iconos SVG, otro renderer, botones con texto visible ni cambios en las preferencias originales.

**QA de aceptación:** icono ratón/trackpad, alternancia reversible, sincronización inmediata con Ver y Preferencias, persistencia, foco/tooltip/ARIA, visor estrecho, regresión Edit Mesh y Juego. QA local del dispositivo físico pendiente de ejecutar por el usuario.

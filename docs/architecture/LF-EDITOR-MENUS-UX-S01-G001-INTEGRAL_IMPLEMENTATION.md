# LF-EDITOR-MENUS-UX-S01-G001-INTEGRAL · Implementación

**Estado técnico:** IMPLEMENTADO EN SOURCE_BASELINE · Node 62/62 PASS (corrección de fixture) · COMPILACIÓN NO VERIFICADA · ELECTRON NO VERIFICADO · QA LOCAL PENDIENTE · NO CERRADO.

## Cambios en producción

1. `MenuBar.vue`: se elimina el SVG de marca y su contenedor; se ordena visualmente la franja de menús con superficies grafito, conservando modo teléfono, drag/no-drag, los comandos y la alternancia Archivo/Añadir.
2. `ContextMenu.vue`: capa transparente no interceptora; eventos globales de pointerdown y contextmenu cierran al salir sin consumir la interacción subyacente. Se respeta el disparador de la barra al alternar un menú activo. Se enfoca la primera acción cuando se abre y reposiciona cerca de bordes sin alterar el origen.
3. `MenuList.vue`: selección neutra con foco accesible, jerarquía compacta, animación de opacidad y reducción de movimiento. Navegación con flechas, Inicio/Fin, Intro/Espacio; submenús con foco y retorno. Se evita que clics en hojas ejecuten la fila antecesora y se comprueba que una rama asíncrona no haya sido reemplazada antes de colocarla.
4. `AddModal.vue`: presentación como región con búsqueda en lugar de diálogo, capa explícitamente transparente, cabecera/campos coherentes y resaltados neutrales; conserva modelo de categorías, preferencia de inserción, búsqueda y control por teclado.
5. `styles.css`: cuatro variables compartidas de superficie e interacción de menús, sin sustituir la paleta de toda la aplicación.

## Verificación automatizada disponible

- `scripts/test-editor-menus-ux-s01-g001-integral.mjs`: ocho comprobaciones focales de composición, exclusividad, superficies, animación, accesibilidad y posicionamiento.
- Cinco suites previas relacionadas: barra, barra CORR-001, AddMenu, AddMenu CORR y categorías del AddMenu.
- Total local real: **61 PASS, 0 FAIL, 0 SKIP**. Evidencia: `docs/qa/evidence/LF-EDITOR-MENUS-UX-S01-G001-INTEGRAL/node.log`.
- Fixture nueva: `scripts/fixtures/editor/menus-ux-s01-g001-integral.html`, lanzada por `scripts/test-editor-menus-ux-s01-g001-integral-electron.mjs`, reutilizando `scripts/qa-electron-webgl-runner.mjs`. Comprobaciones de Vue, interacciones y apariencia computada; eventos simulados no equivalen a QA manual ni a eventos de teclado nativos. **NO VERIFICADA en este entorno**: Vite/Electron no están instalados.
- `npm run build`: **NO VERIFICADO**. La invocación terminó con `vite: not found` (exit 127); no implica error de compilación del código ni PASS.

## Limitaciones

Los resultados Node incluyen comprobaciones estáticas y la lógica pura del catálogo, pero no demuestran por sí solos que Vue renderice bien, que un dispositivo concreto respete los eventos o que el aspecto sea aceptable. QA visual local y builds siguen pendientes. No hay evidencia para declarar APROBADO/CERRADO.

## Corrección de QA dentro del Gate (incidencia MENU-E01)

**OBSERVADO en equipo del usuario:** los primeros cinco checks Electron pasaron (barra sin logo, menús, velo transparente/no interceptor y popup clickable). El siguiente check, «Aparición activa», devolvió `false` porque el fixture comparaba estrictamente `getComputedStyle(...).animationName === "menu-appear"`. El runner detuvo la prueba antes de comprobar interacciones y Shift+A. **ELECTRON: FAIL reportado por el usuario; corregido, aún NO REEJECUTADO.**

**INFERENCIA TÉCNICA:** al compilar `<style scoped>` Vue puede sufijar los nombres de `@keyframes`; además, el `@media (prefers-reduced-motion: reduce)` desactiva legítimamente la animación. El log no incluye el valor real de `animationName`, por lo que ninguna de esas dos explicaciones está confirmada por evidencia dinámica.

**CAUSA RAÍZ confirmada de la aserción defectuosa:** igualdad exacta con un nombre sin transformar; no consideraba el contrato de nombres scoped ni movimiento reducido.

**Corrección ejecutada, SIN cambios productivos:** en el fixture Electron se comprueban el nombre base o nombres scoped de Vue, una duración positiva cuando no hay reducción de movimiento y `none` cuando está activa esa preferencia. Se aplica la misma validación a `AddModal`. En caso de error, el reporte incluye nombre, duración y preferencia real; en PASS, el runner también imprime ambos diagnósticos. Se agregó una regresión Node de esta condición; **62/62 Node PASS**. La prueba Electron corregida, build y QA visual permanecen **NO VERIFICADOS** hasta nueva ejecución local. No declarar Gate cerrado.

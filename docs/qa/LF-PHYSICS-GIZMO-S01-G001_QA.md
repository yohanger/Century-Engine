# LevelForge — LF-PHYSICS-GIZMO-S01-G001

**Autorización exacta:** `Listo. LF-PHYSICS-GIZMO-S01-G001 autoriza comenzar` (2026-10-26).

**SOURCE_BASELINE de partida:** `LevelForge_MATERIAL_UX_S01_G001_SOURCE_BASELINE.zip` (800 entradas). No se mezclan los cambios del futuro Gate Scene Inspector.

## Problema

Al seleccionar una primitiva con **Cuerpo dinámico** no existía contorno visible de la forma que utiliza Jolt. El Inspector solo ofrecía Caja, Esfera o Cápsula y los parámetros físicos: no permitía separar el origen de la colisión (Offset) ni ampliar/reducir su forma (Extensión) de manera independiente de la malla.

## Implementación

- `src/engine/runtime/physics/collider-shape.js`: regla común para centro, tamaño y radio/altura reales de Caja, Esfera y Cápsula. Propiedades opcionales persistidas `props.bodyOffset = [x,y,z]` y `props.bodyExtension = [x,y,z]` en metros locales. Ausencia de campos → `[0,0,0]`, compatible con proyectos previos. Extensión se suma al tamaño derivado de la geometría, limitado a 0,04 m como mínimo por eje.
- `src/engine/runtime/physics/bodies.js`: Jolt consume fórmulas de esfera/cápsula comunes; el cálculo del volumen descarta ayudas de edición para que sus asas no agranden accidentalmente el collider.
- `src/engine/runtime/events/play-bodies.js`: transmite Offset/Extensión de las propiedades de los cuerpos de escena al Jolt existente. Conserva el API `game.physics.body(...)`: si se crea un cuerpo sin campos nuevos mantiene los valores anteriores.
- `src/core/editor/collider.js`: representación temporal de autoría (contorno verde, punto central blanco para Offset y seis asas de extensión X/Y/Z). El auxiliar es hijo del nodo rígido (no del hijo visual escalado) y sigue sus transformaciones. Manipuladores sobre el visor permiten ajustar Offset y Extensión sin modificar la malla. Proyección mediante plano del eje/punto; un solo commit de Undo al soltar. Render sin prueba GPU en este entorno.
- `src/core/editor/selection.js`, `src/core/editor/pointer.js`, `src/core/editor.js`: reusan selección/raycast y los eventos de puntero ya existentes. Las ayudas quedan ocultas sin selección, durante Edit Mesh y al jugar; se eliminan sus recursos al reconstruir/borrar nodos. No se convierten en físicas Jolt ni se guardan como geometría de proyecto.
- `src/components/Inspector.vue`: campos Offset y Extensión 3D con `Vec3Field` y commits existentes. Mantiene Forma, Masa, Rozamiento, Rebote, Densidad y Flotación anteriores.

## Evidencia automatizada

1. `node --test scripts/test-physics-gizmo-s01-g001.mjs` → **23 PASS, 0 FAIL**. Incluye caja legacy, offset, extensión, límites, esfera/cápsula, nulos, valores inválidos, regla común Jolt/gizmo, persistencia por propiedades del nodo, controles en Inspector, puntero, tamaño de gizmo, visibilidad opcional y ciclo de vida.
2. Regresión general: `find scripts -maxdepth 1 -name 'test-*.mjs' ! -name 'test-starcat.mjs' -print0 | sort -z | xargs -0 node --test` → **1386 PASS / 0 FAIL / 18 SKIP (1404 pruebas)**. `test-starcat.mjs` excluido por dependencia de Three ausente, igual que el baseline.
3. `node --check` de los JS involucrados → PASS.
4. `npm run build` → **NO VERIFICADO**: `vite: not found`. No se ejecutó `npm ci` ni pruebas gráficas Electron/WebGL/Jolt reales. Las pruebas de integración correspondientes siguen pendientes.

## QA local del usuario

- [ ] `npm ci`, `npm run build`, `npm run electron:dev` en copia aislada del SOURCE_BASELINE.
- [ ] Seleccionar un cubo, activar Cuerpo dinámico → contorno y siete puntos manipuladores; no aparecen si no está seleccionado.
- [ ] Cambiar Forma entre Caja, Esfera y Cápsula: la silueta debe coincidir con la colisión real.
- [ ] Modificar Offset X/Y/Z desde Inspector y desde el punto central: la malla no se mueve y el contorno sí.
- [ ] Modificar Extensión X/Y/Z desde Inspector y las seis asas: el volumen cambia sin escalar la malla.
- [ ] Comprobar escala desigual y rotación del objeto; comprobar objetos con padre.
- [ ] Probar Undo/Redo de arrastre, guardar/reabrir, duplicar y prefabs; comparar proyecto legado sin nuevos campos.
- [ ] Entrar/salir de Play y Edit Mesh: la ayuda debe desaparecer y regresar sin afectar colisiones reales.
- [ ] Validar un cuerpo en suelo, esfera rodante y cápsula dinámica con Jolt; comparar contorno con colisiones observadas.
- [ ] Exportar Player y confirmar ausencia de contornos, puntos y controles de autoría.

**Estado:** IMPLEMENTADO / REGRESIÓN AUTOMATIZADA PASS. **No implica compilación aprobada, verificación Jolt real ni aceptación visual**. No cerrar hasta QA local del usuario.

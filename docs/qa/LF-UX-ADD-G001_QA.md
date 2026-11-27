# LF-UX-ADD-G001 — Menú contextual compacto Shift+A

**Fecha:** 2026-10-24  
**Baseline:** `LevelForge_CMD_WINDOW_G001_SOURCE_BASELINE.zip`  
**Estado:** IMPLEMENTADO · PENDIENTE QA VISUAL LOCAL

## 1. Qué cambia

- `Shift+A`, «Añadir» del menú y «Añadir» del árbol abren el mismo menú compacto cerca del puntero. La posición se mantiene dentro de la pantalla.
- El menú toma sus elementos de `shiftAItems()` y del registro `allDefs()`: categorías, hojas, modelos del proyecto, importación y opción «Siempre dentro del seleccionado». No guarda otro catálogo.
- Las categorías muestran submenús a la derecha o, si no caben, a la izquierda. Se conserva el subgrupo de brushes sustractivos.
- Al escribir se buscan nodos de cualquier profundidad, ignorando mayúsculas y tildes; el resultado incluye la categoría a la que pertenece.
- Flechas Arriba/Abajo navegan; Derecha abre; Izquierda retrocede; Enter añade; Escape retrocede o cierra. Clic fuera cierra sin insertar.
- El destino de creación y el punto del mundo capturado al abrir se conservan; alternar «Siempre dentro» actualiza las acciones sin usar un parentId obsoleto.
- El menú especial de modo edición de malla conserva su ruta `openEditAddMenu()`.

## 2. Evidencia automatizada

`node --test scripts/test-db-contract.mjs` → **344 PASS, 0 FAIL, 0 TODO** (329 anteriores + 15 ADD).

`node --check` de `add-menu-model.js`, `commands.js` y tests → **PASS**.

`npm run build` → **NO VERIFICADO**: `vite: not found`, no están instaladas las dependencias de Vue/Vite en este entorno.

**Importante:** las pruebas nuevas verifican árbol, filtros, rutas, geometría numérica de apertura y contratos del componente. No equivalen a comprobar el menú en Vue/Electron; no atribuir QA visual aprobado.

## 3. QA del editor (pendiente en máquina local)

| ID | Paso | Resultado esperado |
|---|---|---|
| ADD-01 | Situar cursor sobre escena y pulsar Shift+A | Menú compacto junto al cursor, sin ventana grande |
| ADD-02 | Teclear `cubo` | Búsqueda directa; Enter añade una primitiva |
| ADD-03 | Teclear `cilindro tunel` | Encuentra «Cilindro (túnel)», sin tildes |
| ADD-04 | Entrar a Geometría → Primitivas → Hueco | Submenús anidados seleccionables |
| ADD-05 | Navegar sin ratón con ↑/↓/→/←/Enter/Esc | Navegación, creación y retroceso correctos |
| ADD-06 | Gameplay → Gameplay Object | Crea un Gameplay Object válido |
| ADD-07 | Gameplay → Event | Crea un evento válido |
| ADD-08 | Modelos del proyecto → modelo importado | Conserva `modelId` y permite colocarlo |
| ADD-09 | Abrir Shift+A junto a un borde de la ventana | Menú y submenús visibles, sin recortes |
| ADD-10 | Abrir cerca del lado derecho con una categoría | Submenú aparece a la izquierda cuando procede |
| ADD-11 | Añadir con escena vacía, y con un grupo seleccionado | Se conserva posición y parentado esperado |
| ADD-12 | Marcar «Siempre dentro del seleccionado» y añadir | Inserta como hijo, sin preferencia obsoleta |
| ADD-13 | Abrir desde barra superior y botón del árbol | Mismo menú, anclado al botón |
| ADD-14 | Abrir en edición de malla | Mantiene el menú de primitivas de edición y añade correctamente |
| ADD-15 | Cerrar por clic fuera o Escape | Sin crear objetos, sin cambiar selección |

## 4. Regresión y límites

Verificar que Shift+A no robe el atajo dentro de `input`, `textarea`, editores de código ni diálogos. La paleta Ctrl+K sigue siendo independiente. No modificar aquí Database, nodos, físicas, View Model, sistema UI, ni runtime de Player.

El Gate queda **implementado, pendiente de compilación y de QA visual local**. La aprobación del Gate previo `LF-UX-CMD-WINDOW-G001` fue expresada por el usuario; no hay evidencia técnica adicional de QA visual de ese Gate en este entorno.

# QA — LF-EDITOR-NODE-ICONS-S01-G001

**Fecha:** 2026-10-28  
**Estado:** IMPLEMENTADO / TEST AUTOMATIZADO PASS / QA LOCAL PENDIENTE.

## Evidencia ejecutada

| Validación | Resultado | Alcance |
|---|---|---|
| `node --test scripts/test-node-icons-s01-g001.mjs` | **15 PASS / 0 FAIL / 0 SKIP** | Definiciones, nombres, variantes físicas, primitiva, geometría, sprites, luces, audio, agua, integración UI |
| Regresión `node --test` sobre 107 archivos `test-*.mjs` (excluye test-starcat y test-clouds) | **2274 PASS / 0 FAIL / 19 SKIP** | Sprints anteriores y S01 |
| Chromium headless, SVG inline | **18/18 SVG con geometría no vacía** | Muestra representativa a 32 px en 24 × 24; no equivale a QA visual real en Electron |
| Comparación con último SOURCE_BASELINE | **PASS: 3 nuevos, 14 modificados, 0 eliminados** | 49 eventos protegidos idénticos byte a byte |
| `npm run build` / Electron / Player | **NO VERIFICADO** | Falta `node_modules` en el baseline recibido |

## QA local del usuario

1. Instalar CHANGE y abrir LevelForge con `npm run electron` tras compilar con `npm run build`.
2. En Scene Tree, crear `Node`, `Node3D`, `Mesh`, `StaticBody3D`, `RigidBody3D`, `CharacterBody3D` y `Area3D`; comprobar iconos diferentes y legibles a 14 px.
3. Crear BoxShape3D, SphereShape3D y CapsuleShape3D desde Añadir → Física; verificar tres símbolos distintos en el árbol, menú Añadir e Inspector.
4. Probar Sprite2D, Sprite3D y lienzos Pixel 2D/3D; confirmar distinción por dimensión.
5. Probar mallas Cubo, Rejilla, Círculo y Toro, luz puntual/direccional/rectangular, Camera Shake Base, Substract, Decal y Objeto interactuable.
6. Reducir el ancho del dock, expandir el árbol, filtrar, renombrar con F2 y arrastrar nodos. No deben variar la altura de fila, la selección ni la jerarquía.
7. Guardar/reabrir una escena y verificar que iconos se reconstruyen desde `type`/`kind`, sin agregar propiedades ni duplicar registros.
8. Comprobar que scripts, páginas de eventos, creación y ejecución de objetos, PlayMode y Player no registran regresiones.

**No marcar CERRADO hasta recibir QA local y aprobación del usuario.** S02 HUB y S03 Assets Browser continúan planificados.

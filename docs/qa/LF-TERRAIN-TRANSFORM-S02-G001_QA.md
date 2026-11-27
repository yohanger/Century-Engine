# LF-TERRAIN-TRANSFORM-S02-G001 — Contrato y QA

**Autorización literal recibida:** `Listo. LF-TERRAIN-TRANSFORM-S02-G001 autoriza comenzar`.

**SOURCE_BASELINE vinculante:** `LevelForge_TERRAIN_NODE_S01_G001_CORR_001_SOURCE_BASELINE.zip`. La entrega incrementa ese baseline; no modifica proyectos locales del usuario.

## Objetivo autorizado

Permitir trasladar una pieza Terrain en Y desde el Inspector y el gizmo con coherencia entre render, suelo, raycast, Jolt, vegetación, agua, hidrología, persistencia y exportación. El mapa de alturas sigue en espacio LOCAL. `oy` es la traslación mundial vertical, persistida por pieza, que vale 0 en escenas antiguas.

## Mecanismo aplicado

- `Terrain.setOffset(x,z,y)` conserva el contrato legado de dos argumentos; visual, foliage y posición mundial comparten `oy`.
- `groundAt` y `raycastW` incluyen `oy`; `heightAt(x,z)` permanece local. `heightAtAll`, `groundAtAll` y `rangeAll` proporcionan alturas mundiales.
- Jolt crea el cuerpo en `(ox, oy, oz)`, sin alterar la geometría local ni crear otro colisionador.
- `TerrainPanel.vue` expone X/Y/Z; el gizmo conserva translate y activa eje Y. Snap preserva los tres ejes.
- Serialización, instantáneas, Undo/Redo y deserialización preservan `oy`, con cero por defecto para datos legados.
- Foliage se traslada con el grupo; los elementos desprendidos y las consultas meteorológicas utilizan cotas mundiales. La rampa y Aplanar convierten su altura mundial al mapa local.
- El mapa de agua usa una consulta mundial cuando existe traslación, sin mover los cuerpos de agua. El exportador sigue fusionando piezas, horneando `oy` en las alturas del terreno consolidado; no crea un segundo mapa de alturas.
- Las piezas a distinta Y no se sueldan automáticamente. Una pieza añadida junto a otra hereda su elevación inicial.

**Fuera de alcance:** extender +X/-X/+Z/-Z (S03), eliminar `frameAll()` al redimensionar (S04), resolver `setPointerCapture` (Gate independiente), refactorizar Jolt, migrar mallas ajenas.

## Evidencia ejecutada en este entorno

- **17/17 TT2 Node PASS** y **31/31 S01 Node PASS**.
- Regresión focal ampliada: **617/622 PASS y 5 FAIL**. Los cinco fallos (tres tests `test-water-s03-corr001.mjs` por falta de `lfExcludeFromAO` en el doble de prueba, dos `test-weather-unification-s02-g001.mjs` por `stormCoverFromFrame` ausente en el doble de prueba) se reprodujeron también en el SOURCE_BASELINE anterior: **5 FAIL preexistentes**, no corregidos en este Gate.
- Fixture de Electron con Three.js/Terrain real, runner de Jolt WASM real y build **NO VERIFICADOS**: `node_modules` ausente; error `Cannot find package 'three'` y `vite: not found`. No hay evidencia de compilación, QA visual ni Player exportado en este entorno.
- **Prerequisitos no cerrados:** QA de S01 CORR-001 aún no aprobado explícitamente y error `setPointerCapture` pendiente. No se consideran superados por tests Node.

## QA local obligatorio

Desde la raíz de `LevelForge_TERRAIN_TRANSFORM_S02_G001_SOURCE_BASELINE`:

```bash
npm ci
node --test scripts/test-terrain-transform-s02-g001.mjs
node --test scripts/test-terrain-node-s01-corr001.mjs scripts/test-terrain-node-s01-g001.mjs
node --test scripts/test-terrain-transform-electron-s02-g001.mjs
node --test scripts/test-terrain-transform-jolt-s02-g001.mjs
npm run build
npm run electron
```

Resultados esperados: Node TT2 **17/17**; S01 **31/31**; Electron S02 **1/1 con 14 controles internos**, Jolt real **2/2**; build Editor y Player sin errores. No declarar PASS de resultados todavía no vistos.

### Pruebas manuales en Editor y Player

1. Crear una escena y Terreno desde Shift+A → Ambiente. Verificar que no aparece terreno fantasma en escenas vacías (S01) antes de aceptar S02.
2. Seleccionar Terreno y cambiar **Y: 0 → 5 → −3 → 0** desde Inspector. Comprobar la malla, plantas, pintura, vegetación y ausencia de reencuadre inesperado.
3. Repetir con la flecha verde del gizmo y Snap activo/inactivo. No debe perder el desplazamiento Y ni afectar X/Z.
4. Guardar, cerrar, volver a abrir; verificar Y, Undo/Redo y proyectos legados sin `oy`.
5. Crear dos piezas a distintas elevaciones; las costuras no deben modificar sus mapas de altura ni soldar automáticamente escalones.
6. En Play, recorrer, saltar y aterrizar sobre el terreno elevado y por debajo de cero. Verificar contacto Jolt sin suelo invisible y raycasts correctos.
7. Probar lluvia/charcos, agua física y vegetación; el terreno debe cambiar de cota sin arrastrar automáticamente el nivel de agua.
8. Exportar Player independiente y ejecutar la misma escena. Confirmar altura de colisión, superficie y vegetación.
9. Confirmar que no reaparece `this.footstep is not a function`; reportar separadamente `setPointerCapture` si ocurre.

## Estado y evidencia de cierre

IMPLEMENTADO / TEST NODE PASS (suite específica) / REGRESIÓN GLOBAL PARCIAL / ELECTRON NO VERIFICADO / JOLT REAL NO VERIFICADO / BUILD NO VERIFICADO / QA LOCAL PENDIENTE / **NO CERRADO**.

Para aceptar, adjuntar salidas de comandos, capturas con Y inicial y desplazado, prueba Play y evidencia de Player exportado. Registrar en ledger solo resultados efectivamente comprobados.

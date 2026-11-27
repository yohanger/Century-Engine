# QA — LF-LIQUID-ARCH-S05-G001

**Gate autorizado:** `LF-LIQUID-ARCH-S05-G001`. **Fecha:** 2026-10-30. **Estado:** IMPLEMENTADO; TEST AUTOMATIZADO PASS; COMPILADO NO VERIFICADO; QA LOCAL PENDIENTE; NO CERRADO.

## Verificación automática

- `node --test scripts/test-liquid-arch-s05-g001.mjs`: **24 PASS, 0 FAIL** (contrato S05).
- `node --test scripts/test-water-s01.mjs scripts/test-water-s02.mjs scripts/test-water-s03.mjs scripts/test-water-s03-corr001.mjs scripts/test-water-s04.mjs`: **77 PASS, 0 FAIL**, suites existentes sin alteración.
- **101 PASS, 0 FAIL**, en ambas baterías. Además, `test-render-pipe-s01.mjs` aporta 7 regresiones: **108 PASS, 0 FAIL, 0 SKIP** en la selección ampliada. Repetir desde extracción limpia del nuevo SOURCE_BASELINE.
- `node --check` de los módulos editados: **PASS**.
- `npm run build`: **NO VERIFICADO**, falla con `vite: not found` (no hay dependencias instaladas); Editor, Player y QA WebGL **NO VERIFICADOS**.
- `npm run docs:build`: **BLOQUEADO**, falta el paquete `marked`; la documentación fuente está actualizada pero no se ha regenerado el portal estático.

## QA local requerido al usuario

1. Comparar los archivos del CHANGE con los locales y conservar respaldo del ledger y de cualquier archivo modificado. Aplicar CHANGE solamente al SOURCE_BASELINE anterior correcto.
2. `npm ci`; ejecutar `npm run test:liquid-arch`, los cinco tests WATER, `npm run docs:build`, `npm run docs:check`, `npm run build` y `npm run electron`.
3. En una escena con agua física sobre Terrain, activar y desactivar lluvia; verificar que el agua aparece, fluye y no se duplica visualmente por gotas y anillos GPU.
4. Medir la diferencia de volumen antes/después de un aporte físico y verificar balance; en escenas de prueba con regiones finitas distintas, realizar una transferencia explícita mediante runner Node (API `transferVolume`) y comparar inventario, saldo externo y comprobante de origen/destino. La UI actual **no configura enlaces automáticos**; no declararlos implementados.
5. Probar salidas por límite abierto y drenajes superiores al volumen disponible; no debe quedar profundidad negativa.
6. Guardar/cargar snapshots anteriores v1 y los nuevos v2. Repetir tras transferencias confirmadas y pendientes, verificando que no haya duplicaciones al restaurar.
7. Abrir una escena anterior con lago/río/océano sin regiones físicas: la superficie debe seguir operando como antes. No confundir el agua consultable heredada con inventario finito.
8. Cambiar Terrain, probar Undo/Redo de edición y escenas; no debe duplicarse agua ni aparecer volumen no contabilizado.
9. Repetir Play y Stop, probar FilmMaker y Player exportado. Inspeccionar consola, WebGL y GLSL. Verificar PSX y PBR.
10. Medir FPS y ms/frame en el equipo N5030 de destino con 32×32 y 64×64 celdas, con y sin lluvia; no establecer umbrales arbitrarios sin línea base.

**Evidencia a devolver:** salidas Node, build y docs, capturas/captura de video del agua en Editor/Play/Player, comparación de volúmenes, datos de rendimiento, versión de plataforma y cualquier error. El test Node **no sustituye** la prueba física en Electron/Player.

## Riesgos y deuda técnica

- No se simulan recipientes ni interacción automática entre cuerpos; S06–S13 están planificados.
- Los intercambios preservan **masa**, no momento ni energía entre los dos solvers. La continuidad hidráulica natural de ríos y otras representaciones exige trabajo futuro.
- Historial e identificadores de transacción acotados a 256; fuera de esa ventana no hay promesa de idempotencia indefinida.
- Los tests de World con cuerpos heredados emplean stubs de imports de Three.js, y no comprueban shaders ni runtime Electron.

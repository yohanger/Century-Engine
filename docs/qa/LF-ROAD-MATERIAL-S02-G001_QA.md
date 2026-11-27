# QA · LF-ROAD-MATERIAL-S02-G001

**Estado del Gate: IMPLEMENTADO · PENDIENTE DE QA LOCAL Y APROBACIÓN.**

## Ejecutado

`node --test scripts/test-road-material-s01-g001.mjs scripts/test-road-material-s02-g001.mjs scripts/test-material-ux-s01-g001.mjs scripts/test-material-resource-g001.mjs scripts/test-editor-distribution-g001.mjs`

Resultado en el entorno de autoría: **98 PASS / 0 FAIL / 0 SKIP**. Nueva batería ROAD-S02-01..14: **14 PASS**. Se comprobaron contrato de datos, lectura de recursos, aislamiento de slots antiguos, UV métricas, materiales PBR por cuatro submallas, cambio sin regeneración, superficies compartidas, selección del Inspector y export Godot de valores PBR. Las pruebas de runtime usan dobles controlados de Three.js y no validan el shader GLSL con GPU.

## No ejecutado (no afirmar PASS)

- `npm ci` y `npm run build` Editor + Player en Linux/Windows: dependencias Vite y Three.js no disponibles aquí.
- Compilación real GLSL/MaterialShader con WebGL y carga asíncrona de mapas.
- QA gráfico y de ejecución de Electron/Player.
- Export GLB hacia Godot desde un proyecto real y equivalencia visual de shaders (fuera de alcance la última).

## Plan de aceptación local

1. Crear carretera: calzada debe mostrar **Blockout 1 m**; líneas conservan blanco/amarillo; probar recta, curva y cerrada.
2. Crear primitiva en mismo lugar: comparar cuadrícula métrica, no deben estirarse las casillas al doblar carretera.
3. Carretera antigua sin `slot.mat`: permanece color/textura antigua tras cargar/guardar; comprobar con `look: realista`.
4. Para cada slot: asignar `.material` desde Assets; editar shader y parámetros en el Inspector del recurso; comprobar actualización inmediata en todos los consumidores.
5. Probar **Crear .material** y **Hacer local** con el mismo recurso compartido entre dos carreteras y una primitiva.
6. Cambiar imagen, repetición, color, tinte y rugosidad; comprobar la conservación de UV, render y sombras.
7. Eliminar o desasignar recurso y comprobar diagnóstico/valores locales en la carretera; validar escenas y prefabs relacionados.
8. Probar carretera siguiendo terreno, aceras y marcas: no perder geometría ni colisiones.
9. Guardar y reabrir `.lfproj`; verificar persistencia de materialId y mat por slot y respuesta del Player.
10. Ejecutar `npm run build`, `npm run electron`, `npm run dist:linux`, `npm run dist:win` donde correspondan, con registros de PASS reales.

**No cerrar** hasta aprobación expresa del usuario tras QA gráfico y compilación. La pintura por capas no pertenece a este Gate.

# LF-VFX-S02-G002 — Informe QA

**Autorización:** exacta recibida el 2026-10-28. **Estado:** IMPLEMENTADO, TEST AUTOMATIZADO PARCIAL PASS; COMPILACIÓN y QA LOCAL NO VERIFICADOS; CERRADO: NO.

## Evidencia ejecutada

- `node --test scripts/test-vfx-node-s02-g002.mjs`: **10/10 PASS**. Validador real, buildList real, callbacks reales de Node Registry ejecutados mediante harness de Three.js simulado; simulación CPU real. No equivale a render GPU.
- `node --test scripts/test-vfx-simulation-s02-g001.mjs`: **13/13 PASS**.
- `node --test scripts/test-project-safe.mjs scripts/test-resource-history-corr-g001.mjs`: **27/27 PASS**.
- Total ejecutado en este Gate: **50/50 PASS; 0 fallos**, sin incluir pruebas de JSZip/GPU/Vite no ejecutables aquí.
- `node --check` sobre los archivos JS modificados: sin errores de sintaxis.
- `scripts/fixtures/vfx/s02/player-vfx-fixture.levelgame`: comprobación CRC ZIP PASS. Contiene definición única, dos escenas y textura procedimental PNG.

## Pruebas necesarias en el equipo usuario

Desde `~/ENGINES/lf-0.26.13/lf` tras conciliar cambios locales y extraer CHANGE:

```bash
node --test scripts/test-vfx-node-s02-g002.mjs scripts/test-vfx-simulation-s02-g001.mjs scripts/test-project-safe.mjs scripts/test-resource-history-corr-g001.mjs
node --test scripts/test-vfx-player-s02-g002.mjs
node --test scripts/test-vfx-webgl-s02-g001.mjs
node --test scripts/test-vfx-resource-s01-g001.mjs scripts/test-vfx-assets-s01-g002.mjs
npm run build
npm run electron
```

El harness WebGL requiere Chromium, Vite y GPU WebGL accesible. **No atribuir PASS sin evidencia de su ejecución.**

## QA visual e integración S02 (pendiente)

1. Crear un proyecto de prueba y un recurso VFX desde Assets, crear dos nodos VFX3D desde Añadir, asignar el mismo recurso a ambos en Inspector. Confirmar sus iconos y jerarquía, Transform y orden de parenting.
2. En modo Edit las partículas no avanzan. Al pulsar Play aparecen partículas en ambos nodos. Cambiar activación pausa solo la instancia seleccionada, modificar semilla reinicia solo esa. La guía editorial no debe verse en Play ni Player.
3. Con VFX local, mover/rotar/escalar el padre: la simulación sigue al Transform. Con VFX world, partículas emitidas antes de mover el padre conservan coordenadas en mundo. Probar con ambas cámaras y PSX.
4. Asignar textura válida, eliminar su referencia y ejecutar Play/Build: el sistema debe diagnosticar recurso faltante; no fingir fallback. Restaurar textura y repetir. Probar carga tardía, eliminar nodo antes de completarse y comprobar que no reaparece ni fugan GPU.
5. Guardar, cerrar y reabrir proyecto de prueba; cambiar escena y regresar; las referencias continúan, no quedan partículas de la anterior. Destruir/reconstruir nodos, parar Play y repetir para detectar residuos.
6. Build Player con dos escenas y al menos un VFX por escena, y jugar el paquete exportado. Confirmar textura, transparencia y que no hay trazas de editor. Exportar esa escena a Godot debe fallar de manera explícita.
7. Confirmar que las escenas antiguas sin VFX abren/guardan correctamente y Event Order Flow no presenta regresiones.

## Limitación explícita

No hubo módulos `three`, `jszip` ni Vite utilizables para ejecutar el renderer WebGL, el lector ZIP Player o `npm run build` en este entorno. No se certifica tamaño de FPS, latencia, leaks GPU, PSX ni aspecto final. El usuario realiza QA local y proporciona logs/capturas.

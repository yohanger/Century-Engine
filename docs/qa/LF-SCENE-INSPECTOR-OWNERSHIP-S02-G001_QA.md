# QA — LF-SCENE-INSPECTOR-OWNERSHIP-S02-G001

**Estado:** IMPLEMENTADO; Node PASS; Electron y build no verificados en este entorno; QA local pendiente; NO CERRADO.

## Pruebas ejecutables

```bash
node --test scripts/test-scene-inspector-ownership-s02-g001.mjs
node --test scripts/test-scene-inspector-s01-g001.mjs scripts/test-scene-fade-transitions-s01-g001.mjs
node --test scripts/test-scene-inspector-ownership-electron-s02-g001.mjs
npm run build
npm run electron
```

Electron usa exclusivamente el runner del proyecto `qa-electron-webgl-runner.mjs` y Electron embebido. Fixture: `scripts/fixtures/editor/scene-inspector-ownership-s02-g001.html`; incluye Vue real, `ColorInput` registrado como en `main.js`, proyecto creado con `createProjectData`, cambios reactivos de clima/ciclo, 260px y WebGL real. No presupone PASS hasta ejecutarlo.

## QA de usuario (Editor)

1. Abrir **Inspector de Escena**, observar tres bloques claros y sin duplicar Bake.
2. Seleccionar escena con GameManager y transiciones, editar valores; Undo/Redo y persistencia sin cambios.
3. Clima OFF: nubes manuales visibles y ajustables. Activar nubes, modificar cobertura; conservar valor.
4. Clima ON con presets despejado, lluvia y tormenta: indicador de World; nubes y niebla muestran autoridad; no aparece segundo control de clima.
5. Clima OFF de nuevo: cobertura manual anterior sigue almacenada, sin duplicados.
6. Con clima OFF y ciclo día/noche ON, el indicador de niebla reconoce el ciclo. Cambiar Manual/Ciclo y verificar luz solar seleccionada.
7. Verificar que «Restablecer clima y atmósfera» **continúa reseteando** parámetros de nubes y niebla heredados; **no se promete** reset limitado únicamente a weather.
8. Guardar/reabrir varias escenas con entornos diferentes; comprobar independencia por escena.
9. Revisar panel 260px, Editor 1024×600 y 1366×768: sin scroll horizontal ni pérdida de controles.
10. Validar Play y Player con cielo, lluvia, nubes, niebla, bake, transición de escena y retorno a edición.

## Evidencia a devolver

- `node --test` con resumen y fallos (si los hay).
- `node --test scripts/test-scene-inspector-ownership-electron-s02-g001.mjs`.
- `npm run build` y `npm run electron`.
- Capturas de Inspector con clima ON y OFF, y una escena con ciclo día/noche.
- Confirmación de guardado/reapertura y Play/Player.

No declarar QA LOCAL PASS ni cierre sin esta evidencia y aprobación expresa.

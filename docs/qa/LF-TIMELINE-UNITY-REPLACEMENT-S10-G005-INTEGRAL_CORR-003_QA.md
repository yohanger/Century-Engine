# QA local — LF-TIMELINE-UNITY-REPLACEMENT-S10-G005-INTEGRAL_CORR-003

**Estado:** IMPLEMENTADO EN FUENTES / NODE PASS / QA LOCAL PENDIENTE / NO CERRADO.

## Punto de entrada

SOURCE_BASELINE aprobado para comenzar CORR-003: `LF_TIMELINE_UNITY_REPLACEMENT_S10_G005_INTEGRAL_CORR002_SOURCE_BASELINE.zip`. Comparar y respaldar los archivos afectados antes de extraer CHANGE en la carpeta original de LevelForge (la que contiene `package.json`). No sobreescribir cambios locales sin comparación. Si hay diferencias locales no conciliadas, extraer el nuevo SOURCE_BASELINE de CORR-003 en una carpeta separada para probarlo.

Mantener intactos proyectos, escenas, `.lfproj`, recursos, `node_modules`, builds, cachés, Cinematics, FilmMaker y Player. Conservar el baseline de CORR-002 para reversión.

## Comandos, desde la raíz del proyecto de QA

```bash
npm ci
node --test scripts/test-timeline-unity-replacement-s10-g005-corr003.mjs
npm run electron -- --build
```

**Esperado con dependencias instaladas:** 12 PASS, 0 FAIL en CORR-003. Si falta `@vue/compiler-sfc`: 11 PASS y 1 SKIP, **no equivale a compilación verificada**. Ejecutar después la regresión S04–S10 de los tests incluidos, sin cambiar dependencias ni actualizar paquetes especulativamente.

## Casos de prueba local (Electron embebido)

1. Abrir la Timeline de prueba (4 pistas). Confirmar que existe **un único `]` amarillo** con trazo vertical continuo desde arriba de la regla hasta el límite inferior del área visible de tiempo, incluidos espacios vacíos; los dos remates deben estar conectados al mismo borde.
2. Añadir pistas hasta provocar scroll vertical. Desplazarse arriba/abajo y comprobar que el `]` mantiene el trazo continuo, con remates visibles en el área útil, mientras las cabeceras permanecen alineadas.
3. Reducir/ampliar el panel, desacoplar/acoplar, abrir/cerrar Curvas y reducir la altura del dock. Confirmar que el `]` adapta su altura sin cortarse y acaba antes de la barra de scroll horizontal.
4. Desplazarse horizontalmente con el scroll inferior y la rueda sobre la columna fija; el `]` debe seguir exactamente al tiempo `timeline.duration` en la regla, sin invadir cabeceras ni desplazarse de forma independiente.
5. Cambiar zoom y duración, probar Snap, arrastre del borde `]` y flechas del teclado. Inspeccionar las opciones/Inspector: la duración total cambia con el mismo mínimo temporal y un único Undo/Redo. Guardar, cerrar y reabrir.
6. Probar selección múltiple de claves, arrastre/resize de clips y sus asas, grupos, marcadores y scroll en panel estrecho; el corchete solo debe capturar puntero en su borde, no en toda la gráfica.
7. Reproducir en Editor y Player la Timeline guardada; no deben existir cambios en el evaluador, clips o Player. Verificar que el estado de Comandos/Naturaleza/Métodos permanece sin duración individual nueva.

**Evidencia requerida:** salida de Node y Electron, capturas de `]` en dock normal y estrecho, vídeo corto de scroll vertical/horizontal y redimensionado, resultado de guardado/reapertura y Player. Declarar PASS/FAIL por caso. No interpretar compilación como QA visual; no cerrar sin aprobación expresa.

## Evidencia de desarrollo

`docs/qa/evidence/LF_S10_G005_CORR003_NODE_FOCUS.log`, `...NODE_REGRESSION.log` y `...NPM_OFFLINE_BLOCKED.log`. Sin pruebas de GUI en el entorno de construcción.

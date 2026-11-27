# LF-TERRAIN-TRANSFORM-S02-G001_CORR-001 — Shift/Snap del terreno

**Autorización recibida:** `Listo. LF-TERRAIN-TRANSFORM-S02-G001_CORR-001 autoriza comenzar`.

**SOURCE_BASELINE vinculante:** `LevelForge_TERRAIN_EXTENTS_S03_G001_CORR_001_SOURCE_BASELINE.zip` (integración Terrain S01–S03 y previsualización S03 CORR-001 preservadas).

## Diagnóstico / evidencia

**OBSERVADO:** al mover el terreno, Shift no anulaba el ajuste a cuadrícula ni el imán entre piezas. `src/core/editor/gizmo.js` aplicaba `settings.snap` y `_snapPiece()` incondicionalmente, sin invocar el ciclo por gesto de los nodos normales.

**CAUSA RAÍZ:** Terrain no llamaba a `_beginSnapDrag`, `_applySnapDrag`, `_endSnapDrag`, y no condicionaba el imán a `_shiftSnapHeld`. El teclado ya controlaba `_setSnapShiftHeld`, por lo que no requiere otro listener de teclado ni un nuevo sistema Snap.

## Corrección S02 CORR-001

- Conecta `tcTer` a los tres métodos de Snap existentes en Object Mode; el addon calcula el movimiento bruto y el gestor compartido cuantiza con `snapEnabled(settings, 'translate')` / `snapStep`.
- Shift temporalmente omite **tanto la rejilla como el imán** entre piezas. Las transiciones activado/libre mantienen anclas de la posición visible, sin saltos por pulsar o soltar Shift sin mover el ratón.
- El movimiento X/Y/Z y la posición `oy` de S02 se conservan. La distancia del imán de Terrain no se modifica.
- Durante el gesto no cambia ninguna preferencia persistente de Snap. Tras el mouseUp se restituye la cuantización normal del addon.
- El mouseUp produce **una única operación** de historial si la pieza realmente se desplazó. Un clic inmóvil no crea una transacción.
- Al ocultarse el gizmo se libera el estado de Snap Terrain. El ciclo de Shift del editor existente mantiene keyup, blur y visibilitychange.

No se modificaron la malla, la física Jolt, las alturas, el tamaño rectangular, los cuatro bordes, su previsualización temporal ni el Player.

## Evidencia automatizada

- **TSS-01..12: 12/12 PASS**. Prueba la implementación real de `gizmoMethods`, con un adaptador de Vector3/Quaternion sin `node_modules`, para Shift inicial, durante gesto, Snap por configuración, tres ejes, imán, posición continua y ruta de Undo.
- Regresión focal **140/140 PASS**: S01/S02/S03, Snap de objetos, Snap de Edit Mode y cámara del editor.
- Regresión ampliada de 45 ficheros: **831/840 PASS, 8 FAIL, 1 SKIP**. Los fallos corresponden a una aserción textual antigua de Node Icons / SceneTree (ambos archivos sin modificaciones), dos runners Jolt que no arrancan sin dependencias, tres fixtures históricas de agua y dos de meteorología, todos ajenos a este Gate. No declarar suite ampliada PASS.
- Runner y fixture `scripts/test-terrain-transform-shift-snap-electron-s02-corr001.mjs` preparados con Three.js y TransformControls reales; **NO VERIFICADO** porque no están instaladas las dependencias de Vite/Electron. Verifica 14 comprobaciones internas.
- **BUILD NO VERIFICADO:** intento local de `npm run build` termina `vite: not found`.
- **QA nativo Shift/pointer lock y Editor/Player:** NO VERIFICADO.

## QA local obligatorio

En una carpeta **nueva** que contenga el SOURCE_BASELINE de este correctivo, ejecutar:

```bash
npm ci
node --test scripts/test-terrain-transform-shift-snap-s02-corr001.mjs
node --test scripts/test-editor-snap-shift-g001.mjs
node --test scripts/test-editor-editmode-shift-snap-corr-g001.mjs
node --test scripts/test-terrain-transform-shift-snap-electron-s02-corr001.mjs
npm run build
npm run electron
```

**Esperado:** TSS 12/12, otros tests PASS, Electron 1/1 con 14 verificaciones, build Editor/Player sin errores.

En Electron comprobar una escena con Terrain y, si es posible, una segunda pieza para el imán:

1. Activar **Snap** de movimiento, ajustar paso de rejilla a 1 m, mover Terrain X/Y/Z sin Shift: debe seguir la rejilla.
2. Mantener Shift antes de iniciar el arrastre: movimiento libre en los tres ejes, incluso cerca de los bordes de otra pieza.
3. Iniciar arrastre con Snap, presionar Shift mientras el ratón sigue presionado y continuar: no debe haber salto instantáneo. Soltar Shift y seguir moviendo; recupera Snap sin salto inicial.
4. Desactivar el Snap desde la configuración y comprobar que el movimiento de Terrain es libre incluso si la opción heredada `snap` estuviera activa.
5. Con Shift suelto probar el imán de bordes; con Shift sostenido no debe actuar.
6. Mover una pieza una vez, hacer Undo/Redo. Un clic sin movimiento no debe generar historia.
7. Confirmar que el movimiento de piezas no interfiere con los cuatro tiradores de S03 ni con el guardado/recarga de la posición Y.
8. Verificar funcionamiento en Player tras la exportación: las posiciones confirmadas permanecen coherentes con Jolt (no se cambió código de Player).

Enviar salida Node/Electron/build, vídeo o capturas de los tres momentos del mismo arrastre (Snap/Shift/Snap) y resultado de Undo/Redo. Si aparece `setPointerCapture`, registrar por separado: **sigue pendiente en Gate independiente**.

## Estado contractual

**IMPLEMENTADO · 12/12 NUEVAS PASS · 140/140 REGRESIÓN FOCAL PASS · REGRESIÓN AMPLIADA PARCIAL · BUILD/ELECTRON/QA LOCAL NO VERIFICADOS · NO CERRADO**.

S03 CORR-001 conserva su estado previo de QA visual pendiente; esta reparación no autoriza S04 ni altera su alcance.

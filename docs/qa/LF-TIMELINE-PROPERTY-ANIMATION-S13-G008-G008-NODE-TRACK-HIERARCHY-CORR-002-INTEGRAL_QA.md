# QA — LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-NODE-TRACK-HIERARCHY-CORR-002-INTEGRAL

Fecha: 2026-11-10. **NO CERRADO · TEST AUTOMATIZADO SELECCIONADO PASS · BUILD/ELECTRON/PLAYER NO VERIFICADOS.**

## Antes de aplicar CHANGE

Comparar archivos afectados con cambios locales posteriores a SOURCE_BASELINE CORR-001 y respaldar; no sobrescribir cambios sin comparar. Directorio destino: raíz de LevelForge con `package.json`. CHANGE se extrae ahí; SOURCE_BASELINE se conserva como respaldo acumulativo, no se usa para sobrescribir una instalación activa. No tocar Assets, escenas, `.ui`, scripts del usuario, `node_modules` ni backups. No borrar el baseline anterior antes de QA.

## Pruebas Node (ejecutadas en esta entrega)

```bash
node --test scripts/test-timeline-property-animation-s13-g008-g008-node-hierarchy-corr002.mjs
```

Esperado: **32 PASS**.

```bash
node --test scripts/test-timeline-property-animation-s13-g008-g006.mjs scripts/test-timeline-property-animation-s13-g008-g007.mjs scripts/test-timeline-temporal-geometry-s13-g008-g002.mjs scripts/test-timeline-property-animation-s13-g008-g008.mjs scripts/test-timeline-property-animation-s13-g008-g008-universal-corr001.mjs scripts/test-timeline-property-animation-s13-g008-g008-node-hierarchy-corr002.mjs scripts/test-timeline-hierarchy-dnd-s04-g001.mjs
```

Esperado: **157 PASS, 0 FAIL**.

## Tests dependientes de npm en equipo local (NO EJECUTADOS aquí)

```bash
node --test scripts/test-timeline-property-animation-s13-g008-g008-node-hierarchy-corr002-electron.mjs
node --test scripts/test-timeline-camera-node-binding-s11-g002.mjs
npm run build
npm run electron
```

Esperado: **24 checks Electron**; Camera Binding sin FAIL; Editor y Player compilan ambos; QA visual en Electron embebido. Esta es la expectativa de QA, no evidencia ya comprobada.

## Matriz de integración por escenario

| ID | Escenario | Resultado requerido |
|---|---|---|
| NH-01 | Arrastrar Camera3D desde Jerarquía | Un solo encabezado Camera3D, fila hija Toma de cámara |
| NH-02 | Pulsar llave Posición de esa cámara | Posición se incorpora BAJO el encabezado existente |
| NH-03 | Añadir Rotación/Escala | Mismo encabezado y pistas independientes |
| NH-04 | Arrastrar otra vez la misma cámara | No crea un segundo nodo ni pista idéntica |
| NH-05 | Dos nodos con igual nombre | Se distinguen mediante ID, sin mezclar claves |
| NH-06 | Renombrar Camera3D | El encabezado refleja nombre actual, las pistas conservan ID |
| NH-07 | Contraer/expandir nodo | Solo oculta/restaura filas en ambas columnas |
| NH-08 | Eliminar una propiedad | Mantiene las restantes y su propietario |
| NH-09 | Eliminar última pista | Desaparece encabezado vacío sin dejar datos |
| NH-10 | Undo/Redo | Pistas y claves coherentes, sin claves fantasmas |
| NH-11 | Guardar/reabrir | Mismos IDs, grupos, claves, clips y datos de escena |
| NH-12 | Cámara con una sola fuente | Toma asociada inequívocamente al nodo |
| NH-13 | Cámara con varias fuentes | Toma global fuera del nodo; las propiedades siguen bajo sus nodos |
| NH-14 | Dos escenas | Asociaciones por escena+ID, sin reclamar nodos de otra escena |
| NH-15 | Grupos editoriales | Permanecen intactos; conflicto entre grupos se muestra y bloquea nueva autoría |
| NH-16 | Audio, clips, métodos, FilmMaker | Ninguna pista ajena altera evaluación, ni pierde datos |
| NH-17 | Encabezado del nodo → Inspector | Primer clic recupera propiedades incluso si era el mismo nodo |
| NH-18 | Editor/Player | La evaluación de pistas reales no cambia; Player no depende de encabezados |
| NH-19 | Scroll/zoom/marquee | Filas del encabezado y carril alineadas, selección rectangular exacta |
| NH-20 | Rendimiento | No se ejecuta derivación de filas por frame, sin segundo gestor |

## Anomalías históricas que NO deben encubrirse

- `scripts/test-timeline-unity-replacement-s10-g004-integral.mjs`: G004-29 busca un texto literal inexistente ya en el baseline anterior. Su FAIL no se atribuye a este cambio, pero sigue **NO RESUELTO**.
- `scripts/test-timeline-ux-integration-s04-g004.mjs`: extracción textual obsoleta de `setZoom` en código antiguo; requiere reparación de harness en otro Gate autorizado, no dentro de esta corrección de jerarquía.
- No ejecutar `npm audit fix --force` como parte de QA: cambiar dependencias sin su Gate introduciría riesgo adicional.

## Evidencia requerida del usuario

Enviar salidas de los tres tests Node/Electron/cámara, `npm run build`, descripción o vídeo breve de Camera3D arrastrada y llaves Posición/Rotación bajo un solo encabezado, y evidencia de colapso, Undo/Redo, dos cámaras distintas y una pista global multicámara. Indicar explícitamente si el Inspector y scroll/zoom se comportan como antes.

**Cierre solo con QA LOCAL PASS y aprobación explícita**. Compilar no sustituye QA visual. UA-CA-001 y TB01 siguen vinculantes, G007 raw `object3D` permanece NO VERIFICADO.

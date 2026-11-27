# QA — LF-TIMELINE-UNITY-REPLACEMENT-S10-G002-INTEGRAL

**Estatus actual (posterior): CERRADO Y APROBADO POR EL USUARIO el 2026-11-06.** La compilación y pruebas detalladas de Player no tienen nuevos logs adjuntos; el estado de verificación técnica original se conserva abajo.

## Evidencia automatizada

- Suite específica de G002: `scripts/test-timeline-unity-replacement-s10-g002-integral.mjs`: **24 PASS / 1 SKIP / 0 FAIL**. El SKIP es comprobación de compilador Vue ausente en este entorno.
- Regresión final S04/S07/S08/S09/S10: **141 PASS / 6 SKIP / 0 FAIL**, repetida después del último ajuste del arrastre de segmentos.
- `node --check` en scripts extraídos de componentes y modelos: PASS.
- Intento `npm ci --offline`: **FALLÓ** (`zip-stream@4.1.1`, paquete no disponible en caché); **Vite, Electron, QA visual, guardado local y Player NO VERIFICADOS** aquí.

Logs preservados en `docs/qa/evidence/LF-TIMELINE-UNITY-REPLACEMENT-S10-G002-INTEGRAL/`.

## Procedimiento local

Desde la raíz del proyecto que contiene `package.json`, partiendo del SOURCE_BASELINE G001 CLOSURE ya aprobado o del nuevo G002 en **carpeta independiente**:

```bash
npm ci
node --test scripts/test-timeline-unity-replacement-s10-g002-integral.mjs
node --test scripts/test-timeline-unity-replacement-s10-g001-corr001.mjs scripts/test-timeline-pro-ux-s07-g001-integral.mjs scripts/test-timeline-advanced-direction-s09-g001-integral.mjs
npm run electron -- --build
```

`npm ci` es necesario solamente si las dependencias locales aún no están instaladas. Si se trabaja sobre el directorio existente, comparar archivos de CHANGE con modificaciones locales y respaldar antes de extraer; no reemplazar `node_modules`, proyectos, assets ni escenas de usuario.

### QA visual en Electron

1. Abrir una Timeline existente con pista de nodo, cámara y comandos; comprobar que las cabeceras siguen fijas durante scroll horizontal y vertical (**regresión de G001**).
2. Seleccionar dos claves con **Ctrl+clic** (o Cmd+clic) en distintas pistas. Deben permanecer ambas marcadas. Ctrl+clic sobre una de ellas debe quitarla de la selección.
3. Seleccionar una clave y extender la selección dentro de la misma pista con **Mayús+clic**. Usar **Mayús+arrastrar** desde un área vacía del carril para hacer selección rectangular sobre varias pistas; comprobar la cantidad mostrada.
4. Arrastrar una clave seleccionada y verificar que **todas las seleccionadas se mueven conservando distancias temporales**, sin traspasar 0 ni la duración de la Timeline. Cancelar un arrastre y comprobar que se restauran las posiciones anteriores.
5. Probar Snap activado: acercar claves al cabezal, a otra clave y al final de la Timeline; variar zoom. Desactivar Snap (Libre) y comprobar que no cuantiza los tiempos.
6. Seleccionar un segmento azul de animación. Arrastrar su cuerpo: se trasladan las claves límite sin variar la duración del segmento. Arrastrar el asa existente: se ajusta la duración mediante su mecanismo anterior.
7. Con varias claves seleccionadas, comprobar que **Inspector** muestra cantidad, pistas y tiempo mínimo/máximo. Introducir un desplazamiento numérico y verificar el grupo.
8. Usar `Ctrl+D` para duplicar y Supr para eliminar. Probar `Ctrl+Z` para deshacer y `Ctrl+Shift+Z` o `Ctrl+Y` para rehacer. Verificar que otras pistas no pierden datos.
9. Guardar, cerrar y reabrir la misma Timeline y el proyecto `.lfproj`. Comprobar que claves, pistas, comandos y duraciones persisten, pero no quedan seleccionados artificialmente.
10. Revisar el preview de nodo y cámara y Play/Player con una escena de prueba. La Timeline no debe ejecutar comandos de gameplay durante scrubbing.
11. Comprobar panel acoplado, desacoplado y estrecho, en particular el selector rectangular y los controles de selección.

**Evidencia a devolver:** resultado completo de Node, resultado del build, capturas del Inspector y la selección múltiple, vídeo corto de arrastre colectivo/segmento si es posible, y resultado de Undo/Redo, guardado y Play/Player. Si falla, aportar el **primer error rojo** de DevTools y la operación que lo produjo.

## Criterio de aprobación

La QA local debe demostrar selección múltiple, desplazamiento conjunto, duplicación/eliminación y persistencia en Electron, sin regresiones de S09 ni G001. Compilar NO equivale a aprobar. Estado inicial de entrega: **PENDIENTE, NO CERRADO**. Estado posterior: **APROBADO / CERRADO**, según la declaración expresa del usuario; ver documento de cierre.

## Cierre posterior (2026-11-06)

El usuario respondió «Aprobado. SIgamos.» después de recibir el Gate G002. Se registra como **APROBADO POR EL USUARIO y CERRADO**. No se han recibido nuevos logs de Vite/Electron, Player o persistencia; no se inventan verificaciones específicas. El siguiente Gate G003 exige declaración y autorización propias.

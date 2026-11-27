# QA local — S10-G005 CORR-002

**Estado:** Node seleccionadas 245 PASS / 11 SKIP / 0 FAIL; compilación Vue/Vite/Electron NO VERIFICADA; QA LOCAL PENDIENTE. Comandos/Naturaleza/Métodos sin `duration` propia permanecen BLOQUEADOS por G003 y NO IMPLEMENTADOS como intervalos.

## Preparación

Utilizar el SOURCE_BASELINE de la corrección sobre una carpeta independiente o aplicar CHANGE sobre G005 CORR001 **solo tras comparar y respaldar cambios locales**. La raíz contiene `package.json`.

```bash
npm ci
node --test scripts/test-timeline-unity-replacement-s10-g005-corr002.mjs
node --test scripts/test-timeline-unity-replacement-s10-g005-corr001.mjs
npm run electron -- --build
```

**Salida esperada:** suite CORR002 13 PASS, 0 FAIL con Vue instalado; sin Vue: 12 PASS, 1 SKIP. Suite CORR001 actualizada 12 PASS con Vue o 11 PASS y 1 SKIP. El resto de pruebas seleccionadas se registra en `docs/qa/evidence/LF_S10_G005_CORR002_NODE_REGRESSION.log`. `npm ci --offline` falló con ENOTCACHED `zip-stream@4.1.1`; no cambiar dependencias para esconder el error.

## Pruebas de interacción en Electron

1. Abrir Timeline en dock estrecho (aprox. 320–400 px) y amplio. Confirmar que la toolbar conserva `overflow-x`, la columna de nombres está fija y la guía amarilla se alinea con el asa final `]` en la regla, incluso con zoom y scroll horizontal.
2. Arrastrar el asa `]` y usar flechas izquierda/derecha. Confirmar que cambia `timeline.duration`, no `ph`, hasta el mínimo permitido por el último contenido, incluyendo el final de un Audio con duración fija. Comparar con el campo Duración de opciones/Inspector. Guardar y reabrir.
3. Crear una pista Audio, clave `play` en el segundo 2 con `duration=0` en Inspector. **Clic sin arrastre:** debe permanecer 0; arrastrar asa derecha para convertir a 1–3 s, observar duración en Inspector; repetir con Snap. Verificar Undo/Redo y guardar/reabrir. Con `Home` sobre asa: volver a 0 (archivo completo). Audio `stop` no debe ofrecer asa de duración. Verificar no mover la clave `t` durante el ajuste.
4. Bloquear la pista Audio: no debe permitir redimensionar. Comprobar que cámara/nodo y clips G003 siguen con sus propias asas. Probar con reproducción y Player local antes de aprobar.
5. Inspector de una clave de cámara/nodo: comprobar etiquetas originales inglesas de Ease/Interpolation sin cambios de ID, funcionamiento de `Bezier`, persistencia y evaluación de curvas.
6. Comandos, Naturaleza y Métodos: verificar que siguen ejecutándose en su instante `t`, que el ancho estético no simula duración y que no hay cambios de semántica. **Su ampliación independiente no está entregada en esta corrección; requiere decisión contractual.**
7. Comprobar selección múltiple, Mix/Ripple/Replace, marcadores, curvas responsive, cabeceras fijas, grabado/reapertura y Player. Adjuntar capturas y vídeo del arrastre de Audio y del asa `]`.

**Cierre:** solo con aprobación del usuario y evidencia; compilación PASS no equivale a QA visual. No avanzar G006 mientras G005 siga con un bloqueo de alcance relevante.

# QA — LF-TIMELINE-UNITY-REPLACEMENT-S10-G003-INTEGRAL

**Estado posterior a aprobación:** IMPLEMENTADO EN FUENTES · AUTOMATIZADO PASS PARCIAL · APROBADO POR EL USUARIO (2026-11-06) · GATE CERRADO DOCUMENTALMENTE. Compilación Electron, Player visual y persistencia individual siguen NO VERIFICADOS con la evidencia disponible.

## Evidencia ejecutada

- Suite nueva `scripts/test-timeline-unity-replacement-s10-g003-integral.mjs`: **29 PASS, 1 SKIP, 0 FAIL**, incluidos evaluadores numéricos/cámara Mix reales, Ripple/Replace transaccionales, reproducción directa de Player con seek, protección de fuentes y normalización de datos existentes.
- Regresión S04/S07/S08/S09/S10 (14 suites): **170 PASS, 7 SKIP, 0 FAIL**. Los SKIP son pruebas que precisan compilador Vue u otras dependencias de UI que no existen en este contenedor.
- Evidencia textual: `docs/qa/evidence/LF-TIMELINE-UNITY-REPLACEMENT-S10-G003-INTEGRAL/node-regression-20261106.log`.
- **NO VERIFICADO:** Vite/compilación Electron, Player 3D real, guardado y reapertura en proyecto `.lfproj`, QA visual, rendimiento, audio de gameplay. Sin `node_modules` completos; no se inventa compilación.
- Las pruebas históricas que asumían `evalNode`/`evalCamera` directos se ajustaron para exigir los wrappers `evalTimelineNode`/`evalTimelineCamera` al activar el modelo de clips; no se eliminó la validación de formatos heredados.

## Instalación local

Usar el SOURCE_BASELINE **de cierre G002**. Si se ha cambiado localmente, **comparar y respaldar** cada archivo del CHANGE antes de reemplazar. Los cambios de FilmMaker son ajenos a este Gate.

En la raíz existente del proyecto (carpeta con `package.json`):

```bash
node --test scripts/test-timeline-unity-replacement-s10-g003-integral.mjs
npm run electron -- --build
```

Si faltan dependencias, ejecutar `npm ci` previamente (requiere red). Con Vue instalado, la suite específica debería mostrar **30 PASS y 0 FAIL**.

## QA local requerido

1. Abrir una Timeline existente de G002 con claves de cámara/nodo; guardar copia del proyecto antes de editar. Comprobar primero el modo heredado (sin clips) y la permanencia de sus recursos.
2. En pista de `Posición`, colocar al menos cuatro claves, seleccionar un tramo y usar **+ Clip**. Confirmar que el clip hace referencia a las dos claves por ID y que no aparece otra animación duplicada en el tiempo fuente una vez movido.
3. Crear otro clip y seleccionar **Mix**. Solapar dos clips, reproducir en Editor, mover cabezal al solapamiento y observar transición continua. Probar el modo Cámara, incluida interpolación de FOV. Intentar un tercer clip simultáneo; debe impedirlo sin mutación parcial.
4. Seleccionar **Ripple**. Desplazar un clip temprano, comprobar que se mueven los posteriores de la misma pista manteniendo distancias relativas; mover fuera de duración y confirmar rechazo/rollback.
5. Seleccionar **Replace**. Colocar un clip en medio de otro, comprobar que se crean los fragmentos de origen correctos y que el tramo restante conserva su referencia. Recortar y ampliar hasta su límite fuente.
6. Probar **Ripple/Replace con pista de Comandos, Métodos y Audio** mediante eventos puntuales; no deben ejecutarse comandos al mover el cabezal en Edit. Mix debe comunicar que no es válido para eventos.
7. Seleccionar clip y modificar inicio/duración desde **Inspector**; seleccionar su fuente y comprobar que no se deja borrar una clave referenciada sin eliminar el clip primero. Probar Undo/Redo del editor.
8. Guardar `.lfproj`, cerrar y reabrir, comprobar IDs, clips, claves, duración e interpolación; reproducir en Player y confirmar consistencia visual/temporal con Preview.
9. Volver a comprobar cabeceras fijas y controles de selección múltiple G001/G002 en panel estrecho. No modificar Nether FilmMaker.

**Evidencia a devolver:** salida de test y build; captura/video de Mix (durante solapamiento), Ripple y Replace (antes/después), Inspector de clip, y persistencia/reproducción Player; primer error completo si aparece.

**Restricciones explícitas:** G003 no habilita mezclas PCM de audio, global Ripple multitrack, ni grupos de pistas. No cerrar Gate sin QA local satisfactorio y aprobación del usuario.

## Aprobación y cierre (2026-11-06)

- El usuario respondió textualmente **«Aprobado.»** a la entrega de `LF-TIMELINE-UNITY-REPLACEMENT-S10-G003-INTEGRAL`. Se registra su aprobación del Gate implementado.
- Esta aprobación no aporta por sí sola logs nuevos de compilación ni observaciones individualizadas de Mix, Ripple, Replace, Player visual o persistencia. Por ello conservamos sus verificaciones locales como **NO VERIFICADAS DOCUMENTALMENTE**, aunque el Gate quede aceptado.
- Las cifras de pruebas que figuran arriba son de la implementación entregada, no de una nueva ejecución de QA.
- El cierre no habilita G004 ni modifica el alcance originalmente autorizado. FilmMaker y las limitaciones de audio PCM / Ripple multitrack continúan intactos.
- Registro vinculante: `docs/qa/LF-TIMELINE-UNITY-REPLACEMENT-S10-G003-INTEGRAL_CLOSURE.md`.

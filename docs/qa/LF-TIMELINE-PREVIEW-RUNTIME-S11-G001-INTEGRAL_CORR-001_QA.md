# QA local — S11-G001 CORR-001

**Estado:** IMPLEMENTADO EN FUENTES · QA LOCAL PENDIENTE · GATE NO CERRADO.

## Instalación

SOURCE_BASELINE de entrada: `LF_TIMELINE_PREVIEW_RUNTIME_S11_G001_INTEGRAL_SOURCE_BASELINE.zip`.

En la raíz LevelForge con `package.json`, comparar los cambios locales y respaldar antes de aplicar CHANGE. Si no coinciden, extraer SOURCE_BASELINE CORR001 en una carpeta separada. No sustituir proyectos, escenas, Assets, `node_modules`, builds ni otros cambios locales.

```bash
npm ci
node --test scripts/test-timeline-preview-runtime-s11-g001-corr001.mjs
node --test scripts/test-timeline-preview-runtime-s11-g001-integral.mjs
npm run build
npm run electron -- --build
```

Con Vue instalado, la suite CORR001 debe devolver **15 PASS / 0 FAIL**; sin el compilador, **14 PASS / 1 SKIP**. Compilar no sustituye QA visual.

## QA del usuario en Electron embebido

1. Crear/abrir Timeline con al menos Nodo, Cámara, Audio y dos claves de Comandos. Añadir una clave meteorológica previsualizable; dejar `weatherThunder` como prueba de bloqueo explícito, no de ejecución exitosa.
2. Seleccionar un **clip de Cámara** y pulsar Play. Deben escucharse todos los Audio habilitados y ejecutarse los Comandos seguros; la selección solo resalta/actualiza Inspector. Repetir con clip Nodo, Audio, Comandos y Naturaleza, y sin selección.
3. Mientras Play está activo, seleccionar distintas claves, clips y pistas, incluso en el Inspector. El tiempo debe seguir avanzando sin pausas ni silencios; no aparecen eventos duplicados ni se modifican Solo/Mute.
4. Pulsar una clave sin moverla: Play continúa. Arrastrarla realmente: Pause del reloj, eventos y voces sucede junto y de forma explícita; retomar desde el mismo tiempo sin duplicar eventos. Repetir con asa de clip y punto de Curvas.
5. Con Play activo, cambiar Timeline → **Audio Mixer**, luego Proyecto, Consola y volver. El audio/comandos deben continuar; el botón Play/Pause y el cabezal muestran el estado/tiempo real acumulado. Repetir con docking/tab flotante y, si es aplicable, cajón móvil.
6. Probar Pause/Resume, Seek hacia adelante/atrás y Loop. Al hacer Stop, detener solo las voces pertenecientes a Preview y restaurar transformaciones y clima temporales; comprobar que no queda audio residual.
7. Iniciar Play y abrir otra escena, proyecto, otra Timeline o PlayMode. El transporte anterior debe detenerse de forma controlada y liberar recursos. Volver a la escena anterior no reinicia automáticamente su audio.
8. Guardar, cerrar/reabrir proyecto y comprobar que la previsualización no modificó escenas ni recursos; probar guardado con clips y curvas existentes.
9. Validar Responsive First, cabeceras fijas, Inspector, Mix/Ripple/Replace, grupos, bloqueo y el corchete global `]` sin regresiones.

## Evidencia solicitada

Enviar salida completa de Node, `npm run build` y Electron; vídeo corto con audio donde se observa selección de varios clips durante Play y cambio a Audio Mixer mientras continúa el sonido; comprobar Stop y guardado/reapertura. Informar PASS o FAIL por caso y las advertencias de consola si aparecen. Los comandos no aislables deben mostrar advertencia, no simular ejecución.

**No declarar cierre ni QA LOCAL PASS sin evidencia expresa.**

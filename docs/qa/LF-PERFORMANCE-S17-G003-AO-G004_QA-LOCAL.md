# QA LOCAL — LF-PERFORMANCE-S17-G003-AO-G004-INTEGRAL-COMPOSITE-OPTIMIZATION

## Despliegue

1. Extraer `LF_PERFORMANCE_S17_G003_AO_G004_INTEGRAL_COMPOSITE_OPTIMIZATION_SOURCE_BASELINE.zip` en carpeta nueva, con `package.json` en la raíz. Conservar sin tocar proyectos, SOURCE_BASELINE G003, exportaciones antiguas y cambios locales.
2. No extraer CHANGE sobre el nuevo SOURCE_BASELINE. CHANGE solo sobre copia intacta de G003 y después de comparar los archivos modificados.
3. En esa carpeta, ejecutar:

```bash
npm ci
node --test scripts/test-performance-s17-g003-ao-g004-composite-optimization.mjs
node --test scripts/test-performance-s17-g001-profiler-contract.mjs scripts/test-performance-s17-g002-spatial-reconstruction.mjs scripts/test-performance-s17-g003-diagnostics.mjs scripts/test-performance-s17-g003-ao-g001-cost-diagnosis.mjs scripts/test-performance-s17-g003-ao-g002-optimization.mjs scripts/test-performance-s17-g003-ao-g003-composite-scene-diagnosis.mjs scripts/test-performance-s17-g003-ao-g004-composite-optimization.mjs
npm run build
npm run electron
```

**Esperado:** 14 pruebas nuevas PASS y 79 focales PASS; Editor y Player deben compilar antes de verificar con Electron. Avisos de chunks y imports no equivalen a fallos, pero conservar el log. Electron no equivale a AppImage exportado.

## A/B controlado de composición

1. Usar el **mismo proyecto de prueba**, cámara fija, misma resolución de ventana, perfil Realista Alto, AO habilitado, iluminación y escena inalterados. Elegir escena con suelo/pared y objeto apoyado, sombras de contacto y bordes finos. No usar el terreno cuadriculado como único criterio de fidelidad.
2. Con F3 (Stats), seleccionar **AO 100 %** y **Composición original · copia + mezcla**. Dejar estabilizar la escena. Reiniciar medias y registrar captura de escena y Stats tras 60 segundos; repetir tres veces.
3. Sin mover cámara, seleccionar **Fusionada · un dibujo**. Dejar estabilizar, reiniciar medias y registrar tres capturas/mediciones de 60 segundos. Registrar específicamente `AO · copia`, `AO · mezcla`, `AO · fusión`, `AO · composición`, `AO · total`, `GPU · pasadas`, FPS, p50/p95, draw calls y `Escena · dibujo`. La ausencia de consultas GPU debe anotarse como NO VERIFICADO.
4. Repetir la comparación original/fusionada con AO al 75 % y 50 % por separado, sin mezclar estadísticas. Repetir un encuadre hacia el cielo.
5. Verificar que al cerrar F3 y volver a abrir Stats se restauran **AO 100 %** y **composición original**. Con Stats cerrado, ninguna fusión debe activarse.
6. Examinar visualmente uniones objeto/suelo, bordes finos, transparencia y movimiento/cámara. Buscar halos, cambios de color/alpha y parpadeo. Una captura fija no prueba ausencia de artefactos temporales; aportar grabación si aparecen.

## Diagnóstico focal de «Escena · dibujo»

Con escena y cámara inmóviles, usar composición original AO 100 % y medir «Escena · dibujo» con **ventana 100 % y después aproximadamente 75 % de ancho y alto**, manteniendo mismo perfil gráfico. Registrar `Buffer escena`, resolución efectiva, draw calls, triángulos y tiempo GPU. Repetir tres veces, sin zoom de cámara ni cambio de geometría. Una variación asociada a resolución sugiere coste por píxel/fragmento, **no identifica por sí sola el shader o material culpable**. Esta prueba no autoriza cambiar calidad o materiales por defecto.

## NGM Runtime / seguridad

Exportar un AppImage de prueba **solo con NGME-STATS habilitado** y confirmar que `Ctrl+Shift+F3` muestra los controles A/B. Verificar por separado un AppImage normal, donde no debe ser accesible Stats ni DevTools. La configuración del proyecto no debe persistir el experimento. Si el AppImage no está disponible, anotar NO VERIFICADO.

## Evidencia que debe regresar

Logs Node y build; 3 capturas del modo original y 3 de fusión (mismo encuadre y resolución), tablas de 3×60 s por variante, capturas detalladas del panel, video de movimiento si aparecen defectos, resultado de restauración al cerrar Stats, comparación de resolución del dibujo de escena y resultados de ambos AppImage. Registrar fallos exactos y hardware/controlador si se puede obtener sin herramientas nuevas.

## Criterios

No marcar `QA LOCAL PASS` integral, `APROBADO`, `FIXED` o `CERRADO` hasta recibir evidencia de compilación, calidad visual, estado de los atajos y rendimiento comparativo. Si la fusión no mejora o degrada la imagen, conservar opción original y recomendar descarte/corrección posterior autorizada. No se promete un porcentaje de ganancia.

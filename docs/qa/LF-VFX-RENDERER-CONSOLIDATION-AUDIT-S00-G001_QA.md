# QA — LF-VFX-RENDERER-CONSOLIDATION-AUDIT-S00-G001

**Estado:** AUDITORÍA DOCUMENTADA; QA GPU/Player NO VERIFICADO; NO CERRADO. Gate S00 no permite migraciones ni correcciones del runtime.

## Base y precauciones

Extraer el **SOURCE_BASELINE** completo en carpeta separada, o aplicar el **CHANGE** sólo sobre `LevelForge_VFX_BLACK_ARTIFACT_CORR_G001_CORR_001_SOURCE_BASELINE(1).zip` comparando cambios locales antes. No sobrescribir proyectos ni archivos modificados por el usuario. No tocar escenas, Assets ni `node_modules`. No empaquetar carpetas de resultados locales.

## Pruebas Node (desde raíz)

```bash
node --test scripts/test-vfx-renderer-consolidation-audit-s00-g001.mjs
node scripts/bench-vfx-renderer-consolidation-s00-g001.mjs
node --test scripts/test-vfx-black-artifact-corr-g001.mjs scripts/test-vfx-simulation-s02-g001.mjs scripts/test-vfx-node-s02-g002.mjs scripts/test-weather-storm-activation-contract-g001.mjs
```

`AUD-01..AUD-17` requieren **17 PASS**. La regresión ampliada Node se realizó en el entorno de auditoría (69 PASS, 0 FAIL, 0 SKIP). El benchmark CPU imprime tiempo por **600 pasos** de simulación genérica con capacidades 64, 256 y 1024; sus resultados **NO SON FPS ni coste GPU** y no se comparan directamente con el shader de lluvia.

## QA Electron GPU (obligatorio antes del cierre)

```bash
npm ci
node --test scripts/test-vfx-renderer-consolidation-electron-s00-g001.mjs
node --test scripts/test-vfx-black-artifact-electron-g001.mjs scripts/test-weather-storm-activation-electron-g001.mjs
npm run build
npm run electron
```

El primer runner debe producir **1 PASS**, con `LF_VFX_RENDERER_AUDIT:` detallando, entre otras métricas, `drawCalls`, `medianSubmitMs`, `gpuError`, capacidades y estado de las representaciones. La fixture prueba VFX, PrecipFX lluvia, PrecipFX nieve, SplashFX, LeafFX (emisor sintético), CritterSystem (cluster sintético) y LightningFX **inactivo**. Sus tiempos son de envío CPU a WebGL, **no tiempos reales GPU ni fps de Player**. El runner no requiere navegador externo; utiliza Electron instalado con el proyecto.

Para capturas diagnósticas se permite:

```bash
LF_QA_CAPTURE_DIR=./qa-vfx-audit node --test scripts/test-vfx-renderer-consolidation-electron-s00-g001.mjs
```

Las capturas y logs de GPU del usuario no están disponibles en el entorno de implementación; deben devolverse para completar la evaluación comparativa.

## Integración manual Editor / Play / Player

1. En Editor, crear o abrir recurso `.vfx` y dos nodos VFX3D con el mismo `vfxId`. Cambiar el recurso y verificar definición compartida y simulaciones independientes.
2. Repetir previsualización con alpha 0 y 0,6, textura y fallback procedural; verificar que el rectángulo negro no reaparece al aplicar GTAO y cambiar de perfil.
3. Mantener la misma cámara, escena, resolución y perfil para comparar `PrecipFX` en Despejado, Llovizna, Lluvia, Tormenta y Nieve, con tornados deshabilitados; registrar cuándo aparece un quad oscuro. En particular comparar GTAO activo/inactivo **sólo como diagnóstico**, sin dejarlo desactivado como parche.
4. Probar hojas de árboles y luciérnagas, día/noche y viento; comprobar halo, profundidad, transparencia y rendimiento.
5. Probar SplashFX con impacto de objeto sobre agua y, por separado, salpicaduras de lluvia sobre terreno o primitiva. Verificar diferencias semánticas, no equipararlas por nombre.
6. Probar rayos físicos, con ramas y sin cambiar geometría de LightningFX. El fixture S00 sólo mide su caso inactivo, no sustituye esta verificación.
7. Repetir en Play/Stop y Player exportado con Compatibility, medir FPS, CPU, memoria, draw calls, geometrías, texturas y capturas. Comparar mismos parámetros, no solo screenshots de configuraciones distintas.
8. Comprobar referencias `.vfx` al exportar, textura empaquetada y recursos inválidos; no aceptar pérdida silenciosa de un archivo referenciado.

## Cierre y evidencia requerida

Enviar salida completa de los dos comandos Node nuevos, del benchmark CPU, runner Electron y compilación, imagen con o sin negro en Llovizna, capturas por perfil de render, resultados Editor/Player y cualquier error GPU. Comparación GPU/Player no disponible = **NO VERIFICADO**. Un resultado que reproduzca un bug no autoriza migración automática: primero se establece causa raíz y después el Gate correctivo propietario.

**S00 permanece PENDIENTE DE QA/ACEPTACIÓN.** La documentación y pruebas diagnósticas son entregables autorizados; no se ha implementado una consolidación de renderers.

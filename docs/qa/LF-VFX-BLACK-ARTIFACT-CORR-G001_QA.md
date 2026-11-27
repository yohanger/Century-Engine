# LF-VFX-BLACK-ARTIFACT-CORR-G001 — QA local

## Preparación

Utilizar el SOURCE_BASELINE exacto entregado o aplicar CHANGE exclusivamente a `LevelForge_WEATHER_STORM_BLACK_ARTIFACT_CORR_G001_AUDIT_SOURCE_BASELINE.zip`, tras comparar archivos locales. Editor y Player del mismo proyecto. Electron es el único host requerido para pruebas automáticas WebGL; no instalar navegadores externos.

## Comandos desde la raíz de LevelForge

```bash
npm ci
node --test scripts/test-vfx-black-artifact-corr-g001.mjs
node --test scripts/test-vfx-black-artifact-electron-g001.mjs
node --test scripts/test-vfx-webgl-s02-g001.mjs
npm run build
npm run electron
```

El test Node nuevo debe presentar 7 PASS. El Electron nuevo debe presentar 1 PASS y al menos 7 verificaciones internas GPU; el VFX WebGL histórico debe presentar 1 PASS. Esos son **resultados requeridos, no acreditados**.

## Pruebas visuales del usuario

1. Crear un `.vfx` nuevo, iniciar vista previa. Confirmar partículas visibles sin fondo cuadrado.
2. Con partículas activas, cambiar Apariencia → Opacidad a 0. Confirmar que el rectángulo negro desapareció, sin reducir el contador de simulación a cero.
3. Restaurar opacidad 0,6 y cambiar entre texturas procedurales y recurso de textura real. Probar mezclas Alfa y Aditiva.
4. Probar en los perfiles Forward+, Mobile y Compatibility, tanto en modo Escena como Play, sin apagar GTAO globalmente.
5. Repetir Play/Stop, cambiar recurso `.vfx` y reiniciar vista previa. Confirmar liberación sin residuos.
6. Probar la escena de Tormenta con tornados desactivados. **Registrar por separado** si el artefacto meteorológico persiste: no declarar que esta corrección lo resuelve sin evidencia.
7. Comprobar Editor y Player exportado; observar FPS con F3, texturas, transparencias y mensajes GPU.

## Evidencia a devolver

Salida completa Node, Electron, build y consola; captura de `.vfx` con 26 partículas y Opacidad 0, y con Opacidad 0,6; captura Tormenta sin tornado; resultados de Play/Stop y Player. Los tests automatizados no sustituyen QA visual del usuario.

## Condición de cierre

Diagnóstico GPU real, sin rectángulo VFX en todos los perfiles, sin regresiones de textura/mezcla, QA local aprobado, ledger actualizado. Hasta entonces **IMPLEMENTADO — NO VERIFICADO EN GPU — NO CERRADO**.

## CORR-001 — repetir tras el crash de `_excludeVfxFromAO`

Aplicar CHANGE CORR-001 **solo** sobre `LevelForge_VFX_BLACK_ARTIFACT_CORR_G001_SOURCE_BASELINE.zip`, o utilizar el SOURCE_BASELINE CORR-001 en carpeta separada. Conservar copia y comparar cualquier modificación local previa.

Desde la raíz de LevelForge:

```bash
node --test scripts/test-vfx-black-artifact-corr-g001.mjs
node --test scripts/test-vfx-black-artifact-electron-g001.mjs
node --test scripts/test-vfx-webgl-s02-g001.mjs
npm run build
npm run electron
```

El primer comando debe devolver **9 PASS, 0 FAIL, 0 SKIP**. El test Electron VFX debe devolver **1 PASS** cuando WebGL real y GTAO funcionen (requerido, no acreditado). El build debe terminar ambos Vite y el Editor debe abrir sin `Cannot read properties of undefined (reading 'bind')` al renderizar, redimensionar, cambiar de perfil o mostrar un `.vfx`.

En la vista previa: prueba partículas activas con opacidad 0 y 0,6, con y sin textura y con GTAO habilitado; revisa Play/Stop y la restauración de objetos sólidos. Aporta log y capturas. **No se declara resuelto el rectángulo negro** ni el defecto meteorológico de Tormenta hasta obtener evidencia visual real.

La advertencia CSP y la obsolescencia de `slider-vertical` están fuera del alcance de esta corrección.

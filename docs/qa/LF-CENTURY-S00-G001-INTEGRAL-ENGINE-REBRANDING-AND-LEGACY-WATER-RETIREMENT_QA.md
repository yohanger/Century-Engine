# LF-CENTURY-S00-G001-INTEGRAL-ENGINE-REBRANDING-AND-LEGACY-WATER-RETIREMENT — Implementación y QA

**Fuente:** `LF_TOOLING_S00_G001_CORR001_NATIVE_ELECTRON_LAUNCH_AND_BUILD_VALIDATION_SOURCE_BASELINE.zip` (3.744 archivos).  
**Autorización literal del usuario:** `Listo. LF-CENTURY-S00-G001-INTEGRAL-ENGINE-REBRANDING-AND-LEGACY-WATER-RETIREMENT autoriza comenzar`.  
**Amendment:** `LF-WATER-LEGACY-RETIREMENT-CA-006`, ratificado.  
**Fecha:** 19 de noviembre de 2026.  
**Estado:** IMPLEMENTADO EN FUENTES · TEST PASS · COMPILACIÓN NO VERIFICADA · QA ELECTRON/PLAY/PLAYER NO VERIFICADO · APROBACIÓN/CERRE PENDIENTES.

## Objetivo / mecanismo

- Nombre público **Century**: npm `century`, productName y ejecutable `century`, ventana Electron, Hub, Editor, mensajes y descripción de VS Code. Conservados intencionadamente los IDs persistentes como `com.levelforge.editor`, `levelforge.levelforge`, `levelforge.*`, `.levelforge` y extensión `.lfproj` para no desasociar preferencias, proyectos o VS Code actuales. No se inventa dirección web pública del motor.
- Registro de nodos `water` y `fluidcontainer3d` retirado. Las escenas y prefabs previos permanecen como datos; en representación visual se instancian grupos vacíos sin físicas ni materiales para no perder estructura de hijos, sin registrar tipos nuevos ni limpiar datos automáticamente.
- Retirados simuladores `WaterWorld`, superficies, shaders, solvers y recursos de código exclusivos del agua; rutas de Play, efecto sumergido, flotabilidad, recipientes físicos y APIs `game.water` desconectados. En `docs/qa/CA006_RETIRED_SOURCE_FILES.txt` consta el manifiesto de archivos de origen retirados.
- Reciclado de `rainImpact()` independiente en `scene/rain-impact.js`; humedad de lluvia y reflejos de charcos meteorológicos mantenidos en render. Jolt, terreno, rayos, fuego y tornados continúan como sus propios subsistemas.
- Se conserva lectura, validación y serialización de perfiles `.liquid` existentes mediante `normalizeLiquid`; se deshabilita su autoría física y su uso como solver, sin declararla biblioteca nueva.
- Godot export legacy: se dejan de exportar agua y `water_map`; no se sustituye por otra simulación. Scripts de arranque Electron y Vite HMR no se modifican.

## QA y resultados reproducibles

| Comando/comprobación | Resultado en este entorno | Alcance acreditado |
|---|---|---|
| `npm test` después de actualizar `smoke` | **30/30 PASS** | 19 pruebas del launcher previo + 11 pruebas de contrato CA-006; son verificaciones automatizadas, no pruebas de Editor real |
| `find src -name '*.js' ... node --check` | **PASS** | Sintaxis ECMAScript; no prueba resolución de paquetes npm ni ejecución de Vue |
| Revisión estática de importaciones del agua retirado | **Sin imports activos a rutas retiradas detectados** | Inspección de importaciones estáticas; no certifica llamadas dinámicas |
| `npm run build` | **NO COMPILADO: `vite: not found`** | Baseline no contiene `node_modules`; no se verifica bundle Editor/Runtime |
| QA manual Electron/Hub/Editor/Play/Player/FilmMaker | **NO VERIFICADO** | Requiere equipo local con dependencias, Electron y recursos WASM |
| Distribución AppImage/DEB/Windows | **NO VERIFICADO** | La identidad está modificada en configuraciones; empaquetado sin ejecutar |
| Tests históricos de agua | **SUPERSEDIDOS por CA-006** | Se retienen para historial; no deben incluirse en `smoke` vigente |

## Contradicciones, restricciones y próximos pasos

1. NO afirmar que los perfiles líquidos almacenados son simulación operativa. `fluidcontainer3d` y el nodo `water` son datos inertes si aparecen en un proyecto existente.
2. Mantener IDs/formatos persistentes evita pérdidas involuntarias, pero requiere una decisión separada si más adelante se desea reemplazarlos; no crear migraciones por defecto.
3. Un proyecto que dependa de la física antigua del agua **no la ejecutará** tras este Gate. No abrir ni guardar automáticamente un proyecto de usuario durante el cambio.
4. Validar en Linux local: `npm ci`, `npm run build`, `npm run start`, Editor, Hub, escena con nodo de agua legado e hijos, guardar/reabrir sin pérdida de campos, terreno/clima/tormenta, Jolt, Play y Player. Revisar nombre de ejecutable y empaquetado Linux/Windows cuando proceda.
5. No iniciar todavía investigación, propuesta o implementación de biblioteca de fluidos; será un trabajo posterior autorizado.
6. QA LOCAL PASS, aprobación y cierre permanecen pendientes hasta evidencias proporcionadas por el usuario. Al aprobar/cerrar, actualizar los seis registros del ledger sin sobrescribir la historia.

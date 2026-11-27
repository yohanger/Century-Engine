# QA local — Cinematic nativo S04-G001-INTEGRAL

**Estado:** PENDIENTE DE EJECUCIÓN LOCAL. Este documento es el procedimiento, no evidencia de PASS.

## Prerrequisitos

- Proyecto local LevelForge existente con `package.json`; comparar primero los archivos modificados localmente con CHANGE, respaldar sus contenidos y no sustituir escenas ni películas.
- Electron instalado con sus dependencias. Aplicar CHANGE sobre el baseline acumulado S07 CORR-002 + S03, no sobre un baseline antiguo de FilmMaker móvil.
- Guardar un respaldo del proyecto `.lfproj` real antes de probar la persistencia cinematográfica.

## Terminal en la raíz del proyecto

```bash
node --test scripts/test-filmmaker-native-cinematic-resource-s04-g001-integral.mjs scripts/test-filmmaker-timeline-unification-s03-g001-integral.mjs
npm run filmmaker -- --build
npm run electron
```

Si falla la compilación, devolver log completo y **no** atribuir el fallo a la Timeline sin identificar su componente.

## Prueba de integración

1. Abrir un proyecto existente en LevelForge y localizar `Assets/Cinematics`.
2. En `Assets/Cinematics`, utilizar **+ → Cinematic**, poner nombre y comprobar que aparece el recurso `.cinematic`.
3. Abrirlo en Nether FilmMaker; comprobar una cámara estructural y Timeline sin contenido creado automáticamente.
4. Grabar una pasada real de cámara, añadir un plano al montaje y guardar desde FilmMaker sin exportar `.nfm`.
5. Regresar a LevelForge; confirmar el mismo ID, sin nueva importación ni recursos duplicados.
6. Seleccionar Cinematics, consultar pistas reales y probar reproducción; comprobar escena correcta.
7. Reabrir FilmMaker desde el recurso; verificar contenido y modificar duración/planos. Volver a guardar.
8. En LevelForge guardar el proyecto al archivo `.lfproj`, cerrarlo, volverlo a abrir y comprobar que el Cinematic está presente y puede editarse y reproducirse.
9. Inspeccionar el `.lfproj` (ZIP) y verificar `Assets/Cinematics/<nombre>.cinematic` y registro en `project.json`, sin proyecto `.lfproj` anidado.
10. Probar el Player con la secuencia guardada; verificar retorno de control y ausencia de errores.
11. Abrir dos ventanas FilmMaker del mismo Cinematic; guardar cambios en la primera y comprobar que la segunda **rechaza** guardar revisión obsoleta sin perder su estado local.
12. Renombrar el recurso desde Assets mientras FilmMaker lo mantiene abierto; comprobar conflicto en la sesión antigua. Moverlo a carpeta válida y reabrirlo por ID.
13. Verificar que borrar una carpeta que contiene Cinematics nativos no elimina películas implícitamente; eliminar un Cinematic individual y probar Deshacer antes de guardar al disco.
14. Verificar que exportar `.nfm` sigue siendo una operación separada.
15. Repetir funciones de Timeline LevelForge, Timeline FilmMaker y Cinematics anteriores para detectar regresiones.

## Evidencia que devuelve el usuario

- Log Node y compilación.
- Captura de Assets con Cinematic creado; captura de Timeline vacía en FilmMaker; captura con plano y pistas reales.
- Prueba de guardado/reapertura `.lfproj` y reproducción Player.
- Resultado de guardado concurrente (error esperado en segunda ventana).
- Incidencias reproducibles por paso, con captura o mensaje exacto.

Los estados `IMPLEMENTADO`, `TEST AUTOMATIZADO PASS`, `COMPILADO`, `QA LOCAL PASS`, `APROBADO` y `CERRADO` se registrarán separadamente. Si falta QA local, el Gate permanece abierto.

**Nota de integridad:** el guardado de película en FilmMaker no crea una operación de Deshacer del Editor para los datos binarios; las ediciones temporales se deshacen dentro de FilmMaker. Un recurso eliminado permanece recuperable localmente para Deshacer, pero no se exporta en `.lfproj` mientras está eliminado del registro.

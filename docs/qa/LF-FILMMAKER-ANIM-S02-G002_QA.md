# LevelForge · LF-FILMMAKER-ANIM-S02-G002 · QA

**Estado:** IMPLEMENTADO / QA LOCAL Y JOLT REAL PENDIENTES / NO CERRADO.
**Baseline:** `LevelForge_FILMMAKER_ANIM_S02_G001_SOURCE_BASELINE.zip`.

## Pruebas automatizadas ejecutadas

Comando (desde la raíz de LevelForge):

```bash
node --test \
  scripts/test-filmmaker-anim-s01-g001.mjs \
  scripts/test-filmmaker-anim-s01-g002.mjs \
  scripts/test-filmmaker-anim-s02-g001.mjs \
  scripts/test-filmmaker-anim-s02-g001-runtime.mjs \
  scripts/test-filmmaker-anim-s02-g002.mjs \
  scripts/test-filmmaker-frame-s01-g001.mjs \
  scripts/test-filmmaker-ux-s01-g002.mjs \
  scripts/test-filmmaker-ux-s01-g002-corr001.mjs \
  scripts/test-node-physics-s02-g001.mjs \
  scripts/test-node-physics-runtime-s03-g001.mjs \
  scripts/test-gameplay-physics.mjs \
  scripts/test-node-character-area-s04-corr001.mjs \
  scripts/test-node-character-area-s04-g001.mjs \
  scripts/test-physics-gizmo-s01-g001.mjs
```

**Resultado en contenedor:** 254 casos; 253 PASS, 0 FAIL, 1 SKIP (prueba Three.js opcional; no hay paquete instalado). El script nuevo INT-01..INT-18 pasa 18/18. Incluye validaciones de ID, muestras, quaternion SLERP, seek reversible, firma obsoleta, límites y preflight. Los tests que examinan el control de Jolt son pruebas de estructura y mocks, **NO validan el WASM real**.

**Compilación:** `npm run build` => exit 127 `vite: not found`. **NO VERIFICADO**.
**JSZip real:** `scripts/test-filmmaker-anim-zip-s01-g001.mjs` no pudo ejecutarse sin dependencia JSZip. **NO VERIFICADO**.
**Vue/Three/Electron:** pruebas visuales y WASM no disponibles en este entorno; requieren instalación local.

## Protocolo obligatorio de QA en el equipo del usuario

1. Instalar dependencias (`npm ci`), ejecutar `npm run build` y `npm run filmmaker`.
2. Crear una escena con `RigidBody3D` y `CollisionShape3D` válidas (p. ej., vaso) sobre un `StaticBody3D` con colisión; sin preset instalado por el Gate.
3. En Filmmaker, simular con Jolt WASM real, hornear, añadir pistas manuales a otro nodo, guardar `.nfm` v4.
4. En LevelForge, usar Importar película, comprobar que aparece la cinemática con pistas por ID y bloque físico horneado, sin advertencias ni cambios duplicados del objeto.
5. Guardar el proyecto, cerrarlo y reabrirlo; comprobar que siguen intactos `samples`, duración, quaternion, ID de nodo y mute.
6. Iniciar Player y ejecutar la cinemática desde evento/script de Timeline. El vaso sigue el movimiento grabado y no cae una segunda vez por Jolt.
7. Pausar y desplazar el cabezal hacia delante y atrás. La misma marca temporal reproduce exactamente la misma pose, incluidas rotaciones grandes y padres transformados.
8. Comprobar impacto/rebote contra el suelo, transición de cuerpo físico a controlador cinemático y regreso a dinámico en fin, stop, skip y reinicio de escena.
9. Lanzar dos timelines que intenten controlar el mismo `RigidBody3D`; el segundo debe rechazarse sin dejar a Jolt bloqueado.
10. Renombrar un nodo y repetir la película: la pista sigue vinculada a su ID. Borrarlo: mostrar diagnóstico sin reasignarlo por nombre.
11. Cambiar la CollisionShape3D o su padre en el proyecto y reimportar un `.nfm` con firma antigua: rechazar **antes** de aplicar overrides, perfiles, assets o timelines.
12. Forzar un error de importación después de agregar un asset: confirmar rollback de metadatos, blob y Timeline anterior. Importar correctamente y usar Undo/Redo una sola operación para volver y recuperar el contenido.
13. Validar animaciones, cámaras, transiciones, texto, audio, filtros y Event Order Flow heredados sin regresiones.
14. Verificar disposición en 1440×900, 1280×720 y 1024×768 y ausencia de controles de claves falsos sobre la pista física.

## Criterios de cierre

- Build Editor y Player PASS, sin errores Vue.
- Importación `.nfm` real con JSZip, persistencia al guardar y reabrir.
- Player y Jolt WASM reales: colisiones, pausa/seek, prioridad de Transform, stop/skip/restauración.
- Validación de Undo/Redo y rechazo transaccional.
- Capturas o registros de QA local suministrados por el usuario.

**El usuario todavía no ha aprobado ni cerrado S02-G002.**

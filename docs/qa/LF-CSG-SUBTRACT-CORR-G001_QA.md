# LevelForge — LF-CSG-SUBTRACT-CORR-G001 · QA

**Autorización:** `Listo. LF-CSG-SUBTRACT-CORR-G001 autoriza comenzar` (2026-10-27).  
**Aclaración del usuario:** en Base de datos ▸ Jugador debe quedar un único campo FOV, horizontal y sin compatibilidad vertical heredada.  
**Estado:** IMPLEMENTADO · PRUEBAS AUTOMATIZADAS PASS · BUILD Y QA VISUAL NO VERIFICADOS · APROBACIÓN DEL GATE PENDIENTE.

## Fuente de continuidad

`LevelForge_CAMERA_PROJECTION_CORR_G001_FOV_SOURCE_BASELINE.zip`: 881 archivos verificados. La corrección de FOV anterior fue aprobada por el usuario, quien confirmó que el ensanchamiento de cámara se resolvió.

## Causa raíz identificada y corrección

En `src/engine/runtime/scene/brushes.js`, `isReceiver()` aceptaba exclusivamente objetos `type === 'primitive'` y `refreshBrushes()` descartaba los nodos `mesh` antes de intentar cortar. Los muros y demás sólidos realizados con Edit Mesh, incluyendo Mesh Instances, nunca eran receptores válidos. La operación booleana BSP de `geometry/csg.js` sí produce recortes correctos para cajas solapadas: pruebas geométricas con volumen previo/posterior, paredes interiores y múltiples cortes.

Corrección aplicada sin reescribir BSP:

- Receptores: primitivas **y mallas editables** cerradas (solidos válidos). Se respetan `visible` y `props.carve`.
- `SceneGraph.syncObject()` programa recálculo también cuando cambia un nodo `mesh`.
- `refreshBrushes()` detecta y reemplaza la geometría base de la malla cuando Edit Mesh la reconstruye; evita cortar otra vez sobre un resultado ya cortado.
- Las paredes interiores se añaden como mallas con material del brush. La geometría recortada entra al Player mediante el flujo de colisiones de malla existente.
- Al eliminar o mover un brush, se recalcula/restaura la geometría sin alterar los vértices fuente de PolyMesh.
- Inspector muestra **Recibe cortes** también para mallas editables.

**Limitación:** los sólidos abiertos, superficies no-manifold y geometrías degeneradas no garantizan un resultado booleano válido. Las pruebas automatizadas de geometría usan un adaptador controlado del subconjunto Three.js indispensable para ejecutar el BSP, porque `three`/Vite no están instalados en el entorno de entrega. No se ha probado visualmente el material, GPU ni la colisión Jolt real.

## Limpieza de FOV autorizada

- `PLAYER_DEFAULTS.fov = 90`; el valor de Jugador es **horizontal** en todo el flujo FPS.
- Se eliminó `fovAxis` del modelo, la normalización, `MOVE_KEYS`, API de scripts y selector del formulario del jugador.
- La barra del Editor conserva solo un control numérico horizontal (sin selector de eje).
- No se migran ni se interpretan automáticamente valores verticales antiguos. Se elimina también la lectura del FOV del `legacyGame` del jugador.
- `camera-fov.js` convierte horizontal a vertical al trabajar con Three.js; las cámaras de escena y cinemáticas pueden declarar `vertical` **internamente**, sin exponer otro selector al usuario.
- Las pruebas históricas que exigían la rama heredada se ajustaron expresamente al nuevo contrato; no se silenciaron pruebas.

## Pruebas y resultados

| Verificación | Resultado |
|---|---|
| `node --test scripts/test-csg-subtract-corr-g001.mjs` | **20 PASS / 0 FAIL** |
| Regresión Node disponible sin `test-starcat.mjs` | **1958 PASS / 0 FAIL / 18 SKIP** |
| Tests históricos `test-camera-fov-horizontal-g001.mjs` + `test-render-camera-g001.mjs` | **28 PASS / 0 FAIL** |
| Sintaxis de módulos JavaScript afectados | PASS |
| `npm run build` | **NO VERIFICADO** — `vite: not found` |
| Editor Electron / Player / exportación real / Jolt | **NO VERIFICADOS** |

Nota de metodología: la suite CSG ejecuta el código real de BSP y de `brushesMethods`, con reemplazos de las clases matemáticas/geométricas mínimas de Three.js. Los valores de volumen y los cambios de geometría son comprobados; esta prueba no es una sesión Electron real.

## QA local — procedimiento obligatorio

```bash
cd ~/ENGINES/lf-0.26.13/lf
node --test scripts/test-csg-subtract-corr-g001.mjs
npm run build
npm run electron
```

1. Crear un **Cubo** (receptor), escalarlo hasta hacer un muro (p. ej. X=5, Y=3, Z=0.3).
2. Añadir otro **Cubo**, darle tamaño de puerta (p. ej. X=1, Y=2, Z=1) y colocarlo atravesando el muro.
3. En su Inspector → Brush → Tipo seleccionar **Sustractivo (hace huecos)**. Ver el hueco en el muro. Si no aparece, informar el tipo exacto de receptor y la superposición.
4. Cambiar posición, escala y rotación del brush. Deben recalcularse los bordes del hueco.
5. Eliminar el brush: debe restaurarse el muro. Deshacer y rehacer.
6. Repetir usando como **receptor una malla editable cerrada**, convertida desde una primitiva; mantener la opción **Recibe cortes** activa.
7. Cambiar un vértice del receptor desde Edit Mesh y confirmar. Verificar que el corte se conserva después de actualizar la geometría base.
8. Probar dos brushes en el mismo muro, normales de las paredes interiores, UV y materiales.
9. Entrar en Play: el brush no debe verse ni bloquear el paso; las colisiones deben permitir atravesar el hueco, no el muro restante.
10. Guardar y reabrir; probar Player exportado (escena y colisión). Si Jolt no responde, aportar su error.
11. Base de datos → Jugador: debe haber **solo FOV (°)**, valor inicial 90. En Editor debe haber un FOV numérico sin selector horizontal/vertical.
12. En Play, probar 80°, 85° y 90° del jugador y cambiar el tamaño del visor; la representación debe mantener el FOV horizontal configurado.

**No declarar CSG cerrado ni QA visual PASS antes de recibir estas comprobaciones del usuario.**

## Integridad

Se modifica solo la integración CSG y FOV, los tests de contrato existentes, el nuevo test, este informe y el ledger de seis hojas. El catálogo de geometrías, motor BSP, pipeline PBR, Mesh Instances, clases de física Jolt, Shader Graph y exportador no se reescribieron.

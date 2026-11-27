# QA — S15-G004 · Play Mode / Runtime exportado

**Estado:** IMPLEMENTADO EN FUENTES · NODE PASS · BUILD / ELECTRON / APPIMAGE INDEPENDIENTE / QA LOCAL PENDIENTES.

## Prerrequisitos

Aplicar solo el CHANGE G004 sobre el proyecto local que ya contiene G003 CORR-002 CONT-001 aprobado. Comparar modificaciones locales antes de sobrescribir. Conservar `node_modules`, datos y proyectos. No extraer SOURCE_BASELINE para aplicar G004.

## 1. Pruebas automatizadas

Desde la raíz que contiene `package.json`:

```bash
node --test scripts/test-camera-orchestration-s15-g004.mjs
node --test scripts/test-camera-orchestration-s15-g004.mjs scripts/test-game-manager-g001.mjs scripts/test-camera-orchestration-s15-g002.mjs scripts/test-camera-orchestration-s15-g003.mjs scripts/test-node-active-visible-s15-g003-corr002-cont001.mjs scripts/test-event-order.mjs scripts/test-cinematics-player-integration-s05-g004.mjs scripts/test-vfx-player-s02-g002.mjs
npm run build
npm run electron
```

Esperado sobre el baseline de G004 con dependencias instaladas: 9 PASS en G004, 126 PASS en la batería seleccionada; Editor y runtime exportable deben compilar sin errores. El build NO prueba la ejecución independiente. Si alguna prueba falla, devolver salida completa.

La prueba G004-09 ejercita el host real con un `SceneGraph` simulado: **no** equivale a render, Jolt ni Electron. En el entorno de entrega se utilizó una sustitución temporal de reactividad debido a que faltaban dependencias npm; en la máquina local deben utilizarse las dependencias reales del proyecto.

## 2. Matriz de paridad manual

Probar el mismo proyecto en Play Mode y en un **AppImage independiente**:

| Escenario | Resultado esperado |
|---|---|
| Escena Sin jugador con Camera3D activa e invisible | Imagen de Camera3D disponible; el frustum no determina elegibilidad |
| Camera3D desactivada o con padre inactivo | No se selecciona; se respeta fallback vigente |
| GameManager con cámara seleccionada NO principal | La misma cámara gana en Play y en AppImage, con FOV configurado |
| GameManager con `player=none` y escena con Spawn | No aparece FPS adicional solo en AppImage |
| GameManager con `player=fps` / plantilla First Person | Mismas reglas que Play Mode; no modernizar personaje |
| Evento visual «Controlar cámara» | Activar/cambiar/liberar respeta propiedad y cámara efectiva |
| Script `game.camera.acquire(id)` | La referencia por ID funciona; `release({to:'keep'})` conserva cámara viva |
| Timeline con referencia Camera3D por escena e ID | Reproduce la cámara correcta sin recurrir a la editorial |
| Cinematics/FilmMaker como consumidor | No sobreescribe autoridad por accidente; respetar ownership |
| Cambio de escena A → B → A con GameManager distinto | Reevalúa cámara, perfil y jugador por escena sin reutilizar ID ajeno |
| Eliminar o desactivar Camera3D solicitada | Fuente inválida gestionada con estado seguro |
| FOV/perfiles, Camera Shake, DOF y audio | Misma vista efectiva; sin cambios de comportamiento no autorizados |

Para exportar desde Electron utiliza la ventana Build: seleccionar las escenas, exportar como AppImage y ejecutar el archivo guardado. El diálogo propone una ruta en `~/Documents`, pero permite elegir otra. Utiliza la ruta efectiva informada por LevelForge; no presupongas un nombre de AppImage.

El AppImage debe ejecutarse fuera del Editor; iniciar Play Mode o simplemente compilar `dist-player` no sustituye esta prueba. Si el sistema exige permiso de ejecución, concederlo solo al AppImage generado.

## 3. Evidencia a devolver

Salida de las dos órdenes Node, `npm run build`, confirmación de arranque Electron y ejecución del AppImage real. Identificar por escenario PASS/FAIL/NO VERIFICADO, adjuntar capturas o logs relevantes. No se declara QA LOCAL PASS ni CERRADO antes de evaluación y aprobación explícita del usuario.

**Fuera de G004:** eliminar la fila Visible del Inspector, modernización de plantilla FPS, nuevos blends, G005/G006/G007.

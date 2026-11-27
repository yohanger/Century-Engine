# LF-EDITOR-SNAP-SHIFT-G001 — Contrato de integración

## Fuente y autoridad

Se modifica únicamente el sistema de transformación de nodos sobre `LevelForge_MESH_BEVEL_VERTEX_CORR_G001_SOURCE_BASELINE.zip`. No se crea un transformador alternativo ni se modifica el estado persistente `project.settings`. Se reutilizan los tres `TransformControls` existentes (mover, rotar, escalar), incluido su modo universal.

## Mecanismo

1. `editor/gizmo.js` captura Shift al recibir eventos de puntero y teclado; únicamente el gizmo de escena activo inicia una sesión efímera `_snapDrag` cuando Three.js emite `mouseDown`.
2. Durante esa sesión, los pasos de Snap del addon se suspenden temporalmente para obtener su transformación sin cuantizar. Antes del consumidor `objectChange` ya existente, el editor ajusta el valor: posición mundial/local según eje, rotación angular en radianes y escala por componente.
3. Un gesto iniciado con Snap activado y sin Shift respeta el redondeo absoluto habitual. Al pulsar o soltar Shift durante el gesto, el estado visible y el valor sin cuantizar se anclan como comienzo de un nuevo tramo. El tramo posterior es libre o usa los pasos configurados **sobre el delta**. Así el cambio de tecla no provoca teletransporte y no se modifica la configuración guardada.
4. Las operaciones de rotación local multiplican el cuaternión por la derecha; las globales por la izquierda, como el addon oficial. La escala mantiene su protección frente a cuantización a cero. El desplazamiento global se cuantiza en coordenadas de mundo, incluso con un padre transformado.
5. `mouseUp`, reemplazo/desacople y `dispose` restauran las propiedades normales del addon. `keyup`, pérdida de foco y `visibilitychange` mediante la puerta `win`/`doc` de `platform.js` liberan Shift. Se limpian los listeners nuevos al cerrar el editor.
6. El `objectChange` original continúa actualizando la selección/pivote y el `mouseUp` conserva una única escritura Undo/Redo. No se toca el flujo de `Edit Mesh`, FilmMaker, terreno, ni los atajos de menú.

## Restricciones

- La transición de **libre → Snap** en mitad de un mismo arrastre aplica pasos **incrementales desde la posición actual**; no fuerza alineación inmediata a la cuadrícula global porque violaría la prohibición de saltos.
- No hay preferencias nuevas, cambios de formato `.lfproj`, managers, dependencias ni scripts que modifiquen el proyecto.
- Se emplea la API y propiedades de `TransformControls` de Three.js 0.186.1 fijada en `package.json` (`rotationAxis`, `rotationAngle`, `_quaternionStart` ya utilizadas por el addon). Las propiedades con guion bajo deben revisarse en una futura actualización de Three.js; no se cambia de versión.
- La prueba Node usa un modelo matemático determinista y comprueba contratos del código. No equivale a la prueba del addon real en Electron.

## Prerequisitos de cierre

Ejecutar `npm run test:snap-shift`, `npm run build` y pruebas visuales en Electron con Shift al inicio/medio/final, varios ejes, pivot múltiple, local/global y Undo/Redo; validar también Play, FilmMaker, Edit Mesh, terreno y Windows. Solo QA del usuario con evidencia permite cerrar el Gate.

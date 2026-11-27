# CORR-005 · Protocolo de QA

## Repetición

Desde la raíz del proyecto.

```bash
npm ci
node --test scripts/test-timeline-property-animation-s13-g008-g008-corr005-electron.mjs
npm run build
npm run electron
```

El runner usa los componentes Vue en Electron. `LF_QA_WINDOW_WIDTH=1366 LF_QA_WINDOW_HEIGHT=768` fija el tamaño solicitado y `LF_QA_CAPTURE_DIR` guarda la captura. El gestor de ventanas puede ajustar el tamaño efectivo.

## Regresión seleccionada

En Bash, ejecutar la batería de autoría, vista previa, evaluación, cámara y audio.

```bash
node --test --test-concurrency=2 \
  scripts/test-timeline-preview-runtime-s11-g001{,-integral,-corr001}.mjs \
  scripts/test-timeline-property-animation-s13-g008-g00{6,7,7-runtime,8,8-corr003,8-universal-corr001,8-node-hierarchy-corr002,8-ux-corr004}.mjs \
  scripts/test-timeline-hierarchy-dnd-s04-g001.mjs \
  scripts/test-timeline-camera-node-binding-s11-g002.mjs \
  scripts/test-timeline-audio-{trim-duration-s12-g002,volume-automation-s11-g007-g002}.mjs
```

## Aceptación manual

1. Abre un Timeline editable y arrastra Cámara, Luz o Mesh desde Jerarquía. Cancela el encabezado provisional y comprueba que el recurso sigue intacto.
2. Arrastra el nodo de nuevo, pulsa la llave del encabezado y elige una propiedad. Comprueba pista y primera clave al tiempo del cabezal. Deshacer y rehacer restauran pista y clave juntas.
3. Mueve el cabezal, cambia el valor autoral y usa la llave de la pista. Repite en el mismo instante. La clave existente conserva su ID y actualiza su valor.
4. Abre Detalles para editar el tiempo o el valor de la clave. Comprueba que el Inspector conserva el nodo. Bloquea la pista y comprueba que la llave queda deshabilitada.
5. Mueve el cabezal antes de Play, después de pausar y después de editar con el gizmo. El visor sigue el tiempo. Reanuda y comprueba el transporte de audio y comandos.
6. Guarda y reabre el proyecto. Comprueba claves, valores e identidades. Repite con dock estrecho y un proyecto con audio, tomas y grupos.

## Evidencia

El fixture usa los componentes reales con eventos DOM de arrastre. La prueba de sesión instrumenta la entrega de muestras al adaptador del visor. Las capturas corresponden al fixture Electron. La revisión manual del usuario, la paridad con Godot y la ejecución del Player exportado se registran por separado.

## Resultados de ejecución

| Comprobación | Resultado |
|---|---|
| Regresión Node seleccionada | 300/300 PASS |
| Electron CORR-005, ancho y estrecho | 22/22 PASS en cada ejecución |
| Build Editor final | PASS |
| Build Player | PASS |
| Player exportado y QA manual del usuario | Pendientes |
| Comparación visual con Godot | CORR-006 |

Capturas y registros en `docs/qa/evidence/LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-TIMELINE-AUTHORING-CORR-005-INTEGRAL/`.

### Regresión Electron adicional

- S13-G008-CORR-003 · Electron: claves genéricas, cámara explícita y UX de pistas
- S13-G008-G008 · Electron: Inspector/Timeline, un clic, llaves, Undo/Redo
- S13-G008-CORR-002 · Electron: Camera3D, nodo, propiedades, selección y carriles
- S13-G008-CORR-001 · Electron WebGL: Inspector universal, timeline, historial y selección
- S13-G008-CORR-004 · Electron: jerarquía, menú anclado, foco, scroll y estado de pistas

La batería Node incluye el transporte de preview, evaluación tipada, Camera Binding, jerarquía, clips de audio, volumen, UX de menús y autoría. Los fixtures migrados conservan los escenarios de los Gates anteriores y sustituyen las aserciones que requerían llaves en el Inspector por la interacción ratificada.

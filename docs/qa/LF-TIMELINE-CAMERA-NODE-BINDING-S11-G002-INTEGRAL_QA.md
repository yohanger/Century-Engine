# QA de Camera3D y selección durante Play

Gate `LF-TIMELINE-CAMERA-NODE-BINDING-S11-G002-INTEGRAL`

**QA LOCAL PASS declarado por el usuario. APROBADO y CERRADO el 7 de noviembre de 2026.** Evidencia de cierre: «AProbado. SIgamos.». La compilación y las pruebas Node constan por separado en QA. La ejecución de Electron en el entorno de generación se bloqueó por falta de sesión gráfica.

## Aplicar los cambios

En la raíz de la instalación existente de LevelForge, ubica `package.json`. Compara los archivos de `LF_TIMELINE_CAMERA_NODE_BINDING_S11_G002_INTEGRAL_CHANGE.zip` con los de tu proyecto de motor y respalda cualquier edición local antes de aplicar los archivos en sus mismas rutas relativas. Si prefieres una prueba aislada, extrae `LF_TIMELINE_CAMERA_NODE_BINDING_S11_G002_INTEGRAL_SOURCE_BASELINE.zip` en una carpeta nueva y ejecuta los comandos allí. Conserva tus proyectos, escenas, Assets y cambios locales. Guarda ambos ZIP hasta la aprobación.

```bash
npm ci
node --test scripts/test-timeline-camera-node-binding-s11-g002.mjs scripts/test-timeline-preview-runtime-s11-g001-corr001.mjs
node --test scripts/test-timeline-camera-node-binding-s11-g002-electron.mjs
npm run build
npm run electron
```

Salida esperada. La primera prueba informa 23 PASS. La fixture de Electron informa 10 verificaciones cuando se ejecuta con sesión gráfica. Vite debe compilar Editor y Player. El último comando abre el Editor con Electron embebido.

## Prueba local

1. Abre una escena con dos nodos Cámara con el mismo nombre y distintos encuadres o FOV. Arrastra uno desde Jerarquía a Timeline. Comprueba el nombre en el Inspector y repite el drop en el mismo tiempo. Debe seleccionarse la clave original. Suelta la segunda cámara sobre el carril a otro tiempo para comprobar el corte.
2. Anima la transformación de un padre de Camera3D en otra pista. Prueba scrub, Play, Pause, Resume y Stop. La cámara debe seguir el movimiento y conservar su FOV. Stop debe devolver el control de la vista de edición y restaurar la escena.
3. Renombra la cámara. Guarda, cierra y vuelve a abrir. La referencia debe mostrar el nombre actualizado. Duplica la escena o elimina la cámara original. El Inspector debe advertir el problema y, al alcanzar la clave, el transporte debe continuar. Restaura el nodo o reasigna el vínculo en el Inspector.
4. Crea un Timeline con clips de cámara y nodo, una pista de Audio y varias claves de Comandos seguros. Pulsa Play con un clip seleccionado y vuelve a seleccionar clips y claves durante la reproducción. Repite con clics rápidos, un pequeño movimiento al soltar, selección en Inspector y Timeline → Audio Mixer → Timeline. Deben continuar el cabezal, el sonido y los comandos. Comprueba que un arrastre efectivo pausa y que reanudar no duplica eventos.
5. Dispara el Timeline con el comando «Reproducir timeline» en PlayMode. Exporta el juego con la escena original incluida y repite en Player. Comprueba la cámara vinculada y un recurso anterior que use posición libre o vista del jugador.
6. Prueba cancelación de un arrastre real y Undo/Redo. La cancelación debe restaurar el material anterior. Un arrastre confirmado debe dejar una sola entrada de historial.

Devuelve la salida de Node y Electron, el resultado de los seis casos y un vídeo corto con audio que muestre el caso intermitente de selección si reaparece. Incluye la pista seleccionada, el gesto y el tiempo aproximado del fallo.

## Evidencia de generación

- 23 PASS en las suites de Gate y continuidad.
- Regresión de Timeline y Cinematics en Node con 435 pruebas. 431 PASS y cuatro fallos preexistentes reproducidos en la base de entrada. Tres corresponden a aserciones históricas de Cinematics y uno al fixture SSR S06 que monta Timeline sin proporcionar el transporte.
- `npm ci` completado. `npm run build` compiló Editor y Player. Vite informó los avisos de tamaño de chunks y de externalización de Jolt.
- La ejecución de Electron se detuvo antes de cargar la fixture por falta de servidor X/`DISPLAY`. QA visual, audio real y ejecución local del Player exportado pendientes.

Los logs están en `docs/qa/evidence/` con el prefijo `LF_S11_G002_`.

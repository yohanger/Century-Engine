# QA — LF-TIMELINE-UNITY-REPLACEMENT-S10-G004-INTEGRAL

## Evidencia automatizada ejecutada

| Tipo | Resultado |
|---|---|
| Tests específicos G004 (`scripts/test-timeline-unity-replacement-s10-g004-integral.mjs`) | **28 PASS, 1 SKIP, 0 FAIL** |
| Regresión seleccionada S04/S07/S08/S09/S10-G001–G004 | **198 PASS, 8 SKIP, 0 FAIL**; 206 pruebas |
| `node --check` modelos, estado y pruebas modificadas | Sin errores sintácticos |
| Balance básico de etiquetas en plantillas Vue | Sin errores (no sustituye al compilador Vue) |
| Compilador Vue | SKIP, dependencias no disponibles aquí |
| Electron/Vite build | NO VERIFICADO |
| QA local visual y PlayMode/Player | PENDIENTE |
| Aprobación usuario | PENDIENTE |

El entorno no dispone de las dependencias para ejecutar el compilador Vue. No se atribuye PASS a las pruebas omitidas. Los tests comprueban reglas de negocio, pero las operaciones interactivas de arrastre, zoom y docking necesitan QA real de Electron.

## Procedimiento local en la raíz del proyecto (`package.json`)

1. Conservar la carpeta del proyecto ya aprobado; comparar archivos antes de aplicar CHANGE de G004. Si hay modificaciones locales no conciliadas, extraer SOURCE_BASELINE de G004 a otra carpeta. No reemplazar archivos de proyectos del usuario, escenas, recursos ni `node_modules`.
2. Instalar dependencias si faltan con `npm ci` (sin ejecutar `npm audit fix` ni actualizar dependencias).
3. Ejecutar `node --test scripts/test-timeline-unity-replacement-s10-g004-integral.mjs` — **esperado: 29 PASS, 0 FAIL** con compilador Vue instalado.
4. Ejecutar `npm run electron -- --build` — debe terminar el build y arrancar Electron sin error; guardar salida.
5. En una Timeline de prueba, crear dos grupos con `+ Grupo`, renombrarlos y arrastrar pistas entre grupos; comprobar que no cambian ID, claves, clips o orden de reproducción.
6. Contraer/expandir un grupo con pistas; probar desplazamiento horizontal (cabeceras fijas aprobadas en G001), desplazamiento vertical, zoom, DnD y fila del grupo. Mover pistas ocultas y expandir para comprobar su orden.
7. Bloquear una pista con claves, clips y comandos. Debe seguir reproduciéndose sin alteraciones, pero no debe permitir editar desde cabecera, Inspector, arrastre, menú contextual, Ctrl+D, Supr, Mix/Ripple/Replace ni editor de comandos. Comprobar que silenciar funciona de manera independiente. Desbloquear y volver a editar.
8. Crear un marcador en el cabezal y otro sobre la regla, renombrar y mover desde Inspector y regla, probar Snap, eliminar y verificar que no se ejecuta ningún evento.
9. Guardar el proyecto, cerrar/reabrir; comprobar grupos, orden, colapsado, bloqueo, marcadores y reproducción Editor/Player. Probar Undo/Redo de cada edición y proyecto antiguo sin metadatos G004.
10. Revisar anchura de panel acoplado/desacoplado, G002 (selección múltiple), G003 (Mix/Ripple/Replace) y G001 (pistas fijas). Sin regresiones visuales o funcionales.

**Evidencia a devolver:** salida de pruebas y build; capturas de dos grupos expandidos/contraídos, bloqueo y marcadores; breve vídeo de reordenamiento y scroll; resultado de guardado, reapertura y Player; descripción del error si falla.

**Cierre:** prohibido declarar QA LOCAL PASS, APROBADO o CERRADO sin evidencia y conformidad del usuario.

## Cierre posterior a la entrega — 2026-11-06

El usuario aprobó G004 mediante «Aprobado, sigamos.». Se registra **APROBADO POR USUARIO · CERRADO** para el alcance funcional entregado. Permanecen históricamente válidos los resultados Node **28 PASS / 1 SKIP** específicos y **198 PASS / 8 SKIP / 0 FAIL** en regresión. No se aportó un log nuevo que individualice compilación Vue/Vite/Electron, Player 3D o guardado/reapertura, por lo que esas comprobaciones continúan **NO VERIFICADAS documentalmente**. No confundir aprobación de usuario con PASS de cada prueba no documentada.

Ver `LF-TIMELINE-UNITY-REPLACEMENT-S10-G004-INTEGRAL_CLOSURE.md` y el ledger de seis hojas. G005 queda recomendado y **no autorizado**.

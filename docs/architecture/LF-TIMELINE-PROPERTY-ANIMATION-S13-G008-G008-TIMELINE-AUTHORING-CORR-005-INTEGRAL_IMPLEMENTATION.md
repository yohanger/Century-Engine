# CORR-005 · Autoría en Timeline y vista previa automática

**Fecha** · 10 de noviembre de 2026  
**Gate** · `LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-TIMELINE-AUTHORING-CORR-005-INTEGRAL`  
**Autorización** · «Listo. LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-TIMELINE-AUTHORING-CORR-005-INTEGRAL autoriza comenzar».

## Enmienda de autoría

El usuario ratificó el cambio con «Ratifico el cambio». En UA-03, las llaves y los detalles temporales pasan al Timeline. El Inspector muestra las propiedades autorales del nodo. La primera inserción crea pista y clave en una transacción. Insertar en un instante existente actualiza su valor y conserva la identidad de la clave. Esta sustitución prevalece sobre la ubicación anterior de las llaves en TA-03 y CORR-004.

Mover el cabezal evalúa la vista previa automáticamente. Ceder el visor a la edición espacial conserva el cabezal. El siguiente desplazamiento vuelve a muestrear. Durante la pausa, el audio y los comandos siguen suspendidos. El transporte de efectos se sincroniza con el tiempo seleccionado al reanudar. Se conservan las reglas de contexto y restauración de TB01.

## Implementación

- Jerarquía conserva el contrato de arrastre original. Timeline enfoca el encabezado existente o presenta uno provisional y cancelable. El encabezado y el estado de apertura son editoriales.
- La llave del encabezado consulta los descriptores del nodo. La llave de pista y Ctrl + doble clic comparten la función de inserción tipada. Se conservan el ID de la pista, el bloqueo y Undo/Redo.
- Detalles reutiliza el formulario temporal y recibe la selección del Timeline. El Inspector mantiene el nodo y las propiedades registradas. Se conservan la toma explícita de cámara y las pistas de métodos.
- Se retiran los interruptores manuales de preview. El transporte existente conserva las reglas de cesión al gizmo y aplica el muestreo al desplazar el cabezal.
- La columna inicial de pistas se amplía para alojar el control de llave. En dock estrecho, Detalles queda bajo la regla y por encima del cabezal.

## Base de entrada

Se verificó el inventario acumulativo desde el SOURCE_BASELINE de CORR-001 más los CHANGE de CORR-002, QA Host, CORR-003 y CORR-004. Hubo 3.043 coincidencias de 3.045 archivos. El VSIX local y su manifiesto eran las dos diferencias preexistentes y eran coherentes con las fuentes de la extensión. Se preservan ambos. El inventario de CORR-005 compara contra la copia local autorizada. Queda pendiente el cotejo contra el ZIP oficial completo de CORR-004.

CORR-006 conserva la comparación píxel a píxel con Godot. G009–G014 conservan sus dependencias y cobertura. G007 conserva la certificación pendiente de `object3D`.

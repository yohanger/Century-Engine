# Amendment — CSG con receptor por jerarquía y matrices coherentes

**Gate:** `CENTURY-EDITOR-MESH-S02-G001-CORR-002-PARENT-BOUND-SUBTRACT-AND-WORLD-SPACE-ALIGNMENT`

## Autoridad y alcance

Este Amendment modifica únicamente la asignación de receptor y el espacio de la geometría cortadora de los nodos `subtract` y `meshSubtract`. Prevalece, para esos supuestos, sobre la semántica de alcance global de los contratos anteriores. Se conserva la composición mixta declarada en `CENTURY-EDITOR-MESH-S02-G001-CORR-001-MIXED-SUBTRACT-COMPOSITION_AMENDMENT.md`.

## Receptor por jerarquía

- Cuando un cortador tiene una malla (`mesh`) o primitiva (`primitive`) entre sus ancestros, **el ancestro compatible más próximo es su receptor exclusivo**. Esto incluye parentescos intermedios mediante grupos o `Node3D`.
- Si ese receptor tiene `props.carve === false`, no se aplica el corte y **no** se busca un receptor alternativo de forma global.
- Sin un ancestro de ese tipo, el cortador conserva la operación global sobre los receptores compatibles que intersecta. Así se preserva el comportamiento de los nodos existentes en la raíz.
- `subtract` puede guardar opcionalmente `props.receiverId` para limitarse a una única primitiva o malla. Esa referencia prevalece sobre la jerarquía; si queda obsoleta, el nodo no degrada a alcance global.
- Al reparentar un cortador, el receptor se vuelve a resolver sin añadir ni migrar campos a los objetos almacenados. Dos cortadores de distinto tipo pueden afectar a un mismo receptor y siguen usando el CSG existente.
- El Inspector muestra el receptor por jerarquía en los dos nodos. Una referencia manual `props.sourceId` de `meshSubtract` permanece independiente; si coincide con el receptor produce el mismo vaciado interior que la selección automática. Con `sourceId` vacío, el padre compatible se resuelve como fuente y receptor automáticamente.

## Alineación de espacios

- La geometría de la referencia `meshSubtract` sigue consumiendo su forma y transformación mundial, pero se convierte al **espacio de la raíz del padre del cortador** antes de mostrarse y de pasar al CSG.
- Para un cortador bajo un receptor, la conversión de la geometría desde fuente a padre es `inverse(M_padre_raíz) * M_fuente_visual`. La pose y escala propias del cortador son un desplazamiento/transformación adicional, aplicado una única vez.
- La matriz de operación sobre el receptor es `inverse(M_receptor_visual) * M_cortador_visual`. El volumen dibujado y la geometría que recibe CSG comparten estas transformaciones y ya no duplican el desplazamiento de la fuente con el del padre.
- `M_padre_raíz` excluye la escala propia de la malla padre: en Century, las escalas de las mallas viven en el grupo visual, mientras la jerarquía de raíces propaga las transformaciones de `Node3D` y `sceneInstance`.
- Sin padre, `M_padre_raíz` es la identidad y la geometría de una referencia externa conserva su comportamiento previo.
- En evaluación temporal (`timeline`), las matrices proceden de las raíces Three.js evaluadas y de sus grupos visuales, sin escribir poses efímeras sobre los objetos autorales.

## Integridad

- No se crea un segundo CSG, duplicación de recursos, estado `receiverId` persistente ni migración de escenas.
- Se preserva el orden determinista `meshSubtract` antes de `subtract` en composiciones mixtas, y el orden previo cuando solo existe un tipo.
- Se conserva el criterio de malla fuente cerrada. La autorreferencia sólo se admite cuando fuente y receptor jerárquico coinciden; las fuentes globales independientes siguen protegidas. La colisión de huecos requiere un `TriMeshShape3D` del receptor compatible; los `BoxShape3D` no reflejan el vaciado.
- Se añade actualización CSG tras sincronizar transformaciones de `Node3D` y `sceneInstance`, sin reconstrucción por fotograma ni cambio de las colisiones ajenas.

## Fuente y límites

Entrada: `CENTURY-EDITOR-MESH-S02-G001-CORR-001-MIXED-SUBTRACT-COMPOSITION_SOURCE_BASELINE.zip`. No se tuvo acceso a modificaciones locales posteriores al ZIP; deben revisarse antes de aplicar el CHANGE. No hay paquetes, API pública ni costes de licencia nuevos. La compilación completa y la revisión visual en Electron siguen pendientes de evidencia.

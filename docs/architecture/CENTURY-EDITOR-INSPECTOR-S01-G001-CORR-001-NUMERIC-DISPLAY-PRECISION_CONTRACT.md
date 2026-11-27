# Precisión visual de transformaciones

Gate ratificado y autorizado literalmente. Base: CENTURY_EDITOR_UX_S04_G001_CORR002_SOURCE_BASELINE.zip (4070 archivos, CRC y extracción verificados; árbol local del usuario no accesible). La base acumulativa no implica aprobar Gates anteriores.

Extender NumberField/Vec3Field con precisión de presentación independiente de `decimals` (operativa). Usar máximo dos decimales en transformaciones de nodo, escala uniforme, selección múltiple y Edit Mesh; revelar el número completo al enfocar. No redondear el modelo, no modificar Snap, gizmos, Undo/Redo ni propiedades de precisión especial. Mantener valores mixtos como vacío y no confirmar sin edición. QA específico de handlers, regresiones y fixture Vue/Electron. Aprobación y cierre requieren evidencia local.

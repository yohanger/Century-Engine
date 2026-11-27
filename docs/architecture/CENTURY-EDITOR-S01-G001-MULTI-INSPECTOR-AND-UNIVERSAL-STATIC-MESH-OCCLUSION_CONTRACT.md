# Century Engine — Inspector contextual y oclusión universal de mallas estáticas

**Gate autorizado:** `CENTURY-EDITOR-S01-G001-MULTI-INSPECTOR-AND-UNIVERSAL-STATIC-MESH-OCCLUSION`

**SOURCE_BASELINE:** `CENTURY-EDITOR-SUBTRACT-S01-G001-CORR-001-SELECTION-RAYCAST-PRIORITY_SOURCE_BASELINE(1).zip`, proporcionado por el usuario. Pre-1.0: sin migraciones obligatorias ni eliminación de escenas.

## Autoridad y comportamiento

El Inspector único de Century continúa siendo propietario del contexto individual y de la multiselección. Una selección múltiple debe mostrar la identidad del nodo activo y los controles aplicables a **todos** los nodos elegidos, sin sustituirlos por un panel informativo de acciones. La UI no muta otros nodos fuera de la selección.

El estado mixto se representa como checkbox indeterminado o campo numérico vacío con marcador. No se homogeniza ningún valor hasta que el usuario lo edite. Activo, Visible, Estático, DontDestroyOnLoad, transformación por eje, apariencia y propiedades geométricas seguras (Escalones y Recibe cortes) son compartidos cuando todos los nodos admiten la propiedad. Se excluyen los nodos enlazados/bloqueados de una operación conjunta (sin modificaciones parciales). Las transformaciones respetan los enlaces de escala de primitivas.

La transacción primero valida el estado de todos los destinatarios, luego sincroniza cada nodo y finalmente crea **un único commit** del historial. Ante un fallo de sincronización, restaura los campos de autoría de toda la selección; no registra historial de una edición fallida. La revisión de Undo/Redo real en Electron sigue pendiente.

## Oclusión estática

El atributo Estático pertenece al nodo de escena y no depende de que su geometría conserve la forma paramétrica original. Todas las **mallas renderizables, con geometría fija verificable**, marcadas Estático participan como candidatas del horneado, incluidas mallas indexadas/no indexadas y editadas mediante Edit Mesh. La superficie opaca puede ser oclusora si tiene material estable sin recortes alpha, sin transparencia y sin deformación dinámica. Mallas transparentes o materiales no certificables participan como posibles objetivos, pero no autorizan ocultar otra malla.

La versión de horneado pasa a **2** para invalidar conservadoramente los datos anteriores. Las escenas y recursos se mantienen intactos; solo es necesario volver a hornear cuando el usuario quiera oclusión precalculada.

Las superficies oclusoras se construyen a partir de **triángulos reales**: se combinan pares coplanares que constituyen paralelogramos completos y se usa un pequeño paralelogramo interior en triángulos sueltos. No se sustituye un objeto recortado por su caja envolvente: los agujeros se conservan. El algoritmo GPU solo utiliza el plano de estas superficies para certificar el descarte y procesa mallas y superficies por lotes sin truncar silenciosamente el conjunto por un límite de 128 oclusores. El resultado es conservador: una superficie compleja puede no lograr ningún descarte; se prioriza evitar falsos negativos de visibilidad (ocultar objetos que deberían verse).

Antes de ocultar, la cámara comprueba material, estado Estático, matriz, cara, firma actual de vértices/índices de oclusor y objetivo, y posición real respecto al plano cercano. Un cambio posterior al horneado impide utilizar testimonios obsoletos. Un cambio de propiedades estáticas, de visibilidad o de transformaciones compartidas invalida el bake persistido. Un horneado con cero o una malla es válido y produce cero descartes.

## Preservación de sistemas

- No modificar TriangHor, físicas/Jolt, `setPointerCapture`, CSG/Substract ni el Editor de mallas.
- No duplicar Inspector, sistema de historia ni algoritmo de oclusión.
- No añadir dependencias nuevas. La distribución incluye los mismos scripts y contratos previos.
- No operar Git; entregar CHANGE ZIP y SOURCE_BASELINE sin compilaciones ni cachés.
- QA Node no sustituye compilación ni QA visual de Electron/Player o validación real del shader WebGL2.

## Criterios de aceptación pendientes

Además de los controles Node: validar el Inspector con tres cubos y selección mixta, un solo Undo/Redo, entradas numéricas, una pared de malla editada con un hueco real, una malla importada, materiales transparentes, mutación tras bake, rendimiento en el equipo objetivo y paridad Editor/Player. Cerrar únicamente tras evidencia real y aprobación del propietario.

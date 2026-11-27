# Mover a grupo — contrato autorizado

Gate `CENTURY-EDITOR-HIERARCHY-S01-G001-MOVE-TO-COLLECTION-GROUP`, ratificado y autorizado literalmente por el usuario. SOURCE_BASELINE de entrada: `CENTURY_ENGINE_MATERIALS_S01_G001_SOURCE_BASELINE.zip` (3862 archivos), cotejado byte a byte con la copia de trabajo; diferencias externas no verificables. El Gate de materiales fue aprobado explícitamente por el usuario; no se presume QA no aportado ni cierre. Se mantienen los estados previos de Modo Local y selección jerárquica.

## Autoridad y alcance
- El menú contextual de Jerarquía añade «Mover a grupo» junto a Emparentar. Se reutiliza MenuList para el submenú lateral, con buscador fijo y hasta 10 filas completas (28 px cada una), desplazamiento vertical, adaptación al viewport y búsqueda por nombre/ruta sin acentos ni distinción de mayúsculas.
- Destinos autorales de la escena actual: Node, Node3D y Grupo vacío. Excluir escenas vinculadas como destino, nodos derivados, bloqueos, ciclos, destinos incompatibles y operaciones sin cambio. No se confunden con los grupos de scripting. Un Node sin Transform solo admite cambios de espacio compatibles.
- Se mueven raíces de la selección, preservando selección, datos, parentesco interno, matrices mundiales cuando sean representables y orden relativo de los movidos. Los nodos ya en el destino no se reordenan. Una única transacción en el historial. Se revalida el destino al ejecutar; no se permite un cambio de proyecto/escena. Se reutilizan las validaciones de física y parentesco y el mecanismo de reparentado. El alineamiento automático de Mesh Subtract conserva su autoridad: no se ofrece un destino que exigiría tal alineamiento.
- Sin dependencias nuevas, modificación de esquema, cambios de runtime/Player, nuevas ventanas, migraciones ni cambios de la selección desde viewport. La validación de transformaciones sigue usando las matrices existentes. No se encontraron contradicciones con el contrato de menús vigente.

QA Node focal y regresiones; fixture Vue/Electron con búsqueda, filas, scroll, reparentado y Undo/Redo real; build y QA manual local separados. Sin evidencia de QA local, Gate no aprobado y no cerrado.

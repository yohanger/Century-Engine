# Contract Amendment — LF-EDITOR-VIEWPORT-CONTROLS-S02-G001-INTEGRAL / CA-004

**Estado:** CORRECCIÓN DE QA solicitada por el usuario dentro del Gate S02 autorizado; no equivale a aprobación ni cierre del Gate.
**Fuente:** captura de QA local `docs/qa/evidence/LF-EDITOR-VIEWPORT-CONTROLS-S02-G001-INTEGRAL/user-negative-handles.png` y rechazo expreso de S02.
**Reemplazo limitado:** cláusulas 3 y 5 de `LF-EDITOR-VIEWBAR-UX-CA-003.md`, solo en geometría visible, pickers y tamaño de gizmos de objeto. Las restantes cláusulas de CA-003 continúan vinculantes.

1. **Tres asas, no seis:** Move y Scale mostrarán una sola asa en sentido positivo por cada eje X/Y/Z; no aparecerán conos/cubos negativos. Los ejes seguirán admitiendo arrastre bidireccional desde el asa positiva. Planos XY/YZ/XZ y centro XYZ de Scale se conservan.
2. **Picker coherente:** los selectores del addon deben retirarse en los mismos extremos negativos que la geometría visible; esconder solo las mallas constituye una corrección incompleta.
3. **Tamaño histórico:** recuperar las proporciones del `SOURCE_BASELINE` anterior a S02: Scale 0.50, Move 0.85, Rotate 0.95, todas multiplicadas por la preferencia única `store.prefs.gizmoSize` (0.5–4, valor inicial 1). Universal reutiliza las mismas tres proporciones; no amplifica esos valores por modalidad.
4. **Mecanismo:** preservar los tres `TransformControls` originales, sin copiar geometrías, crear nuevos pickers ni modificar `node_modules`. La corrección puede retirar únicamente las mallas/bounds negativas ya presentes en los grupos privados del addon Three.js r186.1, una sola vez durante `_buildGizmo`. Deben existir pruebas con grupos reales en el fixture Electron, porque los dobles Node no prueban la implementación del addon.
5. **Sin cambios:** transformaciones, Snap+Shift, selección múltiple, Undo/Redo, Global/Local, FilmMaker, Terrain, Edit Mesh, persistencia, Player, exportación y docking.

**Contradicción resuelta:** CA-003 solo eliminó las copias de asas creadas por LevelForge, no las seis asas originales de Three.js r186. La corrección modifica esa interpretación incompleta. La preferencia de tamaño no desapareció, pero S02 introdujo coeficientes distintos a los del baseline vigente; se restituyen.

**Evidencia para aprobación:** 3 asas positivas visibles en Move y Scale, 3 pickers positivos por modo, centro XYZ de Scale, preferencias funcionales, Node/Electron con addon real, build, y QA visual del usuario. S02 permanece **NO APROBADO** hasta nueva evidencia y aceptación.

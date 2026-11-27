# Century — Modo Local de Edit Mesh

Gate ratificado y autorizado literalmente por el usuario: `CENTURY-EDITOR-MESH-S01-G001-BLENDER-LOCAL-VIEW-ISOLATION`.

- Solo Edit Mesh: `/` (incluida la distribución que requiere Mayús) y `Numpad /`, sin repetir al mantener la tecla. Respetar foco de campos, alcance de atajos, operaciones modales y Play.
- La autoridad de la malla es EditSession. El viewport existente dibuja únicamente su rama visual y conserva los ancestros necesarios para las transformaciones mundiales. Los hijos lógicos, objetos, terreno, agua, vegetación, cielo, efectos y helpers ajenos no se dibujan. La máscara es temporal, reversible incluso si falla el dibujo; no altera objetos de autoría, materiales, geometría ni historial.
- El pase de aislamiento usa el renderer y cámara existentes, fondo neutro y luces editoriales existentes, sin efectos ambientales ni postproceso del juego. No es un nuevo viewport ni un modo de diagnóstico de rendimiento. La vista normal y sus ajustes se conservan.
- Encuadrar la malla completa, no solamente los elementos seleccionados; permitir navegación y operaciones de malla. Restaurar snapshot de cámara al desactivar, salir de edición, cambiar de escena o iniciar Play. El snapshot no se guarda como vista de escena ni se usa para miniaturas. Undo/Redo dentro de la misma sesión conserva el aislamiento; si cambia la sesión se desactiva.
- Sin dependencias nuevas ni migraciones. QA Node sobre el mecanismo y rutas de integración; QA visual Electron y compilación por separado.

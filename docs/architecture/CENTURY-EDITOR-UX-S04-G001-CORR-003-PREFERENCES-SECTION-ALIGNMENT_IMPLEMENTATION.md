# Alineación de Preferencias del editor

Gate ratificado y autorizado literalmente. Base `CENTURY_EDITOR_STABILITY_POINTER_DOM_FOCUS_SOURCE_BASELINE.zip`: 4.135 archivos, CRC correcto; copia disponible idéntica en todos los archivos de la base. La copia contiene además 132 archivos de dependencias instaladas excluidos del empaquetado anterior; no se incorporan. Árbol local del usuario no accesible.

La regla global `button` de `src/styles.css` establece `justify-content: center`. Los selectores locales `.prefs-nav button` y `.section-head` solo especificaban `text-align:left`, que no alinea elementos flex. Se establece `justify-content:flex-start` en ambos selectores. Los textos permiten ajustar su ancho sin desplazar sus iconos; se preservan los tamaños, gaps, estados y las reglas responsive existentes. El icono existente ya tiene `flex:none` en `Icon.vue`. Ninguna modificación de plantilla, script, CSS global, TOML ni dependencias.

Se agrega QA aislado de estilos, un runner Electron con el componente real y se conserva la regresión de sensibilidad. Aprobación y cierre sujetos a evidencia local.

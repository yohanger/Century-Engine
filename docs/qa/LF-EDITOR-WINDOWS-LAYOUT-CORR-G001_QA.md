# LF-EDITOR-WINDOWS-LAYOUT-CORR-G001 — QA y contrato ejecutado

**Autorizado:** 2026-10-28 · `Listo. LF-EDITOR-WINDOWS-LAYOUT-CORR-G001 autoriza comenzar`.
**Estado:** IMPLEMENTADO · QA NODE PASS · BUILD Y QA VISUAL WINDOWS/LINUX NO VERIFICADOS · APROBACIÓN DEL USUARIO PENDIENTE.

## Fuente y alcance

Baseline `LevelForge_EDITOR_DISTRIBUTION_LINUX_WINDOWS_G001_SOURCE_BASELINE.zip`, 902 archivos, ZIP íntegro. El objetivo es mantener Hierarchy, Inspector y Proyecto/Consola accesibles al reducir la ventana de escritorio Electron y conservar sus dimensiones preferidas. El modo navegador/tableta/móvil, la configuración de Play maximizado, el Player, la exportación de juegos y la distribución desktop no cambian.

## Causa raíz y corrección

`src/App.vue` elegía automáticamente el modo `tablet` con `innerWidth < 1100`, incluso en Windows Electron: los paneles fijos desaparecían del árbol de componentes y eran reemplazados por cajones. Con el escalado de Windows (125 % o 150 %), un ancho de pantalla aparentemente grande puede producir un ancho CSS menor que 1100.

- `editorScreenMode`: Electron siempre conserva modo `desktop`; el navegador mantiene `desktop/tablet/phone` por ancho.
- `fitEditorDocks`: Hierarchy/Inspector/Proyecto se ajustan dentro del tamaño CSS actual. El viewport mantiene un espacio reservado y los tamaños preferidos del usuario **no se sobrescriben** por una reducción de pantalla.
- Los splitters de Hierarchy e Inspector conocen límites máximos dinámicos; al arrastrar uno, se prioriza su tamaño sin forzar el cierre del panel contrario.
- Proyecto/Consola utiliza altura máxima dinámica con el fin de no colapsar el viewport. `leftOpen`, `rightOpen`, `bottomOpen`, sus tamaños y pestañas siguen almacenados en `levelforge:prefs`.
- `AppWindow` deja de imponer pantalla completa automática por el breakpoint móvil cuando se ejecuta en Electron; sigue ajustando tamaño/posición del diálogo al área disponible y recupera la geometría guardada.
- `FloatingEditorWindow` persiste posición y maximización por nombre de ventana y recupera ventanas arrastradas fuera del área visible. El Shader Graph acoplado no guarda posición flotante.
- Una prueba histórica de `AppWindow` se actualizó para exigir el nuevo contrato Electron/navegador en lugar de la antigua expresión literal.

**Sin cambios** en componentes de cámara, Shader Graph, CSG, Jolt, Player ni runtime.

## Evidencia automatizada

| Suite | Resultado |
| --- | --- |
| `node --test scripts/test-editor-windows-layout-corr-g001.mjs` | **36 PASS / 0 FAIL** |
| `node --test scripts/test-editor-windows-layout-corr-g001.mjs scripts/test-cmd-window.mjs` | **43 PASS / 0 FAIL** |
| Regresión disponible sin `test-starcat.mjs` ni benchmark `test-clouds.mjs` | **2037 PASS / 0 FAIL / 18 SKIP** |
| `node scripts/test-clouds.mjs` aislado, última repetición | **PASS** (prueba de tiempo intermitente) |
| Total de la colección combinada | **2038 PASS / 0 FAIL / 18 SKIP** (el benchmark pasó en ejecución separada) |
| `npm run build` | **NO VERIFICADO** — `vite: not found`, exit 127 |
| Windows 100/125/150 %, Electron, Linux | **QA VISUAL NO VERIFICADA** |

El benchmark `test-clouds.mjs` falló intermitentemente por la condición temporal de horneado (87.9 ms y 141.4 ms en intentos fallidos; pasó en repetición aislada). El código del sistema de nubes no ha cambiado; no se afirma estabilidad de esa prueba de rendimiento. La regresión completa en una sola ejecución secuencial fue interrumpida por el límite de ejecución antes de emitir resumen, por eso la evidencia válida es la ejecución paralela **sin** el benchmark más la ejecución aislada de éste. `test-starcat.mjs` queda excluido por dependencias Three.js ausentes en el entorno de entrega.

## QA local requerido

Instalar `CHANGE`, conservar backup del ledger y archivos modificados; abrir en Windows con `npm run electron` o build empaquetado y repetir en Linux.

1. Abrir proyecto con Hierarchy/Inspector/Proyecto visibles. Reducir la ventana por debajo de 1100 px CSS: los tres paneles deben permanecer presentes y accesibles, nunca cambiar a drawers sin orden del usuario.
2. Probar 1920×1080 y 1366×768 con escalas de Windows de 100 %, 125 % y 150 %. El viewport no debe desaparecer; se pueden reducir y ampliar los paneles con sus divisores.
3. Personalizar los anchos (Hierarchy e Inspector) y la altura de Proyecto. Reducir y volver a ampliar la ventana: sus tamaños elegidos deben reaparecer.
4. Cerrar/reabrir LevelForge; conservar estados abiertos/cerrados y pestañas. Ocultar paneles voluntariamente desde Toolbar y comprobar persistencia.
5. Abrir un diálogo AppWindow y un editor flotante (Event Editor / Shader Editor). Arrastrarlos, cerrar/reabrir y verificar que su posición se mantiene. Reducir la pantalla y comprobar que vuelven al área visible.
6. Maximizar/restaurar, iniciar/detener Play y comprobar que «Game Maximize» sigue ocultando paneles **solo cuando se ha activado esa opción**.
7. En navegador no Electron, comprobar que los modos tableta y móvil siguen funcionando.
8. Construir Editor y Player con `npm run build` en un equipo con dependencias disponibles; no declarar compilado hasta verificarlo.

**Condición de cierre:** aportación de QA visual Windows/Linux, build local y aprobación explícita del usuario. Los resultados Node no demuestran píxeles reales de Electron ni el comportamiento del compositor de ventanas de Windows.

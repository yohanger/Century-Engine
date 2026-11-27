# LF-PROJECT-SAFE-G001 — Protección del proyecto abierto

**Fecha:** 2026-10-24  
**Estado:** IMPLEMENTADO · PENDIENTE COMPILACIÓN Y QA VISUAL/LOCAL

## 1. Problema observado y alcance

En el baseline `LevelForge_UI_SYSTEM_ASSETS_G001_SOURCE_BASELINE.zip`, la función `removeProject(id)` de `src/core/state/project.js` ejecutaba `db.deleteProject(id)` **antes de evaluar si ese proyecto estaba abierto**. Esto permitía eliminar de IndexedDB las escenas y los assets de un proyecto en uso. La ventana Proyectos y la bienvenida mostraban «Eliminar/Quitar» sin la protección necesaria.

**Contrato:** impedir eliminar el proyecto activo y desbloqueado, manteniendo eliminación normal, previa confirmación, de proyectos inactivos. No bloquear renombrar, duplicar, guardar, cambiar o abrir proyectos. `store.locked === true` representa el modo de bienvenida/placeholder, no un proyecto abierto.

## 2. Cambios implementados

- `src/core/state/project.js`: `isProjectOpen(id)` evalúa identidad y `store.locked` usando el estado existente. `removeProject(id)` **antes** de llamar a la base de datos comprueba ese estado, muestra un aviso y devuelve `false` si intenta eliminar el proyecto activo; devuelve `true` al eliminar uno inactivo. Ya no elimina el activo para abrir otro automáticamente.
- `src/components/ProjectsModal.vue`: botón Eliminar desactivado para el proyecto abierto, mensaje visible, aviso si se invoca la acción por otra vía. Tras confirmar, actualiza la lista solo si se eliminó.
- `src/components/WelcomeScreen.vue`: acción Quitar desactivada para un proyecto que esté realmente abierto, aviso por acceso mediante tecla Supr, referencia fija del proyecto elegido durante la confirmación.
- Se preservan `db.deleteProject`, `duplicateProject`, `renameProject`, `openProject`, `saveNow` y sus firmas. No hay un nuevo gestor de proyectos.

**Límite de protección:** El código impide borrar los registros del proyecto desde las acciones de LevelForge que invocan `removeProject`. La eliminación normal quita datos del navegador/IndexedDB; no borra la carpeta física del disco. No se intenta proteger frente a modificaciones hechas externamente sobre el sistema de archivos.

## 3. Reconciliación del baseline recibido

El usuario adjuntó **G001 sin el correctivo `LF-UI-SYSTEM-ASSETS-G001_CORR-001`**. Esta entrega compara contra el ZIP aportado y, por seguridad, **incluye también la corrección de las exportaciones duplicadas `resetSystemUi`**. Reconciliar el baseline no reabre el alcance tipográfico ni cambia el comportamiento de las interfaces del sistema:

- `resetSystemUi(id)` restaura un documento `sys:*`.
- `resetAllSystemUi()` restaura los nueve recursos del sistema sin alterar Canvas propios.
- `ThemeEditor` importa la función global desde el módulo de UI correspondiente.
- Las tres pruebas de regresión `SYSUI-CORR-01..03` aseguran esta separación.

El Change ZIP es acumulativo respecto al **ZIP G001 efectivamente adjunto**. Puede instalarse sobre ese G001 o sobre un proyecto al que ya se haya aplicado el correctivo anterior; no restablece la exportación ambigua.

## 4. Evidencia de pruebas

`node --test scripts/test-db-contract.mjs` → **371 PASS · 0 FAIL · 0 TODO**:

- 356 pruebas originales del baseline proporcionado.
- 3 pruebas de corrección previa UI System (`SYSUI-CORR-01..03`).
- 12 pruebas nuevas de protección (`SAFE-01..12`), incluidas ejecuciones de las funciones **reales** `isProjectOpen` y `removeProject` con dependencias simuladas y comprobación de que no se llama a `db.deleteProject` cuando el ID está abierto.

`node --check` en los módulos JS relevantes: **PASS**. No se detectan exportaciones con nombre duplicado en el barrel de estado.

`npm run build` → **NO EJECUTABLE EN ESTE ENTORNO**: `sh: 1: vite: not found`. El baseline necesita que en el equipo local estén instaladas las dependencias. No hay evidencia de compilación Vue/Electron/Player aquí.

## 5. QA funcional local (pendiente)

| ID | Acción | Resultado esperado |
|---|---|---|
| SAFE-LOCAL-01 | Abrir un proyecto y abrir Proyectos | El proyecto activo muestra «Abierto», Eliminar deshabilitado y motivo visible |
| SAFE-LOCAL-02 | Intentar eliminar el activo por otra ruta/código | Aviso; `db.deleteProject` no debe ejecutarse |
| SAFE-LOCAL-03 | Duplicar el proyecto activo | Nueva copia aparece sin modificar la original |
| SAFE-LOCAL-04 | Renombrar el proyecto activo | Nombre cambia y se conserva al guardarlo |
| SAFE-LOCAL-05 | Guardar escenas y assets | Sin pérdida de datos |
| SAFE-LOCAL-06 | Eliminar proyecto inactivo desde Proyectos | Confirmación y eliminación normales |
| SAFE-LOCAL-07 | Cambiar a otro proyecto | Se habilita Eliminar para el anterior; se bloquea el nuevo activo |
| SAFE-LOCAL-08 | Abrir WelcomeScreen sin proyecto activo (`locked`) | Quitar un proyecto en la lista funciona con confirmación |
| SAFE-LOCAL-09 | En bienvenida, usar tecla Supr sobre un proyecto abierto | No elimina el proyecto; muestra aviso |
| SAFE-LOCAL-10 | Cancelar la confirmación de eliminación | El proyecto inactivo permanece intacto |
| SAFE-LOCAL-11 | Compilar `npm run build` | Se compilan editor **y** Player sin conflictos de `resetSystemUi` |
| SAFE-LOCAL-12 | Revisar project.lfproj y carpeta física | La eliminación desde navegador no borra archivos físicos por accidente |

**Criterio de aceptación:** QA local, compilación real de editor y Player, confirmación del usuario. La ejecución de Node no certifica la interfaz gráfica.

## 6. Comandos para QA

```bash
cd "$HOME/ENGINES/lf-0.26.13/lf"
unzip -o "$HOME/Downloads/LF-PROJECT-SAFE-G001_CHANGE.zip" -d .
node --test scripts/test-db-contract.mjs
npm run build
```

**Nota:** antes de sobreescribir archivos, cotejar el Change ZIP con el código local, preservando modificaciones manuales que el usuario haya incorporado fuera del baseline declarado.

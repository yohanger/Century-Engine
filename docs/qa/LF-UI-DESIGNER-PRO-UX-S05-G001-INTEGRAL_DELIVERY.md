# S05 UI Designer — Entrega incremental y baseline acumulativo

**Base exacta:** `LevelForge_SCRIPT_EDITOR_GODOT_UX_S04_G001_INTEGRAL_CLOSE_SOURCE_BASELINE.zip`.
**Gate:** `LF-UI-DESIGNER-PRO-UX-S05-G001-INTEGRAL`.
**Estado:** IMPLEMENTADO; QA LOCAL PENDIENTE. Ledger: ROADMAP, BACKLOG, DEPENDENCIES, GATES, EVIDENCE, TRACEABILITY.

- `LevelForge_UI_DESIGNER_PRO_UX_S05_G001_INTEGRAL_CHANGE.zip`: exclusivamente rutas nuevas/modificadas, QA, documentación y ledger.
- `LevelForge_UI_DESIGNER_PRO_UX_S05_G001_INTEGRAL_SOURCE_BASELINE.zip`: todos los archivos del proyecto con cambios acumulados (base de siguiente Gate, solo tras aprobación).

## Instalación

**Recomendada:** extraer solamente SOURCE_BASELINE en nueva carpeta de pruebas, separada del proyecto operativo, por ejemplo `~/Desktop/LevelForge_S05_UI_DESIGNER_QA`. Instalar dependencias con `npm ci` si hace falta.

**Incremental:** aplicar CHANGE solo sobre una copia idéntica al SOURCE_BASELINE S04 CLOSE. Comparar primero archivos del ZIP con cambios locales; sustituir solo rutas incluidas. No extraer los dos paquetes uno sobre otro, no sobrescribir proyectos/escenas/Assets personales, no borrar el baseline anterior hasta QA.

## QA

Ejecutar los dos `node --test` de la matriz, `npm run build` y `npm run electron`. Esperado 15 Node PASS; Electron un test con al menos 16 checks (no verificado aquí). Entregar stdout de fallos, captura del editor en diseño y confirmación de guardado/reapertura de `.ui`. No se deben usar navegadores externos para QA visual; Electron embebido es obligatorio.

**Preservar:** `node_modules` no se distribuye; no se incluyen `dist`, `dist-player`, caches ni temporales. El CHANGE no toca VCS Git ni sus permisos 0755; SOURCE_BASELINE sí debe preservarlos.

## Entrega de cierre (2026-11-03)

S05 fue **APROBADO Y CERRADO funcionalmente** tras QA local declarado por el usuario. Se genera un nuevo CHANGE exclusivo de documentación/ledger y SOURCE_BASELINE completo; esta nota no altera el significado histórico de los resultados «NO VERIFICADO» de Electron/build en la entrega inicial.

# LF-ASSETS-LPKG-G002 — Importación `.levelpackage`

## Alcance autorizado

- [X] Leer paquetes `levelforge-package` v1 exportados por G001.
- [X] Inspeccionar archivos, nombres, tipos y dependencias antes de importar.
- [X] Selección de recursos, cierre transitivo de dependencias y conflictos por recurso.
- [X] Conflictos: importar renombrado, reutilizar entrada compatible u omitir; sin sobrescritura implícita.
- [X] Remapear IDs y referencias de rutas literales en escenas, prefabs, scripts y metadatos.
- [X] Escribir metadatos, escenas y binarios en una sola transacción IndexedDB.
- [X] Preservar recursos existentes y excluir interfaces internas del sistema.
- [X] Advertir sobre referencias construidas dinámicamente y contexto global de escenas.
- [X] Actualizar el ledger en sus seis hojas.
- [ ] Verificación GUI/Electron, generación ZIP real con JSZip y prueba interproyectos en Linux.

## Contrato de seguridad

- Solo formato/version 1; rutas bajo `Assets/` sin `..`, separadores Windows ni control characters.
- Rechazar rutas/IDs duplicados, manifest inválido, entradas no declaradas, recursos ausentes y tipo no admitido.
- Límite ZIP de entrada: 96 MiB, 500 recursos; contenido total descomprimido 256 MiB, cada recurso máximo 64 MiB.
- JSZip verifica CRC32; no se extraen archivos a rutas del sistema operativo.
- Escenas, proyecto y binarios se guardan en una única transacción IDB: aborto por error sin escrituras parciales.
- La vista previa no escribe en el proyecto; el proyecto origen nunca se modifica.
- No reemplaza ni fusiona datos globales ajenos como Database, InputMap, audio, render, animaciones o localización. Las escenas que los usan pueden necesitar ajustes manuales.
- No hay Undo/Redo para modificaciones de inventario o de IndexedDB; se muestra aviso antes de confirmar. No debe simularse compatibilidad con Ctrl+Z.
- Los scripts y shaders procedentes de terceros deben considerarse contenido no confiable: revisar antes de ejecutarlos.
- Importar no significa compatible con `.unitypackage`, `.lfproj` ni paquetes Player.

## Datos afectados

- `src/core/levelpackage-import.js`: lectura, validación y planificación pura.
- `src/core/db.js`: `saveLevelPackageImport` transaccional para `projects`, `scenes`, `assets`.
- `src/core/state/project.js`: integración con guardado y aplicación a proyecto activo.
- `src/components/ProjectPanel.vue`: importar y previsualizar, selección y conflictos.
- `src/core/state/filesystem.js`: instrucción de importación desde Proyecto al arrastrar `.levelpackage`.
- `scripts/test-assets-lpkg-g002.mjs`: 23 pruebas nuevas de contrato/dinámica mock.
- `docs/qa/LevelForge_DB_Ledger.xlsx`: seis hojas actualizadas.

## Evidencia automatizada

- [X] `node --test scripts/test-assets-lpkg-g002.mjs` → **23 PASS / 0 FAIL**.
- [X] Regresión secuencial de `scripts/test-*.mjs` excepto `test-starcat.mjs` (requiere Three.js no instalado) → **1013 PASS / 0 FAIL / 18 SKIP**.
- [X] Verificación de sintaxis JS; ZIP y comparación binaria de entrega.
- [ ] `npm run build` del Editor/Player: `vite` ausente en este entorno. **NO considerar build PASS**.
- [ ] Prueba de importación real usando JSZip/IndexedDB y archivos `.levelpackage` válidos entre proyectos.
- [ ] QA visual, precarga de modelos importados, prefabs, scripts, textures, Player exportado.

## QA manual en Linux (requerido para aceptación)

1. [ ] `npm run build && npm run electron:dev` sin errores.
2. [ ] Crear proyecto A; importar modelo, textura y prefab; exportar `.levelpackage` con G001.
3. [ ] Crear proyecto B; abrir la vista previa del `.levelpackage`; validar rutas y dependencias.
4. [ ] Importar modelo y prefab; colocarlo en viewport; textura visible y no se pierden referencias.
5. [ ] Importar una escena; abrirla en B; el terreno y los nodos funcionan; confirmar advertencia de contexto global.
6. [ ] Importar el mismo paquete dos veces; elegir Renombrar en un recurso y Reutilizar en otro; nunca sobrescribir silenciosamente.
7. [ ] Omitir una dependencia obligatoria y comprobar que la importación se rechaza sin cambios.
8. [ ] Usar `.levelpackage` truncado o con manifiesto alterado: rechazo sin modificación de Assets.
9. [ ] Simular fallo de almacenamiento/cuota IndexedDB y confirmar ausencia de escenas o binarios parciales.
10. [ ] Guardar, cerrar y volver a abrir B; los recursos importados siguen disponibles; comprobar `.lfproj` exportado.
11. [ ] Comprobar que Undo/Redo no se presenta como capaz de revertir importaciones de Assets.
12. [ ] Revisar scripts con rutas o IDs construidos dinámicamente.

## Exclusiones explícitas

- Exportación G001 intacta.
- Sin compatibilidad directa con UnityPackage.
- Sin migración automática de configuración global ajena.
- Sin integración de Vertex Paint, UV ni herramientas nuevas de Edit Mesh.

# LF-TIMELINE-LIBRARY-ASSETS-S06-G001 · Entrega y QA

CORR-001 vigente: el usuario reportó un fallo del fixture Electron. Ver LF-TIMELINE-LIBRARY-ASSETS-S06-G001_CORR-001_QA.md para diagnóstico, fixture corregido y ejecución actual. La evidencia histórica de esta entrega se conserva; el Gate sigue abierto.

Base: SOURCE_BASELINE VSCODE EXTENSION INTEGRATION S03 G001 aprobado, 2.034 archivos.
Estado: IMPLEMENTADO · QA LOCAL PENDIENTE · NO APROBADO · NO CERRADO.

## Funcionalidad

Timeline dispone de biblioteca lateral, búsqueda, selección y Nuevo Timeline con nombre. Al confirmar se crea una secuencia vacía en Assets y se abre el editor existente. Cancelar no crea recursos. Desde Assets se respeta la carpeta actual válida. Crear y editar marca el proyecto para guardado mediante su mecanismo existente; no equivale a confirmar un guardado en disco.

Los timelines siguen en project.timelines/project.json. La carpeta es metadato opcional, con Assets por defecto. Copiar ruta copia una ruta lógica; no se genera un segundo archivo de timeline ni otra colección de recursos.

Assets habilita Renombrar, Duplicar, Mover a, Exportar selección, Copiar ruta y Eliminar para timelines nativos. F2/Ctrl+D/Supr y arrastre reutilizan los handlers existentes. Duplicar cambia IDs del recurso, pistas y claves. Mover conserva el nombre; si hay colisión se rechaza. Renombrar comprueba nombres y referencias explícitas en escenas, prefabs, eventos y timelines. Un uso por nombre bloquea el cambio; los usos por ID permanecen válidos. Se advierte antes de renombrar porque no se reescriben referencias dentro de scripts. El Inspector y la barra usan la misma operación.

Mover, renombrar y eliminar carpetas incluyen los timelines contenidos. El historial conserva las operaciones; eliminar una carpeta con timelines se deshace como una operación. Las carpetas del sistema y Cinematics siguen protegidas.

La exportación e importación .levelpackage admite timelines nativos, valida el cuerpo y su identidad, incluye audio por ID/nombre y otros timelines referenciados mediante campos explícitos. Al importar se generan IDs nuevos, se resuelven colisiones y se remapean las referencias detectadas. Los enlaces a nodos de escena y las referencias dinámicas requieren revisión en el destino; no se importan automáticamente todos los nodos del proyecto. Un importador anterior que no conozca este tipo rechazará ese paquete; no se cambia el formato del proyecto ni del juego.

Cinematics conserva únicamente las películas FilmMaker. La biblioteca de autoría excluye esos recursos. El editor de pistas y su preview se reutilizan; runtime/Jolt y la integración VS Code no se modifican.

## Evidencia

- Node principal: 187/187 PASS. Incluye 17 comprobaciones focales y 170 de regresión Timeline/Cinematics, persistencia y paquetes.
- Regresión ampliada de Assets/DnD: 247 PASS y dos fallos históricos, reproducidos también en S03-G001: expectativa antigua de VFXResourceInspector y harness que exige la firma anterior de allEntries. No se alteran esos módulos para ocultarlos. La prueba ampliada se ejecutó antes de añadir la comprobación focal de arrastre; no sumar sus resultados con los del conjunto principal porque se solapan.
- Los harness .levelpackage antiguos eliminaban imports sin inyectar validadores de Signals que el código ya utilizaba. Se reparó ese entorno de prueba y se separó el caso de binario ausente del caso de prefab malformado, conservando el rechazo esperado. No se relajó la validación del producto.
- Electron embebido: NO VERIFICADO, sin X/DISPLAY. Fixture preparado con al menos 20 comprobaciones de biblioteca, creación, cancelación, Assets, menús, Undo/Redo y 260 px. No hay PASS visual.
- Compilación: Editor COMPILADO (829 módulos; 27,29 s, comando Vite directo) y Player COMPILADO (20,79 s). Evidencia: build-editor-summary.log y build-player.log; build.log de npm no conservó una salida final y no se utiliza como prueba de compilación. docs:check PASS, 12/12 tests del portal.
- QA local: PENDIENTE.

Evidencia: docs/qa/evidence/LF-TIMELINE-LIBRARY-ASSETS-S06-G001/. La aprobación S03 queda registrada separadamente, sin reinterpretar resultados históricos.

## Instalación

Conservar S03-G001 aprobado y extraer el SOURCE_BASELINE completo en una carpeta nueva:

`~/Desktop/LevelForge_TIMELINE_LIBRARY_ASSETS_S06_G001_SOURCE_BASELINE/`

Los ZIP contienen rutas relativas desde la raíz del motor. Allí deben quedar package.json, src/, electron/ y vendor/. CHANGE contiene únicamente archivos nuevos/modificados para revisión o aplicación sobre una copia limpia de S03-G001; no debe extraerse sobre el nuevo SOURCE_BASELINE. No hay eliminaciones de archivos.

No reemplazar proyectos de juego, escenas, scripts del usuario ni cambios locales. No borrar S03 hasta aprobar esta entrega. node_modules, dist, dist-player, release y temporales quedan excluidos.

Desde la raíz:

```bash
npm ci
node --test scripts/test-timeline-library-assets-s06-g001.mjs
node --test scripts/test-timeline-library-assets-s06-g001-electron.mjs
npm run docs:check
npm run build
npm run electron
```

Esperado: 17 pruebas focales PASS; fixture Electron con al menos 20 comprobaciones; docs:check y builds Editor/Player completos. El Electron visual debe confirmarse localmente.

## QA local prioritario

1. Abrir Timeline sin recurso seleccionado. Crear con nombre, cancelar otra creación y comprobar búsqueda, selección y aparición inmediata en Assets.
2. Crear otro con el mismo nombre; comprobar sufijo único. Cambiar de secuencia y verificar restauración del preview. Probar el panel estrecho y flotante.
3. Desde Assets, probar F2, Ctrl+D, Supr y menú contextual. Confirmar duplicado con IDs nuevos, copiar ruta y arrastrar a otra carpeta.
4. Mover un timeline; renombrar su carpeta y eliminar una carpeta de prueba. Verificar Undo/Redo y restauración de recursos y ubicación.
5. Usar un timeline por nombre en un evento: renombrarlo debe bloquearse con explicación. Cambiar la referencia a ID y repetir: el ID se conserva. Revisar manualmente los nombres escritos en scripts.
6. Exportar un timeline con audio y referencia explícita a otro timeline. Importar en un proyecto de prueba, resolver conflictos y comprobar datos, audio y referencias. Revisar enlaces a nodos de la nueva escena.
7. Guardar/reabrir proyecto y comprobar nombres, carpetas, pistas, claves e Inspector. Probar Play y Player con una secuencia existente.
8. Importar FilmMaker: la película debe aparecer en Cinematics y no en la biblioteca de autoría nativa. Verificar que no se habilite creación cinematográfica desde el visor.

Tras QA satisfactorio, «Aprobado» se registra como QA LOCAL PASS declarado. Si falla, devolver acción, mensaje y salida del test afectado. La siguiente acción real es ese QA; el puente local VS Code sigue pendiente de autorización propia.

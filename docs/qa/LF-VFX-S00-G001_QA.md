# LF-VFX-S00-G001 — Evidencia, QA previsto y entrega

Fecha: 2026-10-28. S00 produce documentación y ledger. Estado: PENDIENTE de revisión/aprobación del usuario; no cerrado.

## 1. Evidencia y límites de este Gate

| Comprobación | Estado / evidencia |
|---|---|
| Continuidad del baseline | OBSERVADO: 991 archivos comunes idénticos; 24 añadidos en `dist-player` únicamente. |
| Auditoría de rutas | REALIZADA por lectura de código y contratos; matriz en `LF-VFX-S00-G001_AUDIT.md`. |
| Ledger | 60 registros añadidos entre las seis hojas. Recalculado y revisado visualmente; sin errores de fórmula encontrados. |
| Preservación del ledger | Valores, fórmulas, estilos, alturas/anchos, vistas, validaciones y tablas anteriores conservados. Solo se actualiza A2 como resumen vigente; su texto anterior queda registrado en §2. |
| Alcance de fuente | Cuatro documentos nuevos y un ledger modificado. Cero eliminaciones o cambios inesperados respecto al baseline. Los 49 archivos protegidos de eventos permanecen byte idénticos. |
| ZIP de entrega | CHANGE: 5 archivos. SOURCE_BASELINE: 995 archivos. Integridad CRC y correspondencia de sus contenidos comprobadas durante el empaquetado. |
| Paquete Three.js instalado | NO VERIFICADO: no está instalado en esta copia. Versión declarada/lock 0.186.1. Documentación oficial consultada. |
| Implementación VFX | NO REALIZADA; fuera de S00. |
| Tests de simulación / render | NO EJECUTADOS; aún no existe implementación VFX. |
| Compilación Editor / Player de esta entrega | NO VERIFICADA. S00 no cambia fuente ejecutable ni dependencias. |
| QA visual, persistencia real en Electron, rendimiento | NO VERIFICADO; requiere Gates funcionales y evidencia local. |
| Aprobación y cierre S00 | PENDIENTES. La autorización de empezar no equivale a aceptar la entrega. |

La integridad de ZIP y la validación del ledger se informan como comprobaciones de entrega, nunca como tests del motor. Las cifras de pruebas históricas no se atribuyen a este Gate.

## 2. Conciliación histórica del ledger

Se mantienen las seis hojas, su orden, historial y contenido previo. Se añaden registros específicos de S00 y dependencias de S01–S03. Las aprobaciones recientes se registran con su fuente conversacional:

| Gate | Evidencia recibida del usuario | Registro correcto |
|---|---|---|
| `LF-EDITOR-CAMERA-STATE-FIX-G001` | Mensaje posterior a entrega: «Aprobado. AHora, el hud…» | APROBADO por usuario; no inventar logs, mediciones o compilación. |
| `LF-EDITOR-HUB-POLISH-G001` | Mensaje posterior: «Aprobado. Sigamos» | APROBADO por usuario; QA detallado y build no aportados en este hilo. |
| `LF-EDITOR-MENUBAR-UX-G001` | Reporte de superposición Añadir/Editar y correctivo posterior | Historial de fallo conservado; aprobación funcional a través de CORR-001. |
| `LF-EDITOR-MENUBAR-UX-G001_CORR-001` | Mensaje posterior: «Aprobado.» | APROBADO por usuario; compilación pendiente de evidencia. |

La fuente previa del ledger solo resumía el último Gate en A2 de cada hoja, sin filas completas. Se conserva el texto de ese encabezado histórico aquí: «LF-EDITOR-MENUBAR-UX-G001_CORR-001 | exclusividad Añadir/menubar | 5 pruebas estructurales PASS | build y Electron pendientes». No se borran ni reinterpretan los registros anteriores de cámara. Los contadores antiguos del ROADMAP y los rangos parciales de tablas previas no se usan como totales globales; regularizarlos íntegramente excede este Gate.

## 3. QA funcional futuro (PENDIENTE, ninguna fila ejecutada en S00)

| ID | Caso / evidencia necesaria | Gate de cierre previsto |
|---|---|---|
| VFX-Q01 | Validación del formato, extremos, no finitos y versión futura; original intacto al fallar. | S01-G001 |
| VFX-Q02 | Round-trip `.lfproj` real, identidad estable y proyecto antiguo sin VFX. | S01-G001 |
| VFX-Q03 | Undo/Redo con funciones reales; gesto único, recurso restituido y sin datos ajenos perdidos. | S01-G001/G002 |
| VFX-Q04 | Crear, renombrar, mover, duplicar y bloquear borrado con usos en otras escenas/prefabs. | S01-G002 |
| VFX-Q05 | `.levelpackage` real: textura, dependencias, colisión/remapeo de IDs, memoria e IndexedDB tras importar. | S01-G002 |
| VFX-Q06 | Pool: nacimientos, muerte, límites, curvas, semilla, reinicio y dt excesivo. Comparar valores, no código textual. | S02-G001 |
| VFX-Q07 | WebGL real: cámara perspectiva/ortográfica, alpha/aditivo, profundidad, color y textura. | S02-G001 |
| VFX-Q08 | Dos instancias/un recurso: cambios compartidos de definición y simulación independiente. | S02-G002 |
| VFX-Q09 | Local/mundo con taza móvil, padre Node3D y escala; selección del emisor sin seleccionar cada partícula. | S02-G002 |
| VFX-Q10 | Edit/Play/pausa/paso/reinicio: nunca doble tick; no ejecutar scripts en Edit. | S02-G002 |
| VFX-Q11 | 20 ciclos abrir/cerrar/cambiar escena/Undo: sin crecimiento sostenido de recursos GPU ni callbacks tardíos. | S02-G002/S03-G001 |
| VFX-Q12 | Paquete real Player con texturas, dos escenas y mismo efecto; Godot avisa si no puede representarlo. | S02-G002 |
| VFX-Q13 | Editor por recurso, abrir/guardar, teclado, sliders numéricos, curvas, selección/foco y ventanas pequeñas. | S03-G001 |
| VFX-Q14 | Preview cierra sin modificar cámara/proyección/OrbitControls/escena; cargar otro proyecto no hereda preview. | S03-G001 |
| VFX-Q15 | Vapor de café creado sin scripts; recurso modificable, disipación suave, sin iluminación falsa. Vídeo de Editor y Player. | S03-G002 |
| VFX-Q16 | Benchmark sin VFX/1/10 tazas, misma escena y GPU, calentamiento y 60 s por caso; mediana/p95 y memoria. | S03-G002 |
| VFX-Q17 | Regresión de cámara, menubar, Assets, recursos, nodos, lluvia/agua, render PSX y eventos intactos. | Integración de S02/S03 |

No se declarará PASS por compilar, por un mock del viewport o por buscar nombres de funciones. El usuario ejecuta el QA local y devuelve pasos, vídeo/capturas y logs; el asistente analiza evidencia y corrige dentro del Gate autorizado. Después se solicita aprobación de cierre y se actualiza el ledger.

## 4. Manifiesto de esta entrega

Exactamente dos ZIP, con rutas relativas a la raíz `lf/` y sin carpeta envolvente:

- `LevelForge_VFX_S00_G001_CHANGE.zip`: cuatro documentos nuevos y un ledger modificado.
- `LevelForge_VFX_S00_G001_SOURCE_BASELINE.zip`: fuente acumulada del baseline aprobado más esos cambios.

Nuevos:

1. `docs/architecture/LF-VFX-S00-G001_AUDIT.md`
2. `docs/architecture/LF-VFX-S00-G001_CONTRACT.md`
3. `docs/architecture/LF-VFX-S00-G001_SPRINTS.md`
4. `docs/qa/LF-VFX-S00-G001_QA.md`

Modificado: `docs/qa/LevelForge_DB_Ledger.xlsx`.

Eliminados respecto al baseline: ninguno. Cambios de código, pruebas de motor o dependencias: ninguno. No se añaden `.sh`, checksum separado, modelos ni escenas. Se excluyen de los ZIP de salida los 24 archivos de compilación local `dist-player/`; no se ordena borrarlos de la instalación del usuario. No hay `node_modules`, builds ni cachés generados por S00 en los ZIP.

## 5. Revisión e instalación documental

Destino conocido por el historial: `~/ENGINES/lf-0.26.13/lf`. Antes de aplicar, conservar una copia del ledger local y comparar cualquier edición posterior. No reemplazar un ledger que contenga cambios no incluidos en el baseline sin conciliarlos primero.

Comprobar el CHANGE descargado:

```bash
cd ~/ENGINES/lf-0.26.13/lf
unzip -t ~/Downloads/LevelForge_VFX_S00_G001_CHANGE.zip
unzip -l ~/Downloads/LevelForge_VFX_S00_G001_CHANGE.zip
```

Salida esperada: ZIP sin errores y únicamente las cinco rutas del manifiesto. Si coinciden y no hay cambios locales pendientes de conciliar, extraer sobre esa raíz:

```bash
unzip -o ~/Downloads/LevelForge_VFX_S00_G001_CHANGE.zip -d .
```

Se incorporan los cuatro Markdown y se reemplaza exclusivamente el ledger indicado. No tocar `src/`, `electron/`, `package*.json`, escenas/juegos de usuario, assets de proyectos, `node_modules` ni sus builds locales. No hace falta ejecutar `npm run build` para aplicar documentación; no se presenta esto como validación del motor.

El SOURCE_BASELINE es la fuente acumulada para el siguiente Gate. Extraerlo en una carpeta nueva y vacía si se desea revisar íntegramente; no superponerlo a cambios locales sin comparar. Conservar el ZIP local original, el SOURCE_BASELINE aprobado anterior y ambos ZIP de esta entrega. No hay archivos que el usuario deba eliminar por S00.

Evidencia a devolver ahora: aceptación o cambios del contrato (recurso/editor/alcance), y confirmación de que las seis hojas muestran los registros VFX y las aprobaciones conciliadas. Si el ledger local tiene novedades, aportar esa versión antes de reemplazarlo. No se solicita un vídeo de partículas porque aún no se han implementado.

Siguiente acción: aprobar/revisar S00. El primer Gate técnico propuesto es `LF-VFX-S01-G001`, declarado íntegramente en el plan; requiere su autorización exacta independiente.

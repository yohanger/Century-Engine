> **Amendment vigente LF-VFX-INSPECTOR-CA-001:** R02 pasa a abrir el Inspector con selección simple; la ventana S03 se sustituye. El resto del contrato de recurso continúa.

# LF-VFX-S00-G001 — Contrato propuesto de VFX mediante recurso

Fecha: 2026-10-28. Estado: RECOMENDADO; aprobación documental PENDIENTE. Implementación NO AUTORIZADA por S00.

## 1. Declaración íntegra del Gate autorizado

| Campo | Alcance de S00 |
|---|---|
| Objetivo | Auditar y definir un editor VFX profesional basado en recurso, con vapor de café como primer caso de aceptación. |
| Mecanismo | Contrastar contratos, fuente real, ledger y documentación oficial de Three.js; definir integración, formato, UX, pruebas y dependencias. |
| Prerrequisitos | Último baseline aprobado y contraste con `lf(2).zip`; satisfecho para auditoría. |
| Alcance permitido | Este contrato, auditoría, plan de Sprints/Gates, QA documental y actualización del ledger de seis hojas. |
| Medios indispensables | Lectura y comparación de archivos, elaboración de Markdown y XLSX, herramientas temporales de autoría/validación del ledger y empaquetado. No se entrega ni se requiere un runner de motor, plugin o escena ejecutable en S00. |
| Evidencia | Rutas/funciones observadas, diferencias entre entradas, matriz de reutilización, inspección del ledger y manifiesto de salida. |
| Contradicciones | Recurso exigido por el último mensaje; propuestas anteriores se subordinan a él. No hay implementación VFX aprobada que migrar. Ver incidencias de la auditoría. |
| Siguiente acción real | Revisión del usuario. Después, Gate específico para implementar recursos; no comenzar por dibujar partículas aisladas. |

Autorización: «Listo. LF-VFX-S00-G001 autoriza comenzar». No autoriza los Gates S01–S03 descritos en el plan.

## 2. Responsabilidades y autoridad del dato

| Elemento propuesto | Responsabilidad | No almacena |
|---|---|---|
| Recurso `.vfx`, colección `project.vfx` | Definición compartida y versionada de un efecto: emisión, movimiento, apariencia y curvas. Identidad estable. | Partículas vivas, reloj, cámara, selección o estado de paneles. |
| Nodo `VFX3D`, tipo interno propuesto `vfx`, base Node3D | Transform existente, referencia `vfxId`, activación y semilla de instancia. | Copia de la definición del efecto, árbol paralelo o cuerpo Jolt por partícula. |
| Instancia temporal del runtime | Pool, edades, posiciones, velocidades, RNG, buffers y recursos GPU propios. | Un segundo documento editable del recurso. |
| Editor VFX | Editar el recurso, deshacer/rehacer y controlar una previsualización aislada. | Un motor de partículas diferente al del Player. |

Dos tazas pueden referenciar el mismo `.vfx`: editarlo actualiza su definición compartida; pausar o reiniciar una instancia no cambia la otra. Duplicar un nodo conserva `vfxId`; duplicar un recurso crea un ID nuevo. Para una variante se duplica el recurso deliberadamente; no se añaden overrides de todos los parámetros al nodo.

Nombres `.vfx`, `project.vfx`, `VFX3D` y `vfxId` son decisiones RECOMENDADAS de este contrato, no capacidades ya presentes. Primera versión: un emisor por recurso, sin grafo de programación. Múltiples emisores, ribbons, subemisores y grafos avanzados requieren una decisión posterior del usuario.

## 3. Datos propuestos y validación

| Grupo | Datos mínimos | Regla verificable |
|---|---|---|
| Identidad | `id`, `name`, `folder`, `schemaVersion` | ID independiente del nombre/ruta; versión del recurso 1. Nombres únicos con las funciones existentes. |
| Emisión | continua o ráfaga, tasa, cantidad por ráfaga, duración, repetición, capacidad | Números finitos; tasa y cantidad no negativas; capacidad entera positiva y acotada. Ráfaga al iniciar; sin comandos de eventos nuevos. |
| Nacimiento | punto, caja o esfera; dimensiones/radio; rango de vida | Vida mayor que cero, mínimo no mayor que máximo; muestreo reproducible. |
| Movimiento | velocidad inicial y dispersión, aceleración, espacio local/mundo | Tiempo en segundos y distancias en unidades de escena. Semántica de transform explícita. |
| Apariencia | textura opcional por ID, color, tamaño, opacidad, rotación; alpha o aditivo | Fallback procedural suave si no se asigna textura. Una referencia rota se denuncia; no se oculta como fallback voluntario. |
| Evolución | curvas de tamaño y opacidad, gradiente de color | Vida normalizada 0–1, puntos ordenados, extremos definidos, valores finitos e interpolación lineal inicial. Sin overshoot implícito. |

Todo dato importado se valida antes de mutar el proyecto. Versión futura desconocida o contenido corrupto: diagnóstico y rechazo de esa operación, conservando el original. Los valores predeterminados cubren ausencia legítima, no falsifican datos inválidos.

El `.lfproj` almacena el índice del recurso en sus metadatos y el contenido canónico en el archivo `.vfx`; al abrir se hidrata `project.vfx`. No se mantienen dos cuerpos independientes. IndexedDB guarda la copia de trabajo del proyecto mediante el mecanismo existente. El paquete del juego incluye la definición una sola vez y las texturas como assets existentes.

Los proyectos antiguos sin `vfx` siguen abriendo sin añadir emisores ni carpetas. No se promete abrir recursos nuevos con versiones antiguas de LevelForge/Player. La versión propia de VFX se valida en el lector nuevo; cualquier cambio del formato general exige análisis y autorización concreta.

## 4. Contrato de recursos

| ID | Comportamiento exigido al implementar |
|---|---|
| VFX-R01 | Crear recurso desde Assets en la carpeta elegida, enfocar nombre y permitir renombrar; no abrir el editor automáticamente. |
| VFX-R02 | Un clic selecciona/metadatos; doble clic o acción Editar abre el editor VFX. Asignar desde Inspector no duplica el recurso. |
| VFX-R03 | Renombrar y mover preservan ID y referencias en todas las escenas y prefabs. |
| VFX-R04 | Borrar recurso o carpeta con usos se bloquea indicando usuarios en escena activa, escenas guardadas y prefabs. Desasignar primero; no eliminar efectos silenciosamente. |
| VFX-R05 | Eliminar una textura usada por VFX requiere conservar la referencia diagnosticable o bloquear; no convertirla silenciosamente en otra textura. Primera política recomendada: bloquear mientras tenga usos. |
| VFX-R06 | Un gesto de slider/curva produce un Undo; restaurar cambia recurso y preview. Crear/duplicar/borrar/mover VFX usa el historial existente con sus datos afectados. |
| VFX-R07 | Guardar/reabrir `.lfproj` conserva recurso, IDs, texturas y referencias; no almacena simulación temporal. |
| VFX-R08 | `.levelpackage` incluye dependencias, remapea IDs al importar en otro proyecto y sincroniza memoria/IndexedDB. Se respeta la transacción existente; la importación de paquetes conserva su exclusión actual de Ctrl+Z, claramente informada. |
| VFX-R09 | El paquete Player contiene definiciones y texturas usadas y diagnostica referencias ausentes antes de exportar. No hay URLs externas obligatorias. |
| VFX-R10 | Crear recurso no altera la escena; asignarlo o arrastrarlo al viewport crea/edita únicamente una instancia deliberada, con Undo. |

## 5. Qué significa editor profesional en este alcance

La aceptación se basa en trabajo de autoría verificable, no en aplicar un fondo oscuro.

| Zona | Comportamiento propuesto |
|---|---|
| Cabecera | Nombre/ruta, marca de cambios pendientes, guardar y volver a escena. No confundir reproducción del VFX con Play del juego. |
| Área de trabajo | Editor acoplado reutilizando el layout existente. Fondo negro/carbón sobrio, tipografía/controles del editor, iconos existentes y foco visible. No un modal centrado que bloquee la aplicación. |
| Secciones | Emisión, forma, movimiento, apariencia y evolución. Etiquetas, unidades, valores numéricos junto a sliders y ayuda concreta. No campos sin nombre ni parámetros duplicados entre secciones. |
| Vista previa | Render del efecto real con fondo/rejilla de referencia y controles Reproducir, Pausa, Reiniciar y un paso. Semilla visible y estadísticas reales de partículas/capacidad. |
| Curvas | Selección de puntos, valor/tiempo numéricos, altas y bajas, límites 0–1 y Undo por gesto. Gráfica ligada al mismo dato usado por el runtime. |
| Diagnósticos | Recurso/textura ausente, datos inválidos y límite alcanzado con ubicación accionable. No mostrar éxito antes de validar. |
| Teclado | Tab, Enter, Escape y Undo/Redo con foco delimitado; atajos no mueven la cámara mientras se escribe. |
| Tamaño | Controles accesibles en 1280×720 y 1024×768; paneles redimensionables y scroll en el panel correspondiente. Popovers no salen de la ventana. |

La previsualización recomendada utiliza el viewport y renderer existentes como área de trabajo temporal. Mantiene su propio estado efímero de simulación y grupo de preview, excluido de `project.objects`, selección de juego, guardado y exportación. Al cerrar, cambiar de recurso/proyecto o entrar en Play, desmonta el preview y devuelve cámara, proyección, OrbitControls, selección y opciones visuales al estado capturado. Nada de `setTimeout` para restaurar estado ni segundo RAF de VFX.

La implementación deberá validar primero este mecanismo con el viewport real. Si requiere un segundo renderer o cambiar el mecanismo, el Gate de preview se bloquea y se reemplaza íntegro antes de implementarlo. No está autorizado copiar `ShaderPreview.vue` ni generalizarlo mediante un refactor ajeno.

## 6. Simulación y render recomendados

- Pool de arrays preasignados, capacidad limitada; no un `Object3D` por partícula. Simulación CPU sencilla y un quad instanciado dibujado mediante Three.js por emisor. Sin computación GPU adicional inicial.
- RNG de instancia con semilla explícita. Reiniciar limpia tiempos/buffers y reproduce el efecto con la misma secuencia de pasos. No se promete igualdad binaria de píxeles entre GPUs.
- Paso fijo interno propuesto 1/60 s con acumulador alimentado por `dt`; máximo acotado de pasos para evitar una puesta al día ilimitada. Prueba de exceso de `dt` y diagnóstico del tiempo descartado. No usar reloj de pared como tiempo de simulación.
- En Play: callbacks nativos del Node Registry mediante `NodeLifecycle.onProcess`. En Edit: `_sceneFrame` solo si hay preview activo y no está jugando. Pausa no avanza edades; un paso avanza exactamente una vez. Los scripts de usuario no corren en Edit.
- Local: las partículas ya nacidas siguen el transform del emisor. Mundo: se transforma nacimiento/velocidad al emitir; mover después la taza no arrastra el vapor emitido. Comprobar padres Node3D, escala no uniforme y transform al reparentar según restricciones existentes.
- Alpha con prueba de profundidad y sin escritura de profundidad para el vapor. Ordenar partículas dentro del emisor cuando proceda; comprobar cruce entre emisores/vidrio y documentar limitaciones. No prometer transparencia perfecta ni iluminación volumétrica.
- Integrar color/tonemapping y proyección perspectiva/ortográfica. Compatibilidad con modos de render existentes debe probarse, incluido PSX; no asumirla por compilar.
- Borrado, reconstrucción, cambio de escena, Undo y cierre liberan geometría/material/buffers propios; texturas compartidas conservan su propietario. Las cargas asíncronas tardías no resucitan instancias eliminadas.
- No emitir luz, proyectar sombra ni colisionar con Jolt en la primera versión. Los efectos no alteran eventos, inventario, agua ni clima.

## 7. Presupuesto y primer caso

Valores RECOMENDADOS para validar, no resultados medidos: preset café con capacidad 64, tasa 12 partículas/s y vida 1,5–3 s. Nacimiento junto al borde interior de la taza, subida lenta, dispersión suave y desaparición gradual. No se incluye un modelo de taza en S00.

Límites iniciales propuestos: 1.024 partículas por emisor y 4.096 vivas por escena, repartidas de forma estable y diagnosticable. Al agotarse la capacidad se descartan nuevos nacimientos; no crece el pool durante el frame. La instancia de preview también tiene un límite. Deben comprobarse antes de reservar memoria.

QA de rendimiento en el equipo del usuario: registrar CPU/GPU/RAM, resolución y renderer; comparar escena sin VFX, una taza y diez tazas durante 60 s después del calentamiento. Registrar mediana/p95 de frame, coste de simulación, draw calls y memoria. Objetivo recomendado a aceptar en el Gate de render: incremento p95 ≤2 ms para una taza y ≤5 ms para diez a 1280×720; no es una garantía actual ni un criterio de cierre medido en S00. Overdraw y tamaño en pantalla cuentan tanto como número de partículas.

## 8. Límites y aceptación

La primera entrega funcional recomendada cubre recurso, emisor único, editor, vapor de café, Editor y Player. Polvo/chispas/humo adicionales, múltiples emisores, grafo tipo Niagara, GPU compute, colisión, soft particles de profundidad, fluidos, volumetría, comandos nuevos de eventos y exportación VFX a Godot permanecen PENDIENTES de decisión específica, no funciones autorizadas por mencionar VFX.

La exportación Godot deberá avisar y detener una operación que vaya a perder VFX; no modificar su conversión silenciosamente. Las pruebas de compatibilidad no permiten cambiar Event Order Flow: se conservarán byte por byte sus 49 archivos protegidos, salvo futuro Gate que declare una excepción exacta.

Aceptación del flujo completo: crear `.vfx` en Assets → editar vapor sin scripts → asignarlo a dos nodos → modificar el recurso y ver ambos → simular/reiniciar instancias sin contaminación → Undo/Redo → guardar/reabrir → exportar paquete e importar en otro proyecto → ejecutar Player con el mismo efecto → cerrar/cambiar de escena sin fugas ni cambios en cámara. Evidencia local y aprobación del usuario requeridas para cerrar la fase funcional.

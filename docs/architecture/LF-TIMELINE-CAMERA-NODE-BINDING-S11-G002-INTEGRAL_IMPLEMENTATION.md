# LF-TIMELINE-CAMERA-NODE-BINDING-S11-G002-INTEGRAL

Autorización literal del usuario el 7 de noviembre de 2026. «Listo. LF-TIMELINE-CAMERA-NODE-BINDING-S11-G002-INTEGRAL autoriza comenzar».

Base de entrada `LF_TIMELINE_PREVIEW_RUNTIME_S11_G001_INTEGRAL_CORR001_SOURCE_BASELINE(1).zip`. El usuario aprobó S11-G001 y CORR-001. En CORR-001 dejó registrado que seleccionar un clip todavía interfería de forma ocasional. El ledger separa esa incidencia del resultado de la aprobación.

## Auditoría

- **Observado.** La Jerarquía ya publica los IDs en `application/x-lf-node`. Timeline ofrecía pistas de propiedades y métodos. Las claves de cámara heredadas resolvían por nombre o usaban una pose libre o la del jugador. Editor y Player tenían resolutores distintos. Player podía evaluar la cámara antes de mover sus nodos. La duplicación de escena de LevelForge conserva IDs de nodo dentro de la copia.
- **Causa raíz de la ruta reproducible de selección.** `pointerup` volvía a llamar al manejador de movimiento. Con más de tres píxeles entre pulsación y liberación podía editar y pausar, incluso sin un `pointermove` válido. Los listeners tampoco filtraban por ID de puntero. `structuredClone` sobre el array reactivo de clips y eventos podía lanzar `DataCloneError` durante la selección. Las pruebas reproducen las condiciones y comprueban el comportamiento corregido. El caso intermitente en el equipo del usuario sigue pendiente de QA local.
- **Integración.** La selección continúa pasando al Inspector contextual y los gestos de edición comparten un criterio de seis píxeles CSS con el puntero inicial pulsado. Liberar, cancelar, perder foco o desmontar limpia los listeners. Una selección deja intactos el tiempo, los clips y el calendario. La edición efectiva pausa mediante el transporte existente. Tras confirmar el movimiento de eventos, el mismo Runner actualiza su calendario y conserva el registro de lo ya disparado.

## Contrato implementado

| Operación | Resultado |
| --- | --- |
| Soltar una cámara de Jerarquía sobre el área de Timeline | Crea una pista de cámara o reutiliza la pista asociada al mismo vínculo que esté disponible para claves directas. Añade la clave en el cabezal con Snap. Repetir el drop en el mismo tiempo selecciona la clave existente. |
| Soltar sobre un carril de cámara | Reutiliza esa pista y toma el tiempo del punto de drop con Snap. Una pista bloqueada, una clave distinta en ese tiempo o una pista con clips muestran una indicación. Las claves fuente de un clip pueden vincularse desde su Inspector. |
| Guardar | El modo `camera3d` persiste `sceneId` y `node` en la clave de cámara. Los clips siguen referenciando sus claves originales. |
| Previsualizar o reproducir | El evaluador compartido resuelve la identidad estricta en la escena activa y lee posición y rotación mundiales más FOV vertical del nodo después de aplicar las pistas de transformación y bake del Timeline. Cada clave nueva comienza con corte. La interpolación sigue usando las opciones ya existentes. |
| Nodo eliminado, de otro tipo o de otra escena | El Inspector muestra el estado. Preview y Player avisan y omiten la contribución de la referencia. La cámara normal vuelve cuando el montaje carece de otra contribución válida. La identidad se conserva para restaurar o reasignar. |
| Abrir recursos previos | Los modos libre, jugador y cámara de escena heredada conservan sus datos y resolutores. Nether FilmMaker conserva la autoría de Cinematics. |

El paquete de juego conserva los IDs de origen. La importación de intercambio entre proyectos (`.levelpackage`) sigue el contrato existente de reasignación manual cuando el destino asigna nuevos IDs a los nodos.

Decisiones de implementación del Gate. La escena califica el ID porque dos copias pueden compartir IDs. El modo explícito de clave permite combinar referencias nuevas con claves antiguas en la misma pista. El umbral de seis píxeles distingue el clic con desplazamiento leve de un arrastre.

## Estado

**QA LOCAL PASS declarado por el usuario. APROBADO y CERRADO el 7 de noviembre de 2026.** Evidencia de cierre: «AProbado. SIgamos.». La compilación y las pruebas Node constan por separado en QA. La ejecución de Electron en el entorno de generación se bloqueó por falta de sesión gráfica. Audio Mixer, forma de onda, efectos, envolventes y tooltips continúan en la secuencia planificada.

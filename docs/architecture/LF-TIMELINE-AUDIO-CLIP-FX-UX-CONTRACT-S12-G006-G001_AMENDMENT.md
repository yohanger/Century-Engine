# Contract Amendment — LevelForge Timeline · Editor de FX individuales

**Identificador contractual:** `CA-TIMELINE-AUDIO-CLIP-FX-UX-001`  
**Gate documental:** `LF-TIMELINE-AUDIO-CLIP-FX-UX-CONTRACT-S12-G006-G001`  
**Autorización de redacción:** `Listo. LF-TIMELINE-AUDIO-CLIP-FX-UX-CONTRACT-S12-G006-G001 autoriza comenzar`  
**Fecha:** 2026-11-08  
**Estado:** **RECOMENDADO · AMENDMENT REDACTADO · QA CONTRACTUAL DEL USUARIO PENDIENTE · NO APROBADO · NO VINCULANTE AÚN**.  
**Baseline:** `LF_TIMELINE_AUDIO_VOLUME_AUTOMATION_S11_G007_G002_INTEGRAL_CORR001_SOURCE_BASELINE.zip`.

## CA-01 · Contratos anteriores y conflicto explícito

1. Contrato S11-G005 y corrección CORR-001: `docs/architecture/LF-TIMELINE-AUDIO-CLIP-EFFECTS-S11-G005-INTEGRAL_IMPLEMENTATION.md`, apartados «Contrato de datos» y «Recorrido real». La interfaz del Inspector permite crear, ordenar, activar, parametrizar y eliminar efectos individuales `key.fx`; la ejecución de AudioEngine admite esos datos. El usuario aprobó el resultado acumulado de G005/CORR-001.
2. Contrato S11-G006: `docs/architecture/LF-TIMELINE-AUDIO-INTEGRATION-PERSISTENCE-S11-G006-INTEGRAL_IMPLEMENTATION.md` y QA, que conservan y comprueban efectos de clip durante guardado/exportación y reproducción Player.
3. Decisión UX posterior del usuario: retirar de Timeline las opciones «Efectos de este clip», que ya no desea usar desde el Inspector. El usuario indicó que existen comandos; **no está demostrado** que los comandos repliquen cada efecto o sus parámetros. No se establece equivalencia entre sistemas.
4. **CONTRADICCIÓN:** el editor de FX individuales obligatorio en G005 frente a la retirada solicitada. Está **BLOQUEADA la retirada en código** hasta que este Amendment sea aprobado mediante QA contractual del usuario. La autorización de redactar el documento no ratifica por sí sola su contenido.

## CA-02 · Cláusulas sustituidas, solo DESPUÉS de aprobación expresa

| Contrato previo | Parte sustituida | Nueva política propuesta |
|---|---|---|
| S11-G005, «Recorrido real» | Inspector de clave Audio `play` como editor de FX por clave | Retirar la sección de edición individual del Inspector de Timeline; mantener el Inspector contextual existente y su edición de fuente/volumen, ruteo, fundidos y automatización. |
| S11-G005, «Contrato de datos» | Autoría de nuevos `key.fx` mediante edición explícita desde ese Inspector | Las claves nuevas siguen sin recibir `fx` automáticamente y no existirá en Timeline un control para añadir FX privados. `key.fx` existente seguirá siendo un campo opcional de datos válido. |
| S11-G005 y S11-G006, QA de edición FX en Inspector | Exigir en el Inspector los controles para agregar/editar/ordenar FX individuales | Sustituir únicamente esas verificaciones de UI por la ausencia del editor y una indicación no editable para recursos con efectos guardados. Todas las pruebas de persistencia y reproducción de FX continúan vinculantes. |

Ningún otro apartado de estos contratos queda supersedido. La documentación histórica y sus resultados QA no se reescriben ni se borran.

## CA-03 · UI prevista para la implementación posterior

- En el Inspector de una clave Audio de acción `play` sin `key.fx` o con cadena vacía, **no mostrar** el editor ni una sección vacía «Efectos del clip». El espacio recuperado pertenece a la información útil de la clave.
- Si `key.fx` contiene una o más entradas compatibles, mostrar **solo una indicación compacta y de solo lectura**: número y tipos de FX conservados, incluyendo estado activado/desactivado si se presenta; sin botones de añadir, eliminar, reordenar, presets ni controles de parámetros. No afirmar que sean «antiguos» basándose en fechas inexistentes: la condición es la presencia de datos.
- El usuario puede editar los **efectos de bus** en el Audio Mixer existente. Esa operación es distinta de los FX individuales guardados en la clave y no los modifica automáticamente.
- No agregar panel nuevo, estado duplicado ni alternativa de autoría FX en Assets, Timeline o comandos. No trasladar FX al Mixer ni crear buses por clip.
- Si se necesita en el futuro modificar o retirar una cadena privada ya guardada, será necesario **otro Gate autorizado** con una política expresa de edición/migración. La retirada actual de UI no constituye autorización para modificar esos datos.

## CA-04 · Persistencia y reproducción siguen siendo obligatorias

1. **No eliminar ni limpiar** `key.fx` en lectura, normalización, duplicación, guardado, exportación ni serialización por el mero hecho de ocultar su editor. Los tipos/parametrizaciones compatibles conservan orden, IDs, `on` y parámetros según `normalizeFx` ya aprobado. La normalización histórica **descarta tipos no admitidos**, por lo que este contrato no inventa conservación de FX desconocidos.
2. AudioEngine sigue construyendo la cadena privada por voz de claves que ya contengan FX, seguida por la ganancia de la voz y el bus/FX del Mixer. Mantener Preview y las rutas ordinaria y avanzada del Player.
3. No mutar la clave al seleccionarla ni al mostrar/ocultar el Inspector. Conservar proyectos antiguos sin campo FX y proyectos con FX; ninguna migración silenciosa, ninguna supresión de metadatos para «sanear» la UI.
4. No alterar audio PCM, waveform, ruteo por bus, `fadeIn`, `fadeOut`, `fade`, `volumeAutomation`, pausa, Seek, Stop, loops ni el ciclo de vida de las colas DSP.
5. Conservar el Audio Mixer como editor de FX de **bus**. **No modificar** `AudioMixerInspector.vue` en su modo de Mixer normal, la configuración de audio ni el catálogo `FX_TYPES`.
6. Preservar escenas, Assets, Player/exportación, FilmMaker/Cinematics y las claves de comandos, Naturaleza y Métodos, incluida su deuda de duración independiente en S10.

## CA-05 · Política de pruebas del Gate de implementación futuro

**Prerrequisito obligatorio:** aprobación expresa de este Amendment y nuevo Gate de implementación autorizado literalmente.

- Comprobar ausencia de controles FX privados en Inspector con clave nueva sin FX y con `fx:[]`.
- Para una clave con FX guardados, comprobar indicador compacto no editable, **sin cambios en `key.fx` al seleccionarla**.
- Guardar, cerrar y reabrir una copia de proyecto con cadena FX preexistente. Comparar IDs, orden, estado, parámetros y ruteo; AudioEngine, Preview, Player normal/avanzado y Player exportado deben conservar el sonido.
- Confirmar FX de bus aún editables desde el Mixer y distintos de los FX de voz; pruebas de dos voces con cadenas diferentes en un mismo bus.
- Verificar que el cambio visual no afecta automatización de volumen, fundidos, PCM, bloqueo, historial ni transporte.
- Node con pruebas de regresión G005/G006, fixture Electron embebido con controles reales, compilación Editor/Player y QA auditivo del usuario. Distinguir resultados ejecutados de esperados; no cambiar aserciones históricas sin trazabilidad contractual.

**Criterios de aprobación contractual de este Gate documental:** CA-01 a CA-05 completos, límites de compatibilidad sin ambigüedad, reglas de tratamiento para cadenas guardadas y ningún código cambiado. La prueba documental no sustituye a la integración futura.

## CA-06 · Precedencia, activación y siguiente Gate

- **Hasta aprobación expresa del usuario:** G005/G006 originales continúan vinculantes; este texto es una propuesta documental **RECOMENDADA**. No declarar aún que la cláusula de edición FX de G005 ha sido sustituida.
- **Después de aprobar este Amendment:** solo CA-02 y CA-03 reemplazarán las cláusulas enumeradas de interfaz/autoría y QA UI; CA-04 conserva los contratos de datos y runtime. La aprobación contractual **no autoriza cambios de código**.
- **Gate de implementación futuro RECOMENDADO (no autorizado):** `LF-TIMELINE-AUDIO-CLIP-FX-UX-S12-G006-G002-INTEGRAL`. Será una unidad UX mínima: modificar el Inspector original para retirar edición privada, mostrar indicador de solo lectura si hay FX; actualizar pruebas afectadas y ledger; sin mutaciones de runtime ni Mixer.
- Tooltips globales son otro Sprint UX. La duración individual de Comandos/Naturaleza/Métodos es deuda contractual separada S10; no es conexión olvidada de este Gate.
- Toda entrega implementada requerirá `CHANGE` incremental y `SOURCE_BASELINE` acumulado, prueba Electron embebida, QA usuario, evidencia y ledger seis hojas. No borrar historial ni ocultar fallos.

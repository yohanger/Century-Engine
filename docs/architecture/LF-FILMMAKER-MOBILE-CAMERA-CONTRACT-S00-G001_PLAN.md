# Cámara móvil FilmMaker: fases y dependencias

Fecha: 2026-11-04. Sprint funcional propuesto: Cámara móvil LAN. Solo está autorizado S00 documental. Todas las filas futuras son RECOMENDADAS, PENDIENTES PLANIFICADAS y NO AUTORIZADAS; no son declaraciones ejecutables completas ni promesas de capacidades.

## Autoridad actual

1. SOURCE_BASELINE de cierre S04 aprobado: 2.121 archivos; no se modifica su código.
2. S00 autorizado para formalizar auditoría, CA-MC-001, contrato y QA.
3. Contrato y Amendment pendientes de aprobación del usuario; no anticipar implementación.
4. No existe evidencia real de 6DoF en Z2473. No existe todavía el enlace de cámara LAN o el monitor remoto.

## Secuencia propuesta

| Unidad futura | Objetivo concreto | Prerrequisitos | Medios indispensables a declarar antes de autorizarla | Evidencia de salida requerida |
|---|---|---|---|---|
| `LF-FILMMAKER-MOBILE-CAMERA-CAPABILITIES-S01-G001` | Diagnosticar capacidades reales y decidir fuente de cámara viable en Z2473 | S00 aprobado; teléfono y permisos disponibles | Diagnóstico dentro del proyecto Android existente, comprobación nativa de sensores/cámara y de disponibilidad AR pertinente; versión/licencia de SDK si se necesita; APK y runner/ensayo físico | Informe del teléfono con modelo/OS, sensores, permisos, soporte efectivo y muestra de pose si procede. Fuente simulada o WebView sin XR no certifican AR nativo |
| `LF-FILMMAKER-MOBILE-CAMERA-LAN-S02-G001` | Vínculo autenticado PC–APK y entrada remota con ciclo de vida | S00 aprobado; modo de control definido por S01; declaración de transporte/confianza resuelta | Servicio específico en Electron, cliente de la app existente, protocolo, emparejamiento, límites, cierre/reconexión y pruebas TCP/WebSocket/nativas que requiera el mecanismo elegido | Sesión correcta, comandos confirmados, rechazo de otra producción/cliente, ausencia de saltos al reconectar; no afirmar visor ni AR completo |
| `LF-FILMMAKER-MOBILE-CAMERA-MONITOR-S03-G001` | Mostrar en el teléfono el encuadre virtual del PC | S02 aprobado; captura/codificación/decodificación y confianza de conexión definidas | Reutilizar el renderer/encuadre; transporte de imagen, APK receptor, identificación de fotogramas, fixture y medición real N5030/Z2473 | Imagen correcta y fresca, aspecto/FOV conservados, calidad regulable sin cambiar film.frame; informe de latencia/FPS/CPU/RAM y límites acordados |
| `LF-FILMMAKER-MOBILE-CAMERA-COLLISION-S04-G001` | Detener la cámara ante obstáculos y descartar avance bloqueado | S00 aprobado; API de consultas y política de escena definidas; entrada verificable | Extensión del camarógrafo con consultas de física existentes, volumen/márgenes, referencia móvil, fixtures de pared/esquina/techo y runner Jolt real/Electron si se usa Jolt | No penetración ni túnel, retroceso inmediato, contacto seguro al girar, sin fuerzas sobre mundo. Puede ensayarse con entrada controlada sin certificar seguimiento del teléfono |
| `LF-FILMMAKER-MOBILE-CAMERA-RECORDING-S05-G001` | Integrar control remoto, colisión, reloj y pases existentes | S02, S03 y S04 aprobados; fuente prometida resuelta | startPass/stopPass, muestreo, arbitraje de cámara, suspensión, interpolación y pruebas ZIP/export existentes ampliadas | Monitor, toma y reproducción corresponden a cámara resuelta; conservar IDs/.nfm/escena; pérdida de control no produce toma falsa |
| `LF-FILMMAKER-MOBILE-CAMERA-INTEGRATION-S06-G001` | Cerrar el Sprint con sesión real completa | Gates previos aprobados; distribución objetivo validada; fuente espacial real si sigue siendo requisito | APK y editor reales, red local sin nube, ensayos prolongados y regresión de importación Cinematics/Player; QA editor con Electron embebido | Usuario ve, mueve, colisiona, retrocede, reconecta y guarda/reproduce/exporta con la fuente comprometida. Resultados parciales no cierran caminar si no hay tracking viable |

La ruta mínima del flujo remoto es S01 → S02 → S03 → S05 → S06, con S04 como dependencia de S05. S04 puede desarrollarse después de la aprobación documental sin depender de AR certificado si usa fixtures explícitos; su integración remota se valida finalmente con el equipo real. Este paralelismo es de dependencias, no autorización para comenzar trabajos o delegarlos.

## Dependencia de distribución separada

`LF-FILMMAKER-STANDALONE-STARTUP-CORR-G001` queda RECOMENDADO y NO AUTORIZADO. Resolver la lectura obligatoria del manifiesto VS Code no empaquetado por FilmMaker independiente. Su declaración debe auditar la inicialización compartida, elegir extensión del mecanismo existente, incluir regresión S04 y arranque/configuración empaquetados, y enumerar los runners/fixtures necesarios. No se corrige en S00 ni se da por fallado un AppImage que no se ejecutó.

Es dependencia antes de certificar el servidor distribuido como AppImage en S06. No impide diagnosticar el teléfono ni obliga a cambiar el Player/export de juegos. Si se prueba el editor desde fuentes mientras tanto, registrar esa modalidad y no extrapolarla al paquete independiente.

## Decisiones pendientes que cada declaración debe cerrar

- S01: inventario nativo real y fuente viable; no sustituir caminar por joystick sin decisión del usuario. Si la fuente no es viable, registrar el bloqueo y proponer opciones sin declarar integración completa.
- S02: transporte concreto de control, emparejamiento, interfaces/puertos, autorización de producción y confianza que funcione con Android 15. Definir límites/temporizadores; no basarse solo en que exista un socket.
- S03: transporte de vídeo, contenido capturado, códec soportado, calidad inicial y medición de extremo a extremo. El rendimiento puede limitar monitor/control sin cambiar el archivo de producción. No prometer una tasa antes de medirla.
- S04: consulta/volumen, escena/capas, plano cercano y orden de filtros. No usar suelo, un rayo o el cuerpo FPS como prueba de colisión de cámara ya implementada.
- S05: arbitraje, reloj, claves de contacto, suspensión/reanudación y compatibilidad de .nfm. Cualquier esquema nuevo exige aprobación explícita.
- S06: equipos, modalidad de distribución, límites medidos ratificados y matriz integral sin campos de hardware pendientes.

Antes de cada implementación se contrasta documentación → código real → ledger y se emite una declaración completa. Si exige un medio no permitido, la declaración se marca SUPERSEDIDA o BLOQUEADA y se reemplaza antes de pedir autorización; no se improvisa un runner fuera de alcance.

## Clasificación del trabajo pendiente

LAN, monitor, capacidades nativas y colisión del camarógrafo son PENDIENTES PLANIFICADOS: no fueron implementados ni autorizados en los Gates anteriores de UI/animación. La ausencia del recurso requerido por el arranque compartido es una dependencia de empaquetado detectada por la auditoría y requiere corrección separada. No se presenta como función futura ya terminada ni se borra el historial de S04 aprobado.

Siguiente acción de S00: entregar contrato y ledger para aprobación documental. La siguiente acción tras aprobar S00 será declarar S01 con todos sus medios, no implementarlo automáticamente.

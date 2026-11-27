# Cámara móvil FilmMaker: contrato S00

Fecha: 2026-11-04. Gate: `LF-FILMMAKER-MOBILE-CAMERA-CONTRACT-S00-G001`. Estado: DOCUMENTADO PARA REVISIÓN; aprobación del usuario PENDIENTE. Este contrato no describe capacidades ya implementadas. Sus reglas serán vinculantes para los Gates futuros tras aprobación de S00.

## 1. Objetivo, base y autorización

Objetivo: especializar el móvil como cámara/monitor de Nether FilmMaker por red local, conservar el editor del PC como autoridad de la producción y resolver la colisión de la cámara contra la escena.

Autorización recibida: «Listo. LF-FILMMAKER-MOBILE-CAMERA-CONTRACT-S00-G001 autoriza comenzar». Mecanismo autorizado ahora: auditoría, contrato/Amendment, planificación, criterios de QA y seis hojas del ledger. Base exacta: SOURCE_BASELINE de cierre S04 aprobado, 2.121 archivos.

Prerrequisitos cumplidos de S00: código existente disponible, auditoría realizada, decisión del usuario sobre función del teléfono, visor y paredes, equipo objetivo identificado. No hay contradicción aprobada sin resolver: CA-MC-001 delimita el cambio de responsabilidad móvil para ratificación conjunta. Hardware AR y transportes efectivos permanecen como dependencias de implementación, no como capacidades aprobadas.

Alcance permitido ahora: documentos y ledger, comprobaciones documentales y pruebas existentes del baseline. No se añade ni modifica código, dependencias, configuración de producción, SDK, APK, escena, servidor o runner. Medios de autoría/inspección son temporales y no se instalan en el proyecto. Entrega: exactamente CHANGE y SOURCE_BASELINE.

## 2. Responsabilidades y reutilización

**MC-01 — Móvil especializado.** La app existente será cámara/control y monitor. La pantalla debe priorizar encuadre y estado de conexión/seguimiento/grabación; el editor completo seguirá en el PC. La UI definitiva requiere aprobación en su Gate; este contrato no impone botones ficticios ni un segundo árbol de escena.

**MC-02 — PC como autoridad.** En el PC residen escena, cámara resultante, colisión, render, reloj de producción y grabación. Los mensajes del móvil no escriben directamente transforms serializados de objetos ni controlan otros proyectos. No se envían datos para que el PC ejecute seguimiento visual de la cámara física como solución implícita al rendimiento del móvil.

**MC-03 — Extender lo existente.** Se reutilizan `OperatorRig`, sus conversiones de orientación, `startPass/stopPass/viewPass`, `film.passes`, montaje, normalización y `.nfm` v4. Se separará adquisición de pose de aplicación solo en el alcance autorizado de un Gate. Se conserva un único renderer de la producción y el motor/física existentes; no un editor móvil paralelo. Aplican las condiciones de [CA-MC-001](LF-FILMMAKER-MOBILE-CAMERA-CONTRACT-S00-G001_AMENDMENT.md).

## 3. Capacidades del teléfono y referencia espacial

**MC-04 — Capacidades verificadas.** Dispositivo objetivo declarado: ZTE Blade A56 Z2473, Android 15 / MyOS 15, `MyOs15.0.2_Z2473_LA2`, memoria «4 GB + 8 GB» indicada por el usuario. El presupuesto inicial usa 4 GB sin asumir la naturaleza de la ampliación. Deben registrarse versión efectiva de app/WebView, sensores disponibles, permisos, servicios AR y resultado de seguimiento. Un emulador o una fuente simulada no certifican el teléfono.

Ausencia en el catálogo público ARCore consultado: COMPATIBILIDAD OFICIAL NO IDENTIFICADA. Seguimiento real del dispositivo: NO VERIFICADO. No se concluye que toda técnica alternativa sea imposible; tampoco se promete 6DoF. La app distinguirá soporte, permiso denegado, servicio ausente, inicialización y pérdida de rastreo. Si no hay fuente espacial viable, la declaración de cumplimiento de caminar queda bloqueada y se presenta una alternativa al usuario antes de cambiar alcance.

La ruta actual WebXR no acredita AR dentro del APK. Para Android se investigará una integración nativa en el proyecto existente si la compatibilidad lo permite; versión, licencia, API y coste de cualquier SDK/plugin deben auditarse antes de declarar su Gate. Una ruta web alternativa necesita dispositivo/navegador y contexto seguro efectivos. No se usará la ausencia de `navigator.xr` en WebView como diagnóstico universal de todo el hardware AR nativo.

**MC-05 — Calibración y referencia.** Posiciones expresadas en metros; cámara del motor con Y arriba, cuaterniones XYZW y mirada local hacia -Z. El adaptador documentará la conversión exacta de ejes y orientación de pantalla. Se establece origen/alineación contra la cámara inicial del PC, con confirmación de referencia antes de grabar. Cambio de orientación de pantalla, reinicio del tracker o nueva sesión no deben causar giros, saltos ni teletransporte silencioso.

## 4. Enlace LAN y estado

**MC-06 — Sesión explícita.** PC y móvil se vinculan por LAN mediante emparejamiento autorizado por el usuario. Una ventana/producción acepta una cámara móvil activa; cada sesión identifica película/escena, versión y época de referencia. Se rechazan otro cliente, sesión caducada o producción distinta. Cambiar/cerrar escena invalida el vínculo de grabación. El método de conexión deberá ser accesible desde la app, sin archivos de token, CLI o configuración manual repetida como flujo normal del usuario.

**MC-07 — Protocolo acotado.** El contrato lógico debe incluir versión, sesión, identidad de producción, secuencia, tiempo de muestra, tipo/capacidad de fuente, estado de seguimiento y pose/control disponibles. Validar finitud, rangos, tamaño, cuaternión y orden; no aceptar mensajes de código, shell, rutas de disco o escritura arbitraria. El tiempo del móvil no sustituye al reloj de película. No se convierten ausencia o datos inválidos en una posición cero válida.

El servidor FilmMaker será específico de esta función. El TCP loopback de VS Code no se abre a la LAN ni se reutilizan sus sesiones/credenciales de archivos. Controles y señalización requieren autenticación y protección efectiva en Android 15 con la configuración elegida. No depende de internet, nube, un relay externo ni un proceso que el usuario deba instalar aparte. WebSocket para control y WebRTC para imagen son candidatos, no tecnologías ratificadas por S00. Antes del Gate de transporte se resolverán compatibilidad, confianza de conexión, puertos y ciclo de vida; no se prometerá LAN operativa cambiando solamente una URL.

**MC-08 — Ciclo de vida.** Estados distinguibles: sin vínculo, emparejando, conectado, preparando capacidades, listo/calibrado, grabando y suspendido/error. La conexión de socket no significa imagen recibida, tracker válido o grabación aceptada. Las órdenes de armar/iniciar/parar requieren respuesta explícita, evitando duplicados por reintento.

Pérdida de enlace, referencia inválida o rastreo necesario perdido: congelar la última cámara segura, suspender la toma de forma coherente con el reloj del entorno e informar. No inventar desplazamiento ni continuar añadiendo claves como si hubiera control válido. Reconexionar no reanuda automáticamente la grabación ni restaura una referencia espacial distinta. Los umbrales temporales serán acotados, visibles en QA y fijados antes del Gate que los implemente.

## 5. Monitor y rendimiento

**MC-09 — Vista virtual obligatoria.** El móvil muestra la escena vista por la cámara efectiva del PC, con su FOV y proporción de encuadre. Se preserva el encuadre mediante bandas cuando sea necesario, sin estirar ni recortar para llenar pantalla. No se transmite como monitor el escritorio completo con Inspector, Assets o timeline. La resolución del monitor es independiente de `film.frame` y no modifica la resolución final de producción.

La ruta de captura reutiliza la producción existente. No se carga una copia de la escena en el móvil ni se añade un segundo renderer 3D para duplicar el visor. La elección de codificación, captura/composición y decodificación deberá cubrir el contenido visible requerido y sus límites; no se atribuirá captura de overlays DOM a una API que solo capture el canvas.

**MC-10 — Monitor y control válidos.** El estado listo requiere primera imagen decodificada de la sesión correcta, además del control requerido. La toma remota no se arma con monitor ausente u obsoleto. Si la imagen se pierde durante la toma, se suspende e indica el estado; no se deja al operador filmando sin ver. La pérdida se detecta mediante identificación/edad de imágenes, no solo por que el elemento de vídeo siga abierto. No reemitir sin fin una imagen antigua como si fuera nueva.

**MC-11 — Presupuesto medido.** Referencia: laptop N5030/4 GB y Z2473 del usuario. Se medirán FPS entregados, latencias p50/p95 de control y monitor, bitrate, CPU/RAM de ambos equipos y estabilidad sostenida con una escena de QA representativa. Se probará degradación de calidad del monitor manteniendo encuadre y calidad final de producción independientes. No hay FPS, bitrate o latencia garantizados en S00; límites y perfil inicial deben acordarse con evidencia antes del Gate del monitor. No se hará un benchmark de red sintética pasar por rendimiento del equipo real.

## 6. Colisión de cámara y movimiento físico

**MC-12 — Cámara fuera de obstáculos.** La cámara debe detenerse ante las paredes con colisión habilitada, incluyendo movimiento rápido y paredes finas. La resolución se hace en el PC, después de transformar y suavizar la intención de posición y antes de aplicar/grabar la posición final. Utilizar volumen y recorrido barrido/consulta equivalente de la física existente, no solo un rayo desde el centro ni corrección al final de una penetración. El volumen debe proteger el encuadre próximo al girar, considerando plano cercano, FOV y aspecto. El radio/forma y márgenes requieren justificación y QA en su Gate.

El mínimo incluye paredes, esquinas, suelo y techo relevantes a la cámara. Respetar geometría/cuerpos habilitados y capas vigentes; objetos con colisión desactivada no se convierten automáticamente en obstáculos. El contacto del actor y el cuerpo FPS no se toman como integración ya hecha del camarógrafo. La elección entre consultas editoriales y mundo de rodaje debe quedar definida antes de implementar: conectar o calibrar la cámara no debe ejecutar scripts/eventos de Play accidentalmente ni crear otro motor físico.

**MC-13 — Descartar avance bloqueado.** Si el operador continúa andando hacia una pared virtual, ese desplazamiento bloqueado se consume y descarta. Al retroceder, la cámara responde al nuevo movimiento sin exigir volver a recorrer la distancia física rechazada. La referencia de entrada avanza aunque el movimiento resuelto sea cero. No hay deuda acumulada, rebote ni salto al dejar de tocar. Se permite componente tangencial segura para deslizar junto a la pared; rotación no bloqueada por traslación, manteniendo protegido el encuadre. No se aplican fuerzas a cuerpos del mundo por mover la cámara.

Pérdida de rastreo y nueva referencia no se interpretan como desplazamientos físicos grandes. Un salto de origen se suspende para recalibración; no se recorre como movimiento válido a través de la escena.

## 7. Grabación, reproducción y conservación

**MC-14 — Una cámara y un reloj.** El monitor, el visor del PC y la toma utilizan la misma pose final corregida por colisión. El PC decide los tiempos de muestra y conserva el formato de claves existente. La ruta cruda del teléfono no se graba como si hubiera atravesado una pared. El muestreo/interpolación debe preservar contactos y esquinas al reproducir; verificar si necesita claves adicionales en cambios de trayectoria, sin asumir que 30 Hz basta en todos los casos. Reproducción no vuelve a simular para alterar la toma resuelta arbitrariamente.

Una sola fuente tiene control efectivo de cámara por instante. No combinar entrada remota, ratón, reproducción de pase y montaje escribiendo transforms a la vez. El Gate de integración fijará transiciones, restauración y estado base, preservando el reloj de entorno y las funciones existentes.

**MC-15 — Persistencia compatible.** Conservar IDs, `.nfm` v4, `passes`, montaje, normalización, guardado/reapertura e importación a LevelForge/Cinematics. No persistir IP, token, sockets o credenciales en películas/escenas. Una necesidad real de cambiar esquema debe declararse con Amendment y migración antes de hacerlo. Los archivos previos del móvil/PC se preservan. No se borra el editor de escritorio ni la captura de actores como efecto lateral de especializar el APK.

**MC-16 — Aceptación integral real.** Solo se declarará el objetivo completo tras una sesión en el teléfono y PC de referencia que permita ver el encuadre, controlar la cámara con la fuente prometida, bloquear paredes, retroceder sin deuda, reconectar de forma explícita y guardar/reproducir/exportar el resultado sin pérdida. Se usarán Electron embebido para QA del editor y APK/teléfono real para capacidades nativas; ningún navegador externo sustituirá ese QA del editor. El vídeo simulado o una pose sintética sirven como fixture identificado, no como evidencia de AR del Z2473.

Si el Z2473 no proporciona una fuente espacial viable, se puede validar LAN/monitor y colisión con otra entrada como resultados parciales claramente identificados. Eso no cierra el requisito de seguir al operador al caminar. Cualquier sustitución funcional requiere decisión del usuario; no se presupone compra de otro teléfono ni se cambia de tecnología a ciegas.

## 8. Dependencias y exclusiones

El [Plan](LF-FILMMAKER-MOBILE-CAMERA-CONTRACT-S00-G001_PLAN.md) registra diagnóstico real, transporte, monitor, colisión, grabación e integración como PENDIENTES PLANIFICADOS y NO AUTORIZADOS. La incidencia del arranque de FilmMaker independiente es una dependencia separada de distribución: corregirla antes de certificar el servidor empaquetado, sin contaminar S00.

Fuera del objetivo: editor móvil completo, nuevas herramientas de actor/mocap, IA de pose trasladada al PC, cambios de Player/Cinematics, ECS, un motor nuevo, acceso por internet, vídeo final MP4/WebM y servidor global genérico. La configuración de FilmMaker, VS Code o Android no se modifica aquí para anticipar esos Gates.

## 9. Aceptación de S00 y siguiente acción

S00 se acepta mediante revisión del usuario del contrato, CA-MC-001, dependencias, límites de hardware y matriz de QA. La inspección documental y el ledger deben preservar historial y código original. Las pruebas existentes del baseline no demuestran las funciones futuras. S00 no se marca aprobado/cerrado por haber creado archivos.

Siguiente acción real tras entrega: revisión/aprobación documental del usuario. Tras ratificación, declarar de forma completa el Gate de capacidades del teléfono; no comenzar su implementación por la aprobación de S00.

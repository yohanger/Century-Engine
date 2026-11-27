# CA-MC-002 — Integración LAN y monitor anticipado de FilmMaker

Fecha: 2026-11-04. Vinculado a `LF-FILMMAKER-MOBILE-CAMERA-LIVE-BRIDGE-S02-G001-INTEGRAL`.

**Estado documental: RATIFICADO SIN MODIFICACIONES (2026-11-05).** Este estado sustituye únicamente el prerrequisito de ratificación previamente pendiente. El usuario declaró literalmente «Apruebo CA-MC-002 sin modificaciones». El alcance y los términos sustantivos siguientes son los aprobados, sin cambios.

## Autoridades y alcance excepcional

- `CA-MC-001` permanece vinculante: la app Android es exclusivamente cámara/monitor/control, el PC gobierna la escena, render, colisiones, reloj y grabación. No se altera `.nfm`, Cinematics ni Editor/Player.
- El plan S00 separaba LAN S02 de monitor S03. La solicitud posterior del usuario prioriza validar visualmente la conexión antes de la evaluación espacial completa y autoriza `...LIVE-BRIDGE-S02-G001-INTEGRAL`.
- Este Amendment propone unir **solo en el Gate S02 integral**: emparejamiento LAN, vídeo real del renderer existente hacia teléfono, orientación física 3DoF desde Android hacia la cámara virtual **en vista previa** y medición de frescura/reconexión. Sustituye para este Gate la secuencia S02→S03 del plan S00, sin cambiar los compromisos finales de CA-MC-001.
- La traslación 6DoF permanece NO VERIFICADA; el experimento de marcadores S01A queda abierto. La vista previa S02 no acredita caminar, colisión ni grabación. S04/S05/S06 requieren Gates propios.
- S03 autónomo no se declara aprobado ni cerrado: si el monitor del S02 integral supera QA y el usuario ratifica CA-MC-002, se decidirá documentalmente si su alcance se subsume. No borrar el histórico.

## Mecanismo y límites vinculados a la autorización S02

- Ampliar el `FilmApp`/`OperatorRig` y `filmmaker-mobile/` existentes; no crear escena 3D móvil ni reproductor paralelo.
- PC: Electron ofrece sesión LAN efímera por HTTP **solo para señalización autenticada** con PIN HMAC, límite de cuerpo/intentos y único interlocutor; WebRTC cifrado por DTLS/SRTP para imagen y DataChannel.
- Teléfono: monitor WebRTC en WebView Capacitor; vector de rotación Android; detener envío si el vídeo no está fresco, si app está oculta o se desconecta.
- PC: previsualización independiente de tomas y grabaciones; sin introducir desplazamiento sintético. Detener sesión al cambiar película, salir o navegar.
- El vídeo usa la resolución disponible del canvas y tasa objetivo 10 FPS, **no rendimiento garantizado**; medir FPS, RTT y memoria en el N5030/Z2473.
- Mantener la adquisición de imágenes S01A solo para diagnóstico; no confundirla con la fuente de vídeo virtual transmitida desde PC.

## Estado y siguiente acción

El código S02 está **implementado en fuentes para QA**, con compilación Android y recepción de vídeo PC↔Z2473 NO VERIFICADAS. La aprobación contractual final y el cierre del Gate exigen ratificación expresa de este texto, QA local real y evidencia. Una falla de control/monitor no se corrige cambiando CA-MC-001 para justificarla.

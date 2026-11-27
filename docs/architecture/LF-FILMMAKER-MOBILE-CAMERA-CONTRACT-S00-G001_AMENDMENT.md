# CA-MC-001: responsabilidad de la cámara móvil

Gate documental: `LF-FILMMAKER-MOBILE-CAMERA-CONTRACT-S00-G001`. Fecha: 2026-11-04. Estado: PROPUESTO PARA APROBACIÓN. La autorización de redactar S00 no equivale a ratificar este Amendment ni a autorizar implementación futura.

## Fuentes y cambio de alcance

La implementación y README actuales de `filmmaker-mobile/` describen la misma app web de rodaje empaquetada como APK. Los trabajos UX anteriores preservaron paneles móviles del editor completo. La instrucción posterior del usuario precisa el papel del teléfono: cámara, seguimiento disponible y monitor del rodaje, conectado al editor del PC por LAN. El usuario añade visor del escenario virtual y colisión contra paredes.

Tras aprobar S00, este Amendment sustituye exclusivamente la responsabilidad futura del APK FilmMaker como editor completo por la responsabilidad de cámara/monitor. No reescribe el histórico ni declara que ese cambio ya exista.

## Responsabilidades que se ratifican

1. El editor del PC conserva escena, cámara resultante, física, render, reloj, pases, montaje, películas y guardado.
2. El móvil aporta las capacidades de cámara/seguimiento efectivamente verificadas y muestra la vista virtual transmitida. No necesita cargar el proyecto 3D para ser monitor y controlador.
3. Se extiende `filmmaker-mobile/` y se reutilizan las funciones actuales de FilmMaker. No se crea otro motor, editor, formato cinematográfico o aplicación paralela especulativa. La separación necesaria de adquisición y aplicación se hará en un Gate explícito.
4. La adaptación futura del APK preservará archivos `.nfm` que el usuario ya tenga en el teléfono; no habrá borrado o conversión automática de sus datos por cambiar la interfaz.
5. El editor de escritorio, sus paneles y formatos siguen vigentes. Este Amendment no autoriza eliminar su interfaz responsive ni capacidades del editor compartido indiscriminadamente.
6. La app antigua `capture-app/` permanece conservada y obsoleta. No se migra a ella ni se reanima su producto.
7. La captura de actores/MediaPipe existente no se elimina del editor ni se incorpora automáticamente al alcance de la cámara móvil. El objetivo contratado aquí es el camarógrafo virtual.
8. Cinematics de LevelForge sigue consumiendo películas importadas de FilmMaker. El enlace móvil no convierte Cinematics en editor ni receptor de captura.

## Condiciones que no se pueden rebajar

La vista virtual en el teléfono y el bloqueo de la cámara ante paredes forman parte del objetivo. Una pantalla conectada sin imagen, una pose sintética o una cámara que atraviesa paredes no constituyen integración terminada.

El seguimiento espacial del Z2473 queda sujeto a diagnóstico real. Una degradación a controles táctiles u orientación sin posición exige identificar claramente ese modo y aprobación del usuario si sustituye el requisito de caminar. No se puede declarar AR por tener Android 15, permiso de cámara o valores simulados.

La imagen del móvil y las claves de la toma deben corresponder a la misma cámara corregida por colisión. La escena y los recursos previos conservan IDs, formato y compatibilidad; cualquier cambio de esquema requiere contrato y QA específicos.

## Efectos y autorización

S00 solo entrega documentación, evidencia de auditoría y ledger. No añade SDK AR, plugins, APIs, servidores, APK, escenas, código o runners al producto.

La aprobación de S00 ratifica el contrato y esta delimitación de responsabilidades. Cada Gate futuro necesita declaración ejecutable propia con mecanismo, medios, evidencia y autorización literal. Las dependencias y límites pendientes están en el [Plan](LF-FILMMAKER-MOBILE-CAMERA-CONTRACT-S00-G001_PLAN.md).

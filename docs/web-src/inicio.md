# Documentación de Century Engine

Century Engine es un editor y motor 3D para crear juegos con **escenas, nodos, recursos, eventos y JavaScript**. Esta documentación describe la versión **0.26.13**.

> Esta es documentación de una versión en desarrollo. Una API documentada no implica que todas las rutas de exportación o hardware estén validadas. Consulta las limitaciones de cada sistema.

## Elige tu punto de partida

| Necesitas | Empieza por |
|---|---|
| Abrir un proyecto y orientarte | [Primeros pasos](#/primeros-pasos) |
| Conocer paneles y herramientas | [Manual del editor](#/editor) |
| Crear jerarquías de nodos | [Escenas y nodos](#/escenas) |
| Programar comportamientos | [Scripts por nodo](#/scripts-nodo) y [propiedades editables](#/propiedades-editables) |
| Configurar controles | [Preferencias](#/preferencias) |
| Evaluar rendimiento | [Optimización](#/optimizacion) |
| Usar la API JavaScript | [Referencia de API](#/api-intro) |
| Construir eventos narrativos | [Event Order Flow](#/eventos) y [comandos](#/comandos-intro) |
| Crear colisiones | [Física y cuerpos](#/fisica) |
| Generar una aplicación | [Exportación](#/exportacion) |
| Registrar versiones y colaborar | [Control de versiones Git](#/vcs-intro) |

## Dos modos de desarrollar

**Eventos visuales:** las páginas del nodo Evento ejecutan comandos en un orden determinado, con condiciones, señales y ramas. Ideales para interacción y narrativa.

**JavaScript:** los scripts globales actúan a nivel del juego; los scripts de nodo se asocian a una instancia concreta y utilizan callbacks de ciclo de vida. Ambos utilizan la API `game` en sus contextos correspondientes.

Los ejemplos requieren adaptar los nombres de escenas, recursos y nodos al proyecto. Puedes consultar el portal sin conexión.

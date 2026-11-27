# Shader Graph

Century Engine dispone de un editor Shader Graph para materiales y efectos. No es un panel genérico del Inspector; conserva su propia herramienta visual.

## Flujo

1. Selecciona un material o perfil de postproceso compatible.
2. Abre el editor Shader Graph desde el recurso.
3. Modifica el grafo, sus parámetros y conexiones compatibles.
4. Verifica la previsualización y el resultado en escena.

## Integración

El material compartido pertenece al sistema de Assets; las referencias por ID permiten reutilizarlo. No confundas parámetros del shader con propiedades de cuerpos físicos.

## Referencias

La documentación heredada de shaders se conserva como [referencia ampliada](#/referencia-shaders) y el código de producción sigue siendo la fuente de verdad para los nodos de Shader Graph.

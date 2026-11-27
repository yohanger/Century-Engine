# Scripting JavaScript

Century Engine utiliza JavaScript como lenguaje de script. Hay dos modalidades de recurso: **Global** y **Nodo**. El editor de código integrado abre los recursos por defecto.

## Crear un recurso Script

Desde **Assets → Crear** elige **Script de Nodo (.js)** o **Script Global (.js)**. Century Engine crea el recurso y activa su **renombrado**. Cuando esté nombrado, haz doble clic para abrir el archivo en el editor integrado. También puedes abrir el editor desde **Juego → Editor de código**. El comando **Nuevo Script de Nodo** también lleva a Assets para nombrar el recurso.

Desde el menú contextual de un script, **Ejecución → Global** o **Nodo** cambia su modo. Para editar fuera de Century, usa **Juego → Abrir proyecto en VS Code** en un proyecto guardado en una carpeta. Guarda el archivo en el editor externo y luego guarda el proyecto en Century para incorporar los cambios.

Los scripts Global se crean con `start`, `update` y `fixedUpdate` vacíos. Los scripts de Nodo se crean con `_ready`, `_process` y `_physics_process` vacíos. No incluyen diálogos ni efectos de prueba.

## Script Global

Se carga para el juego y se comunica con el runtime mediante `game`. Es apropiado para reglas generales, sistemas de estado y eventos globales. Los recursos anteriores sin campo `execution` se interpretan como globales.

## Script Nodo

Se asocia a un nodo concreto desde el Inspector. El runtime crea **una instancia por nodo** y ejecuta callbacks durante PlayMode. Un recurso configurado como Nodo no se ejecuta también como global.

## API compartida

`game` ofrece acceso a variables, escenas, audio, UI, nodos y otras capacidades. `node` existe en los scripts de Nodo; no debe suponerse disponible en los scripts globales. La referencia exacta está en [API de game](#/api-intro) y [API de NodeScriptHandle](#/api-nodescripthandle).

## Eventos y scripts

El comando Script de una página de evento utiliza un contexto distinto, con `event` y `args` cuando correspondan. Las páginas de evento siguen su lista de comandos; los scripts de nodo siguen sus callbacks de ciclo de vida.

## Seguridad y errores

Los scripts de autor comparten permisos con los scripts existentes; **no** constituyen un sandbox. Los errores se reportan y las instancias se aíslan para evitar que una falla detenga todas las demás.

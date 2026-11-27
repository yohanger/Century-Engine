# LF-EDITOR-DOCKING-CA-001 — Enmienda vinculante del Sprint S03

**Estado:** RATIFICADA por autorización literal del Gate `LF-EDITOR-DOCKING-S03-G001-INTEGRAL` (2026-11-02). **QA:** PENDIENTE. No cierra el Gate por sí sola.

## Contradicción resuelta

El layout anterior fijaba los paneles izquierda/derecha/inferior y reservaba el centro para el viewport o Shader Graph, mediante `shaderGraphDocked`. S03 requiere pestañas trasladables y ventanas flotantes, sin permitir que el viewport sea una pestaña desplazable.

## Contrato prevaleciente

1. El viewport sigue siendo el **único** visor de escena/juego del Editor, estructuralmente fijo en el centro. No se registra como panel acoplable.
2. Cada panel tiene una identidad y un único destino: grupo de pestañas en izquierda, derecha, superior o inferior; ventana interna flotante; oculto. No se duplica su documento, estado o instancia de UI.
3. Shader Graph conserva su alojamiento central anterior hasta que se reubica explícitamente en una zona de docking. Al hacerlo, el documento se presenta en un grupo o flotante y se mantiene la sesión original; el viewport no se convierte en pestaña.
4. Las ventanas especializadas de eventos, scripts, shaders y diseñador UI reutilizan `FloatingEditorWindow` o `AppWindow`, con sus acciones de acoplamiento y redimensionado. Los formularios de confirmación y diálogos transaccionales quedan excluidos.
5. `leftOpen`, `rightOpen`, `bottomOpen`, tamaños y pestañas legadas siguen como rutas de compatibilidad y migran a una distribución persistente única `prefs.dockLayout`. No se permiten dos listas autoritativas de ubicación.
6. La consola y las herramientas contextuales siguen usando las fuentes de datos y los estados originales. Edit Mesh y pintura se muestran únicamente en su modo correspondiente.
7. Al jugar maximizado, al cerrar zonas o al cambiar de tamaño, las instancias de panel deben conservarse sin teletransportarse a un elemento DOM inexistente. Al reabrir, se recuperan.

## Sustituciones de pruebas anteriores

- WL-08: el toggle literal `p.leftOpen = !p.leftOpen` deja de ser una exigencia; se reemplaza por `hideDockPanel`/`restoreDockPanel` y apertura de zona correspondiente.
- WL-13: `if (props.docked) return` deja de ser la única condición de docking; `isDocked` comprende el alojamiento central heredado y el nuevo grupo.
- UXCORR2-01: el orden literal de atributos de `<FloatingEditorWindow>` ya no es contractual; sí lo es conservar un único componente Graph y el marco existente.

Todas las demás verificaciones históricas permanecen. Las pruebas de funcionamiento real en Electron siguen pendientes, así como QA visual local.

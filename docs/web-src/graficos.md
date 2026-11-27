# Gráficos y materiales

Century Engine utiliza **Three.js** como base de renderizado. El editor ofrece materiales PBR, iluminación, entornos, postprocesado, edición de mallas y herramientas de geometría.

## Geometría

El catálogo permite primitivas, mallas editables, modelos y objetos especializados. **Edit Mesh** soporta operaciones geométricas (vértices, aristas, caras, Fill, extrusión y herramientas numéricas). No sustituye a un modelador externo completo.

## Materiales PBR

El Inspector expone propiedades como color, rugosidad, metalicidad, opacidad y otras opciones físicas del material cuando corresponda. Los materiales compartidos se referencian por ID y se editan desde Assets. [Shader Graph](#/shader-graph) sigue siendo un editor especializado.

## Luces y sombras

Las luces contienen propiedades propias de iluminación. Las sombras y el resultado dependen de la configuración de render de la escena; la geometría visual no administra cuerpos físicos.

## Postproceso

Los perfiles `.post` permiten configurar efectos y previsualizarlos desde el Inspector. La cámara/Spawn/GameManager determina el perfil efectivo según contexto.

## Compatibilidad de recursos

La calidad visual y el rendimiento deben validarse en el hardware de destino. Comprueba el resultado en el juego exportado.

## Efectos visuales

Crea un recurso `.vfx`, configura sus partículas desde el Inspector y asígnalo a un nodo VFX3D. Usa **Vista previa** para revisar su apariencia. El efecto visual no genera masa ni colisiones. Para lluvia y agua consulta [Agua y fluidos](#/agua).

## Estilo PSX
En **Ajustes del motor → General → Aspecto y Shader**, activa Estilo PSX. Resolución PSX elige 240p, 480p o nativa; Ajuste de vértices (0–4 px) controla la cuantización de primitivas y mallas nativas compatibles. Texturas affine es independiente y afecta los mapas de color compatibles de modelos GLTF/GLB.

**Temblor continuo** (desactivado inicialmente) hace variar el ajuste de vértices en cada fotograma aunque la cámara y los objetos estén quietos. Requiere PSX y un ajuste mayor que 0; no cambia la geometría real. Puede aumentar el trabajo de render mientras el editor está inmóvil. No amplía el efecto a materiales que antes no admitían el ajuste.

Desde un script del juego puedes usar las propiedades públicas ya existentes:

```js
game.graphics.set({ psx: true, psxHeight: 240, psxSnap: 4, psxAffine: true })
const actual = game.graphics.settings.psxSnap
game.graphics.set({ psx: false })
```

Temblor continuo se configura exclusivamente en los ajustes del motor. Consulta la referencia de GraphicsApi en la API JavaScript.

# Shaders de superficie (GLSL)

*Juego ▸ Nuevo shader…* (o *Assets/Shaders ▸ nuevo `.glsl`*) crea un shader. Se asigna a una primitiva o malla en
*Inspector ▸ Material ▸ Shader*. El editor compila mientras escribes y marca el error en su línea. También existe el **Shader Graph**
(nodos) que genera este mismo GLSL.

## Estructura

```glsl
// @name Musgo
// @description Piedra con musgo en las caras que miran arriba.
uniform vec3 uColor;      // @param label="Color" color default=#6b8f3a
uniform float uAmount;    // @param label="Cantidad" min=0 max=1 step=0.01 default=0.5
uniform sampler2D uTex;   // @param label="Textura" srgb

void surface(inout Surface s) {
  vec3 base = rtTriplanar(uTex, s.position, s.mapNormal, 1.0 / 2.0).rgb;
  float up = smoothstep(0.4, 0.9, s.mapNormal.y) * uAmount;
  s.albedo = mix(base, uColor, up);
  s.roughness = mix(0.8, 0.95, up);
}
```

Cada `uniform … // @param …` aparece como propiedad en el Inspector (número con `min/max/step`, `color`, o ranura de textura).

## `Surface` (lo que escribes)

| Campo | Tipo | |
|---|---|---|
| `albedo` | `vec3` | Color base. |
| `alpha` | `float` | Opacidad. |
| `roughness` · `metallic` | `float` | Rugosidad y metalicidad. |
| `emissive` | `vec3` | Emisión (brilla en la oscuridad; activa bloom). |
| `ao` | `float` | Oclusión ambiental. |
| `normal` | `vec3` | Normal en espacio de vista. |

Y lo que puedes leer: `position` (mapeo en metros), `mapNormal`, `worldPos`, `viewDir`, `uv`, `time` (segundos).

## Etapa de vértices (opcional)

```glsl
// @vertex begin
void vertex(inout Vertex v) {
  v.position.y += sin(v.worldPos.x * 2.0 + v.time) * 0.05; // ondea
}
// @vertex end
```

`Vertex`: `position`, `normal`, `uv`, `worldPos`, `time`.

## Ayudas

| Función | |
|---|---|
| `rtTriplanar(tex, p, n, escala)` | Textura proyectada en las tres direcciones (`escala` = 1 / metros). Continua entre objetos. |
| `rtTriplanarNormal(tex, p, n, escala, fuerza)` | Mapa de normales triplanar. |
| `rtToView(n)` | Normal a espacio de vista. |
| `rtNoise(p)` · `rtFbm(p)` · `rtHash(p)` | Ruido 3D, ruido fractal (4 octavas) y hash. |

El editor sugiere los tipos y funciones GLSL, estas ayudas, los miembros de `s.` / `v.` y los comentarios `@param`, `@name`, `@vertex`.
Los shaders se ven en el editor y en el juego exportado.

## Shaders de versiones anteriores

Las ayudas de GLSL empezaban por `lf` (`lfNoise`, `lfTriplanar`…) y ahora empiezan por `rt` (`rtNoise`, `rtTriplanar`…). Al abrir un proyecto antiguo, tus archivos `.glsl` y los grafos se reescriben solos (con copia `project.lfproj.bak-v1` junto al proyecto); no hay que hacer nada.

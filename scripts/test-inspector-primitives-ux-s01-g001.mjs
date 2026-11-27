// QA del contrato visual S01: los datos/acciones siguen en el Inspector original.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8')
const inspector=read('src/components/Inspector.vue')
const material=read('src/components/MaterialSection.vue')
const dock=read('src/components/InspectorDock.vue')
const styles=read('src/styles.css')
const checks=[
 ['IP-01: cabecera de primitiva reutiliza el mismo nodo',()=>assert.match(inspector,/data-testid="inspector-node-head"/)],
 ['IP-02: apariencia condicionada exclusivamente a primitivas',()=>assert.match(inspector,/\.insp\[data-node-type='primitive'\] \.primitive-head/)],
 ['IP-03: transformación mantiene posición',()=>assert.match(inspector,/vec\('position', \$event\)/)],
 ['IP-04: transformación mantiene rotación',()=>assert.match(inspector,/vec\('rotation', \$event\)/)],
 ['IP-05: transformación conserva escala por eje',()=>assert.match(inspector,/vec\('scale', \$event\)/)],
 ['IP-06: escala uniforme conserva confirmar y cancelar',()=>{assert.match(inspector,/@commit="confirmUniformScale"/);assert.match(inspector,/cancelUniformScale\(uniformDraft\)/)}],
 ['IP-07: Transformación conserva su cabecera y el control para restablecer',()=>assert.match(inspector,/<header>Transformación[^\n]+@click\.stop="resetTransform"/)],
 ['IP-08: las secciones tienen roles visuales estables',()=>{for(const kind of ['transform','cuts','script','material','lighting','mesh','prefab','stairs'])assert.ok(inspector.includes(`'${kind}'`) || inspector.includes(`data-primitive-section="${kind}"`),kind)}],
 ['IP-09: cortes sigue siendo edición de primitiva',()=>assert.match(inspector,/data-primitive-section="cuts"/)],
 ['IP-10: Hornear cortes conserva comando existente',()=>assert.match(inspector,/store\.editor\.bakeCuts\(\)/)],
 ['IP-11: Editar malla conserva toggleEdit y Tab',()=>assert.match(inspector,/store\.editor\.toggleEdit\(\)/)],
 ['IP-12: material se renderiza una vez por objeto',()=>assert.equal((inspector.match(/<MaterialSection v-if=/g)||[]).length,1)],
 ['IP-13: material primitivo habilita variante sin sustituir componente',()=>assert.match(inspector,/:primitive-layout="obj\.type === 'primitive'"/)],
 ['IP-14: materiales compartidos conservan recurso y edición',()=>{for(const f of ['assignMaterial','makeMaterialLocal','openMaterialEditor'])assert.ok(material.includes(f),f)}],
 ['IP-15: controles de material tienen fuente única',()=>assert.match(material,/effectiveMaterialObject\(host\.value, materials\.value\)/)],
 ['IP-16: plegado conserva claves anteriores del InspectorDock',()=>{assert.match(dock,/header\.textContent\.trim\(\)\.slice\(0, 40\)/);assert.match(dock,/const key = keyOf\(header\)/)}],
 ['IP-17: recursos tienen selectores y foco de teclado',()=>{assert.match(material,/\.mr\.mr-primitive \.mr-group summary:focus-visible/);assert.match(styles, /button:focus-visible, input:focus-visible, select:focus-visible/)}],
 ['IP-18: campos usan ancho compartido de etiquetas',()=>assert.match(inspector,/:deep\(\.mr-primitive \.field\)[\s\S]*?var\(--lf-property-label-width, 112px\)/)],
 ['IP-19: panel compacto apila propiedades',()=>assert.match(inspector,/@container insp \(max-width: 260px\)/)],
 ['IP-20: acciones Script y Prefab siguen existentes',()=>{assert.match(inspector,/onScriptDrop/);assert.match(inspector,/applyToPrefab\(obj\.id\)/);assert.match(inspector,/createPrefab\(\[obj\.id\]/)}],
 ['IP-21: Tags y estado de escena NO se migran en S01',()=>{assert.match(inspector,/<TagLayerRow :obj="obj"/);assert.match(inspector,/<ScenePanel \/>/)}],
 ['IP-22: no se cambia propiedad ni objeto en MaterialSection',()=>assert.match(material, /const host = computed\(\(\) => props.resourceId \?/)],
 ['IP-23: sombras, GI y lightmap siguen editables',()=>{for(const field of ['castShadow','GI_MODES','lmScale'])assert.ok(inspector.includes(field),field)}],
 ['IP-24: el editor conserva plegado por tipo de nodo',()=>assert.match(dock,/\$\{context\}:\$\{label\}/)],
]
for(const [label,fn] of checks)test(label,fn)

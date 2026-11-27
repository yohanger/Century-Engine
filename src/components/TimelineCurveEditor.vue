<script setup>
// Herramienta gráfica de G005 dentro de TimelinePanel: editar la fuente, no duplicar evaluadores.
import {ref,computed,watch,onMounted,onBeforeUnmount,nextTick} from 'vue'
import {uid} from '../engine/runtime/util.js'
import {evalNode,evalCamera,rotFromQuat} from '../engine/runtime/timeline/eval.js'
import {easeValue} from '../engine/runtime/anim/eval.js'
import {timelineSelectionMoveDelta,timelineTrackEditable,deleteTimelineSelection} from '../core/timeline/model.js'
import {timelineCurveChannels,timelineCurveKeyValue,timelineCurveCanRetime,editTimelineCurveKey,editTimelineCurveTangent,editTimelineCurveBezier,insertTimelineCurveKey} from '../core/timeline/curves.js'
import {createTimelinePointerDrag} from '../core/timeline/pointer-drag.js'
const props=defineProps({timeline:{type:Object,required:true},track:{type:Object,default:null},selectedKey:{type:Object,default:null},playhead:{type:Number,default:0},snap:{type:Number,default:0},disabled:{type:Boolean,default:false}})
const emit=defineEmits(['pick','removed','error','pause','edited','live','seek','close'])
const curveDrag = createTimelinePointerDrag()
const curveSvg = ref(null), easeSvg = ref(null)
const curveClipId = 'lf-timeline-curve-' + uid('mask')
const graphSize=ref({width:900,height:240})
const curvePlot=computed(()=>({left:55,top:20,right:graphSize.value.width-14,bottom:graphSize.value.height-8,
  width:Math.max(1,graphSize.value.width-69),height:Math.max(1,graphSize.value.height-28),
  center:(graphSize.value.height+12)/2,valueSpan:Math.max(1,graphSize.value.height-60)}))
let sizeObserver=null
function bindGraphSize() {
  sizeObserver?.disconnect();sizeObserver=null
  const svg=curveSvg.value
  if(!svg)return
  const sync=()=>{
    const rect=svg.getBoundingClientRect()
    if(rect.width>0&&rect.height>0) {
      const width=Math.max(110,Math.round(rect.width)),height=Math.max(105,Math.round(rect.height))
      if(width!==graphSize.value.width||height!==graphSize.value.height)graphSize.value={width,height}
    }
  }
  sync()
  if(typeof ResizeObserver!=='undefined'){sizeObserver=new ResizeObserver(sync);sizeObserver.observe(svg)}
}
onMounted(()=>nextTick(bindGraphSize))
onBeforeUnmount(()=>{ curveDrag.cancel(); sizeObserver?.disconnect() })
const curveChannelId = ref('v0'), curveTimeStart = ref(0), curveTimeWindow = ref(10)
const curveValueMid = ref(0), curveValueRange = ref(10)
const curveChannels = computed(() => timelineCurveChannels(props.track))
const curveChannel = computed(() => curveChannels.value.find(c => c.id === curveChannelId.value) || curveChannels.value[0] || null)
const curveTrack = computed(() => curveChannel.value ? props.track : null)
const curveCanEdit = computed(() => !!curveTrack.value && timelineTrackEditable(curveTrack.value) && !props.disabled)
const curveCubic = computed(() => curveTrack.value?.kind === 'node' && ['cubic','cubic-angle'].includes(curveTrack.value?.interpolation))
const curveBezier = computed(() => curveCanEdit.value && props.selectedKey?.ease === 'bezier' && !curveTrack.value?.interpolation &&
  curveTrack.value?.keys.indexOf(props.selectedKey) < curveTrack.value?.keys.length - 1)
const curveKeyPoints = computed(() => !curveTrack.value || !curveChannel.value ? [] :
  curveTrack.value.keys.map(k => ({ key:k, x:curveTimeToX(k.t), y:curveValueToY(curveSample(k.t, true)) })))
function curveSample(time, atKey = false) {
  const track = curveTrack.value, channel = curveChannel.value
  if (!track || !channel) return 0
  if (atKey && channel.field !== 'rot' && !(track.kind==='node' && track.prop==='rotation' && track.interpolation?.endsWith('-angle'))) return timelineCurveKeyValue(track.keys.find(k=>Math.abs(k.t-time)<1e-7),channel) ?? 0
  if (track.kind === 'node') return evalNode(track,time)?.[channel.axis] ?? 0
  const pose = evalCamera(track,time)
  if (!pose) return 0
  if (channel.field === 'rot') {
    const raw = rotFromQuat(pose.quat)[channel.axis]
    const first = track.keys[0]?.rot?.[channel.axis] || 0
    return raw + 360 * Math.round((first - raw) / 360)
  }
  return channel.field === 'fov' ? pose.fov : pose.pos[channel.axis]
}
function curveTimeToX(t) { return curvePlot.value.left + (t - curveTimeStart.value) * curvePlot.value.width / Math.max(.01,curveTimeWindow.value) }
function curveValueToY(v) { return curvePlot.value.center - (v - curveValueMid.value) * curvePlot.value.valueSpan / Math.max(.01,curveValueRange.value) }
function curveXToTime(x) { return curveTimeStart.value + (x - curvePlot.value.left) * curveTimeWindow.value / curvePlot.value.width }
function curveYToValue(y) { return curveValueMid.value + (curvePlot.value.center - y) * curveValueRange.value / curvePlot.value.valueSpan }
const curveTickX = computed(() => {const count=Math.max(2,Math.min(14,Math.floor(curvePlot.value.width/90)));return Array.from({length:count+1},(_,i)=>({x:curvePlot.value.left+i*curvePlot.value.width/count,t:curveTimeStart.value+i*curveTimeWindow.value/count}))})
const curveTickY = computed(() => {const count=Math.max(2,Math.min(8,Math.floor(curvePlot.value.height/46)));return Array.from({length:count+1},(_,i)=>({y:curvePlot.value.top+14+i*curvePlot.value.valueSpan/count,v:curveValueMid.value+(count/2-i)*curveValueRange.value/count}))})
const curveLines = computed(() => {
  const tr=curveTrack.value,keys=tr?.keys||[]
  if (!curveChannel.value || keys.length<2) return []
  const begin=curveTimeStart.value, end=begin+curveTimeWindow.value
  return keys.slice(0,-1).flatMap((a,i)=>{
    const b=keys[i+1]
    if(b.t<begin || a.t>end || b.t<=a.t) return []
    const cuts=tr.interpolation==='nearest' || (!tr.interpolation && a.ease==='cut')
    const pieces=[];let previous=null
    const stepCount=Math.min(36,Math.max(2,Math.ceil((b.t-a.t)*curvePlot.value.width/curveTimeWindow.value/4)))
    for(let j=0;j<=stepCount;j++){
      const t=a.t+(b.t-a.t)*j/stepCount
      if(t<curveTimeStart.value-1 || t>curveTimeStart.value+curveTimeWindow.value+1)continue
      // Los cortes no se unen con una diagonal falsa entre una clave y la siguiente.
      if(cuts && j===stepCount)break
      let value=curveSample(t)
      if(curveChannel.value.field==='rot' && previous!==null) value+=360*Math.round((previous-value)/360)
      previous=value
      if(Number.isFinite(value))pieces.push(`${curveTimeToX(t).toFixed(2)},${curveValueToY(value).toFixed(2)}`)
    }
    return [{id:a.id,points:pieces.join(' '),cut:cuts}]
  })
})
function fitCurve() {
  const tr=curveTrack.value, ch=curveChannel.value
  if (!tr || !ch) return
  curveTimeStart.value=0
  curveTimeWindow.value=Math.max(.5,props.timeline?.duration || 10)
  const values=tr.keys.map(k=>curveSample(k.t,true)).filter(Number.isFinite)
  // Incluye sobrepasos cúbicos y Bézier con una muestra ligera del evaluador real.
  for(let j=0;j<100 && tr.keys.length>1;j++){
    const t=tr.keys[0].t+(tr.keys.at(-1).t-tr.keys[0].t)*j/99
    values.push(curveSample(t))
  }
  const min=values.length?Math.min(...values):0,max=values.length?Math.max(...values):1
  curveValueMid.value=(min+max)/2
  curveValueRange.value=Math.max(.1,(max-min)*1.35)
}
watch(() => [props.timeline?.id, props.track?.id], () => {curveDrag.cancel();curveChannelId.value=timelineCurveChannels(props.track)[0]?.id||'v0';fitCurve();nextTick(bindGraphSize)},{flush:'post',immediate:true})
function chooseCurveChannel(id) {curveChannelId.value=id;fitCurve()}
function curveZoom(factor) {
  const dur=Math.max(.5,props.timeline?.duration||10)
  const width=Math.max(.04,Math.min(dur,curveTimeWindow.value*factor))
  const center=curveTimeStart.value+curveTimeWindow.value/2
  curveTimeWindow.value=width
  curveTimeStart.value=Math.max(0,Math.min(dur-width,center-width/2))
}
function curveValueZoom(factor) {curveValueRange.value=Math.max(.001,Math.min(1e7,curveValueRange.value*factor))}
function curveEventXY(event, svg=curveSvg.value) {
  const rect=svg?.getBoundingClientRect()
  if (!rect?.width || !rect?.height) return null
  return {x:(event.clientX-rect.left)*graphSize.value.width/rect.width,y:(event.clientY-rect.top)*graphSize.value.height/rect.height}
}
function curveBackgroundDown(event) {
  if(event.button!==0 || !curveSvg.value) return
  event.preventDefault()
  const origin=curveEventXY(event),resource=props.timeline?.id
  if(!origin)return
  const start=curveTimeStart.value,mid=curveValueMid.value
  let moved=false
  const motion=(ev)=>{
    if(props.timeline?.id!==resource)return
    const curr=curveEventXY(ev);if(!curr)return
    if(Math.abs(curr.x-origin.x)>3||Math.abs(curr.y-origin.y)>3)moved=true
    if(!moved)return
    curveTimeStart.value=Math.max(0,Math.min(Math.max(0,props.timeline.duration-curveTimeWindow.value),start-(curr.x-origin.x)*curveTimeWindow.value/curvePlot.value.width))
    curveValueMid.value=mid+(curr.y-origin.y)*curveValueRange.value/curvePlot.value.valueSpan
  }
  const finish=(ev)=>{clean();if(!moved){const p=curveEventXY(ev);if(p)emit('seek',Math.max(0,Math.min(props.timeline.duration,curveXToTime(p.x))))}}
  const clean=()=>{window.removeEventListener('pointermove',motion);window.removeEventListener('pointerup',finish);window.removeEventListener('pointercancel',clean)}
  window.addEventListener('pointermove',motion);window.addEventListener('pointerup',finish);window.addEventListener('pointercancel',clean)
}
function curveKeyDown(event,key) {
  if(event.button!==0)return
  event.preventDefault();event.stopPropagation()
  const tr=curveTrack.value,ch=curveChannel.value,id=props.timeline?.id
  if(!tr||!ch)return
  emit('pick',tr,key,event.ctrlKey||event.metaKey?event:null)
  if(!curveCanEdit.value)return
  const origin=curveEventXY(event)
  if(!origin)return
  const initial={t:key.t,v:timelineCurveKeyValue(key,ch)}, xScale=curveTimeWindow.value/curvePlot.value.width,yScale=curveValueRange.value/curvePlot.value.valueSpan
  let changed=false
  const restore=()=>{
    key.t=initial.t
    if(ch.axis===null)key[ch.field]=initial.v
    else key[ch.field][ch.axis]=initial.v
  }
  const motion=ev=>{
    if(props.timeline?.id!==id||!tr.keys.includes(key))return
    const point=curveEventXY(ev);if(!point)return
    const dx=point.x-origin.x,dy=point.y-origin.y
    const wasChanged=changed
    if(wasChanged)restore()
    const desired=dx*xScale
    const snapped=timelineCurveCanRetime(tr,key)?timelineSelectionMoveDelta(props.timeline,[{tr:tr.id,k:key.id}],desired,{snap:props.snap,playhead:props.playhead,zoom:curvePlot.value.width/curveTimeWindow.value,anchor:{tr:tr.id,k:key.id}}):0
    const time=initial.t+snapped
    changed=editTimelineCurveKey(tr,key.id,ch.id,{time,value:initial.v-dy*yScale},props.timeline.duration)
    if(changed && !wasChanged)emit('pause')
    if(changed || wasChanged)emit('live')
  }
  curveDrag.begin(event,{axis:'xy',move:motion,
    finish(){if(changed){emit('edited','Editar clave en curvas');emit('live')}},
    cancel(){if(changed){restore();emit('live')}},
  })
}
function curveInsertFromLine(event) {
  if(!curveCanEdit.value || event.target?.closest?.('.curve-edit-key,.curve-edit-handle'))return
  const point=curveEventXY(event),plot=curvePlot.value,tr=curveTrack.value,ch=curveChannel.value
  if(!point||!tr||!ch||point.x<plot.left||point.x>plot.right||point.y<plot.top||point.y>plot.bottom)return
  let time=curveXToTime(point.x)
  if(props.snap>0)time=Math.round(time/props.snap)*props.snap
  if(time<0||time>props.timeline.duration)return
  // Solo insertar sobre un tramo de curva existente, no en cualquier lugar del lienzo.
  const before=tr.keys.findIndex(k=>k.t>time)
  if(before<1||Math.abs(curveValueToY(curveSample(time))-point.y)>12)return
  const pose=tr.kind==='node' ? {v:[...(evalNode(tr,time)||tr.keys[before-1].v)]} : (()=>{
    const camera=evalCamera(tr,time)
    if(!camera)return null
    const rot=rotFromQuat(camera.quat).map((v,i)=>v+360*Math.round(((tr.keys[before-1]?.rot?.[i]||0)-v)/360))
    return {pos:[...camera.pos],rot,fov:camera.fov}
  })()
  if(!pose)return
  const key=insertTimelineCurveKey(tr,ch.id,time,curveYToValue(point.y),props.timeline.duration,pose)
  if(!key)return
  emit('pause');emit('pick',tr,key);emit('edited','Insertar clave en curvas');emit('live')
}
function curveRemoveKey(key=props.selectedKey) {
  const tr=curveTrack.value
  if(!curveCanEdit.value||!tr||!key||!tr.keys.includes(key))return
  try {
    const removed=deleteTimelineSelection(props.timeline,[{tr:tr.id,k:key.id}])
    if(removed){emit('pause');emit('removed',tr);emit('edited','Eliminar clave de curvas');emit('live')}
  }catch(error){emit('error',error.message)}
}
function curveKeyKeyboard(event,key) {
  if(['Delete','Backspace'].includes(event.key)){
    event.preventDefault();event.stopPropagation();curveRemoveKey(key);return
  }

  if(!curveCanEdit.value)return
  const ch=curveChannel.value,tr=curveTrack.value
  if(!ch||!tr||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return
  event.preventDefault();event.stopPropagation()
  const dt=event.key==='ArrowRight'?(props.snap||.05):event.key==='ArrowLeft'?-(props.snap||.05):0
  const dv=event.key==='ArrowUp'?.1:event.key==='ArrowDown'?-.1:0
  const old=timelineCurveKeyValue(key,ch)
  if(editTimelineCurveKey(tr,key.id,ch.id,{time:key.t+dt,value:old+dv},props.timeline.duration)){emit('pause');emit('edited','Editar clave en curvas');emit('live')}
}
function curveTangentData() {
  const tr=curveTrack.value,k=props.selectedKey,ch=curveChannel.value
  if(!curveCubic.value || !tr || !k || ch?.field!=='v')return []
  const index=tr.keys.indexOf(k),base=curveSample(k.t,true)
  const sides=[{side:'in',neighbor:tr.keys[index-1],field:'tanIn',dir:-1},{side:'out',neighbor:tr.keys[index+1],field:'tanOut',dir:1}]
  return sides.filter(s=>s.neighbor).map(s=>{
    const dt=Math.min(Math.abs(s.neighbor.t-k.t)/3,Math.max(.02,curveTimeWindow.value/12))*s.dir
    const stored=k[s.field]?.[ch.axis]
    // Pendiente automática aproximada desde el evaluador existente, nunca otro evaluador.
    const epsilon=Math.min(.003,Math.abs(dt)/4)
    const slope=Number.isFinite(stored)?stored:s.dir>0?
      (curveSample(k.t+epsilon)-base)/epsilon:(base-curveSample(k.t-epsilon))/epsilon
    return {side:s.side,dt,x:curveTimeToX(k.t+dt),y:curveValueToY(base+slope*dt),baseX:curveTimeToX(k.t),baseY:curveValueToY(base)}
  })
}
const curveTangentPoints = computed(curveTangentData)
function curveTangentDown(event,handle) {
  if(event.button!==0||!curveCanEdit.value)return
  event.stopPropagation();event.preventDefault()
  const tr=curveTrack.value,ch=curveChannel.value,key=props.selectedKey,id=props.timeline?.id
  if(!key||!ch)return
  const field=handle.side==='in'?'tanIn':'tanOut',original=key[field]?[...key[field]]:undefined
  let changed=false
  const motion=ev=>{
    if(props.timeline?.id!==id||!tr.keys.includes(key))return
    const point=curveEventXY(ev);if(!point)return
    const slope=(curveYToValue(point.y)-curveSample(key.t,true))/handle.dt
    if(editTimelineCurveTangent(tr,key.id,ch.id,handle.side,slope)){if(!changed)emit('pause');changed=true;emit('live')}
  }
  curveDrag.begin(event,{axis:'xy',move:motion,
    finish(){if(changed){emit('edited','Editar tangente cúbica');emit('live')}},
    cancel(){if(changed){if(original)key[field]=original;else delete key[field];emit('live')}},
  })
}
function enableBezier() {
  if(!curveCanEdit.value||!props.selectedKey||curveTrack.value.interpolation ||
    curveTrack.value.keys.at(-1)===props.selectedKey)return
  emit('pause')
  props.selectedKey.ease='bezier';if(!props.selectedKey.bz)props.selectedKey.bz=[.42,0,.58,1]
  emit('edited','Activar curva Bézier');emit('live')
}
const easeLine = computed(()=>{
  if(!curveBezier.value)return ''
  return Array.from({length:65},(_,i)=>{
    const u=i/64
    return `${(25+210*u).toFixed(1)},${(95-60*easeValue(props.selectedKey,u)).toFixed(1)}`
  }).join(' ')
})
function easeHandleDown(event,handle) {
  if(event.button!==0||!curveBezier.value)return
  event.stopPropagation();event.preventDefault()
  const tr=curveTrack.value,key=props.selectedKey,old=[...(key.bz||[.42,0,.58,1])],id=props.timeline?.id
  let changed=false
  const motion=ev=>{
    if(props.timeline?.id!==id)return
    const rect=easeSvg.value?.getBoundingClientRect();if(!rect?.width||!rect?.height)return
    const x=(ev.clientX-rect.left)*260/rect.width, y=(ev.clientY-rect.top)*140/rect.height
    if(editTimelineCurveBezier(tr,key.id,handle,(x-25)/210,(95-y)/60)){if(!changed)emit('pause');changed=true;emit('live')}
  }
  curveDrag.begin(event,{axis:'xy',move:motion,
    finish(){if(changed){emit('edited','Editar suavizado Bézier');emit('live')}},
    cancel(){if(changed){key.bz=old;emit('live')}},
  })
}

</script>

<template>
      <section class="curve-panel" aria-label="Editor gráfico de curvas" data-test="timeline-curve-editor">
        <div class="curve-bar">
          <strong>Curvas</strong>
          <span class="curve-track-name">{{ curveTrack?.name || 'Selecciona una pista de nodo o cámara libre' }}</span>
          <div class="curve-actions" v-if="curveTrack">
            <button type="button" @click="curveZoom(1.25)" aria-label="Alejar curva horizontalmente">−</button>
            <button type="button" @click="curveZoom(.8)" aria-label="Acercar curva horizontalmente">+</button>
            <button type="button" @click="curveValueZoom(1.25)" aria-label="Alejar valores">Y−</button>
            <button type="button" @click="curveValueZoom(.8)" aria-label="Acercar valores">Y+</button>
            <button type="button" @click="fitCurve">Encuadrar</button>
          </div>
          <button v-if="selectedKey && curveCanEdit" type="button" class="curve-remove" title="Eliminar clave seleccionada (Supr)" @click="curveRemoveKey()">Eliminar clave</button>
          <button type="button" class="curve-close" aria-label="Cerrar editor de curvas" @click="emit('close')">×</button>
        </div>
        <template v-if="curveTrack">
          <div class="curve-channels" role="group" aria-label="Canales de curvas">
            <button v-for="channel in curveChannels" :key="channel.id" type="button" :class="{on:curveChannel?.id===channel.id}" :aria-pressed="curveChannel?.id===channel.id" :style="{'--curve-accent':channel.color}" @click="chooseCurveChannel(channel.id)">{{ channel.label }}</button>
            <span class="curve-note">{{ curveTrack.locked?'Pista bloqueada · solo lectura':curveTrack.clips?.length?'Claves fuente de clips · tiempo protegido en extremos':'Doble clic en curva: insertar clave · Supr: eliminar clave · arrastra para editar' }}</span>
          </div>
          <div class="curve-body">
            <svg ref="curveSvg" class="curve-graph" :viewBox="`0 0 ${graphSize.width} ${graphSize.height}`" preserveAspectRatio="none" role="img" :aria-label="'Curva del canal '+curveChannel.label" @pointerdown="curveBackgroundDown" @dblclick.stop="curveInsertFromLine" data-test="curve-graph-responsive">
              <defs><clipPath :id="curveClipId"><rect :x="curvePlot.left" :y="curvePlot.top" :width="curvePlot.width" :height="curvePlot.height" /></clipPath></defs>
              <rect :x="curvePlot.left" :y="curvePlot.top" :width="curvePlot.width" :height="curvePlot.height" fill="#20262b" />
              <g class="curve-grid"><g v-for="tick in curveTickX" :key="'x'+tick.x"><line :x1="tick.x" :y1="curvePlot.top" :x2="tick.x" :y2="curvePlot.bottom" /><text :x="tick.x+3" y="17">{{ tick.t.toFixed(2) }}s</text></g><g v-for="tick in curveTickY" :key="'y'+tick.y"><line :x1="curvePlot.left" :y1="tick.y" :x2="curvePlot.right" :y2="tick.y" /><text x="3" :y="tick.y+3">{{ tick.v.toFixed(2) }}</text></g></g>
              <g :clip-path="'url(#'+curveClipId+')'">
                <polyline v-for="line in curveLines" :key="line.id" :points="line.points" :stroke="curveChannel.color" stroke-width="2" fill="none" stroke-linejoin="round" />
                <line :x1="curveTimeToX(playhead)" :y1="curvePlot.top" :x2="curveTimeToX(playhead)" :y2="curvePlot.bottom" stroke="#e9cf8a" stroke-width="1" stroke-dasharray="4 4" />
                <g v-for="handle in curveTangentPoints" :key="handle.side">
                  <line :x1="handle.baseX" :y1="handle.baseY" :x2="handle.x" :y2="handle.y" stroke="#aebed0" stroke-width="1.5" />
                  <circle :cx="handle.x" :cy="handle.y" r="5" fill="#d5e1ed" stroke="#1b252d" stroke-width="2" class="curve-edit-handle" :aria-label="'Tangente '+handle.side" @pointerdown.stop.prevent="curveTangentDown($event,handle)" />
                </g>
                <circle v-for="dot in curveKeyPoints" :key="dot.key.id" :cx="dot.x" :cy="dot.y" r="6" :fill="selectedKey?.id===dot.key.id?'#eef8ff':curveChannel.color" stroke="#14191d" stroke-width="2" class="curve-edit-key" tabindex="0" role="slider" :aria-label="'Clave '+dot.key.t.toFixed(2)+' segundos, canal '+curveChannel.label" :aria-valuenow="timelineCurveKeyValue(dot.key,curveChannel)" @pointerdown.stop.prevent="curveKeyDown($event,dot.key)" @dblclick.stop="() => {}" @keydown="curveKeyKeyboard($event,dot.key)" />
              </g>
            </svg>
            <div class="curve-ease-controls" v-if="selectedKey && !curveTrack.interpolation && curveCanEdit && curveTrack.keys.at(-1)!==selectedKey">
              <button v-if="selectedKey.ease!=='bezier'" type="button" @click="enableBezier">Convertir a Bézier</button>
              <div v-else class="curve-ease-group">
                <span>Bézier temporal · clave seleccionada</span>
                <svg ref="easeSvg" class="curve-ease-graph" viewBox="0 0 260 140" preserveAspectRatio="none" role="img" aria-label="Curva de aceleración Bézier">
                  <path d="M25 35 H235 M25 95 H235 M25 15 V125 M235 15 V125" stroke="#47515a" fill="none" stroke-width="1" />
                  <polyline :points="easeLine" stroke="#81b9e7" stroke-width="2.5" fill="none" />
                  <g v-for="handle in [0,1]" :key="handle">
                    <line :x1="handle?235:25" :y1="handle?35:95" :x2="25+210*selectedKey.bz[handle*2]" :y2="95-60*selectedKey.bz[handle*2+1]" stroke="#b4c9d8" />
                    <circle :cx="25+210*selectedKey.bz[handle*2]" :cy="95-60*selectedKey.bz[handle*2+1]" r="6" fill="#e8c184" stroke="#20262b" stroke-width="1.5" class="curve-edit-handle" :aria-label="'Control Bézier '+(handle+1)" @pointerdown.stop.prevent="easeHandleDown($event,handle)" />
                  </g>
                </svg>
                <small>Controla el suavizado del tramo sin cambiar los valores de la clave.</small>
              </div>
            </div>
          </div>
        </template>
        <p v-else class="curve-empty">Selecciona una pista numérica de nodo o una cámara con claves libres. Las pistas de eventos, física y visibilidad no contienen curvas numéricas editables.</p>
      </section>
</template>

<style scoped>
.curve-panel { display:flex;flex-direction:column;flex:none;height:264px;min-height:132px;max-height:50%;background:#23282c;border-top:1px solid #56616a;min-width:0;overflow:hidden; }
.curve-bar { display:flex;align-items:center;gap:8px;min-height:28px;height:28px;flex:none;padding:1px 8px;background:#343a3f;border-bottom:1px solid #151c21;font-size:11px; }
.curve-bar strong { color:#e8eff5;font-size:11px; }.curve-track-name { min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#aab8c4; }
.curve-actions { display:flex;gap:3px;margin-left:auto;flex:none; }.curve-actions button,.curve-close,.curve-ease-controls button { border:1px solid #5e6d7b;background:#34424d;color:#e6edf3;border-radius:2px;font-size:10px;height:23px;padding:0 7px; }
.curve-close { margin-left:auto;flex:none;min-width:23px; }.curve-actions+.curve-close {margin-left:0;}
.curve-channels { display:flex;gap:3px;align-items:center;min-height:30px;padding:3px 8px;flex:none;overflow-x:auto;scrollbar-width:thin; }
.curve-channels button { border:1px solid #49545e;border-left:3px solid var(--curve-accent);border-radius:2px;background:#2d3339;color:#b4c1cb;font-size:10px;padding:3px 7px;white-space:nowrap; }
.curve-channels button.on { background:#445462;color:#fff;border-color:var(--curve-accent); }
.curve-note {color:#9aa9b4;font-size:10px;margin-left:auto;white-space:nowrap;}
.curve-body {display:flex;min-height:0;flex:1;gap:6px;padding:3px 6px;overflow:hidden;}
.curve-graph { flex:1;min-width:0;height:100%;background:#1b2126;touch-action:none;cursor:crosshair;user-select:none; }
.curve-grid line {stroke:#6c7e8c;stroke-width:.55;stroke-opacity:.35;}.curve-grid text {font:10px ui-monospace,monospace;fill:#9baebb;pointer-events:none;}
.curve-edit-key,.curve-edit-handle {cursor:grab;outline:none;}.curve-edit-key:focus {stroke:#fff;stroke-width:3;}.curve-edit-key:active,.curve-edit-handle:active {cursor:grabbing;}
.curve-ease-controls {width:260px;min-width:0;max-width:32%;display:flex;align-items:flex-start;justify-content:center;border-left:1px solid #4a545d;padding:3px 5px;overflow-y:auto;}
.curve-ease-group {width:100%;display:flex;flex-direction:column;gap:4px;align-items:stretch;font-size:10px;color:#c5d2dc;}
.curve-ease-graph {height:135px;width:100%;background:#1d252c;touch-action:none;user-select:none;}.curve-ease-group small {font-size:9px;color:#99a9b6;line-height:1.2;}
.curve-empty {color:#adbcc8;font-size:11px;padding:15px 12px;}
@container (max-width: 680px) { .curve-ease-controls {width:170px;}.curve-note {display:none;} .curve-bar {gap:4px;}.curve-actions button {padding:0 4px;} }

/* G005 CORR-001: Responsive First: la geometría SVG se calcula con el tamaño real. */
.curve-panel {container-type:inline-size; height:clamp(175px,43%,390px);max-height:70%;min-height:min(175px,65%);}
.curve-bar {height:auto;min-height:30px;flex-wrap:wrap;row-gap:3px;padding-block:4px;}
.curve-track-name {flex:1 1 55px;}
.curve-actions {max-width:100%;overflow-x:auto;min-width:0;scrollbar-width:thin;}
.curve-remove {flex:none;border:1px solid #8f645f;background:#573d3b;color:#ffe1dc;border-radius:2px;height:23px;font-size:10px;padding:0 7px;}
.curve-body {flex:1;min-height:0;min-width:0;}
.curve-graph {min-width:0;min-height:95px;}
.curve-channels {min-width:0;max-width:100%;}
@container (max-width:520px) {
  .curve-panel {height:clamp(180px,53%,440px);max-height:75%;}
  .curve-body {flex-direction:column;overflow-y:auto;}
  .curve-graph {flex:1 0 135px;min-height:135px;width:100%;}
  .curve-ease-controls {flex:none;width:100%;max-width:none;max-height:150px;border-left:none;border-top:1px solid #4a545d;padding:5px;box-sizing:border-box;}
  .curve-ease-graph {height:110px;}
  .curve-note {display:none;}
  .curve-actions {order:3;flex:1 1 100%;margin-left:0;}
  .curve-actions button {flex:none;}
}
@container (max-width:280px) { .curve-bar {gap:3px;} .curve-track-name {display:none;} .curve-actions {overflow-x:auto;} }
</style>

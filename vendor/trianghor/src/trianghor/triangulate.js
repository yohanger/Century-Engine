// TriangHor: triangulación mínima de bordes convexos (parche rectangular),
// con prioridad por calidad de forma. Conserva todos los vértices fronterizos
// y evita el vértice central artificial de un abanico de triángulos largos.
export function triangulatePatchRing(ring,width) {
  if (ring.length<3) return []
  const current=ring.slice(),tri=[]
  const point=index=>[index%width,Math.floor(index/width)]
  function quality(a,b,c) {
    const [ax,az]=point(a),[bx,bz]=point(b),[cx,cz]=point(c)
    const twice=(bx-ax)*(cz-az)-(bz-az)*(cx-ax)
    if (twice<=1e-8) return -Infinity // ring orientado CCW
    const aa=(ax-bx)**2+(az-bz)**2
    const bb=(bx-cx)**2+(bz-cz)**2
    const cc=(cx-ax)**2+(cz-az)**2
    return 2*Math.sqrt(3)*twice/(aa+bb+cc)
  }
  while (current.length>3) {
    let best=-1, bestQuality=-Infinity
    for (let i=0;i<current.length;i++) {
      const prev=current[(i+current.length-1)%current.length]
      const next=current[(i+1)%current.length]
      const q=quality(prev,current[i],next)
      if(q>bestQuality){bestQuality=q;best=i}
    }
    if(best<0 || bestQuality<=0) return null
    const prev=current[(best+current.length-1)%current.length]
    const next=current[(best+1)%current.length]
    tri.push(prev,next,current[best]) // winding equivalente a Terrain: xz negativo
    current.splice(best,1)
  }
  if (quality(current[0],current[1],current[2])<=0) return null
  tri.push(current[0],current[2],current[1])
  return tri
}

export function triangleShapeQuality(index,width) {
  let worst=1,mean=0,count=0
  for(let i=0;i<index.length;i+=3) {
    const a=index[i],b=index[i+1],c=index[i+2]
    const ax=a%width,az=(a/width)|0,bx=b%width,bz=(b/width)|0,cx=c%width,cz=(c/width)|0
    const cross=Math.abs((bx-ax)*(cz-az)-(bz-az)*(cx-ax))
    const edges=(ax-bx)**2+(az-bz)**2+(bx-cx)**2+(bz-cz)**2+(cx-ax)**2+(cz-az)**2
    const score=edges?Math.min(1,2*Math.sqrt(3)*cross/edges):0
    worst=Math.min(worst,score);mean+=score;count++
  }
  return {worst,mean: count?mean/count:0}
}

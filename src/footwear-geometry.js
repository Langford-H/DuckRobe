import * as THREE from 'three';
import { PI, mat, add, ellipsoid, tube, disk, softBox } from './garment-primitives.js';
import { FOOT_HULL, ANKLE_HULL, BOOT_SWEEP_BANDS, CALF_SECTIONS, FOOT_ROOF_FIELD } from './footwear-fit-data.js';

const SEGMENTS = 88;
const FOOT_CENTER = [.007, -.0161];
const CALF_CENTER = [.012, .006];
const SHOES = new Set(['loafers', 'sneakers', 'ballet', 'boots', 'wellies', 'high-top', 'trail', 'mary-jane', 'moccasins', 'chunky-sneakers']);
const BOOT_HEIGHT = { boots: .014, wellies: .018, 'high-top': .011, trail: .008 };
const cross = (a,b,c) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function hull(points) {
  const ordered=[...new Map(points.map(p=>[`${p[0]},${p[1]}`,p])).values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const lower=[],upper=[];
  for(const p of ordered){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p)}
  for(const p of ordered.reverse()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p)}
  lower.pop();upper.pop();return lower.concat(upper);
}
// Rounded Minkowski offsets preserve the native foot's corners. An ellipsoid
// that merely has a larger bounding box still cuts through those corners.
function offsetOutline(points,margin) {
  return hull(points.flatMap(([x,y])=>Array.from({length:24},(_,i)=>{const a=i*PI/12;return[x+margin*Math.cos(a),y+margin*Math.sin(a)]})));
}
function outlineRadii(points,center,margin) {
  const polygon=offsetOutline(points,margin);
  return Array.from({length:SEGMENTS},(_,i)=>{
    const angle=i/SEGMENTS*PI*2,dx=Math.cos(angle),dy=Math.sin(angle);let radius=Infinity;
    for(let j=0;j<polygon.length;j++){
      const a=polygon[j],b=polygon[(j+1)%polygon.length],ex=b[0]-a[0],ey=b[1]-a[1],den=dx*ey-dy*ex;
      if(Math.abs(den)<1e-12)continue;
      const ax=a[0]-center[0],ay=a[1]-center[1],t=(ax*ey-ay*ex)/den,u=(ax*dy-ay*dx)/den;
      if(t>0&&u>=-1e-8&&u<=1+1e-8)radius=Math.min(radius,t);
    }
    if(!Number.isFinite(radius))throw new Error('Footwear cavity centre lies outside measured outline');
    return radius;
  });
}
const blendRadii=(a,b,t)=>a.map((r,i)=>THREE.MathUtils.lerp(r,b[i],t));
const fixedFootInner=outlineRadii(FOOT_HULL,FOOT_CENTER,.0017);
function aperture(z,margin=.0018) {
  const lower=[...BOOT_SWEEP_BANDS].reverse().find(band=>band.z<=z)||BOOT_SWEEP_BANDS[0];
  const upper=BOOT_SWEEP_BANDS.find(band=>band.z>=z)||BOOT_SWEEP_BANDS.at(-1);
  return outlineRadii([...ANKLE_HULL,...lower.points,...upper.points],FOOT_CENTER,margin);
}
function bootAperture(z,margin,kind) {
  const radii=aperture(z,margin);
  if(!['boots','wellies'].includes(kind)||z<=0)return radii;
  // A real tiny-steps ankle extreme brings the calf motor close to this rear
  // corner at Z=12.3 mm. A local rounded relief follows its swept surface;
  // shifting both layers preserves the shaft thickness and every other fit.
  return radii.map((r,i)=>{
    const angle=i/SEGMENTS*PI*2;
    const angular=Math.exp(-.5*((angle-2.70)/.45)**2);
    const vertical=Math.exp(-.5*((z-.0125)/.005)**2);
    return r+.0010*angular*vertical;
  });
}
function calfOutline(z,margin) {
  // An XY offset alone is insufficient on the motor's steep chamfer. Include
  // neighbouring measured Z slices so the cavity clears that actual 3D slope.
  const sections=CALF_SECTIONS.filter(section=>Math.abs(section.z-z)<=.00251);
  return outlineRadii(sections.flatMap(section=>section.points),CALF_CENTER,margin);
}
function ringHeight(z,index){return Array.isArray(z)?z[index%SEGMENTS]:z}
function pointAt(radius,z,center,index,mirror=1) {
  const a=index/SEGMENTS*PI*2;return[center[0]+radius*Math.cos(a),mirror*(center[1]+radius*Math.sin(a)),ringHeight(z,index)];
}
function reflectedGeometry(vertices,indices,mirror) {
  if(mirror===-1)for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();return geometry;
}
function hollowLoft(g,material,rows,center,mirror,name) {
  const vertices=[],indices=[],n=SEGMENTS+1,side=rows.length*n;
  for(let layer=0;layer<2;layer++)for(const row of rows)for(let i=0;i<=SEGMENTS;i++)vertices.push(...pointAt((layer?row.inner:row.outer)[i%SEGMENTS],layer?(row.innerZ??row.z):row.z,center,i,mirror));
  for(let layer=0;layer<2;layer++)for(let j=0;j<rows.length-1;j++)for(let i=0;i<SEGMENTS;i++){
    const a=layer*side+j*n+i,b=a+n;indices.push(...(layer===0?[a,a+1,b,a+1,b+1,b]:[a,b,a+1,a+1,b,b+1]));
  }
  for(const j of[0,rows.length-1])for(let i=0;i<SEGMENTS;i++){
    const a=j*n+i;indices.push(...(j===0?[a,a+side,a+1,a+1,a+side,a+side+1]:[a,a+1,a+side,a+1,a+side+1,a+side]));
  }
  return add(g,reflectedGeometry(vertices,indices,mirror),material,[0,0,0],[0,0,0],[1,1,1],name);
}
function outlineTube(g,material,radii,z,center,mirror,radius,name) {
  return tube(g,material,radii.map((r,i)=>pointAt(r,z,center,i,mirror)),radius,name,SEGMENTS,true);
}
function sole(g,material,mirror,chunky=false,ballet=false) {
  const top=-.0239,bottom=chunky?-.0345:ballet?-.0270:-.0285;
  const contour=outlineRadii(FOOT_HULL,FOOT_CENTER,chunky?.0042:.0036);
  const rows=[{z:bottom,scale:.986},{z:bottom+.0009,scale:1.010},{z:top-.0007,scale:1.010},{z:top,scale:.996}],vertices=[],indices=[],n=SEGMENTS+1;
  for(const row of rows)for(let i=0;i<=SEGMENTS;i++)vertices.push(...pointAt(contour[i%SEGMENTS]*row.scale,row.z,FOOT_CENTER,i,mirror));
  for(let j=0;j<rows.length-1;j++)for(let i=0;i<SEGMENTS;i++){const a=j*n+i,b=a+n;indices.push(a,a+1,b,a+1,b+1,b)}
  const lower=vertices.length/3;vertices.push(FOOT_CENTER[0],mirror*FOOT_CENTER[1],bottom);
  const upper=vertices.length/3;vertices.push(FOOT_CENTER[0],mirror*FOOT_CENTER[1],top);
  for(let i=0;i<SEGMENTS;i++){indices.push(lower,i+1,i);const a=(rows.length-1)*n+i;indices.push(upper,a,a+1)}
  add(g,reflectedGeometry(vertices,indices,mirror),material,[0,0,0],[0,0,0],[1,1,1],'complete-contoured-sole');
  return bottom;
}
function upperPatch(g,material,rows,mirror,start=-1.15,end=1.15,name='toe-reinforcement') {
  const vertices=[],indices=[],columns=32;
  for(const row of rows)for(let i=0;i<=columns;i++){
    const theta=THREE.MathUtils.lerp(start,end,i/columns),raw=(theta/(PI*2)*SEGMENTS+SEGMENTS)%SEGMENTS,j=Math.floor(raw),t=raw-j;
    const radius=THREE.MathUtils.lerp(row.outer[j],row.outer[(j+1)%SEGMENTS],t)+.00045;
    const z=THREE.MathUtils.lerp(ringHeight(row.z,j),ringHeight(row.z,j+1),t);
    vertices.push(FOOT_CENTER[0]+radius*Math.cos(theta),mirror*(FOOT_CENTER[1]+radius*Math.sin(theta)),z+.00025);
  }
  for(let j=0;j<rows.length-1;j++)for(let i=0;i<columns;i++){const a=j*(columns+1)+i,b=a+columns+1;indices.push(a,a+1,b,a+1,b+1,b)}
  const mesh=add(g,reflectedGeometry(vertices,indices,mirror),material,[0,0,0],[0,0,0],[1,1,1],name);mesh.material.side=THREE.DoubleSide;return mesh;
}
function nativeRoof(x,y) {
  const {origin,step,counts,heights}=FOOT_ROOF_FIELD;
  const px=THREE.MathUtils.clamp((x-origin[0])/step,0,counts[0]-1),py=THREE.MathUtils.clamp((y-origin[1])/step,0,counts[1]-1);
  const ix=Math.min(Math.floor(px),counts[0]-2),iy=Math.min(Math.floor(py),counts[1]-2),tx=px-ix,ty=py-iy;
  const lower=THREE.MathUtils.lerp(heights[iy*counts[0]+ix],heights[iy*counts[0]+ix+1],tx);
  const upper=THREE.MathUtils.lerp(heights[(iy+1)*counts[0]+ix],heights[(iy+1)*counts[0]+ix+1],tx);
  return THREE.MathUtils.lerp(lower,upper,ty);
}
function outsideFoot(x,y) {
  let distance=Infinity,inside=true;
  for(let i=0;i<FOOT_HULL.length;i++){
    const a=FOOT_HULL[i],b=FOOT_HULL[(i+1)%FOOT_HULL.length],dx=b[0]-a[0],dy=b[1]-a[1];
    if(dx*(y-a[1])-dy*(x-a[0])<0)inside=false;
    const t=THREE.MathUtils.clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy),0,1);
    distance=Math.min(distance,Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t));
  }
  return inside?0:distance;
}
// The vamp follows the measured top of the native foot. At the very outside
// edge it turns gently down to the welt instead of continuing a tall box wall.
function roofHeight(x,y,padding) {
  return nativeRoof(x,y)+padding-Math.max(0,outsideFoot(x,y)-.0015)*1.45;
}
const SHOE_STYLE={
  ballet:{margin:.0030,padding:.0037},'mary-jane':{margin:.0032,padding:.0040},
  loafers:{margin:.0033,padding:.0041},moccasins:{margin:.0035,padding:.0041},
  sneakers:{margin:.0038,padding:.0048},'chunky-sneakers':{margin:.0045,padding:.0055},
  boots:{margin:.0036,padding:.0046},wellies:{margin:.0038,padding:.0047},
  'high-top':{margin:.0038,padding:.0048},trail:{margin:.0040,padding:.0050},
};
function shoe(item,mirror) {
  const g=new THREE.Group(),[a,b,c]=item.palette.map(color=>mat(color)),k=item.kind,height=BOOT_HEIGHT[k]||0,cy=mirror*FOOT_CENTER[1],style=SHOE_STYLE[k];
  const bottom=sole(g,k==='ballet'?c:b,mirror,k==='chunky-sneakers',['ballet','mary-jane'].includes(k));
  const footOuter=outlineRadii(FOOT_HULL,FOOT_CENTER,style.margin),openingInner=aperture(0),openingOuter=aperture(0,.0032);
  const heights=(radii,padding)=>radii.map((r,i)=>{const p=pointAt(r,0,FOOT_CENTER,i);return roofHeight(p[0],p[1],padding)});
  const edgeOuter=heights(footOuter,style.padding),edgeInner=heights(fixedFootInner,style.padding-.0014);
  const rows=[0,.16,.35,.56,.76,.92,1].map(t=>({
    z:edgeOuter.map(z=>THREE.MathUtils.lerp(-.0237,z,t)),
    innerZ:edgeInner.map(z=>THREE.MathUtils.lerp(-.0237,z,t)),
    // A small convex outer wall and a tucked lower edge soften the square
    // native foot. The measured inner cavity remains exactly unchanged.
    inner:fixedFootInner,outer:footOuter.map(r=>r+.0006*Math.sin(PI*t)-.00028*(1-t)),
  }));
  // Several concentric rows form a genuinely curved, thick vamp and a clear
  // ankle opening. Each layer is sampled at its own actual XY location.
  for(const t of[.15,.30,.50,.72,1]){
    const inner=blendRadii(fixedFootInner,openingInner,t),outer=blendRadii(footOuter,openingOuter,t);
    rows.push({inner,outer,z:heights(outer,style.padding),innerZ:heights(inner,style.padding-.0014)});
  }
  const vampRows=rows.slice(6);
  if(height>.001)for(const z of [0,.005,.010,.015,height].filter((v,i,array)=>v<=height&&array.indexOf(v)===i).sort((a,b)=>a-b))rows.push({z,inner:bootAperture(z,.0018,k),outer:bootAperture(z,.0033,k)});
  hollowLoft(g,a,rows,FOOT_CENTER,mirror,'hollow-fitted-shoe-upper');
  outlineTube(g,c,rows.at(-1).outer,rows.at(-1).z,FOOT_CENTER,mirror,.00065,'open-shoe-collar-binding');
  outlineTube(g,c,outlineRadii(FOOT_HULL,FOOT_CENTER,.0038),-.0219,FOOT_CENTER,mirror,.00045,'welt-stitch');
  const top=(x,y,lift=.0007)=>roofHeight(x,y*mirror,style.padding)+lift;
  const surfaceTube=(material,points,radius,name,segments=28)=>tube(g,material,points.map(([x,y,lift=.0007])=>[x,y,top(x,y,lift)]),radius,name,segments);
  if(['sneakers','high-top','trail','boots','chunky-sneakers'].includes(k)) {
    upperPatch(g,b,rows.slice(1,7),mirror,-1.05,1.05,'shaped-rubber-toe-cap');
    if(height>.004) {
      softBox(g,b,[.0253,cy,.006],[.0015,.019,.013],.002,'external-boot-tongue');
      for(let i=0;i<3;i++)tube(g,c,[[.0263,cy-.009,.002+i*.004],[.027,cy,.003+i*.004],[.0263,cy+.009,.002+i*.004]],.0006,'cuff-lace',16);
    } else {
      upperPatch(g,b,vampRows,mirror,-.65,.65,'external-vamp-tongue');
      for(let i=0;i<3;i++)surfaceTube(c,[[.026+i*.0036,cy-.009],[.0265+i*.0036,cy,.0010],[.026+i*.0036,cy+.009]],.00055,'vamp-lace',16);
    }
    if(!height)for(const y of[-.010,.010])for(let i=0;i<3;i++){const x=.026+i*.0036;disk(g,c,[x,cy+y,top(x,cy+y)],.0009,.0005,'lace-eyelet','z')}
    for(let i=0;i<5;i++)softBox(g,c,[-.011+i*.010,cy,bottom-.0007],[.005,.030,.0012],.0007,'sole-tread');
  }
  if(k==='wellies') {
    outlineTube(g,b,rows.at(-1).outer,height-.001,FOOT_CENTER,mirror,.0011,'wellie-folded-top');
    for(const[y,z]of[[-.011,.005],[.009,.011],[-.004,.015],[.015,.004]])disk(g,b,[.0255,cy+y,z],.0016,.00055,'wellie-raised-dot');
  }
  if(k==='loafers') {
    surfaceTube(b,[[.027,cy-.015,.0018],[.028,cy,.0020],[.027,cy+.015,.0018]],.0015,'visible-loafer-saddle',28);
    softBox(g,c,[.029,cy,top(.029,cy,.0025)],[.004,.008,.0012],.0007,'visible-penny-slot');
    upperPatch(g,b,vampRows,mirror,-.9,.9,'loafer-stitched-vamp');
    surfaceTube(c,[[.0245,cy-.0135],[.032,cy-.0135],[.035,cy],[.032,cy+.0135],[.0245,cy+.0135]],.0004,'loafer-vamp-topstitch',40);
  }
  if(['ballet','mary-jane'].includes(k)) {
    if(k==='ballet')for(const side of[-1,1]){const bow=ellipsoid(g,b,[.030,cy+side*.004,top(.030,cy+side*.004,.0022)],[.0038,.0048,.002],'ribbon-bow');bow.rotation.x=side*.28}
    else {
      surfaceTube(b,[[.026,cy-.017,.0016],[.027,cy,.0018],[.026,cy+.017,.0016]],.00125,'mary-jane-instep-strap',32);
      softBox(g,c,[.027,cy+mirror*.014,top(.027,cy+mirror*.014,.0020)],[.005,.005,.0015],.0008,'mary-jane-buckle');
    }
  }
  if(k==='moccasins') {
    surfaceTube(b,[[.0255,cy-.013],[.033,cy-.013],[.0345,cy],[.033,cy+.013],[.0255,cy+.013]],.0006,'moccasin-u-vamp-stitch',40);
    for(let i=0;i<7;i++)surfaceTube(c,[[.026,cy-.011+i*.0036,.0015],[.029,cy-.011+i*.0036,.0007]],.00055,'suede-fringe',10);
  }
  if(k==='chunky-sneakers') {
    upperPatch(g,c,rows.slice(1,7),mirror,1.2,2.35,'layered-sneaker-quarter');
    for(let i=0;i<4;i++)softBox(g,c,[-.010+i*.012,cy,bottom+.002],[.008,.041,.003],.001,'platform-sole-block');
  }
  g.userData={...g.userData,footwearCavity:true,fitMethod:'Native footprint and ankle outline with measured 16-action calf clearance by height',minimumCavityOffset:.0017,soleTop:-.0239};
  return g;
}
function sock(item,mirror) {
  const g=new THREE.Group(),[a,b]=item.palette.map(color=>mat(color));
  const rows=[-.0018,.001,.004,.007].map(z=>({z,inner:aperture(Math.max(0,z),.0019),outer:aperture(Math.max(0,z),.0030)}));
  hollowLoft(g,b,rows,FOOT_CENTER,mirror,'hollow-ankle-sock');
  for(const row of[rows[0],rows[2],rows[3]])outlineTube(g,a,row.outer,row.z,FOOT_CENTER,mirror,.0006,'fitted-sock-rib');
  return g;
}
function calfGarment(item,mirror) {
  const g=new THREE.Group(),[a,b,c]=item.palette.map(color=>mat(color)),k=item.kind;
  if(k==='kneepads') {
    const front=Math.max(...CALF_SECTIONS.filter(row=>row.z>=-.0275&&row.z<=-.015).flatMap(row=>row.points.map(p=>p[0])))+.005;
    softBox(g,a,[front,mirror*.006,-.020],[.005,.027,.013],.004,'articulated-knee-pad');
    softBox(g,b,[front+.0032,mirror*.006,-.020],[.0015,.017,.009],.003,'kneepad-cushion');
    for(const z of[-.024,-.016])outlineTube(g,c,calfOutline(z,.0030),z,CALF_CENTER,mirror,.00075,'measured-kneepad-retaining-strap');
  } else {
    const rows=[-.025,-.0225,-.020,-.0175,-.015].map(z=>({z,inner:calfOutline(z,.0019),outer:calfOutline(z,.0031)}));
    hollowLoft(g,a,rows,CALF_CENTER,mirror,'hollow-fitted-calf-knit');
    for(const row of rows)outlineTube(g,b,row.outer,row.z,CALF_CENTER,mirror,.00065,'warm-leg-rib');
    if(k==='wraps')for(const direction of[-1,1]) {
      const points=Array.from({length:90},(_,i)=>{const z=-.0248+i/89*.0096,theta=direction*i/89*PI*3.5,index=(theta/(PI*2)*SEGMENTS+SEGMENTS*3)%SEGMENTS,j=Math.floor(index),radii=calfOutline(z,.0043),r=THREE.MathUtils.lerp(radii[j],radii[(j+1)%SEGMENTS],index-j);return[CALF_CENTER[0]+r*Math.cos(theta),mirror*(CALF_CENTER[1]+r*Math.sin(theta)),z]});
      tube(g,c,points,.00065,'cross-wrapped-calf-ribbon',110);
    }
  }
  return g;
}
export function createFootwear(item) {
  if(SHOES.has(item.kind)||item.kind==='socks')return['ankle_left','ankle_right'].map((bodyName,index)=>({bodyName,group:item.kind==='socks'?sock(item,index?-1:1):shoe(item,index?-1:1)}));
  if(['legwarmers','wraps','kneepads'].includes(item.kind))return['leg','leg_2'].map((bodyName,index)=>({bodyName,group:calfGarment(item,index?-1:1)}));
  throw new Error(`Unsupported fitted Microduck footwear: ${item.kind}`);
}

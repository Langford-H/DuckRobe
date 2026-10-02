import * as THREE from 'three';

const PI=Math.PI;
const V=p=>new THREE.Vector3(...p);
const mat=(color,options={})=>new THREE.MeshStandardMaterial({color,roughness:.82,metalness:0,...options});
function add(g,geo,m,p=[0,0,0],rotation=[0,0,0],scale=[1,1,1],name='detail') {
  const mesh=new THREE.Mesh(geo,m);mesh.position.set(...p);mesh.rotation.set(...rotation);mesh.scale.set(...scale);mesh.castShadow=true;mesh.receiveShadow=true;mesh.name=name;g.add(mesh);return mesh;
}
function ellipsoid(g,m,p,scale,name){return add(g,new THREE.SphereGeometry(1,24,16),m,p,[0,0,0],scale,name)}
function tube(g,m,points,r=.0006,name='seam',segments=24,closed=false){return add(g,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(V),closed,'centripetal'),segments,r,6,closed),m,[0,0,0],[0,0,0],[1,1,1],name)}
function loop(g,m,center,rx,ry,r=.0009,name='binding',wave=0) {
  return tube(g,m,Array.from({length:48},(_,i)=>{const a=i*PI/24;return[center[0]+rx*Math.cos(a),center[1]+ry*Math.sin(a),center[2]+Math.sin(a*12)*wave]}),r,name,48,true);
}
function disk(g,m,p,radius,depth=.001,name='button',axis='x'){return add(g,new THREE.CylinderGeometry(radius,radius,depth,24),m,p,axis==='x'?[0,0,-PI/2]:[PI/2,0,0],[1,1,1],name)}
function roundedShape(w,h,r) {
 const s=new THREE.Shape();const x=-w/2,y=-h/2;
 s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;
}
function softBox(g,m,p,size,r=.003,name='leather') {
 const geo=new THREE.ExtrudeGeometry(roundedShape(size[1],size[2],Math.min(r,size[1]/2,size[2]/2)),{depth:size[0],bevelEnabled:true,bevelSize:.0004,bevelThickness:.0004,bevelSegments:3,curveSegments:8});
 const pos=geo.attributes.position;for(let i=0;i<pos.count;i++){const y=pos.getX(i),z=pos.getY(i),x=pos.getZ(i)-size[0]/2;pos.setXYZ(i,x,y,z)}geo.computeVertexNormals();return add(g,geo,m,p,[0,0,0],[1,1,1],name);
}
function surfaceX(front,y) {
 const rx=Math.max(.045,front+.006),ry=rx*.81;
 return front-rx*(1-Math.sqrt(Math.max(.08,1-(y/ry)**2)));
}
function frontPoints(points){return points.map(([x,y,z])=>[surfaceX(x,y),y,z])}
function facePatch(g,m,points,x=.043,thickness=.0012,name='tailored-panel') {
 const s=new THREE.Shape();points.forEach((p,i)=>i?s.lineTo(...p):s.moveTo(...p));s.closePath();const geo=new THREE.ExtrudeGeometry(s,{depth:thickness,bevelEnabled:true,bevelSize:.0003,bevelThickness:.0003,bevelSegments:2,curveSegments:8});
 const pos=geo.attributes.position;for(let i=0;i<pos.count;i++){const y=pos.getX(i),z=pos.getY(i),bump=pos.getZ(i);pos.setXYZ(i,(g.userData.curvedBody?surfaceX(x,y):x)+bump,y,z)}geo.computeVertexNormals();return add(g,geo,m,[0,0,0],[0,0,0],[1,1,1],name);
}
function pocket(g,m,stitch,y,z,width=.016,height=.014,x=.044) {
 facePatch(g,m,[[y-width/2,z+height/2],[y+width/2,z+height/2],[y+width/2,z-height/3],[y,z-height/2],[y-width/2,z-height/3]],x,.0014,'patch-pocket');
 tube(g,stitch,frontPoints([[x+.001,y-width/2,z+height/2],[x+.001,y,z+height/2],[x+.001,y+width/2,z+height/2]]),.0004,'pocket-stitch',12);
}
function pointedCollar(g,m,trim,z=.043,spread=.026) {
 for(const s of[-1,1]){facePatch(g,m,[[s*.004,z],[s*spread,z+.003],[s*spread*.82,z-.012],[s*.008,z-.006]],.044,.0015,'folded-lapel');tube(g,trim,frontPoints([[.046,s*.006,z-.001],[.044,s*spread,z+.003],[.045,s*spread*.82,z-.012]]),.00045,'lapel-topstitch',16)}
}
function buttonRow(g,m,y=0,count=4,bottom=.003,step=.009,x=.045){for(let i=0;i<count;i++)disk(g,m,[surfaceX(x,y),y,bottom+i*step],.0016,.0011)}

// Closed fabric with actual thickness. The cut interpolates a shaped waist,
// shoulder and hem; folds, bindings and textile ribs all survive OBJ export.
function fabricShell(g,m,profile,{gap=0,folds=.0005,cx=-.006,segments=56,name='cloth-shell'}={}) {
 const points=[],indices=[],n=segments+1,rows=profile.length;
 for(const layer of[0,1])for(let j=0;j<rows;j++){const[z,rx,ry]=profile[j];for(let i=0;i<=segments;i++){
  const a=gap/2+i/segments*(PI*2-gap),fullness=Math.sin(a*12+j*.13)*folds*(.4+.6*(1-j/rows));
  points.push(cx+(rx+fullness-layer*.0014)*Math.cos(a),(ry+fullness-layer*.0014)*Math.sin(a),z+(j===rows-1?-.0035*Math.abs(Math.sin(a)):0));
 }}
 for(let l=0;l<2;l++)for(let j=0;j<rows-1;j++)for(let i=0;i<segments;i++){const a=l*rows*n+j*n+i,b=a+n;indices.push(...(l===0?[a,a+1,b,a+1,b+1,b]:[a,b,a+1,a+1,b,b+1]))}
 const inner=rows*n;
 for(const j of[0,rows-1])for(let i=0;i<segments;i++){const a=j*n+i;indices.push(a,a+inner,a+1,a+1,a+inner,a+inner+1)}
 for(const i of[0,segments])for(let j=0;j<rows-1;j++){const a=j*n+i,b=a+n;indices.push(a,b,a+inner,b,b+inner,a+inner)}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geo.setIndex(indices);geo.computeVertexNormals();return add(g,geo,m,[0,0,0],[0,0,0],[1,1,1],name);
}
const FITTED=[[-.005,.049,.039],[.005,.0495,.0395],[.015,.048,.038],[.026,.0485,.0385],[.036,.049,.039],[.044,.045,.035]];
function edge(g,m,profile,r=.001,gap=0) {
 for(const row of[profile[0],profile.at(-1)]){const[z,rx,ry]=row;const pts=Array.from({length:gap?49:48},(_,i)=>{const a=gap/2+i/48*(PI*2-gap);return[-.006+rx*Math.cos(a),ry*Math.sin(a),z-(row===profile.at(-1)?.0035*Math.abs(Math.sin(a)):0)]});tube(g,m,pts,r,'bound-hem',48,gap===0)}
 if(gap)for(const s of[-1,1])tube(g,m,profile.map(([z,rx,ry])=>[-.006+rx*Math.cos(gap/2),s*ry*Math.sin(gap/2),z]),r,'bound-opening');
}
function cuffs(g,m,trim,z=.026,radius=.009,ry=.039,length=.007) {
 for(const s of[-1,1]){const cuff=add(g,new THREE.CylinderGeometry(radius,radius*1.08,length,32,4,true),m,[-.008,s*(ry+length*.35),z],[0,0,0],[1.2,1,1],'short-folded-sleeve');cuff.rotation.x=s*.18;tube(g,trim,Array.from({length:24},(_,i)=>{const a=i*PI/12;return[-.008+radius*1.2*Math.cos(a),s*(ry+length*.85),z+radius*Math.sin(a)]}),.0009,'sleeve-binding',24,true)}
}
function knitRibs(g,m,profile=FITTED,count=22,gap=.25){for(let i=0;i<count;i++){const a=gap+i/(count-1)*(PI*2-gap*2);tube(g,m,profile.map(([z,rx,ry])=>[-.006+(rx+.0007)*Math.cos(a),(ry+.0007)*Math.sin(a),z]),.00028,'knit-rib',16)}}
function cable(g,m,y,z0=.003,z1=.037,x=.045){for(const s of[-1,1])tube(g,m,Array.from({length:21},(_,i)=>{const t=i/20,yy=y+Math.sin(t*PI*5+(s===1?0:PI))*.002;return[surfaceX(x,yy)+Math.cos(t*PI*5)*.0003,yy,z0+(z1-z0)*t]}),.00065,'cable-knit',40)}
function strap(g,m,y,width=.002,back=true){tube(g,m,[[.044,y,.011],[.042,y,.038],[.015,y,.047],[-.027,y,.045],[-.052,y,.033],[-.054,back?-y:y,.004]],width,'shoulder-strap',28)}
function zipper(g,m,low=-.003,high=.040,x=.045) {
 for(const y of[-.0014,.0014])tube(g,m,[[x,y,low],[x,y,high]],.00045,'zipper-track',8);
 for(let z=low;z<high;z+=.0022)softBox(g,m,[x+.0004,0,z],[.0006,.0028,.0008],.0002,'zipper-tooth');softBox(g,m,[x+.001,0,high-.004],[.001,.003,.005],.0006,'zip-pull');
}
function star(g,m,p,r=.005){return facePatch(g,m,Array.from({length:10},(_,i)=>{const a=i*PI/5+PI/2,rr=i%2?r*.45:r;return[p[1]+Math.cos(a)*rr,p[2]+Math.sin(a)*rr]}),p[0],.0008,'embroidered-star')}
function flower(g,a,b,p,r=.006){for(let i=0;i<5;i++){const t=i*PI*2/5;ellipsoid(g,a,[p[0],p[1]+Math.cos(t)*r*.55,p[2]+Math.sin(t)*r*.55],[.0017,r*.45,r*.45],'flower-petal')}disk(g,b,[p[0]+.0018,p[1],p[2]],r*.25,.001,'flower-centre')}

// A tapered fabric petal: two thin curved faces, sewn edges and a real
// central fold. Its lower edge flares gently instead of using plush spheres.
function petalPanel(g,m,trim,angle,layer) {
 const rows=18,cols=8,vertices=[],indices=[],n=cols+1,side=(rows+1)*n;
 const sample=(t,u,inner=0)=>{
  const z=(layer?.017:.031)-(layer?.046:.042)*t;
  const width=(.0013+.016*Math.sin(PI*t)**.7)*(layer?1.08:1);
  const rx=(layer?.051:.047)+.012*t+.002*Math.sin(PI*t);
  const ry=(layer?.041:.036)+.015*t+.002*Math.sin(PI*t);
  const fold=.0012*(1-u*u)*Math.sin(PI*t)-inner*.0009;
  return[-.006+(rx+fold)*Math.cos(angle)-u*width*Math.sin(angle),(ry+fold)*Math.sin(angle)+u*width*Math.cos(angle),z+.0015*u*u*Math.sin(PI*t)];
 };
 for(let l=0;l<2;l++)for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++)vertices.push(...sample(j/rows,i/cols*2-1,l));
 for(let l=0;l<2;l++)for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
  const a=l*side+j*n+i,b=a+n;indices.push(...(l?[a,a+1,b,a+1,b+1,b]:[a,b,a+1,a+1,b,b+1]));
 }
 for(const j of[0,rows])for(let i=0;i<cols;i++){const a=j*n+i;indices.push(a,a+1,a+side,a+1,a+side+1,a+side)}
 for(const i of[0,cols])for(let j=0;j<rows;j++){const a=j*n+i,b=a+n;indices.push(a,a+side,b,b,a+side,b+side)}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();
 add(g,geo,m,[0,0,0],[0,0,0],[1,1,1],'layered-fabric-petal');
 tube(g,trim,Array.from({length:12},(_,i)=>sample(.05+i/11*.90,0,-.4)),.00024,'petal-fold-stitch',20);
 for(const u of[-1,1])tube(g,trim,Array.from({length:16},(_,i)=>sample(i/15,u,-.35)),.00024,'petal-edge',20);
}

export { PI, V, mat, add, ellipsoid, tube, loop, disk, roundedShape, softBox, surfaceX, frontPoints, facePatch, pocket, pointedCollar, buttonRow, fabricShell, FITTED, edge, cuffs, knitRibs, cable, strap, zipper, star, flower, petalPanel };

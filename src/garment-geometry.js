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

function body(item) {
 const g=new THREE.Group(),[a,b,c]=item.palette.map(color=>mat(color)),trim=mat(item.palette[1],{roughness:.95}),hardware=mat(item.palette[2],{metalness:.45,roughness:.38}),kind=item.kind;
 g.userData.curvedBody=true;
 if(['cardigan','cable-knit'].includes(kind)) {
  fabricShell(g,a,FITTED,{gap:kind==='cardigan'?.13:0,folds:.0004});edge(g,trim,FITTED,.0016,kind==='cardigan'?.13:0);cuffs(g,a,trim);knitRibs(g,a);
  for(const y of[-.021,.021])cable(g,b,y);if(kind==='cable-knit')cable(g,b,0);
  if(kind==='cardigan'){buttonRow(g,hardware,.005);pocket(g,a,b,-.021,.008);pocket(g,a,b,.021,.008)}else for(const y of[-.010,.010])cable(g,a,y);
 }else if(kind==='breton') {
  fabricShell(g,b,FITTED,{folds:.0003});cuffs(g,b,a);for(let i=0;i<6;i++){const z=.001+i*.0065;fabricShell(g,a,[[z,.0493,.0393],[z+.0021,.0493,.0393]],{folds:.0002,name:'woven-stripe'})}
  for(const s of[-1,1]){facePatch(g,a,[[s*.004,.042],[s*.032,.044],[s*.028,.027],[s*.002,.027]],.045,.0014,'sailor-collar');tube(g,b,frontPoints([[.046,s*.006,.039],[.043,s*.028,.041],[.044,s*.024,.030],[.046,s*.005,.030]]),.0006,'sailor-piping')}edge(g,a,FITTED,.001);
 }else if(kind==='dungarees') {
  fabricShell(g,a,[[-.006,.050,.040],[.006,.050,.040],[.018,.048,.038]],{folds:.0005});facePatch(g,a,[[-.029,.016],[.029,.016],[.023,.039],[-.023,.039]],.044,.0018,'denim-bib');
  for(const s of[-1,1]){strap(g,a,s*.022,.0028);disk(g,hardware,[surfaceX(.046,s*.022),s*.022,.034],.0022)}pocket(g,b,c,0,.028,.024,.014);for(const y of[-.031,.031])pocket(g,a,b,y,.007,.015,.014);
  tube(g,b,frontPoints([[.045,-.028,.014],[.046,0,.014],[.045,.028,.014]]),.00055,'bib-topstitch');
 }else if(['linen-dress','petal-dress','pinafore'].includes(kind)) {
  const skirt=[[-.025,.060,.052],[-.017,.058,.050],[-.007,.054,.046],[.007,.050,.040],[.019,.048,.038],[.036,.047,.036],[.043,.044,.034]];
  fabricShell(g,a,skirt,{folds:.0012});edge(g,trim,skirt,.0012);for(const s of[-1,1])strap(g,kind==='pinafore'?c:b,s*.026,.0021);loop(g,c,[-.006,0,.015],.0489,.039,.0019,'waistband');
  if(kind==='linen-dress'){pointedCollar(g,b,trim,.041,.020);buttonRow(g,hardware,0,3,.019,.006);for(const y of[-.028,.028])pocket(g,a,b,y,-.006,.018,.013,.049)}
  if(kind==='pinafore'){
   for(let i=0;i<4;i++)fabricShell(g,c,[[-.022+i*.012,.060-i*.003,.052-i*.003],[-.019+i*.012,.060-i*.003,.052-i*.003]],{name:'honey-woven-stripe'});
   facePatch(g,b,[[-.021,.005],[.021,.005],[.018,.034],[-.018,.034]],.046,.0015,'pinafore-bib');pocket(g,a,c,0,.018,.024,.012,.049);
   for(let i=0;i<18;i++){const ang=i*PI/9;ellipsoid(g,b,[-.006+.060*Math.cos(ang),.052*Math.sin(ang),-.024],[.0038,.0038,.002],'scalloped-lace')}
  }
  if(kind==='petal-dress'){
   for(let layer=0;layer<2;layer++)for(let i=0;i<9;i++)petalPanel(g,layer?a:b,trim,i*PI*2/9+layer*PI/9,layer);flower(g,c,b,[.047,0,.029],.008);
  }
 }else if(['rain-cape','wizard-cape'].includes(kind)) {
  const cape=[[-.014,.069,.062],[-.004,.067,.060],[.011,.061,.054],[.025,.056,.046],[.040,.047,.038],[.047,.043,.033]],gap=kind==='wizard-cape'?.26:.12;
  fabricShell(g,a,cape,{gap,folds:.0014});edge(g,b,cape,.0013,gap);const yoke=[[.020,.061,.053],[.031,.054,.045],[.043,.047,.037],[.047,.043,.033]];
  fabricShell(g,b,yoke,{gap:.14,folds:.0006,name:'floating-shoulder-yoke'});edge(g,c,yoke,.0008,.14);
  if(kind==='rain-cape'){buttonRow(g,c,0,3,.004,.010,.062);for(const s of[-1,1])pocket(g,a,b,s*.035,.002,.018,.014,.059)}
  else{for(const[y,z,size]of[[-.030,.002,.004],[.032,.014,.004],[.015,-.012,.005],[-.016,.025,.003]])star(g,hardware,[.058,y,z],size);disk(g,hardware,[.044,0,.041],.003)}
 }else if(kind==='puffer') {
  const profile=[[-.006,.052,.042],[.005,.054,.044],[.018,.053,.043],[.031,.051,.041],[.044,.045,.035]];
  fabricShell(g,a,profile,{gap:.15,folds:.0004});for(let i=0;i<5;i++){const z=-.002+i*.008;fabricShell(g,a,[[z-.003,.051,.041],[z,.055,.045],[z+.003,.051,.041]],{gap:.15,folds:.0004,name:'padded-quilt-baffle'})}
  edge(g,trim,profile,.0018,.15);zipper(g,hardware,-.004,.039,.048);for(const y of[-.024,.024])pocket(g,a,b,y,.010,.016,.014,.049);
 }else if(['parka','chore','chef','varsity','track','polo','hoodie','peacoat','trench','smock','kimono'].includes(kind)) {
  const long=['parka','peacoat','trench','smock'].includes(kind),profile=long?[[-.017,.055,.044],[-.007,.053,.043],[.010,.050,.040],[.027,.049,.039],[.038,.050,.040],[.044,.045,.035]]:FITTED;
  const open=['kimono','trench','peacoat','chore','parka','varsity','track'].includes(kind)?.08:0;
  fabricShell(g,a,profile,{gap:open,folds:kind==='smock'?.0012:.0005});edge(g,kind==='track'?b:a,profile,.0012,open);cuffs(g,['varsity','chef','polo'].includes(kind)?b:a,trim,.026,kind==='smock'?.011:.009,.039,kind==='kimono'?.018:.008);
  if(!['track','hoodie','kimono'].includes(kind))pointedCollar(g,kind==='varsity'?b:a,b,.043,kind==='peacoat'?.030:.023);
  if(['parka','chore'].includes(kind)){buttonRow(g,hardware);for(const y of[-.024,.024]){pocket(g,a,b,y,.006,.020,.016);facePatch(g,a,[[y-.011,.014],[y+.011,.014],[y+.008,.009],[y-.008,.009]],.046,.001,'pocket-flap');disk(g,hardware,[surfaceX(.047,y),y,.011],.0014)}if(kind==='parka')zipper(g,c,-.015,.034)}
  if(kind==='chef'){facePatch(g,b,[[-.021,-.002],[.019,-.002],[.025,.035],[-.010,.041]],.044,.001,'double-breasted-front');for(const y of[-.012,.012])buttonRow(g,c,y,4,.004,.009,.047)}
  if(kind==='smock'){for(let i=-4;i<=4;i++)tube(g,b,frontPoints([[.044,i*.006,-.013],[.047,i*.006,.008],[.044,i*.006*.9,.028]]),.0004,'gathered-pleat',16);facePatch(g,b,[[-.032,.029],[.032,.029],[.023,.040],[-.023,.040]],.043,.0014,'smock-yoke');for(const y of[-.024,.024])pocket(g,b,c,y,.001,.019,.019)}
  if(kind==='varsity'){knitRibs(g,b,[[-.005,.050,.040],[.001,.050,.040]],32);zipper(g,c);disk(g,c,[surfaceX(.044,-.023),-.023,.029],.006);star(g,b,[.043,-.023,.029],.004);for(const y of[-.023,.023])tube(g,b,frontPoints([[.043,y*1.25,.005],[.044,y,.013]]),.0013,'welt-pocket')}
  if(kind==='track'){zipper(g,c);for(const s of[-1,1]){facePatch(g,b,[[s*.011,.043],[s*.033,.041],[s*.028,.022],[s*.008,.013]],.044,.0012,'curved-colour-block');tube(g,c,frontPoints([[.044,s*.033,.040],[.047,s*.021,.024],[.046,s*.008,.013]]),.0009,'sport-piping')}}
  if(kind==='polo'){facePatch(g,b,[[-.006,.020],[.006,.020],[.006,.039],[-.006,.039]],.045,.001,'polo-placket');buttonRow(g,c,0,3,.025,.005);knitRibs(g,a,FITTED,16);loop(g,c,[-.006,0,-.004],.050,.040,.0013)}
  if(kind==='hoodie'){facePatch(g,b,[[-.027,-.003],[.027,-.003],[.023,.013],[.012,.019],[-.012,.019],[-.023,.013]],.047,.002,'kangaroo-pocket');for(const s of[-1,1])tube(g,c,frontPoints([[.048,s*.012,.018],[.047,s*.022,.012],[.047,s*.026,.002]]),.0006,'pocket-opening');fabricShell(g,b,[[.035,.047,.037],[.043,.049,.039],[.049,.044,.033]],{gap:.75,folds:.001,name:'folded-resting-hood'});for(const y of[-.009,.009])tube(g,c,[[.047,y,.039],[.049,y,.028]],.0006,'hood-drawcord')}
  if(kind==='peacoat'){for(const y of[-.011,.011])buttonRow(g,hardware,y,4,-.008,.011);for(const y of[-.028,.028])pocket(g,a,b,y,-.005,.018,.016)}
  if(kind==='trench'){loop(g,c,[-.006,0,.012],.051,.041,.0018,'belt');softBox(g,hardware,[.048,.006,.012],[.002,.011,.006],.001,'belt-buckle');facePatch(g,b,[[-.034,.024],[-.007,.030],[-.011,.041],[-.030,.043]],.047,.0014,'storm-flap');for(const y of[-.012,.012])buttonRow(g,hardware,y,3,-.007,.013);for(const y of[-.028,.028])pocket(g,a,c,y,-.008,.018,.015)}
  if(kind==='kimono'){facePatch(g,b,[[-.033,-.004],[.017,-.004],[.026,.042],[.010,.044]],.045,.0018,'overlapping-wrap');tube(g,c,frontPoints([[.044,.027,.042],[.048,.011,.020],[.047,-.011,-.003]]),.0014,'wrap-binding');loop(g,c,[-.006,0,.010],.0505,.0405,.0028,'obi');for(const y of[-.028,.020])flower(g,c,b,[surfaceX(.044,y),y,.029],.0045)}
 }else if(['utility-vest','waistcoat','apron'].includes(kind)) {
  if(kind!=='apron'){
   const profile=[[-.008,.050,.040],[.007,.049,.039],[.024,.048,.038],[.040,.043,.031]],gap=kind==='utility-vest'?.4:.20;fabricShell(g,a,profile,{gap,folds:.0005});edge(g,b,profile,.0008,gap);
   if(kind==='utility-vest'){for(const y of[-.026,.026])for(const z of[.001,.023]){pocket(g,a,b,y,z,.018,.015);facePatch(g,b,[[y-.009,z+.007],[y+.009,z+.007],[y+.007,z+.003],[y-.007,z+.003]],.046,.001,'utility-pocket-flap')}}
   else{pointedCollar(g,b,c,.040,.024);buttonRow(g,hardware,.004,4,-.001,.010);for(const y of[-.027,.027])pocket(g,a,b,y,.006,.016,.012);for(let i=-4;i<=4;i++)for(let j=0;j<4;j++)tube(g,b,frontPoints([[.045,i*.006,-.004+j*.009],[.045,i*.006+.0026,j*.009],[.045,i*.006+.0052,-.004+j*.009]]),.00018,'woven-herringbone',6)}
  }else{
   fabricShell(g,b,[[-.007,.049,.039],[.004,.048,.038],[.019,.047,.037],[.042,.044,.034]],{folds:.0004});facePatch(g,a,[[-.031,-.013],[.031,-.013],[.028,.009],[.019,.037],[-.019,.037],[-.028,.009]],.046,.0018,'curved-apron-bib');for(const y of[-.020,.020])strap(g,c,y,.0022);pocket(g,a,b,0,.007,.034,.019,.049);tube(g,b,[[.051,0,-.002],[.051,0,.016]],.0005,'apron-pocket-divider');for(const y of[-.024,.024])disk(g,hardware,[surfaceX(.046,y),y,.029],.0018,.001,'apron-rivet');
  }
 }else throw new Error(`Unknown tailored body: ${kind}`);
 return g;
}

// Lined crowns sit above the head, leaving face, cameras and neck drives clear.
function hat(item) {
 const g=new THREE.Group(),[a,b,c]=item.palette.map(color=>mat(color)),k=item.kind,cx=.020;
 const dome=(m=a,h=.021,rx=.054,ry=.046,base=.044)=>add(g,new THREE.SphereGeometry(1,40,20,0,PI*2,0,PI/2),m,[cx,0,base],[PI/2,0,0],[rx,h,ry],'shaped-crown');
 const band=(m=b,z=.047,rx=.054,ry=.046,r=.0016)=>loop(g,m,[cx,0,z],rx,ry,r,'hatband');
 function brim(m=a,rx=.069,ry=.056,z=.044){ellipsoid(g,m,[cx,0,z],[rx,ry,.0016],'soft-brim');loop(g,b,[cx,0,z],rx,ry,.00065,'brim-topstitch')}
 function visor(){const v=ellipsoid(g,b,[.073,0,.045],[.036,.038,.0023],'curved-visor');v.rotation.y=-.08;tube(g,c,[[.069,-.034,.045],[.102,-.018,.047],[.108,0,.048],[.102,.018,.047],[.069,.034,.045]],.0005,'visor-stitch',28)}
 function knit(height,pom){dome(a,height);band(b,.048,.054,.046,.0034);band(b,.052,.053,.045,.002);for(let i=0;i<24;i++){const t=i*PI/12;tube(g,b,[[cx+.053*Math.cos(t),.046*Math.sin(t),.048],[cx+.043*Math.cos(t),.037*Math.sin(t),.060],[cx+.022*Math.cos(t),.019*Math.sin(t),.044+height*.88],[cx,0,.044+height]],.00033,'knitted-hat-rib',20)}if(pom)ellipsoid(g,b,[cx-.008,0,.044+height+.008],[.009,.009,.009],'pom-pom')}
 if(['beret','paint-beret'].includes(k)) {
  const d=dome(a,.014,.060,.050,.046);d.rotation.x+=.12;band(c,.045);tube(g,c,[[.018,0,.059],[.015,0,.067]],.0014,'beret-stem',8);
  for(let i=0;i<8;i++){const t=i*PI/4;tube(g,b,[[.020,0,.061],[.020+.033*Math.cos(t),.029*Math.sin(t),.058],[.020+.058*Math.cos(t),.048*Math.sin(t),.047]],.00025,'beret-panel-seam',20)}if(k==='paint-beret')flower(g,c,b,[.068,-.024,.053],.007);
 }else if(['beanie','short-beanie','slouch-beanie'].includes(k))knit(k==='short-beanie'?.022:k==='slouch-beanie'?.038:.032,k==='beanie');
 else if(['baseball','trailcap','workcap','newsboy'].includes(k)) {
  dome(a,k==='newsboy'?.021:.023,k==='newsboy'?.060:.054,.045);band(c,.046);visor();const count=k==='newsboy'?8:6;
  for(let i=0;i<count;i++){const t=i*PI*2/count;tube(g,b,[[cx,0,.068],[cx+.031*Math.cos(t),.026*Math.sin(t),.061],[cx+.053*Math.cos(t),.045*Math.sin(t),.046]],.00035,'cap-panel-seam',20)}disk(g,c,[cx,0,.068],.002,.002,'cap-button','z');if(k==='baseball')star(g,c,[.069,0,.057],.005);
 }else if(['bucket','straw','safari','fedora'].includes(k)) {
  brim(a,k==='straw'?.076:k==='bucket'?.066:.071,k==='straw'?.062:.054,.044);
  fabricShell(g,a,[[.044,.052,.044],[.054,.049,.042],[.068,.045,.037],[.072,.042,.034]],{cx,folds:k==='straw'?.0003:.0006,name:'shaped-hat-crown'});ellipsoid(g,a,[cx,0,.071],[.044,.036,.004],'hat-top');band(c,.049,.051,.043,.0021);
  if(k==='straw')for(let i=0;i<7;i++)loop(g,b,[cx,0,.0445+i*.00002],.050+i*.004,.040+i*.0036,.00023,'woven-straw');
  if(k==='bucket'){band(b,.057,.049,.042,.0006);for(const s of[-1,1])disk(g,c,[.065,s*.026,.060],.0014,.0005,'hat-eyelet')}
  if(k==='fedora')tube(g,c,[[-.012,0,.073],[.015,0,.075],[.045,0,.073]],.002,'felt-crown-pinch');
 }else if(['sailor','naval'].includes(k)) {
  fabricShell(g,a,[[.043,.049,.042],[.052,.053,.046],[.063,.051,.044]],{cx,name:'sailor-crown'});ellipsoid(g,a,[cx,0,.062],[.051,.044,.003],'flat-cap-top');band(c,.044,.049,.042,.003);band(b,.052,.053,.046,.001);
  if(k==='naval'){visor();star(g,b,[.070,0,.053],.005)}else for(const y of[-.016,-.009])tube(g,c,[[-.028,y,.045],[-.036,y,.032],[-.039,y+.004,.025]],.001,'sailor-ribbon',16);
 }else if(k==='rainhood') {
  dome(a,.025,.058,.049);visor();band(c,.045,.057,.049,.0009);for(const s of[-1,1])ellipsoid(g,a,[.002,s*.046,.040],[.029,.006,.014],'rain-hat-ear-flap');tube(g,b,[[-.030,0,.046],[.003,0,.068],[.050,0,.065],[.079,0,.049]],.0007,'waterproof-top-seam');
 }else if(k==='toque') {
  fabricShell(g,a,[[.044,.049,.042],[.057,.047,.041],[.083,.049,.043]],{cx,folds:.0008,name:'chef-pleated-crown'});band(b,.048,.049,.042,.0024);ellipsoid(g,a,[cx,0,.083],[.054,.046,.011],'chef-puffed-top');
  for(let i=0;i<20;i++){const t=i*PI/10;tube(g,b,[[cx+.048*Math.cos(t),.042*Math.sin(t),.053],[cx+.048*Math.cos(t),.042*Math.sin(t),.079]],.0004,'chef-pleat',8)}
 }else if(['visor','sportband'].includes(k)){band(a,.047,.054,.046,.003);band(b,.051,.054,.046,.0007);if(k==='visor')visor();else softBox(g,b,[.074,0,.048],[.002,.021,.006],.001,'headband-label')}
 else if(k==='earmuffs') {
  tube(g,b,[[cx,-.052,.026],[cx,-.050,.054],[cx,0,.075],[cx,.050,.054],[cx,.052,.026]],.0028,'padded-headband');for(const s of[-1,1]){ellipsoid(g,a,[cx,s*.052,.027],[.018,.008,.019],'plush-ear-cushion');ellipsoid(g,b,[cx,s*.059,.027],[.013,.003,.014],'earmuff-centre')}
 }else if(k==='wizard') {
  brim(b,.068,.056);const cone=add(g,new THREE.ConeGeometry(.051,.068,48,10),a,[cx,0,.077],[PI/2,.14,0],[1,1,.88],'bent-wizard-hat');const p=cone.geometry.attributes.position;for(let i=0;i<p.count;i++)p.setX(i,p.getX(i)+Math.max(0,p.getY(i))**2*16);cone.geometry.computeVertexNormals();band(c,.048,.050,.044,.002);star(g,b,[.050,-.018,.079],.006);star(g,b,[.063,.017,.063],.004);
 }else if(['moon-pin','cloud-pin','antennae'].includes(k)) {
  tube(g,c,[[cx,-.047,.022],[cx,-.043,.034],[cx,0,.044],[cx,.043,.034],[cx,.047,.022]],.0011,'delicate-hairband');
  if(k==='antennae')for(const s of[-1,1]){tube(g,c,[[cx,s*.023,.042],[cx-.002,s*.033,.066]],.0011,'antenna');ellipsoid(g,a,[cx-.002,s*.033,.070],[.005,.005,.005],'antenna-tip')}
  if(k==='moon-pin'){flower(g,a,b,[.050,-.032,.046],.010);add(g,new THREE.TorusGeometry(.007,.0016,8,32,PI*1.45),b,[.048,.018,.053],[.35,PI/2,-.35],[1,1,1],'moon-crescent')}
  if(k==='cloud-pin'){for(const[y,z,r]of[[-.035,.040,.006],[-.028,.045,.008],[-.018,.042,.006]])ellipsoid(g,b,[.053,y,z],[.003,r,r],'cloud-puff');star(g,c,[.057,-.021,.035],.004)}
 }else throw new Error(`Unknown tailored hat: ${k}`);
 return g;
}

// Microduck has ONE camera eye. Every frame is one continuous optical
// silhouette centred on that eye; temples attach to both sides of the head.
function eyewear(item) {
 const g=new THREE.Group(),k=item.kind;
 const frame=mat(k==='clear'?'#deddd2':item.palette[2],{roughness:k==='clear'?.28:.38,metalness:k==='clear'?.05:.25});
 const hinge=mat(item.palette[0],{roughness:.34,metalness:.25});
 const tinted=['sunglasses','sport'].includes(k);
 const lens=mat(tinted?'#819da5':'#c8d9d6',{roughness:.13,metalness:.04,transparent:true,opacity:tinted?.34:.13,depthWrite:false,side:THREE.DoubleSide});
 // Exact native lens centre in the world-aligned jaw_soft authoring frame.
 // The rim clears the forward shell; temple offsets follow actual native
 // triangle sections, with small local allowances at the two curved bends.
 const x=.0872,y=-.000091,z=.0155,pts=[];
 const ry=k==='sport'?.029:k==='cat-eye'?.023:k==='sunglasses'?.025:.0165;
 const rz=k==='sport'?.013:k==='cat-eye'?.014:k==='sunglasses'?.015:.016;
 for(let i=0;i<48;i++) {
  const t=i*PI/24,cos=Math.cos(t),sin=Math.sin(t);let yy,zz;
  if(['sport','sunglasses'].includes(k)) {
   yy=ry*Math.sign(cos)*Math.abs(cos)**.5;zz=rz*Math.sign(sin)*Math.abs(sin)**.6;
  }else if(k==='cat-eye') {
   yy=ry*cos;zz=rz*sin+Math.abs(cos)**3*.006;
  }else if(k==='aviator') {
   yy=ry*cos*(sin<0?.88:1);zz=rz*sin-(sin<0?.004*Math.abs(sin)**2:0);
  }else {yy=ry*cos;zz=rz*sin}
  pts.push([x,y+yy,z+zz]);
 }
 tube(g,frame,pts,k==='clear'?.0016:.0012,'single-eyepiece-rim',56,true);
 const shape=new THREE.Shape(pts.map(p=>new THREE.Vector2(p[1],p[2])));
 const geo=new THREE.ExtrudeGeometry(shape,{depth:.0003,bevelEnabled:false}),pos=geo.attributes.position;
 for(let i=0;i<pos.count;i++){const yy=pos.getX(i),zz=pos.getY(i),xx=pos.getZ(i);pos.setXYZ(i,x+.00015+xx,yy,zz)}
 geo.computeVertexNormals();add(g,geo,lens,[0,0,0],[0,0,0],[1,1,1],'single-optical-lens');
 for(const side of[-1,1]) {
  const yy=y+side*ry;
  tube(g,frame,[[x,yy,z],[x,side*.038,.017],[.0805,side*.0438284,.019],[.064,side*.0423684,.021],[.037,side*.0392219,.023],[.024,side*.0394,.022],[.010,side*.0382213,.019]],.0012,'temple-arm',28);
  disk(g,hinge,[x+.001,yy,z+.002],.0014,.001,'hinge-pin');
 }
 if(k==='aviator')tube(g,hinge,[[x,y-.012,z+.012],[x+.001,y,z+.017],[x,y+.012,z+.012]],.0005,'single-brow-bar',20);
 return g;
}

function accessory(item) {
 const g=new THREE.Group(),[a,b,c]=item.palette.map(color=>mat(color)),metal=mat('#b7ac8f',{metalness:.65,roughness:.34}),k=item.kind;
 if(['tote','satchel','pouch'].includes(k)){
  const y=-.057,z=k==='tote'?.002:.014,x=.012;
  const bag=softBox(g,a,[x,y,z],[k==='tote'?.025:.021,.014,k==='tote'?.035:.027],.004,'stitched-bag');bag.rotation.x=-.12;softBox(g,b,[x+.012,y,z+.005],[.003,.015,.012],.003,'bag-flap');disk(g,metal,[x+.014,y,z+.002],.0018,.001,'bag-clasp');
  tube(g,c,[[x+.012,y-.005,z-.012],[x+.014,y,z-.015],[x+.012,y+.005,z-.012]],.0005,'bag-topstitch');
  if(k==='tote')for(const dx of[-.006,.006])tube(g,b,[[x+dx,y-.004,z+.015],[x+dx,y-.009,z+.031],[x+dx,y+.004,z+.032],[x+dx,y+.005,z+.014]],.0012,'tote-handle');
  else tube(g,c,[[x,y,z+.014],[.030,-.036,.043],[.018,.028,.044],[-.045,.024,.030],[-.052,-.022,.015],[x,y,z+.014]],.0016,'cross-body-strap');
 }else if(k==='backpack'){
  softBox(g,a,[-.067,0,.015],[.025,.044,.047],.007,'canvas-backpack');softBox(g,b,[-.081,0,.021],[.004,.043,.021],.005,'backpack-flap');softBox(g,a,[-.083,0,.000],[.005,.034,.019],.003,'front-pouch');
  for(const s of[-1,1]){tube(g,c,[[-.080,s*.011,.033],[-.084,s*.011,.017],[-.084,s*.011,.011]],.0017,'leather-pack-strap');softBox(g,metal,[-.086,s*.011,.017],[.0015,.004,.006],.0007,'pack-buckle');tube(g,b,[[-.065,s*.020,.031],[-.041,s*.030,.044],[.006,s*.028,.044],[.035,s*.028,.026]],.0019,'shoulder-harness')}
  tube(g,c,[[-.067,-.009,.040],[-.067,-.007,.051],[-.067,.007,.051],[-.067,.009,.040]],.0013,'carry-loop');
 }else if(k==='camera'){
  softBox(g,a,[.060,-.024,.012],[.016,.029,.020],.0025,'camera-body');softBox(g,c,[.066,-.024,.012],[.004,.029,.012],.0012,'camera-grip');
  for(const[x,r,d]of[[.072,.008,.007],[.077,.007,.004]])disk(g,c,[x,-.024,.012],r,d,'lens-barrel');disk(g,metal,[.080,-.024,.012],.0065,.001,'lens-rim');disk(g,mat('#263b40',{roughness:.13}),[.081,-.024,.012],.0055,.001,'camera-glass');
  softBox(g,b,[.061,-.015,.025],[.007,.009,.004],.0008,'shutter-housing');disk(g,metal,[.061,-.030,.024],.0024,.002,'shutter-button','z');tube(g,c,[[.059,-.037,.020],[.043,-.038,.044],[-.020,-.018,.046],[-.039,.028,.044],[.053,.004,.022]],.001,'camera-strap');
 }else if(k==='coffee'){
  const p=[.027,-.058,.016];add(g,new THREE.CylinderGeometry(.009,.007,.025,32),b,p,[PI/2,0,0],[1,1,1],'coffee-cup');add(g,new THREE.CylinderGeometry(.0086,.0086,.010,32),a,p,[PI/2,0,0],[1,1,1],'cup-sleeve');disk(g,c,[p[0],p[1],.029],.0098,.003,'coffee-lid','z');disk(g,b,[p[0],p[1],.031],.0075,.002,'lid-top','z');tube(g,c,[[.019,-.043,.026],[.023,-.055,.027]],.0018,'cup-holder');
 }else if(k==='watering'){
  const p=[.022,-.062,.006];ellipsoid(g,a,p,[.014,.014,.019],'watering-can');disk(g,b,[p[0],p[1],.025],.011,.003,'can-rim','z');tube(g,c,[[.023,-.075,.017],[.023,-.086,.027],[.023,-.091,.003],[.023,-.075,-.007]],.002,'watering-handle');tube(g,a,[[.024,-.048,.002],[.038,-.040,.018],[.049,-.040,.023]],.003,'watering-spout');disk(g,b,[.052,-.039,.024],.006,.002,'rose-spout');
 }else if(k==='book'){
  softBox(g,c,[.023,-.054,.010],[.012,.021,.032],.0018,'book-cover');softBox(g,b,[.030,-.054,.010],[.003,.017,.027],.001,'bound-pages');for(let i=0;i<5;i++)tube(g,a,[[.032,-.061,-.001+i*.004],[.032,-.047,-.001+i*.004]],.00025,'page-edges',4);star(g,a,[.033,-.055,.015],.005);tube(g,a,[[.028,-.055,.027],[.030,-.053,.033],[.030,-.051,.027]],.0007,'ribbon-bookmark');
 }else if(k==='skateboard'){
  const board=softBox(g,a,[-.025,-.061,.012],[.062,.008,.019],.005,'skate-deck');board.rotation.y=-.28;for(const x of[-.043,-.008])for(const s of[-1,1])add(g,new THREE.CylinderGeometry(.004,.004,.003,20),b,[x,-.061+s*.007,.005+(x+.025)*.28],[0,0,0],[1,1,1],'skate-wheel');for(const x of[-.043,-.008])tube(g,c,[[x,-.069,.007],[x,-.053,.007]],.0012,'skate-truck',4);star(g,b,[.004,-.066,.020],.005);
 }else if(k==='wings'){
  for(const s of[-1,1]){const upper=ellipsoid(g,b,[-.068,s*.040,.030],[.003,.022,.029],'upper-wing');upper.rotation.x=s*-.35;const lower=ellipsoid(g,a,[-.068,s*.039,.000],[.003,.018,.019],'lower-wing');lower.rotation.x=s*.30;for(let i=0;i<3;i++)tube(g,c,[[-.072,s*.018,.018],[-.072,s*(.033+i*.006),.022+i*.011],[-.072,s*(.045+i*.004),.040]],.0005,'wing-vein')}
  softBox(g,c,[-.064,0,.019],[.004,.014,.024],.002,'wing-mount');
 }else if(k==='star'){
  star(g,b,[.014,-.058,.002],.012);star(g,c,[.016,-.058,.002],.006);tube(g,c,[[.014,-.058,.014],[.012,-.047,.034],[.008,-.032,.034]],.0008,'star-tether');
 }else throw new Error(`Unknown tailored accessory: ${k}`);
 return g;
}

function legwear(item) {
 const[a,b,c]=item.palette.map(color=>mat(color)),k=item.kind;
 if(k==='legwarmers')return['leg','leg_2'].map((bodyName,index)=>{
  const g=new THREE.Group(),s=index?-1:1,cx=.011,cy=s*.006;fabricShell(g,a,[[-.039,.013,.014],[-.030,.014,.014],[-.020,.013,.013],[-.015,.013,.013]],{cx,folds:.0006,name:'rib-knit-legwarmer'});g.position.y=cy;for(let i=0;i<5;i++)loop(g,b,[cx,0,-.038+i*.005],.0135,.014,.0006,'warm-leg-rib');return{bodyName,group:g};
 });
 return['ankle_left','ankle_right'].map((bodyName,index)=>{
  const g=new THREE.Group(),s=index?-1:1,y=-s*.016,x=.007;
  if(k==='socks'){fabricShell(g,b,[[-.014,.0155,.016],[-.004,.0155,.016],[.007,.014,.015]],{cx:.002,folds:.0003,name:'ankle-sock'});g.position.y=-s*.021;for(let i=0;i<3;i++)loop(g,a,[.002,0,-.003+i*.003],.0157,.0163,.0007,'sock-stripe');return{bodyName,group:g}}
  softBox(g,k==='ballet'?c:b,[x,y,-.0265],[.060,.046,.0038],.007,'sole');const shoe=ellipsoid(g,a,[x+.002,y,-.016],[.031,.023,.013],'rounded-shoe-upper');const p=shoe.geometry.attributes.position;for(let i=0;i<p.count;i++)if(p.getZ(i)<-.52)p.setZ(i,-.52);shoe.geometry.computeVertexNormals();loop(g,c,[x,y,-.0235],.028,.021,.00065,'welt-stitch');
  if(['boots','wellies','high-top','trail'].includes(k)){const height=k==='wellies'?.016:k==='boots'?.014:.011;const cuff=fabricShell(g,a,[[-.012,.019,.020],[height/2,.017,.018],[height,.017,.018]],{cx:x-.006,folds:.0003,name:'ankle-boot-shaft'});cuff.position.y=y;loop(g,b,[x-.006,y,height],.017,.018,.0012,'boot-top-binding')}
  if(k==='wellies')for(const[xx,yy,zz]of[[.025,-.013,-.014],[.029,.009,-.012],[.007,-.020,.008],[-.007,.014,.005]])disk(g,b,[x+xx,y+yy,zz],.0015,.0005,'wellie-dot');
  if(['sneakers','boots','trail','high-top'].includes(k)){
   ellipsoid(g,b,[.008,y,-.004],[.020,.010,.0023],'shoe-tongue');for(let i=0;i<4;i++){const xx=-.002+i*.006;tube(g,c,[[xx,y-.010,-.004],[xx+.003,y,-.001],[xx,y+.010,-.004]],.00065,'lace',12);for(const d of[-1,1])disk(g,b,[xx,y+d*.011,-.003],.001,.0005,'eyelet','z')}
   if(['sneakers','high-top'].includes(k))ellipsoid(g,b,[.029,y,-.014],[.011,.020,.008],'rubber-toe-cap');for(let i=0;i<5;i++)softBox(g,c,[-.012+i*.010,y,-.029],[.005,.039,.0013],.0005,'sole-tread');
  }
  if(k==='loafers'){tube(g,b,[[.002,y-.014,-.005],[.005,y,-.002],[.002,y+.014,-.005]],.0021,'loafer-saddle');softBox(g,c,[.006,y,-.001],[.007,.009,.0015],.0006,'penny-slot')}
  if(k==='ballet'){for(const d of[-1,1]){const bow=ellipsoid(g,b,[.020,y+d*.005,-.006],[.006,.006,.002],'ribbon-bow');bow.rotation.z=d*.4}tube(g,b,[[-.003,y-.019,-.013],[.010,y,-.005],[-.003,y+.019,-.013]],.001,'slipper-ribbon')}
  return{bodyName,group:g};
 });
}
export function createGarment(item) {
 if(item.slot==='legwear')return legwear(item);const builders={hat,eyewear,body,accessory},builder=builders[item.slot];if(!builder)throw new Error(`Unknown clothing slot: ${item.slot}`);return[{bodyName:['hat','eyewear'].includes(item.slot)?'jaw_soft':'trunk_base',group:builder(item)}];
}

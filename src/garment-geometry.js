import * as THREE from 'three';
import { PI, V, mat, add, ellipsoid, tube, loop, disk, roundedShape, softBox, surfaceX, frontPoints, facePatch, pocket, pointedCollar, buttonRow, fabricShell, FITTED, edge, cuffs, knitRibs, cable, strap, zipper, star, flower, petalPanel } from './garment-primitives.js';
import { accessory } from './accessory-geometry.js';
import { createFootwear } from './footwear-geometry.js';

function classicBody(item) {
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
function classicHat(item) {
 const g=new THREE.Group(),[a,b,c]=item.palette.map(color=>mat(color)),k=item.kind,cx=.020;
 const dome=(m=a,h=.021,rx=.054,ry=.046,base=.044)=>add(g,new THREE.SphereGeometry(1,40,20,0,PI*2,0,PI/2),m,[cx,0,base],[PI/2,0,0],[rx,h,ry],'shaped-crown');
 const band=(m=b,z=.047,rx=.054,ry=.046,r=.0016)=>loop(g,m,[cx,0,z],rx,ry,r,'hatband');
 function brim(m=a,rx=.069,ry=.056,z=.044){annularBrim(g,m,cx,rx,ry,z);loop(g,b,[cx,0,z],rx,ry,.00065,'brim-topstitch')}
 function visor(){const v=ellipsoid(g,b,[.073,0,.045],[.036,.038,.0023],'curved-visor');v.rotation.y=-.08;tube(g,c,[[.069,-.034,.045],[.102,-.018,.047],[.108,0,.048],[.102,.018,.047],[.069,.034,.045]],.0005,'visor-stitch',28)}
 function knit(height,pom){dome(a,height);band(b,.048,.054,.046,.0034);band(b,.052,.053,.045,.002);for(let i=0;i<24;i++){const t=i*PI/12;tube(g,b,[[cx+.053*Math.cos(t),.046*Math.sin(t),.048],[cx+.043*Math.cos(t),.037*Math.sin(t),.060],[cx+.022*Math.cos(t),.019*Math.sin(t),.044+height*.88],[cx,0,.044+height]],.00033,'knitted-hat-rib',20)}if(pom)ellipsoid(g,b,[cx-.008,0,.044+height+.008],[.009,.009,.009],'pom-pom')}
 if(['beret','paint-beret'].includes(k)) {
  dome(a,.014,.060,.050,.046);band(c,.045);tube(g,c,[[.018,0,.059],[.015,0,.067]],.0014,'beret-stem',8);
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
  if(k==='naval'){visor();star(g,b,[.070,0,.053],.005)}else for(const y of[-.016,-.009])tube(g,c,[[-.041,y,.045],[-.046,y,.037],[-.049,y+.004,.031]],.001,'sailor-ribbon',16);
 }else if(k==='rainhood') {
  dome(a,.025,.058,.049);visor();band(c,.045,.057,.049,.0009);for(const s of[-1,1])ellipsoid(g,a,[.002,s*.053,.046],[.024,.004,.009],'rain-hat-ear-flap');tube(g,b,[[-.030,0,.046],[.003,0,.068],[.050,0,.065],[.079,0,.049]],.0007,'waterproof-top-seam');
 }else if(k==='toque') {
  fabricShell(g,a,[[.044,.049,.042],[.057,.047,.041],[.083,.049,.043]],{cx,folds:.0008,name:'chef-pleated-crown'});band(b,.048,.049,.042,.0024);ellipsoid(g,a,[cx,0,.083],[.054,.046,.011],'chef-puffed-top');
  for(let i=0;i<20;i++){const t=i*PI/10;tube(g,b,[[cx+.048*Math.cos(t),.042*Math.sin(t),.053],[cx+.048*Math.cos(t),.042*Math.sin(t),.079]],.0004,'chef-pleat',8)}
 }else if(['visor','sportband'].includes(k)){band(a,.047,.054,.046,.003);band(b,.051,.054,.046,.0007);if(k==='visor')visor();else softBox(g,b,[.074,0,.048],[.002,.021,.006],.001,'headband-label')}
 else if(k==='earmuffs') {
  tube(g,b,[[cx,-.052,.026],[cx,-.050,.054],[cx,0,.075],[cx,.050,.054],[cx,.052,.026]],.0028,'padded-headband');for(const s of[-1,1]){ellipsoid(g,a,[cx,s*.052,.027],[.018,.008,.019],'plush-ear-cushion');ellipsoid(g,b,[cx,s*.059,.027],[.013,.003,.014],'earmuff-centre')}
 }else if(k==='wizard') {
  brim(b,.068,.056);const cone=add(g,new THREE.ConeGeometry(.051,.068,48,16,true),a,[cx,0,.077],[PI/2,.14,0],[1,1,.88],'bent-wizard-hat');const p=cone.geometry.attributes.position;for(let i=0;i<p.count;i++)p.setX(i,p.getX(i)+Math.max(0,p.getY(i))**2*16);cone.geometry.computeVertexNormals();band(c,.048,.050,.044,.002);star(g,b,[.050,-.018,.079],.006);star(g,b,[.063,.017,.063],.004);
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

export function createGarment(item) {
 if(item.slot==='legwear')return createFootwear(item);const builders={hat,eyewear,body,accessory},builder=builders[item.slot];if(!builder)throw new Error(`Unknown clothing slot: ${item.slot}`);return[{bodyName:['hat','eyewear'].includes(item.slot)?'jaw_soft':'trunk_base',group:builder(item)}];
}

const NEW_BODY_KINDS = new Set(['duffle','biker','wrap-dress','pleated-dress','poncho','jersey','hanfu','fleece','bolero','quilted-jacket','tunic','shell-vest','balloon-dress','capelet','rugby','workshirt']);
function tailoredBody(item) {
 const g=new THREE.Group(),[a,b,c]=item.palette.map(color=>mat(color)),metal=mat(item.palette[2],{roughness:.36,metalness:.42});g.userData.curvedBody=true;
 const kind=item.kind;
 const coat=[[-.019,.056,.045],[-.011,.054,.043],[.008,.050,.040],[.027,.049,.039],[.039,.050,.040],[.045,.045,.035]];
 const dress=[[-.027,.063,.055],[-.013,.059,.051],[.001,.053,.045],[.016,.049,.039],[.035,.048,.037],[.044,.044,.034]];
 const shell=(profile,m=a,gap=.1,folds=.0005)=>{fabricShell(g,m,profile,{gap,folds});edge(g,b,profile,.0009,gap)};
 if(kind==='duffle') {
  shell(coat);cuffs(g,a,b,.026,.011,.040,.011);fabricShell(g,b,[[.031,.052,.042],[.041,.049,.039],[.046,.044,.033]],{gap:.6,name:'duffle-shoulder-flap'});
  for(let i=0;i<3;i++){const z=.006+i*.011;tube(g,c,frontPoints([[.047,-.014,z],[.049,-.002,z+.002],[.047,.008,z]]),.00065,'toggle-cord',12);const toggle=ellipsoid(g,metal,[surfaceX(.049,.009),.009,z],[.0018,.004,.0013],'wooden-toggle');toggle.rotation.x=.2}
  for(const y of[-.024,.024])pocket(g,a,b,y,-.003,.022,.019);
 } else if(kind==='biker') {
  shell([[.002,.051,.041],[.018,.049,.039],[.034,.050,.040],[.044,.045,.035]],a,.12);cuffs(g,a,c,.027,.010,.040,.009);
  facePatch(g,b,[[-.032,.043],[-.006,.039],[.015,.004],[.028,.007],[.012,.029],[.025,.044]],.047,.0016,'asymmetric-leather-lapel');
  tube(g,metal,frontPoints([[.048,-.013,.040],[.050,.002,.019],[.047,.016,.005]]),.0008,'diagonal-metal-zip');for(const y of[-.025,.025])tube(g,c,frontPoints([[.046,y*.6,.015],[.044,y*1.2,.024]]),.001,'slanted-zip-pocket');
  loop(g,c,[-.006,0,.004],.051,.041,.0017,'biker-belt');for(const y of[-.023,.023])disk(g,metal,[surfaceX(.048,y),y,.034],.0023,.0012,'lapel-snap');
 } else if(['wrap-dress','hanfu'].includes(kind)) {
  shell(dress,a,.1,.001);facePatch(g,b,[[-.035,-.018],[.013,-.018],[.028,.044],[.008,.044]],.050,.0018,'wrapped-fabric-front');
  tube(g,c,frontPoints([[.047,.028,.042],[.052,.012,.017],[.054,-.016,-.019]]),.0012,'diagonal-wrap-binding');loop(g,c,[-.006,0,.014],.050,.040,.002,'wrap-waist');
  for(const side of[-1,1]) {const cuff=add(g,new THREE.CylinderGeometry(kind==='hanfu'?.018:.011,.010,kind==='hanfu'?.027:.014,32,5,true),a,[-.009,side*.047,.023],[0,0,0],[1.12,1,1],'flowing-wrap-sleeve');cuff.rotation.x=side*.25}
  if(kind==='hanfu'){fabricShell(g,b,[[-.025,.064,.055],[-.021,.063,.054]],{name:'hanfu-layered-skirt-border'});for(const y of[-.023,.023])flower(g,c,b,[surfaceX(.052,y),y,-.008],.005)}
  else {for(const side of[-1,1]){const bow=ellipsoid(g,c,[surfaceX(.053,-.021),-.021+side*.005,.013],[.002,.007,.003],'waist-bow');bow.rotation.x=side*.35}}
 } else if(kind==='pleated-dress') {
  shell(dress,a,0,.0011);for(let i=0;i<20;i++){const t=i*PI/10;tube(g,b,Array.from({length:6},(_,j)=>{const z=.015-j*.008,r=.050+j*.0026;return[-.006+r*Math.cos(t),(r*.83)*Math.sin(t),z]}),.00045,'knife-pleat-ridge',16)}
  loop(g,c,[-.006,0,.017],.049,.040,.002,'tailored-waist');pointedCollar(g,b,c,.043,.021);buttonRow(g,c,0,3,.023,.006);for(const side of[-1,1])strap(g,a,side*.025,.002);
 } else if(kind==='poncho') {
  const p=[[-.019,.065,.064],[-.006,.064,.063],[.013,.059,.055],[.032,.049,.039],[.045,.043,.033]];shell(p,a,.2,.0014);
  g.traverse(m=>{if(!m.isMesh)return;const a=m.geometry.attributes.position;for(let i=0;i<a.count;i++){const z=a.getZ(i),theta=Math.atan2(a.getY(i),a.getX(i)+.006);if(z<.010)a.setZ(i,z+.012*Math.abs(Math.sin(theta))*(.010-z)/.035)}m.geometry.computeVertexNormals()});
  for(let i=0;i<24;i++){const theta=i*PI/12;tube(g,c,[[-.006+.065*Math.cos(theta),.064*Math.sin(theta),-.014+.012*Math.abs(Math.sin(theta))],[-.006+.068*Math.cos(theta),.067*Math.sin(theta),-.021+.012*Math.abs(Math.sin(theta))]],.00065,'poncho-fringe',8)}disk(g,metal,[.039,0,.039],.003,.0015,'poncho-fastener');
 } else if(['jersey','rugby'].includes(kind)) {
  shell(FITTED,a,0,.0003);cuffs(g,a,b,.025,.011,.039,.013);if(kind==='rugby')pointedCollar(g,b,c,.043,.024);
  const levels=kind==='rugby'?[.002,.016,.030]:[.025];for(const z of levels)fabricShell(g,b,[[z,.0495,.0395],[z+.004,.0495,.0395]],{name:'woven-team-stripe'});
  if(kind==='jersey'){facePatch(g,b,[[-.006,.002],[.006,.002],[.006,.032],[-.001,.032],[-.009,.026],[-.007,.021],[-.001,.025],[-.001,.002]],.046,.0008,'woven-number-one');for(const side of[-1,1])tube(g,c,[[-.006,side*.041,.006],[-.006,side*.041,.034]],.0008,'mesh-side-seam')}
 } else if(kind==='fleece') {
  shell([[-.006,.052,.042],[.010,.052,.043],[.030,.053,.044],[.045,.045,.035]],a,.08,.0008);cuffs(g,a,b,.025,.012,.042,.012);zipper(g,c);
  for(let i=0;i<24;i++){const y=-.030+(i%6)*.012,z=.005+Math.floor(i/6)*.009;tube(g,b,frontPoints([[.048,y,z],[.049,y+.0016,z+.0008],[.048,y+.003,z]]),.00038,'soft-fleece-loop',8)}pocket(g,b,c,-.022,.029,.016,.012,.047);
 } else if(kind==='bolero') {
  shell([[.020,.051,.041],[.032,.050,.040],[.044,.045,.035]],a,.75);cuffs(g,a,c,.029,.014,.041,.016);
  for(const side of[-1,1])tube(g,b,frontPoints([[.043,side*.017,.042],[.047,side*.020,.029],[.048,side*.031,.021]]),.002,'rounded-bolero-lapel');
 } else if(kind==='quilted-jacket') {
  shell(coat,a,.10,.0007);cuffs(g,a,b,.024,.012,.041,.015);zipper(g,c,-.015,.039);
  for(const side of[-1,1])for(let i=0;i<4;i++)tube(g,b,frontPoints([[.050,side*.004,-.015+i*.013],[.049,side*.018,-.002+i*.013],[.046,side*.032,-.015+i*.013]]),.00055,'diamond-quilt-stitch',16);
  for(const y of[-.025,.025])pocket(g,a,b,y,-.004,.021,.016,.047);
 } else if(kind==='tunic') {
  shell([[-.024,.056,.047],[-.008,.054,.044],[.014,.050,.039],[.037,.048,.037],[.044,.044,.034]],a,.09,.0008);pointedCollar(g,b,c,.042,.019);buttonRow(g,c,0,3,.019,.009);
  for(const side of[-1,1]){tube(g,c,[[-.008,side*.048,-.023],[-.008,side*.046,-.002]],.0007,'side-vent-binding');facePatch(g,b,[[side*.029,-.020],[side*.034,-.008],[side*.024,-.003],[side*.016,-.018]],.054,.001,'tunic-side-insert')}
 } else if(kind==='shell-vest') {
  shell([[.001,.053,.043],[.018,.052,.042],[.035,.050,.040],[.044,.044,.034]],a,.32,.0003);
  for(const side of[-1,1]){facePatch(g,b,[[side*.008,.004],[side*.033,.010],[side*.029,.039],[side*.014,.042]],.049,.0024,'sculpted-shell-panel');for(let i=0;i<3;i++)tube(g,c,frontPoints([[.051,side*.019,.014+i*.006],[.046,side*.030,.020+i*.005]]),.0007,'breathable-shell-vent');disk(g,metal,[surfaceX(.050,side*.026),side*.026,.033],.002,.001,'shell-anchor-snap')}
 } else if(kind==='balloon-dress') {
  shell([[-.024,.052,.044],[-.016,.064,.055],[.002,.063,.054],[.018,.049,.039],[.038,.047,.036],[.044,.043,.033]],a,0,.001);
  loop(g,b,[-.006,0,-.024],.053,.045,.0018,'gathered-elastic-hem');loop(g,c,[-.006,0,.019],.049,.039,.0015,'balloon-waist');for(const side of[-1,1])strap(g,b,side*.024,.0022);flower(g,c,b,[.046,-.017,.030],.007);
 } else if(kind==='capelet') {
  const p=[[.005,.064,.054],[.013,.060,.050],[.028,.052,.041],[.043,.044,.033]];shell(p,a,.28,.0009);
  fabricShell(g,b,[[.007,.065,.055],[.013,.061,.051]],{gap:.28,name:'capelet-layered-edge'});pointedCollar(g,a,c,.041,.023);disk(g,metal,[.041,0,.036],.0034,.0016,'capelet-brooch');
 } else if(kind==='workshirt') {
  shell([[-.014,.052,.042],[.003,.051,.041],[.024,.050,.040],[.037,.049,.039],[.044,.045,.035]],a,.07,.0004);pointedCollar(g,b,c,.043,.026);cuffs(g,b,a,.026,.011,.039,.014);buttonRow(g,c,0,5,-.008,.010);
  for(const y of[-.022,.022]){pocket(g,a,b,y,.024,.019,.013);facePatch(g,b,[[y-.010,.031],[y+.010,.031],[y+.006,.027],[y-.006,.027]],.046,.001,'workshirt-pocket-flap');disk(g,metal,[surfaceX(.048,y),y,.028],.0015,.001,'shirt-pocket-snap')}
 } else throw new Error(`Unknown sculpted clothing cut: ${kind}`);
 return g;
}

function decorateBody(g,item) {
 const d=item.design||{};if(!Object.keys(d).length)return g;
 const [a,b,c]=item.palette.map(color=>mat(color));
 const length=d.cut==='cropped'?.76:d.cut==='long'?1.17:1;
 const minZ=new THREE.Box3().setFromObject(g).min.z;
 if(d.sleeve&&d.sleeve!=='short') {
  for(const m of[...g.children])if(m.isMesh&&['short-folded-sleeve','sleeve-binding'].includes(m.name)){g.remove(m);m.geometry.dispose()}
  if(d.sleeve!=='none')for(const side of[-1,1]) {
   const r=d.sleeve==='bell'?.018:d.sleeve==='puff'?.016:.011;
   const sleeve=add(g,new THREE.CylinderGeometry(d.sleeve==='bell'?r:.010,r,d.sleeve==='raglan'?.022:.015,32,6,true),a,[-.008,side*.046,.026],[0,0,0],[1.15,1,1],`${d.sleeve}-tailored-sleeve`);sleeve.rotation.x=side*.24;
   tube(g,b,Array.from({length:24},(_,i)=>{const t=i*PI/12;return[-.008+r*1.15*Math.cos(t),side*.054,.026+r*Math.sin(t)]}),.0009,'new-sleeve-binding',24,true);
  }
 }
 if(d.closure) {
  for(const m of[...g.children])if(m.isMesh&&['button','zipper-track','zipper-tooth','zip-pull'].includes(m.name)){g.remove(m);m.geometry.dispose()}
  if(d.closure==='zip')zipper(g,c,minZ+.003,.037);
  if(d.closure==='buttons')buttonRow(g,c,0,4,minZ+.010,.010);
  if(d.closure==='toggle')for(let i=0;i<3;i++){const z=.004+i*.011;tube(g,b,frontPoints([[.046,-.011,z],[.048,0,z+.002],[.046,.010,z]]),.00065,'authored-toggle-loop',12);ellipsoid(g,c,[.048,.006,z],[.0014,.004,.0013],'authored-toggle')}
  if(d.closure==='wrap'){facePatch(g,b,[[-.023,minZ+.002],[.009,minZ+.002],[.025,.040],[.008,.043]],.047,.0013,'authored-overlap-panel');tube(g,c,frontPoints([[.046,.025,.040],[.049,.010,.021],[.049,-.010,minZ+.004]]),.0008,'authored-wrap-topstitch')}
  if(d.closure==='bow')for(const side of[-1,1]){const bow=ellipsoid(g,b,[.047,side*.006,.023],[.002,.008,.004],'authored-fabric-bow');bow.rotation.x=side*.3}
 }
 if(d.detail==='pockets')for(const y of[-.022,.022])pocket(g,b,c,y,.009,.021,.018,.048);
 if(d.detail==='patches'){facePatch(g,b,[[-.033,.019],[-.016,.019],[-.016,.034],[-.033,.034]],.047,.001,'sewn-repair-patch');for(let i=0;i<5;i++)tube(g,c,frontPoints([[.049,-.034+i*.004,.019],[.049,-.034+i*.004,.022]]),.00025,'patch-cross-stitch',6)}
 if(d.detail==='ruffles'){fabricShell(g,b,[[minZ,.061,.051],[minZ+.008,.055,.046]],{folds:.0017,name:'gathered-edge-ruffle'});edge(g,c,[[minZ,.061,.051],[minZ+.008,.055,.046]],.0006)}
 if(d.detail==='ribbed')knitRibs(g,b,FITTED,28);
 if(['quilted','pleats'].includes(d.detail))for(let i=-4;i<=4;i++)tube(g,b,frontPoints([[.047,i*.006,minZ+.003],[.049,i*.006,.016],[.046,i*.006,.036]]),.0004,`${d.detail}-construction-seam`,18);
 if(['stripe','check'].includes(d.pattern))for(const z of[.002,.011,.020,.029])tube(g,b,frontPoints(Array.from({length:11},(_,i)=>[.047,-.030+i*.006,z])),.00065,'woven-horizontal-stripe',24);
 if(d.pattern==='check')for(let i=-4;i<=4;i++)tube(g,c,frontPoints([[.047,i*.007,minZ+.002],[.047,i*.007,.039]]),.00045,'woven-check-warp',12);
 if(d.pattern==='dots')for(let i=0;i<12;i++){const y=-.025+(i%4)*.0166,z=.004+Math.floor(i/4)*.012;disk(g,b,[surfaceX(.048,y),y,z],.0016,.0005,'embroidered-dot')}
 if(d.pattern==='petals')for(const y of[-.022,.022])flower(g,b,c,[surfaceX(.047,y),y,.019],.005);
 g.traverse(m=>{if(!m.isMesh)return;m.updateMatrix();const geo=m.geometry.clone().applyMatrix4(m.matrix);m.geometry.dispose();m.geometry=geo;m.position.set(0,0,0);m.rotation.set(0,0,0);m.scale.set(1,1,1);const pos=geo.attributes.position;
  for(let i=0;i<pos.count;i++){let x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);const lower=Math.max(0,Math.min(1,(.024-z)/Math.max(.016,.024-minZ)));z=.044-(.044-z)*length;
   if(d.hem==='asymmetric')z+=y*.14*lower;
   if(d.hem==='scallop')z+=Math.cos(Math.atan2(y,x+.006)*10)*.002*lower;
   if(d.hem==='bubble'){const gain=1+.07*Math.sin(lower*PI)-.055*lower**3;x=-.006+(x+.006)*gain;y*=gain}
   pos.setXYZ(i,x,y,z);
  }geo.computeVertexNormals();geo.computeBoundingBox();
 });
 return g;
}
function body(item){return decorateBody(NEW_BODY_KINDS.has(item.kind)?tailoredBody(item):classicBody(item),item)}

// Sampled from the pinned official top_head_shell STL, in the existing
// world-oriented jaw_soft authoring frame. Colours never change this surface.
const HEAD_TOP_GRID = [[null,null,null,null,null,null,null,null,null,null,null],[.019048,.018713,.017745,.016025,.013313,.009295,.002672,null,null,null,null],[.027175,.027003,.026436,.025365,.02364,.021065,.017361,.011881,.001948,null,null],[.031252,.031114,.030709,.02994,.028658,.026697,.023815,.019582,.013015,-.000155,null],[.033596,.033463,.033178,.032557,.031539,.029971,.027573,.023979,.01845,.00919,null],[.03507,.034959,.034728,.034216,.033366,.032018,.029949,.026804,.021918,.013815,null],[.03606,.035985,.035785,.035351,.03458,.03339,.031571,.0288,.024386,.017007,.002533],[.036911,.036824,.036643,.03624,.035552,.034481,.032813,.030257,.026173,.019434,null],[.037595,.037508,.037367,.036978,.036359,.035363,.033824,.031437,.027657,.021365,null],[.038209,.038123,.037981,.037587,.037025,.036057,.034589,.032341,.028908,.022883,.012461],[.038823,.03873,.038595,.038209,.037673,.036751,.035354,.033224,.029885,.024317,.014638],[.039438,.039335,.039201,.038832,.038319,.037445,.036119,.034094,.030901,.025702,.016766],[.040003,.039897,.039776,.039394,.038891,.038032,.036739,.034753,.031682,.026734,.018415],[.040566,.040444,.040325,.039955,.039463,.038622,.037348,.035412,.032443,.027746,.019909],[.041126,.040993,.040871,.040521,.040036,.039205,.03795,.036067,.033196,.028689,.02137],[.041686,.041553,.04142,.041102,.040607,.039788,.038549,.036711,.033933,.029632,.022406],[null,null,null,null,null,null,null,null,null,null,null]];
function gridHeight(ix,iy) {
 ix=Math.max(1,Math.min(15,ix));iy=Math.max(0,Math.min(10,iy));const row=HEAD_TOP_GRID[ix];if(row[iy]!==null)return row[iy];
 for(let j=iy-1;j>=0;j--)if(row[j]!==null)return row[j];return row[0];
}
function headHeight(x,y) {
 const gx=THREE.MathUtils.clamp((x+.040)/.008,1,15),gy=THREE.MathUtils.clamp(Math.abs(y)/.004,0,10),ix=Math.floor(gx),iy=Math.floor(gy),tx=gx-ix,ty=gy-iy;
 return THREE.MathUtils.lerp(THREE.MathUtils.lerp(gridHeight(ix,iy),gridHeight(ix+1,iy),tx),THREE.MathUtils.lerp(gridHeight(ix,iy+1),gridHeight(ix+1,iy+1),tx),ty);
}
function headNormal(x,y) {
 const e=.0003;return new THREE.Vector3(-(headHeight(x+e,y)-headHeight(x-e,y))/(2*e),-(headHeight(x,y+e)-headHeight(x,y-e))/(2*e),1).normalize();
}
function scalpPoint(x,y,clearance=.003) {return new THREE.Vector3(x,y,headHeight(x,y)).addScaledVector(headNormal(x,y),clearance).toArray()}
function fittedBand(item) {
 const g=new THREE.Group(),[a,b,c]=item.palette.map(color=>mat(color)),k=item.kind,roll=THREE.MathUtils.degToRad(item.design?.tilt||0),cx=.020;
 const point=y=>scalpPoint(cx-y*Math.sin(roll),y*Math.cos(roll),k==='earmuffs'?.0035:.0025);
 tube(g,k==='earmuffs'?b:c,Array.from({length:33},(_,i)=>point(-.036+i/32*.072)),k==='earmuffs'?.0017:.0010,'fitted-scalp-headband',64);
 if(k==='earmuffs')for(const side of[-1,1]) {ellipsoid(g,a,[.020,side*.053,.016],[.013,.006,.013],'fitted-ear-cushion');ellipsoid(g,b,[.020,side*.0575,.016],[.010,.0015,.010],'earmuff-outer-cover');tube(g,c,[point(side*.036),[.020,side*.047,.026],[.020,side*.053,.023]],.0012,'ear-cushion-support',20)}
 if(k==='sportband') {for(let i=0;i<3;i++)tube(g,a,Array.from({length:33},(_,j)=>scalpPoint(cx+.002*(i-1),-.036+j/32*.072,.0025)),.0013,'fitted-sport-band-knit',64);const p=point(0);star(g,b,[p[0]+.001,0,p[2]+.002],.003)}
 if(k==='antennae')for(const side of[-1,1]){const p=point(side*.019);tube(g,c,[p,[p[0]-.001,p[1]+side*.006,p[2]+.019]],.001,'honey-antenna-stalk');ellipsoid(g,a,[p[0]-.001,p[1]+side*.006,p[2]+.023],[.004,.004,.004],'honey-antenna-tip')}
 if(k==='moon-pin'){const p=point(-.024);flower(g,a,b,[p[0]+.004,p[1],p[2]+.011],.008);tube(g,c,[p,[p[0]+.004,p[1],p[2]+.009]],.0008,'moon-pin-support',10);const q=point(.015);add(g,new THREE.TorusGeometry(.006,.0013,8,32,PI*1.45),b,[q[0],q[1],q[2]+.007],[.2,PI/2,-.3],[1,1,1],'supported-moon-pin')}
 if(k==='cloud-pin'){const p=point(-.022);tube(g,c,[p,[p[0]+.003,p[1],p[2]+.010]],.0008,'cloud-pin-support',10);for(const[i,r]of[[0,.004],[1,.006],[2,.004]])ellipsoid(g,b,[p[0]+.003,p[1]+(i-1)*.006,p[2]+.013],[.002,r,r],'supported-cloud-pin');}
 g.userData.fittedHead=true;return g;
}
function annularBrim(g,material,cx,rx,ry,z) {
 const points=[],indices=[],segments=72,rows=9,n=segments+1,side=rows*n;
 const innerX=Math.min(.050,rx*.87),innerY=Math.min(.041,ry*.87);
 for(let layer=0;layer<2;layer++)for(let j=0;j<rows;j++)for(let i=0;i<=segments;i++){
  const t=j/(rows-1),theta=i/segments*PI*2;
  points.push(cx+THREE.MathUtils.lerp(innerX,rx,t)*Math.cos(theta),THREE.MathUtils.lerp(innerY,ry,t)*Math.sin(theta),z+(layer===0?.00065:-.00065));
 }
 for(let layer=0;layer<2;layer++)for(let j=0;j<rows-1;j++)for(let i=0;i<segments;i++){
  const a=layer*side+j*n+i,b=a+n;indices.push(...(layer===0?[a,b,a+1,a+1,b,b+1]:[a,a+1,b,a+1,b+1,b]));
 }
 for(const j of[0,rows-1])for(let i=0;i<segments;i++){const a=j*n+i;indices.push(a,a+1,a+side,a+1,a+side+1,a+side)}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geo.setIndex(indices);geo.computeVertexNormals();return add(g,geo,material,[0,0,0],[0,0,0],[1,1,1],'soft-brim');
}
function newHat(item) {
 const g=new THREE.Group(),[a,b,c]=item.palette.map(color=>mat(color)),cx=.020,k=item.kind;
 const crown=(profile)=>fabricShell(g,a,profile,{cx,folds:.0003,name:'new-tailored-crown'});
 const brim=(rx=.068,ry=.052)=>{annularBrim(g,b,cx,rx,ry,.044);loop(g,c,[cx,0,.044],rx,ry,.0006,'brim-sewn-edge')};
 if(k==='cloche'){crown([[.044,.057,.047],[.053,.053,.043],[.068,.043,.036],[.075,.026,.023]]);ellipsoid(g,a,[cx,0,.074],[.028,.023,.008],'cloche-rounded-top');brim(.061,.050);flower(g,c,b,[.057,-.031,.054],.007)}
 else if(k==='pillbox'){crown([[.044,.048,.040],[.057,.048,.040],[.064,.046,.038]]);ellipsoid(g,a,[cx,0,.064],[.046,.038,.002],'pillbox-flat-top');loop(g,b,[cx,0,.046],.048,.040,.002,'pillbox-woven-band');tube(g,c,[[.044,-.025,.055],[.055,-.027,.072]],.001,'pillbox-brooch-stem')}
 else if(k==='trapper'){crown([[.044,.055,.046],[.056,.053,.043],[.071,.040,.034]]);ellipsoid(g,a,[cx,0,.070],[.042,.035,.007],'trapper-cap-top');for(const side of[-1,1])ellipsoid(g,b,[.009,side*.049,.043],[.026,.003,.008],'trapper-lined-flap');ellipsoid(g,b,[.065,0,.049],[.017,.038,.005],'trapper-front-lining')}
 else if(k==='boater'){crown([[.044,.048,.039],[.062,.048,.039]]);ellipsoid(g,a,[cx,0,.062],[.048,.039,.002],'boater-flat-top');brim(.077,.060);loop(g,c,[cx,0,.049],.048,.040,.002,'boater-ribbon');for(let i=0;i<6;i++)loop(g,b,[cx,0,.044+i*.00008],.051+i*.0045,.041+i*.0035,.00025,'woven-boater-straw')}
 else if(k==='bonnet'){crown([[.044,.055,.046],[.054,.051,.043],[.070,.041,.035]]);ellipsoid(g,a,[cx,0,.070],[.043,.036,.007],'bonnet-crown-top');const rim=ellipsoid(g,b,[.069,0,.046],[.018,.049,.002],'bonnet-frilled-front');rim.rotation.y=-.18;for(let i=0;i<14;i++){const t=-PI/2+i/13*PI;ellipsoid(g,c,[.073+.014*Math.cos(t),.044*Math.sin(t),.048],[.003,.004,.002],'bonnet-scallop')};for(const side of[-1,1])tube(g,c,[[.030,side*.042,.044],[.040,side*.046,.043]],.0013,'bonnet-cheek-bow-tail',10)}
 else if(k==='cycling'){crown([[.044,.054,.044],[.053,.046,.038],[.059,.028,.025]]);ellipsoid(g,a,[cx,0,.058],[.030,.025,.004],'cycling-low-top');ellipsoid(g,b,[.076,0,.045],[.025,.032,.0015],'cycling-short-visor');for(const y of[-.014,.014])tube(g,c,[[.071,y,.046],[.042,y,.059],[.008,y,.054]],.0007,'cycling-panel-binding',24)}
 else if(k==='jester'){crown([[.044,.051,.043],[.057,.044,.036]]);ellipsoid(g,a,[cx,0,.057],[.044,.036,.006],'jester-cap-base');for(const side of[-1,1]){tube(g,side===1?b:a,[[cx,side*.020,.057],[cx-.002,side*.031,.075],[cx+.003,side*.052,.083]],.008,'soft-jester-point',24);ellipsoid(g,c,[cx+.003,side*.052,.083],[.004,.004,.004],'jester-small-bell')}}
 else throw new Error(`Unknown headwear silhouette: ${k}`);
 return g;
}
function conformHat(g,item) {
 const pivot=new THREE.Vector3(.020,0,.044),angle=THREE.MathUtils.degToRad(item.design?.tilt??(item.kind==='beret'?-5:item.kind==='paint-beret'?5:0)),rotation=new THREE.Matrix4().makeRotationX(angle);
 let lowest=0;g.updateMatrixWorld(true);
 const coreNames=['shaped-crown','hatband','shaped-hat-crown','sailor-crown','chef-pleated-crown','new-tailored-crown','bent-wizard-hat'];
 for(const m of g.children)if(m.isMesh){m.updateMatrix();const geo=m.geometry.clone().applyMatrix4(m.matrix);m.geometry.dispose();m.geometry=geo;m.position.set(0,0,0);m.rotation.set(0,0,0);m.scale.set(1,1,1);const pos=geo.attributes.position;
  for(let i=0;i<pos.count;i++){const p=new THREE.Vector3().fromBufferAttribute(pos,i).sub(pivot).applyMatrix4(rotation).add(pivot);pos.setXYZ(i,p.x,p.y,p.z);if(coreNames.includes(m.name)&&Math.abs(p.y)<.034&&p.x>-.025&&p.x<.078)lowest=Math.min(lowest,p.z-.044)}
 }
 // The external crown and brim stay in one smooth, gently pitched plane.
 // A separate thin inner facing takes up the scalp curvature; it is the
 // actual support of the hat, rather than deforming the entire visible crown.
 const lift=.0023-lowest,seatPlane=(x,h)=>.0382+.070*(x-pivot.x)+h+lift;
 g.traverse(m=>{if(!m.isMesh)return;const pos=m.geometry.attributes.position;
  for(let i=0;i<pos.count;i++){
   const x=pos.getX(i),y=pos.getY(i),h=pos.getZ(i)-.044;
   pos.setXYZ(i,x,y,seatPlane(x,h)+(m.name==='curved-visor'?.0009:0));
  }
  m.geometry.computeVertexNormals();m.geometry.computeBoundingBox();
 });
 const vertices=[],indices=[],segments=72,rows=12,n=segments+1,side=rows*n;
 const soft=['beret','paint-beret','beanie','short-beanie','slouch-beanie'].includes(item.kind);
 const rx=soft?.053:.049,ry=soft?.044:.041;
 for(let layer=0;layer<2;layer++)for(let j=0;j<rows;j++)for(let i=0;i<=segments;i++){
  const t=j/(rows-1),theta=i/segments*PI*2;
  const p=new THREE.Vector3(.020+THREE.MathUtils.lerp(.036,rx,t)*Math.cos(theta),THREE.MathUtils.lerp(.025,ry,t)*Math.sin(theta),.044).sub(pivot).applyMatrix4(rotation).add(pivot);
  const scalp=new THREE.Vector3(p.x,p.y,headHeight(p.x,p.y)).addScaledVector(headNormal(p.x,p.y),.0018);
  const outerZ=seatPlane(p.x,p.z-.044);
  const point=new THREE.Vector3(THREE.MathUtils.lerp(scalp.x,p.x,t),THREE.MathUtils.lerp(scalp.y,p.y,t),THREE.MathUtils.lerp(scalp.z,outerZ,t)+(layer===0?.00035:-.00035));
  vertices.push(...point.toArray());
 }
 for(let layer=0;layer<2;layer++)for(let j=0;j<rows-1;j++)for(let i=0;i<segments;i++){
  const a=layer*side+j*n+i,b=a+n;indices.push(...(layer===0?[a,b,a+1,a+1,b,b+1]:[a,a+1,b,a+1,b+1,b]));
 }
 for(const j of[0,rows-1])for(let i=0;i<segments;i++){const a=j*n+i;indices.push(a,a+side,a+1,a+1,a+side,a+side+1)}
 const facing=new THREE.BufferGeometry();facing.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));facing.setIndex(indices);facing.computeVertexNormals();add(g,facing,mat(item.palette[0],{roughness:.95}),[0,0,0],[0,0,0],[1,1,1],'fitted-hat-inner-facing');
 g.userData.fittedHead=true;g.userData.tiltDegrees=THREE.MathUtils.radToDeg(angle);return g;
}
function hat(item) {
 if(['earmuffs','sportband','moon-pin','cloud-pin','antennae'].includes(item.kind))return fittedBand(item);
 const newer=['cloche','pillbox','trapper','boater','bonnet','cycling','jester'].includes(item.kind);
 return conformHat(newer?newHat(item):classicHat(item),item);
}

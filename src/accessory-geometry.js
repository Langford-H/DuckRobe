import * as THREE from 'three';
import { PI, mat, add, ellipsoid, tube, disk, softBox, facePatch, star, flower } from './garment-primitives.js';

const ALIASES = { cup: 'coffee', 'belt-pouch': 'pouch', paintbox: 'paint-palette', 'flower-basket': 'basket', rollmat: 'rolled-blanket' };
const CHEST = new Set(['camera','pouch','neck-scarf','bow-tie','pendant','medal','pocketwatch','brooch','ribbon-pin','charm']);
const BACK = new Set(['backpack','wings','rolled-blanket','rope-coil','mini-kite','garden-pack','guitarcase','satellite-pack']);

function motif(g,a,b,p,r,design={}) {
  if(design.motif==='plain')return;
  if(design.motif==='heart')facePatch(g,a,Array.from({length:32},(_,i)=>{const t=i*PI/16;return[p[1]+Math.sin(t)**3*r,p[2]+(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t))*r/16]}),p[0],.0008,'heart-embroidery');
  else if(design.motif==='leaf'){
    facePatch(g,a,[[p[1],p[2]+r],[p[1]+r*.65,p[2]],[p[1],p[2]-r],[p[1]-r*.65,p[2]]],p[0],.0008,'leaf-applique');
    tube(g,b,[[p[0]+.001,p[1],p[2]-r*.8],[p[0]+.001,p[1],p[2]+r*.7]],.0003,'leaf-vein',8);
  }else if(design.motif==='star')star(g,a,p,r);else flower(g,a,b,p,r);
}
function roundLoop(g,m,p,ry,rz,r=.0008,name='leather-loop') {
  tube(g,m,Array.from({length:32},(_,i)=>{const t=i*PI/16;return[p[0],p[1]+ry*Math.cos(t),p[2]+rz*Math.sin(t)]}),r,name,32,true);
}
function seamBox(g,m,[x,y,z],w,h,name='saddle-stitch') {
  tube(g,m,[[x,y-w/2,z+h/2],[x,y+w/2,z+h/2],[x,y+w/2,z-h/2],[x,y-w/2,z-h/2],[x,y-w/2,z+h/2]],.00035,name,24);
}
function handle(g,m,w=.013,h=.015,z=.016,x=0) {
  tube(g,m,[[x,-w/2,z],[x,-w/2-.003,z+h*.75],[x,0,z+h],[x,w/2+.003,z+h*.75],[x,w/2,z]],.0011,'stitched-carry-handle',24);
}
function sideMount(g,m) {
  // A short keeper below the collar; no strap encircles the robot's neck.
  tube(g,m,[[-.005,.007,.013],[-.011,.017,.019],[-.015,.025,.027]],.0013,'body-side-keeper',12);
  softBox(g,m,[-.015,.026,.026],[.003,.005,.005],.0008,'keeper-anchor');
}
function packHarness(g,m,b) {
  for(const s of[-1,1]){
    tube(g,m,[[-.008,s*.015,-.014],[-.009,s*.024,.008],[-.012,s*.020,.025]],.0017,'pack-harness',18);
    softBox(g,b,[.017,s*.012,-.001],[.0015,.0045,.006],.0006,'pack-buckle');
  }
}
function canopyPanel(g,m,panel) {
  const rows=10,cols=5,vertices=[],indices=[],n=cols+1,side=(rows+1)*n;
  for(const layer of[0,1])for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
    const r=.022*j/rows,t=(panel+i/cols)*PI/4;vertices.push(r*Math.cos(t),r*Math.sin(t),.050+.009*(1-(j/rows)**1.5)-layer*.0008);
  }
  for(const layer of[0,1])for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=layer*side+j*n+i,b=a+n;indices.push(...(layer?[a,b,a+1,a+1,b,b+1]:[a,a+1,b,a+1,b+1,b]))}
  for(const j of[0,rows])for(let i=0;i<cols;i++){const a=j*n+i;indices.push(a,a+side,a+1,a+1,a+side,a+side+1)}
  for(const i of[0,cols])for(let j=0;j<rows;j++){const a=j*n+i,b=a+n;indices.push(a,b,a+side,b,b+side,a+side)}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();
  add(g,geo,m,[0,0,0],[0,0,0],[1,1,1],'thick-umbrella-panel');
}

/** Independent torso objects in the stable Z-up anchor. Garment clearance is
 * applied by createOutfitParts identically to the preview and exported OBJ. */
export function accessory(item) {
  const g=new THREE.Group(),[a,b,c]=item.palette.map(color=>mat(color));
  const metal=mat('#b7ac8f',{metalness:.65,roughness:.34}),dark=mat('#33474b',{roughness:.25}),paper=mat('#efe6d0');
  const k=ALIASES[item.kind]||item.kind,region=item.region||(CHEST.has(k)?'chest':BACK.has(k)?'back':'side'),design=item.design||{};
  g.userData={region,fitEdgeDefault:region==='chest'?.055:region==='side'?-.053:-.062};
  g.position.set(...(region==='chest'?[.065,-.014,.021]:region==='back'?[-.077,0,.018]:[.018,-.074,.007]));
  if(region==='back')g.rotation.z=PI;

  if(k==='camera'){
    softBox(g,a,[0,0,0],[.016,.029,.020],.0025,'leather-camera-body');softBox(g,c,[.008,0,-.001],[.002,.029,.011],.001,'camera-grip');
    for(const[x,r,d]of[[.010,.0075,.006],[.014,.0064,.003]])disk(g,c,[x,0,0],r,d,'camera-lens-barrel');
    roundLoop(g,metal,[.016,0,0],.0062,.0062,.0007,'camera-lens-rim');disk(g,dark,[.0165,0,0],.0056,.001,'camera-glass');
    softBox(g,b,[.001,.008,.012],[.007,.009,.004],.0008,'camera-shutter-housing');disk(g,metal,[.002,-.008,.011],.0024,.0014,'camera-shutter','z');
    for(const s of[-1,1])tube(g,c,[[0,s*.014,.006],[-.007,s*.018,.014],[-.010,s*.017,.020]],.001,'camera-chest-tether',12);
  }else if(k==='pouch'){
    softBox(g,a,[0,0,-.003],[.015,.027,.025],.0035,'belt-pouch');softBox(g,b,[.008,0,.005],[.002,.028,.014],.002,'pouch-rounded-flap');
    seamBox(g,c,[.0095,0,-.003],.022,.019);disk(g,metal,[.010,0,.001],.002,.001,'pouch-snap');
    for(const s of[-1,1])softBox(g,c,[-.005,s*.011,.008],[.004,.003,.015],.001,'belt-loop');motif(g,b,c,[.010,0,-.008],.004,design);
  }else if(k==='bow-tie'||k==='ribbon-pin'){
    for(const s of[-1,1]){
      facePatch(g,a,[[s*.002,.002],[s*.016,.009],[s*.016,-.009],[s*.002,-.002]],0,.003,'folded-bow-lobe');tube(g,b,[[.003,s*.004,0],[.0035,s*.013,.005]],.00055,'bow-pleat',10);
      if(k==='ribbon-pin')facePatch(g,c,[[s*.002,-.002],[s*.011,-.004],[s*.012,-.020],[s*.007,-.016],[s*.003,-.019]],-.001,.0012,'ribbon-tail');
    }
    softBox(g,b,[.003,0,0],[.004,.005,.008],.001,'bow-knot');softBox(g,metal,[-.004,0,0],[.003,.011,.004],.0005,'body-badge-pin');
  }else if(k==='neck-scarf'){
    // A short, pinned chest fold, ending below the robot's collar.
    facePatch(g,a,[[-.015,.010],[.015,.010],[.006,-.014],[0,-.019],[-.006,-.014]],0,.0017,'pinned-neckerchief');
    tube(g,b,[[.002,-.014,.009],[.003,0,.002],[.002,.014,.009]],.0007,'folded-scarf-edge',16);softBox(g,c,[.003,0,.004],[.003,.006,.004],.0007,'scarf-pin-knot');
  }else if(k==='pendant'){
    softBox(g,c,[-.002,0,.010],[.003,.007,.007],.001,'pendant-body-pin');
    tube(g,metal,[[0,-.003,.009],[.001,0,.004],[0,.003,.009]],.00055,'short-pendant-setting',12);
    ellipsoid(g,mat('#f5eada',{roughness:.28,metalness:.08}),[.002,0,-.003],[.0055,.0055,.007],'pearl-drop');
    disk(g,metal,[.006,0,.001],.0025,.001,'pearl-cap');
    for(const s of[-1,1])ellipsoid(g,b,[0,s*.006,.004],[.0015,.0025,.0025],'pendant-side-bead');
  }else if(k==='charm'){
    for(const[y,z,r]of[[-.006,0,.005],[0,.003,.007],[.006,0,.005]])ellipsoid(g,b,[.001,y,z],[.0025,r,r*.75],'cloud-charm-lobe');
    softBox(g,b,[.001,0,-.001],[.004,.018,.005],.002,'cloud-flat-base');
    for(const s of[-1,1])tube(g,metal,[[0,s*.005,.004],[-.002,s*.007,.012]],.0007,'cloud-body-keeper',8);
    ellipsoid(g,a,[.003,0,-.008],[.0015,.0023,.0035],'cloud-raindrop-charm');
  }else if(k==='brooch'){
    flower(g,a,metal,[.001,0,0],.010);softBox(g,c,[-.003,0,0],[.003,.017,.004],.0008,'flower-brooch-pin');
    facePatch(g,b,[[.003,-.004],[.012,-.007],[.006,-.012]],-.001,.001,'brooch-leaf');
  }else if(['medal','pocketwatch'].includes(k)){
    const r=k==='pocketwatch'?.009:k==='medal'?.010:.007;disk(g,metal,[0,0,0],r,.0025,'body-badge-case');disk(g,k==='pocketwatch'?paper:b,[.002,0,0],r*.85,.0012,'enamel-badge-face');roundLoop(g,c,[.0027,0,0],r*.88,r*.88,.0006,'beaded-badge-rim');
    if(k==='pocketwatch'){
      for(let i=0;i<12;i++){const t=i*PI/6;disk(g,dark,[.0033,Math.sin(t)*.0064,Math.cos(t)*.0064],.0004,.0005,'watch-hour-mark')}
      tube(g,dark,[[.0038,0,0],[.0038,0,.0047]],.0004,'hour-hand',6);tube(g,dark,[[.0038,0,0],[.0038,-.004,-.0015]],.0003,'minute-hand',6);
      roundLoop(g,metal,[0,0,.011],.0025,.0025,.0007,'watch-crown');tube(g,metal,[[0,.002,.012],[-.003,.012,.015],[-.004,.022,.010]],.00055,'short-watch-chain',18);
    }else{motif(g,a,metal,[.0035,0,0],r*.65,design);if(k==='medal')facePatch(g,a,[[-.004,.009],[.004,.009],[.006,.020],[-.006,.020]],-.002,.0014,'medal-ribbon');else softBox(g,c,[-.003,0,.010],[.003,.007,.009],.001,'badge-keeper')}
  }else if(k==='tote'||k==='satchel'||k==='lunchbox'){
    const tote=k==='tote',lunch=k==='lunchbox',h=tote?.033:lunch?.023:.028;softBox(g,a,[0,0,0],[lunch?.020:.016,.025,h],.004,tote?'woven-tote':lunch?'rounded-lunchbox':'leather-satchel');seamBox(g,c,[.009,0,0],.021,h-.006);
    if(tote)for(const x of[-.004,.004])handle(g,b,.016,.016,h/2-.001,x);
    else{softBox(g,b,[.009,0,h*.23],[.003,.026,h*.45],.003,'fold-over-flap');disk(g,metal,[.011,0,0],.002,.001,'bag-turn-lock');handle(g,c,.012,.008,h/2)}
    motif(g,b,c,[.010,0,-.005],.005,design);sideMount(g,c);
  }else if(k==='backpack'||k==='garden-pack'){
    softBox(g,a,[.003,0,0],[.022,.040,.044],.006,'canvas-backpack');softBox(g,b,[.015,0,.008],[.003,.039,.024],.005,'pack-flap');softBox(g,a,[.017,0,-.012],[.006,.030,.018],.003,'pack-front-pocket');seamBox(g,c,[.0205,0,-.012],.026,.014);handle(g,c,.015,.010,.023);packHarness(g,c,metal);
    if(k==='garden-pack'){
      for(const s of[-1,1]){softBox(g,b,[.005,s*.026,-.008],[.011,.012,.017],.002,'garden-tool-pocket');tube(g,metal,[[.005,s*.026,-.003],[.005,s*.026,.025]],.001,'tool-shaft',8);softBox(g,c,[.005,s*.026,.022],[.006,.007,.012],.001,'wooden-tool-grip')}
      flower(g,b,c,[.018,0,.007],.006);
    }else motif(g,c,metal,[.018,0,.006],.006,design);
  }else if(k==='coffee'||k==='thermos'){
    const tall=k==='thermos',h=tall?.035:.025,r=tall?.0075:.009;add(g,new THREE.CylinderGeometry(r,r*.85,h,28),tall?a:b,[0,0,0],[PI/2,0,0],[1,1,1],tall?'insulated-thermos':'takeaway-cup');
    add(g,new THREE.CylinderGeometry(r*1.02,r*.94,tall?.010:.009,28),tall?b:a,[0,0,tall?-.004:0],[PI/2,0,0],[1,1,1],'textile-cup-sleeve');disk(g,c,[0,0,h/2+.0015],r*1.09,.003,'sealed-cup-lid','z');disk(g,b,[0,0,h/2+.0035],r*.73,.0015,'lid-top','z');
    if(tall){roundLoop(g,c,[0,0,h/2+.008],.004,.004,.0009,'thermos-carry-loop');tube(g,c,[[.007,-.003,-.007],[.008,0,0],[.007,.003,.007]],.0005,'bottle-mark',10)}else motif(g,c,b,[.009,0,0],.0035,design);sideMount(g,c);
  }else if(k==='watering'){
    ellipsoid(g,a,[0,0,0],[.012,.012,.017],'watering-can-body');disk(g,b,[0,0,.017],.010,.003,'watering-can-rim','z');tube(g,c,[[0,-.010,.009],[0,-.024,.016],[0,-.025,-.010],[0,-.010,-.010]],.002,'watering-can-handle');
    tube(g,a,[[.007,.008,-.003],[.013,.022,.005],[.020,.026,.019]],.0027,'long-watering-spout');disk(g,b,[.022,.026,.020],.006,.002,'watering-rose');for(const y of[-.002,0,.002])disk(g,metal,[.0232,.026+y,.020],.0005,.0005,'rose-hole');sideMount(g,c);
  }else if(k==='book'){
    softBox(g,c,[0,0,0],[.012,.024,.034],.0016,'hardback-cover');softBox(g,paper,[.007,0,0],[.003,.020,.029],.0006,'bound-book-pages');for(let i=0;i<6;i++)tube(g,b,[[.009,-.009,-.010+i*.004],[.009,.009,-.010+i*.004]],.00023,'page-edge',4);
    motif(g,a,c,[.0095,0,.002],.005,design);tube(g,a,[[.002,0,.017],[.004,.002,.023],[.004,.005,.017]],.0007,'ribbon-bookmark');sideMount(g,b);
  }else if(k==='skateboard'){
    const board=softBox(g,a,[0,0,0],[.062,.007,.020],.005,'wooden-skate-deck');board.rotation.y=-.28;
    for(const x of[-.020,.020]){tube(g,metal,[[x,-.009,-.006+x*.28],[x,.009,-.006+x*.28]],.0014,'skate-truck',8);for(const s of[-1,1])add(g,new THREE.CylinderGeometry(.004,.004,.003,20),b,[x,s*.009,-.006+x*.28],[0,0,0],[1,1,1],'skate-wheel')}
    motif(g,b,c,[.006,-.005,.006],.004,design);sideMount(g,c);
  }else if(k==='wings'){
    for(const s of[-1,1]){const upper=ellipsoid(g,b,[.003,s*.031,.010],[.003,.020,.026],'upper-fairy-wing');upper.rotation.x=s*-.3;const lower=ellipsoid(g,a,[.003,s*.030,-.011],[.003,.016,.017],'lower-fairy-wing');lower.rotation.x=s*.35;for(let i=0;i<4;i++)tube(g,c,[[.006,s*.009,.003],[.007,s*(.026+i*.004),.012+i*.004],[.006,s*(.029+i*.005),.029-i*.003]],.0004,'wing-vein',18)}
    softBox(g,c,[-.002,0,0],[.006,.015,.024],.002,'wing-body-mount');
  }else if(k==='star'){
    star(g,b,[.002,0,0],.012);star(g,c,[.0035,0,0],.006);tube(g,c,[[0,0,.012],[-.004,.006,.024],[-.014,.024,.027]],.0008,'star-body-tether',16);
  }else if(k==='basket'||k==='flower-bouquet'){
    if(k==='basket'){softBox(g,a,[0,0,-.003],[.018,.027,.022],.003,'woven-flower-basket');for(let i=0;i<6;i++)tube(g,c,[[.010,-.010+i*.004,-.011],[.011,-.010+i*.004,.006]],.0006,'basket-upright',8);for(let i=0;i<4;i++)tube(g,b,[[.0105,-.012,-.009+i*.004],[.011,.012,-.009+i*.004]],.0006,'basket-weave',8);handle(g,c,.021,.024,.006)}
    else{facePatch(g,b,[[-.014,.005],[.014,.005],[.006,-.018],[-.006,-.018]],-.003,.0012,'bouquet-paper-wrap');tube(g,c,[[.003,-.006,-.007],[.004,0,-.003],[.003,.006,-.007]],.0013,'bouquet-tie',12)}
    const green=mat('#718257');for(let i=0;i<5;i++){const y=(i-2)*.005,z=.017+Math.sin(i*1.8)*.003;tube(g,green,[[0,0,-.007],[.002,y,z]],.00065,'flower-stem',8);flower(g,i%2?a:b,c,[.005,y,z],.005)}sideMount(g,c);
  }else if(k==='umbrella'){
    // Entire canopy stays outside the head's side silhouette.
    g.position.y-=.023;for(let i=0;i<8;i++)canopyPanel(g,i%2?a:b,i);
    for(let i=0;i<8;i++){const t=i*PI/4;tube(g,c,[[0,0,.058],[.010*Math.cos(t),.010*Math.sin(t),.056],[.022*Math.cos(t),.022*Math.sin(t),.050]],.0005,'umbrella-rib',16)}
    tube(g,metal,[[0,0,.059],[0,0,-.019]],.001,'umbrella-shaft',6);tube(g,c,[[0,0,-.019],[0,0,-.028],[0,-.008,-.030],[0,-.010,-.022]],.0018,'curved-umbrella-handle',18);ellipsoid(g,c,[0,0,.060],[.0018,.0018,.003],'umbrella-tip');sideMount(g,c);
  }else if(k==='baguette'){
    ellipsoid(g,mat('#c69a63'),[0,0,.003],[.009,.008,.029],'baked-baguette');const crust=mat('#e4bf85');for(let i=0;i<4;i++){const slit=ellipsoid(g,crust,[.008,0,-.012+i*.010],[.0017,.006,.0017],'diagonal-bread-score');slit.rotation.x=.45}
    softBox(g,b,[-.001,0,-.011],[.017,.020,.024],.002,'bread-paper-sleeve');motif(g,a,c,[.0095,0,-.010],.004,design);sideMount(g,c);
  }else if(k==='binoculars'){
    for(const s of[-1,1]){disk(g,a,[0,s*.008,0],.007,.023,'binocular-barrel');disk(g,c,[.012,s*.008,0],.0075,.002,'binocular-end-ring');disk(g,dark,[.0132,s*.008,0],.006,.0008,'binocular-glass');disk(g,b,[-.013,s*.008,0],.0048,.004,'binocular-eyecup')}
    softBox(g,metal,[0,0,0],[.006,.012,.005],.001,'binocular-bridge');disk(g,c,[0,0,.006],.0028,.003,'focus-wheel','z');sideMount(g,c);
  }else if(k==='paint-palette'){
    ellipsoid(g,a,[0,0,0],[.0035,.016,.021],'wooden-paint-palette');for(let i=0;i<5;i++){const t=(i*.23+.12)*PI;ellipsoid(g,mat(['#9d6657','#6f9299','#ceb065','#778b65','#9b81a0'][i]),[.004,Math.cos(t)*.011,Math.sin(t)*.014],[.001,.003,.0034],'raised-paint-dab')}
    roundLoop(g,c,[.004,-.006,-.009],.003,.003,.0008,'palette-thumb-ring');tube(g,c,[[-.002,.011,-.017],[.001,.014,.023]],.001,'paintbrush-handle',8);softBox(g,paper,[.001,.014,.025],[.003,.003,.009],.0006,'paintbrush-tip');sideMount(g,b);
  }else if(k==='guitar'||k==='guitarcase'){
    const casing=k==='guitarcase';for(const[z,ry,rz]of[[-.008,.015,.018],[.009,.011,.013]])ellipsoid(g,a,[0,0,z],[casing?.008:.0045,ry,rz],casing?'fitted-guitar-case':'guitar-body-lobe');softBox(g,c,[0,0,.032],[.006,.007,.032],.001,'guitar-neck');softBox(g,b,[0,0,.050],[.007,.010,.010],.001,'guitar-headstock');
    if(casing){seamBox(g,c,[.008,0,-.004],.020,.030,'case-edge-stitch');handle(g,c,.012,.007,.010,.007);packHarness(g,c,metal)}
    else{disk(g,dark,[.005,0,.006],.005,.0008,'guitar-sound-hole');softBox(g,c,[.006,0,-.012],[.002,.015,.003],.0005,'guitar-bridge');for(const y of[-.002,-.0007,.0007,.002])tube(g,metal,[[.006,y,-.012],[.005,y,.049]],.00016,'guitar-string',6);for(let i=0;i<6;i++)tube(g,metal,[[.003,-.003,.018+i*.004],[.003,.003,.018+i*.004]],.00022,'guitar-fret',4);sideMount(g,c)}
  }else if(k==='tennis-racket'){
    roundLoop(g,a,[0,0,.021],.014,.019,.0017,'racket-frame');for(let i=-3;i<=3;i++){const y=i*.0034,z=i*.0045,h=.0175*Math.sqrt(1-(y/.014)**2),w=.0125*Math.sqrt(1-(z/.019)**2);tube(g,paper,[[0,y,.021-h],[0,y,.021+h]],.00023,'vertical-racket-string',4);tube(g,paper,[[0,-w,.021+z],[0,w,.021+z]],.00023,'horizontal-racket-string',4)}
    tube(g,c,[[0,-.005,.005],[0,0,-.006],[0,.005,.005]],.0012,'racket-throat',12);softBox(g,b,[0,0,-.016],[.005,.006,.020],.001,'wrapped-racket-handle');for(let i=0;i<4;i++)tube(g,c,[[.003,-.003,-.024+i*.004],[.003,.003,-.022+i*.004]],.00035,'grip-wrap',4);sideMount(g,c);
  }else if(k==='lantern'){
    disk(g,c,[0,0,-.016],.011,.004,'lantern-base','z');disk(g,b,[0,0,.016],.011,.004,'lantern-cap','z');add(g,new THREE.CylinderGeometry(.008,.008,.029,24),mat('#ecd3a1',{transparent:true,opacity:.65}),[0,0,0],[PI/2,0,0],[1,1,1],'lantern-glass');
    for(const s of[-1,1])for(const x of[-.006,.006])tube(g,metal,[[x,s*.006,-.015],[x,s*.006,.015]],.00075,'lantern-cage',8);ellipsoid(g,a,[0,0,-.006],[.0035,.0035,.006],'lantern-wick');handle(g,c,.018,.014,.018);sideMount(g,c);
  }else if(k==='fan'){
    for(let i=0;i<9;i++){const t=-PI*.42+i/8*PI*.84,next=t+PI*.105;facePatch(g,i%2?a:b,[[0,-.009],[Math.sin(t)*.025,-.009+Math.cos(t)*.025],[Math.sin(next)*.025,-.009+Math.cos(next)*.025]],0,.0012,'pleated-fan-leaf');tube(g,c,[[.002,0,-.013],[.002,Math.sin(t)*.025,-.009+Math.cos(t)*.025]],.00045,'fan-rib',8)}disk(g,metal,[.003,0,-.010],.0016,.002,'fan-rivet');sideMount(g,c);
  }else if(k==='microphone'){
    add(g,new THREE.CylinderGeometry(.0035,.004,.026,24),c,[0,0,-.004],[PI/2,0,0],[1,1,1],'microphone-grip');ellipsoid(g,metal,[0,0,.015],[.007,.007,.0085],'microphone-mesh-head');for(let i=0;i<5;i++)roundLoop(g,dark,[.006,-.001,.010+i*.002],.0022,.001,.00022,'microphone-grille');tube(g,c,[[0,0,-.018],[.001,-.006,-.025],[-.009,-.012,-.028],[-.014,.020,.001]],.0007,'coiled-mic-cable',24);sideMount(g,b);
  }else if(k==='rolled-blanket'){
    add(g,new THREE.CylinderGeometry(.011,.011,.045,28),a,[.001,0,0],[0,0,0],[1,1,1],'rolled-camp-mat');
    for(const s of[-1,1]){const end=disk(g,b,[.001,s*.023,0],.010,.001,'mat-roll-end');end.rotation.set(0,0,0);tube(g,c,Array.from({length:32},(_,i)=>{const t=i*PI/16;return[.001+.0115*Math.cos(t),s*.013,.0115*Math.sin(t)]}),.0011,'mat-leather-tie',32,true)}tube(g,c,[[-.004,-.010,.012],[-.005,-.010,.025],[-.005,.010,.025],[-.004,.010,.012]],.0013,'rollmat-body-keeper');
  }else if(k==='rope-coil'){
    for(let i=0;i<5;i++)roundLoop(g,i%2?a:b,[.003+i*.0013,0,0],.017-i*.0008,.022-i*.0008,.0014,'coiled-climbing-rope');tube(g,c,[[.011,0,-.016],[.012,0,.016]],.0021,'rope-binding',8);tube(g,metal,[[.010,.012,-.012],[.011,.020,-.014],[.011,.021,-.004],[.010,.013,-.003]],.001,'carabiner',16);packHarness(g,c,metal);
  }else if(k==='mini-kite'){
    for(const s of[-1,1])facePatch(g,s<0?a:b,[[0,.028],[s*.023,.003],[0,-.029]],.002,.0013,'diamond-kite-panel');tube(g,c,[[.004,0,.028],[.004,0,-.029]],.00065,'kite-spine',8);tube(g,c,[[.004,-.023,.003],[.004,.023,.003]],.00065,'kite-cross-spar',8);tube(g,c,[[.002,0,-.028],[.002,.007,-.037],[.002,-.002,-.041]],.00065,'kite-tail',14);
    for(const z of[-.034,-.040])for(const s of[-1,1])ellipsoid(g,b,[.003,s*.003,z],[.0008,.004,.002],'kite-tail-bow');softBox(g,c,[-.003,0,0],[.005,.013,.020],.0015,'kite-body-clip');
  }else if(k==='satellite-pack'){
    softBox(g,a,[.002,0,0],[.022,.029,.039],.004,'miniature-satellite-pack');softBox(g,b,[.015,0,.006],[.002,.023,.015],.002,'pack-control-panel');
    for(const s of[-1,1]){tube(g,metal,[[.001,s*.014,.002],[.003,s*.028,.002]],.0013,'solar-panel-boom',8);softBox(g,dark,[.003,s*.037,.001],[.002,.026,.033],.001,'solar-panel');for(let i=0;i<4;i++)tube(g,b,[[.0045,s*.037-.010,-.011+i*.007],[.0045,s*.037+.010,-.011+i*.007]],.00035,'solar-cell-row',4);tube(g,b,[[.0045,s*.037,-.014],[.0045,s*.037,.016]],.00035,'solar-cell-bus',4)}
    tube(g,metal,[[0,0,.018],[.001,.006,.037]],.0008,'backpack-radio-aerial',10);ellipsoid(g,c,[.001,.006,.038],[.002,.002,.002],'aerial-tip');packHarness(g,c,metal);
  }else throw new Error(`Unknown tailored accessory: ${item.kind}`);
  return g;
}

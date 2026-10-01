import { createGarment } from './garment-geometry.js';

// Metres, +X forward / +Z up; independent items use the original CAD anchors.
export const SLOT_IDS = ['hat', 'eyewear', 'body', 'accessory', 'legwear'];
export const THEMES = [
  { id: 'everyday', name: '日常好心情', en: 'Everyday', color: '#f0dbae' },
  { id: 'outdoors', name: '出门去玩', en: 'Outdoors', color: '#cbd8ba' },
  { id: 'studio', name: '小小工作室', en: 'At the studio', color: '#e6c6b2' },
  { id: 'sport', name: '动起来', en: 'Play club', color: '#c7d8dd' },
  { id: 'heritage', name: '旧时光', en: 'Heritage', color: '#d4cbbd' },
  { id: 'wonder', name: '一点点魔法', en: 'A little wonder', color: '#d8c9e3' },
];
const COLLECTION = [
  ['butter-walk','奶油散步','Butter walk','everyday','慢慢散步，把阳光装进口袋。','A little sunshine, tucked into a cable-knit pocket.',['#e7c58d','#fff1db','#9a6847'],['beret','round','cardigan','tote','loafers']],
  ['harbour-day','海盐假日','Harbour day','everyday','立体水手领，和海风一起出发。','A Breton knit and a crisp sailor collar, ready for a sea breeze.',['#315975','#f3efe4','#c77e51'],['sailor','clear','breton',null,'sneakers']],
  ['pocket-garden','口袋花园','Pocket garden','everyday','花园色的背带裤里藏着小种子。','Denim dungarees with a tiny pocket for big little plans.',['#4c7181','#dce5c8','#d9a56b'],['bucket',null,'dungarees','watering','sneakers']],
  ['sunday-linen','周日亚麻','Sunday linen','everyday','柔软裙摆，转个圈就是周末。','A gathered linen dress made for slow Sunday twirls.',['#c9958f','#f5e3c6','#747e62'],['straw','cat-eye','linen-dress','satchel','ballet']],
  ['rain-check','雨天约定','Rain check','outdoors','双层雨披和小雨靴，雨天也要去玩。','A layered rain cape and wellies for puddle-sized adventures.',['#dfa637','#f1e2bf','#537d74'],['rainhood',null,'rain-cape','pouch','wellies']],
  ['alpine-cloud','山间云朵','Alpine cloud','outdoors','绗缝羽绒小马甲，暖得刚刚好。','A quilted puffer vest with room for mountain air.',['#7f9e9c','#e8dfcf','#b77550'],['beanie','sport','puffer','backpack','trail']],
  ['forest-post','森林来信','Forest post','outdoors','翻盖口袋和轻巧风衣，收集沿途的风景。','A field parka, made to collect forest postcards.',['#78895d','#e4c39c','#754d3d'],['trailcap','aviator','parka','camera','boots']],
  ['safari-notes','野外笔记','Safari notes','outdoors','多口袋探险马甲，给好奇心留足位置。','An open utility vest for every little discovery.',['#c4a579','#f0e2c7','#626d50'],['safari','sunglasses','utility-vest','pouch','trail']],
  ['clay-day','陶艺日','Clay day','studio','工装小外套，今天把好心情做成形状。','A rounded chore jacket for happy, hands-on days.',['#a96d51','#eacdaf','#5c786e'],['workcap','clear','chore','satchel','boots']],
  ['coffee-break','咖啡时间','Coffee break','studio','交叉背带围裙，今日特供是好心情。','A cross-back apron and a tiny cup of something lovely.',['#88624c','#eee0c9','#9eaf91'],['short-beanie','round','apron','coffee','loafers']],
  ['colour-study','色彩练习','Colour study','studio','宽松罩衣和画家帽，为今天画个笑脸。','A roomy artist smock with a pleated yoke.',['#709299','#ecdab9','#c98165'],['paint-beret','clear','smock','book',null]],
  ['little-chef','小小主厨','Little chef','studio','双排扣厨师服，做一份奶油味的快乐。','Double-breasted chef whites with piping good enough to eat.',['#eee9de','#a7b79c','#725e4d'],['toque',null,'chef','coffee','loafers']],
  ['campus-club','校园俱乐部','Campus club','sport','拼接棒球外套，今天也是快乐队员。','A varsity bomber with ribbed cuffs and a little club badge.',['#6d8871','#f1ddbc','#bc6a52'],['baseball','sunglasses','varsity','book','high-top']],
  ['morning-laps','晨风慢跑','Morning laps','sport','弧线拼色运动服，跟着晨风跳一跳。','A curved-panel track jacket for a cheerful warm-up.',['#5e8995','#dae7dc','#dfb467'],['visor','sport','track','pouch','sneakers']],
  ['court-date','球场见','Court date','sport','针织小翻领，下午三点去球场见。','A knitted tennis polo, ready for a court date.',['#e8dab6','#6f8f6b','#b7868d'],['sportband',null,'polo',null,'socks']],
  ['sidewalk-skater','街角滑板','Sidewalk skater','sport','袋鼠口袋卫衣，小鸭今天有点酷。','A cropped hoodie, kangaroo pocket, and a board for the block.',['#948ba9','#edd6b7','#668986'],['slouch-beanie','sunglasses','hoodie','skateboard','high-top']],
  ['morning-paper','早报送达','Morning paper','heritage','人字纹小马甲，头条是今天阳光很好。','A tailored tweed waistcoat with today’s good news.',['#9a8a70','#efdfc5','#54695e'],['newsboy','round','waistcoat','satchel','loafers']],
  ['old-salt','老船长','Old salt','heritage','圆弧海军外套，口袋里是海边的故事。','A soft double-breasted peacoat, full of harbour stories.',['#3d5569','#e3cc9b','#a77a53'],['naval','aviator','peacoat','camera','boots']],
  ['left-bank','左岸午后','Left-bank afternoon','heritage','收腰小风衣，绕着安静的街角走一圈。','A belted miniature trench with a storm flap and curved lapels.',['#c5a887','#f0e1c6','#725544'],['fedora','cat-eye','trench','tote','loafers']],
  ['cosy-records','暖调唱片','Cosy records','heritage','麻花针织衫和耳罩，听一首温暖的歌。','A cable pullover and earmuffs for a warm little song.',['#c48674','#efd9ba','#83758a'],['earmuffs','round','cable-knit','coffee','legwarmers']],
  ['moon-garden','月亮花园','Moon garden','wonder','层层花瓣轻轻展开，跳一支月光舞。','Layered petal skirts, a moon pin, and one small enchantment.',['#b799b6','#efdbbc','#92ab9b'],['moon-pin','cat-eye','petal-dress','wings','ballet']],
  ['library-spell','图书馆魔法','Library spell','wonder','星星斗篷披好，去读一个新的故事。','A draped star cape and a book of pocket-sized spells.',['#71678e','#e4cc93','#b49aaf'],['wizard','round','wizard-cape','book','boots']],
  ['cloud-postcard','云间明信片','Cloud postcard','wonder','交叠和服与小星星，寄给你一朵云。','An overlapping kimono jacket, sealed with a little star.',['#a9bec2','#eee0c6','#b39bba'],['cloud-pin','clear','kimono','star','socks']],
  ['honey-delivery','蜂蜜派送','Honey delivery','wonder','花边小围裙，今天派送一份蜂蜜甜。','A honey-striped pinafore, tiny antennae, and a winged hello.',['#d7b44f','#f3e3bd','#77634b'],['antennae',null,'pinafore','wings','sneakers']],
];
const NAMES = {
  beret:['羊毛贝雷帽','Wool beret'],round:['单框圆镜','Round monocle'],cardigan:['麻花开衫','Cable cardigan'],tote:['帆布手提包','Canvas tote'],loafers:['软底乐福鞋','Little loafers'],sailor:['水手帽','Sailor cap'],clear:['透明单镜','Crystal eyepiece'],breton:['海盐条纹衫','Breton knit'],sneakers:['帆布运动鞋','Canvas sneakers'],bucket:['缝线渔夫帽','Stitched bucket hat'],dungarees:['牛仔背带裤','Denim dungarees'],watering:['迷你洒水壶','Little watering can'],straw:['编织草帽','Woven sunhat'],'cat-eye':['猫眼单镜','Cat-eye eyepiece'],'linen-dress':['收褶亚麻裙','Gathered linen dress'],satchel:['小邮差包','Leather satchel'],ballet:['蝴蝶结软鞋','Ribbon slippers'],rainhood:['雨天小帽','Rain bonnet'],'rain-cape':['双层雨披','Layered rain cape'],pouch:['腰间小包','Utility pouch'],wellies:['波点小雨靴','Puddle wellies'],beanie:['绒球针织帽','Pom beanie'],sport:['运动护目单镜','Sport shield'],puffer:['绗缝羽绒马甲','Quilted puffer vest'],backpack:['翻盖小背包','Trail backpack'],trail:['徒步小鞋','Trail shoes'],trailcap:['山野五片帽','Five-panel trail cap'],aviator:['飞行员单镜','Aviator monocle'],parka:['口袋风衣','Field parka'],camera:['复古小相机','Tiny camera'],boots:['系带小短靴','Lace-up boots'],safari:['探险小帽','Safari hat'],sunglasses:['单框墨镜','Sun shield'],'utility-vest':['探险马甲','Utility vest'],workcap:['工装小帽','Workwear cap'],chore:['工装短外套','Chore jacket'],'short-beanie':['短款针织帽','Watch cap'],apron:['交叉背带围裙','Cross-back apron'],coffee:['外带咖啡','Coffee to go'],'paint-beret':['画家贝雷帽','Artist beret'],smock:['褶裥画家罩衣','Pleated artist smock'],book:['口袋小书','Pocket book'],toque:['褶纹厨师帽','Pleated chef hat'],chef:['双排扣厨师服','Chef whites'],baseball:['拼片棒球帽','Six-panel cap'],varsity:['校园棒球外套','Varsity bomber'],'high-top':['高帮帆布鞋','High-top sneakers'],visor:['运动遮阳帽','Sport visor'],track:['弧线运动外套','Track jacket'],sportband:['柔软运动发带','Sport headband'],polo:['针织网球衫','Tennis polo'],socks:['条纹袜套','Striped ankle socks'],'slouch-beanie':['松软针织帽','Slouch beanie'],hoodie:['口袋卫衣','Kangaroo hoodie'],skateboard:['小滑板','Mini skateboard'],newsboy:['八片报童帽','Newsboy cap'],waistcoat:['人字纹马甲','Tweed waistcoat'],naval:['海军帽','Naval cap'],peacoat:['海军双排扣外套','Peacoat'],fedora:['软毡礼帽','Felt fedora'],trench:['收腰小风衣','Belted trench'],earmuffs:['毛绒耳罩','Plush earmuffs'],'cable-knit':['麻花针织衫','Cable pullover'],legwarmers:['针织暖腿套','Knit leg warmers'],'moon-pin':['月亮花冠','Moon bloom crown'],'petal-dress':['叠层花瓣裙','Layered petal dress'],wings:['轻盈小翅膀','Little wings'],wizard:['星星魔法帽','Starry wizard hat'],'wizard-cape':['垂褶星空斗篷','Draped star cape'],'cloud-pin':['云朵发夹','Cloud hair pin'],kimono:['交叠小和服','Wrap kimono'],star:['星星小挂饰','Star charm'],antennae:['小蜜蜂触角','Honey antennae'],pinafore:['蜂蜜花边围裙','Honey pinafore'],
};
export const ITEMS = COLLECTION.flatMap(row=>row[7].flatMap((kind,index)=>kind?[{
  id:`${row[0]}-${SLOT_IDS[index]}`,slot:SLOT_IDS[index],kind,theme:row[3],palette:[...row[6]],name:NAMES[kind][0],en:NAMES[kind][1],description:row[4],descriptionEn:row[5],outfitId:row[0],
}]:[]));
export const OUTFITS = COLLECTION.map(row=>({id:row[0],name:row[1],en:row[2],theme:row[3],description:row[4],descriptionEn:row[5],palette:[...row[6]],selection:Object.fromEntries(SLOT_IDS.map((slot,index)=>[slot,row[7][index]?`${row[0]}-${slot}`:null]))}));
const BY_ITEM_ID = new Map(ITEMS.map(item=>[item.id,item]));
export function createOutfitParts(selection={}) {
  return SLOT_IDS.flatMap(slot=>{
    const item=BY_ITEM_ID.get(selection[slot]);if(!item||item.slot!==slot)return[];
    return createGarment(item).map(({bodyName,group},index)=>{
      group.name=`duckrobe:${slot}:${item.id}:${index}`;group.userData={slot,itemId:item.id,outfitId:item.outfitId,kind:item.kind};
      group.traverse(child=>{if(child.isMesh)child.name=`${slot}:${item.kind}:${child.name||'detail'}`});
      return{slot,itemId:item.id,bodyName,group};
    });
  });
}
export function attachOutfitParts(robot,selection) {
  const parts=createOutfitParts(selection);parts.forEach(part=>{const anchor=robot.anchors.get(part.bodyName);if(!anchor)throw new Error(`Missing Microduck clothing anchor: ${part.bodyName}`);anchor.add(part.group)});return parts;
}

import { createGarment } from './garment-geometry.js';
import * as THREE from 'three';

// Metres, +X forward / +Z up; independent items use the original CAD anchors.
export const SLOT_IDS = ['hat', 'eyewear', 'body', 'accessory', 'legwear'];
export const ACCESSORY_REGIONS = ['chest', 'side', 'back'];
export const THEMES = [
  { id: 'everyday', name: '日常好心情', en: 'Everyday', color: '#f0dbae' },
  { id: 'outdoors', name: '出门去玩', en: 'Outdoors', color: '#cbd8ba' },
  { id: 'studio', name: '小小工作室', en: 'At the studio', color: '#e6c6b2' },
  { id: 'sport', name: '动起来', en: 'Play club', color: '#c7d8dd' },
  { id: 'heritage', name: '旧时光', en: 'Heritage', color: '#d4cbbd' },
  { id: 'city', name: '城市慢生活', en: 'City life', color: '#c4d3d8' },
  { id: 'weekend', name: '周末小旅行', en: 'Little weekends', color: '#e2d5bb' },
  { id: 'seasons', name: '四季的温度', en: 'Four seasons', color: '#d6c6bb' },
  { id: 'celebration', name: '快乐纪念日', en: 'Small celebrations', color: '#e5c4cd' },
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
// Shared pieces are designed once, then used across complete looks. Existing
// pieces retain their IDs so saved wardrobes from the original 24 still work.
const PALETTES = {
  oat: ['#c9ad83','#f0e0c3','#80634b'], moss: ['#7b8d6b','#e4dac2','#ba8c58'],
  clay: ['#b88670','#f2dcc4','#627d73'], ink: ['#46657a','#eadfc8','#bd906b'],
  rose: ['#c38f99','#f4dfd4','#8e796e'], lilac: ['#a295b5','#ece0ce','#777f91'],
  mist: ['#92afb0','#e9e2cb','#b98d73'], butter: ['#d9bb6d','#f6e9c8','#879277'],
  berry: ['#98677b','#eed9c8','#7c8b72'], forest: ['#506e60','#eadac0','#bf8b63'],
};
const shared = (key, slot, kind, name, en, palette, design = {}, theme = 'everyday', region) => ({
  id: `${slot}-${key}`, slot, kind, name, en, palette: [...PALETTES[palette]], design,
  theme, description: name, descriptionEn: en, ...(region ? { region } : {}),
});
const SHARED_ITEMS = [
  shared('duffle-toggle','body','duffle','燕麦牛角扣大衣','Oat toggle duffle','oat',{cut:'long',closure:'toggle',detail:'pockets',sleeve:'raglan'},'seasons'),
  shared('duffle-scout','body','duffle','短款侦察牛角扣','Cropped scout duffle','forest',{cut:'cropped',closure:'toggle',detail:'patches',hem:'asymmetric'},'outdoors'),
  shared('biker-zip','body','biker','斜襟机车短夹克','Asymmetric biker jacket','ink',{cut:'cropped',closure:'zip',hem:'asymmetric',detail:'ribbed'},'city'),
  shared('biker-soft','body','biker','软皮落肩夹克','Soft leather riding jacket','clay',{cut:'regular',closure:'zip',sleeve:'raglan',detail:'pockets'},'heritage'),
  shared('wrap-tea','body','wrap-dress','交叠茶歇裙','Tea-time wrap dress','rose',{cut:'long',closure:'wrap',sleeve:'bell',hem:'asymmetric'},'weekend'),
  shared('wrap-check','body','wrap-dress','格纹交叠短裙','Checked wrap dress','moss',{cut:'regular',closure:'bow',sleeve:'short',pattern:'check'},'everyday'),
  shared('pleated-gallery','body','pleated-dress','画廊百褶长裙','Gallery pleated dress','lilac',{cut:'long',detail:'pleats',sleeve:'none',closure:'buttons'},'city'),
  shared('pleated-court','body','pleated-dress','球场条纹褶裙','Court striped pleated dress','butter',{cut:'cropped',detail:'pleats',sleeve:'short',pattern:'stripe'},'sport'),
  shared('poncho-field','body','poncho','不对称山野披衣','Asymmetric field poncho','moss',{cut:'long',hem:'asymmetric',closure:'toggle',detail:'pockets'},'outdoors'),
  shared('poncho-cloud','body','poncho','云边波浪雨披','Scalloped cloud poncho','mist',{cut:'regular',hem:'scallop',closure:'bow',pattern:'dots'},'seasons'),
  shared('jersey-court','body','jersey','拼色无袖球衣','Colour-block court jersey','clay',{cut:'cropped',sleeve:'none',pattern:'stripe',detail:'patches'},'sport'),
  shared('jersey-club','body','jersey','插肩棒球球衣','Raglan baseball jersey','ink',{cut:'regular',sleeve:'raglan',closure:'buttons',detail:'patches'},'sport'),
  shared('hanfu-blossom','body','hanfu','花枝交领汉服','Blossom crossed-collar hanfu','rose',{cut:'long',sleeve:'bell',closure:'wrap',pattern:'petals'},'celebration'),
  shared('hanfu-lantern','body','hanfu','短款灯会交领衫','Lantern crossed-collar jacket','butter',{cut:'cropped',sleeve:'short',closure:'wrap',hem:'asymmetric'},'celebration'),
  shared('fleece-weekend','body','fleece','周末拉链抓绒','Weekend zip fleece','oat',{cut:'regular',closure:'zip',sleeve:'raglan',detail:'ribbed'},'seasons'),
  shared('fleece-camp','body','fleece','长款绒绒露营服','Long camp fleece','forest',{cut:'long',closure:'toggle',detail:'pockets',sleeve:'puff'},'outdoors'),
  shared('bolero-ballet','body','bolero','泡泡袖芭蕾小外套','Puff-sleeve ballet bolero','rose',{cut:'cropped',sleeve:'puff',closure:'bow',hem:'scallop'},'celebration'),
  shared('bolero-jazz','body','bolero','喇叭袖爵士短衫','Bell-sleeve jazz bolero','berry',{cut:'cropped',sleeve:'bell',closure:'buttons',detail:'ruffles'},'heritage'),
  shared('quilted-olive','body','quilted-jacket','橄榄菱格夹克','Olive diamond quilt jacket','moss',{cut:'regular',closure:'zip',detail:'quilted',sleeve:'raglan'},'seasons'),
  shared('quilted-long','body','quilted-jacket','长款绗缝棉服','Long quilted coat','mist',{cut:'long',closure:'buttons',detail:'quilted',sleeve:'puff'},'seasons'),
  shared('tunic-linen','body','tunic','亚麻不对称长衫','Asymmetric linen tunic','oat',{cut:'long',hem:'asymmetric',sleeve:'short',closure:'buttons'},'weekend'),
  shared('tunic-patch','body','tunic','拼布喇叭袖罩衫','Patchwork bell-sleeve tunic','clay',{cut:'regular',sleeve:'bell',detail:'patches',hem:'scallop'},'studio'),
  shared('shell-cyclist','body','shell-vest','轻量骑行风壳','Light cycling shell vest','mist',{cut:'cropped',sleeve:'none',closure:'zip',hem:'asymmetric'},'sport'),
  shared('shell-pocket','body','shell-vest','多口袋户外风壳','Pocketed outdoor shell','forest',{cut:'long',sleeve:'none',closure:'buttons',detail:'pockets'},'outdoors'),
  shared('balloon-birthday','body','balloon-dress','泡泡生日裙','Birthday balloon dress','rose',{cut:'regular',hem:'bubble',sleeve:'puff',closure:'bow'},'celebration'),
  shared('balloon-berry','body','balloon-dress','莓果无袖灯笼裙','Berry sleeveless balloon dress','berry',{cut:'long',hem:'bubble',sleeve:'none',detail:'pleats'},'weekend'),
  shared('capelet-scallop','body','capelet','波浪边小斗篷','Scalloped little capelet','lilac',{cut:'cropped',hem:'scallop',closure:'bow',detail:'ruffles'},'seasons'),
  shared('capelet-arrow','body','capelet','斜摆牛角扣肩披','Asymmetric toggle capelet','ink',{cut:'long',hem:'asymmetric',closure:'toggle',detail:'pockets'},'outdoors'),
  shared('rugby-stripe','body','rugby','横条纹橄榄球衫','Striped rugby shirt','forest',{cut:'cropped',sleeve:'raglan',pattern:'stripe',closure:'buttons'},'sport'),
  shared('rugby-college','body','rugby','学院拼章橄榄球衫','College patch rugby shirt','berry',{cut:'long',sleeve:'raglan',detail:'patches',closure:'buttons'},'city'),
  shared('workshirt-check','body','workshirt','格纹双袋工作衬衫','Checked two-pocket workshirt','clay',{cut:'regular',sleeve:'short',pattern:'check',closure:'buttons'},'studio'),
  shared('workshirt-wrap','body','workshirt','交叠长袖工装衫','Wrapped long workshirt','ink',{cut:'long',sleeve:'bell',closure:'wrap',detail:'pockets'},'studio'),
  shared('cloche-bloom','hat','cloche','花簇钟形帽','Bloom cloche','rose',{hem:'scallop',detail:'ruffles',tilt:-5},'heritage'),
  shared('cloche-check','hat','cloche','格纹深冠钟形帽','Checked deep cloche','oat',{pattern:'check',detail:'ribbed',tilt:4},'city'),
  shared('pillbox-ribbon','hat','pillbox','丝带小圆礼帽','Ribbon pillbox','lilac',{closure:'bow',detail:'pleats',tilt:-7},'celebration'),
  shared('pillbox-pin','hat','pillbox','别针平顶礼帽','Pinned pillbox','ink',{detail:'patches',pattern:'stripe',tilt:3},'heritage'),
  shared('trapper-plush','hat','trapper','毛绒护耳猎帽','Plush trapper','oat',{detail:'quilted',closure:'toggle'},'seasons'),
  shared('trapper-field','hat','trapper','山野短护耳帽','Field trapper','forest',{cut:'cropped',pattern:'check',detail:'pockets'},'outdoors'),
  shared('boater-ribbon','hat','boater','平顶缎带草帽','Ribbon boater','butter',{closure:'bow',detail:'ribbed',tilt:-4},'weekend'),
  shared('boater-stripe','hat','boater','条纹平顶小礼帽','Striped boater','ink',{pattern:'stripe',detail:'pleats',tilt:4},'city'),
  shared('bonnet-lace','hat','bonnet','荷叶边系带软帽','Lace tie bonnet','rose',{hem:'scallop',closure:'bow',detail:'ruffles'},'weekend'),
  shared('bonnet-garden','hat','bonnet','花园遮阳系带帽','Garden tie bonnet','moss',{pattern:'petals',closure:'bow',detail:'pleats'},'outdoors'),
  shared('cycling-road','hat','cycling','公路流线头盔','Road cycling helmet','mist',{pattern:'stripe',detail:'ribbed'},'sport'),
  shared('cycling-city','hat','cycling','城市短檐头盔','City visor helmet','clay',{cut:'cropped',detail:'patches'},'city'),
  shared('jester-bells','hat','jester','铃铛双角小丑帽','Twin-bell jester cap','lilac',{detail:'ruffles',pattern:'dots'},'wonder'),
  shared('jester-patch','hat','jester','拼布软角节日帽','Patchwork jester cap','butter',{detail:'patches',hem:'asymmetric'},'celebration'),
  shared('mary-jane','legwear','mary-jane','搭扣玛丽珍鞋','Buckle Mary Janes','rose',{},'everyday'),
  shared('moccasins','legwear','moccasins','缝线莫卡辛软鞋','Stitched moccasins','oat',{},'weekend'),
  shared('chunky-sneakers','legwear','chunky-sneakers','厚底拼接运动鞋','Chunky panel sneakers','mist',{},'city'),
  shared('wraps','legwear','wraps','交叉绑带脚套','Crossed ankle wraps','lilac',{},'wonder'),
  shared('kneepads','legwear','kneepads','轻巧护膝套','Little knee guards','ink',{},'sport'),
  ...[
    ['neck-scarf','胸前小领巾','Little neckerchief','clay','chest'],
    ['bow-tie','奶油小领结','Butter bow tie','butter','chest'],
    ['pendant','珍珠小吊坠','Little pearl pendant','rose','chest'],
    ['medal','快乐队员奖章','Happy club medal','ink','chest'],
    ['pocketwatch','链条怀表','Chain pocket watch','oat','chest'],
    ['brooch','花朵小胸针','Little flower brooch','moss','chest'],
    ['ribbon-pin','缎带纪念胸针','Ribbon keepsake pin','berry','chest'],
    ['charm','云朵小挂章','Cloud chest charm','mist','chest'],
    ['basket','编织小提篮','Woven hand basket','oat','side'],
    ['umbrella','折边小雨伞','Little stitched umbrella','butter','side'],
    ['baguette','纸袋长面包','Paper-wrapped baguette','oat','side'],
    ['binoculars','双筒小望远镜','Little binoculars','forest','side'],
    ['paint-palette','五色画家调色盘','Artist paint palette','clay','side'],
    ['guitar','木纹小吉他','Little wooden guitar','oat','side'],
    ['tennis-racket','网线小球拍','Strung tennis racket','moss','side'],
    ['lantern','缎边小灯笼','Ribbon-trimmed lantern','berry','side'],
    ['flower-bouquet','春日小花束','Spring bouquet','rose','side'],
    ['lunchbox','便当小饭盒','Little lunchbox','mist','side'],
    ['fan','折叠纸扇','Folded paper fan','lilac','side'],
    ['microphone','舞台小麦克风','Stage microphone','ink','side'],
    ['thermos','带绳小保温瓶','Looped thermos','clay','side'],
    ['rolled-blanket','绑带野餐毯','Rolled picnic blanket','rose','back'],
    ['rope-coil','盘绕登山绳','Coiled climbing rope','butter','back'],
    ['mini-kite','纸鸢背部小架','Little kite carrier','mist','back'],
    ['garden-pack','园艺工具背包','Garden tool pack','forest','back'],
    ['guitarcase','弧线吉他背盒','Curved guitar case','ink','back'],
    ['satellite-pack','迷你卫星背包','Mini satellite pack','lilac','back'],
  ].map(([key,name,en,palette,region])=>shared(key,'accessory',key,name,en,palette,{},region==='back'?'outdoors':'everyday',region)),
];

const LEGACY_REFS = {
  hat: Object.fromEntries(COLLECTION.map(row => [row[7][0], `${row[0]}-hat`])),
  eyewear: { round:'butter-walk-eyewear',clear:'harbour-day-eyewear','cat-eye':'sunday-linen-eyewear',sport:'alpine-cloud-eyewear',aviator:'forest-post-eyewear',sunglasses:'safari-notes-eyewear' },
  body: Object.fromEntries(COLLECTION.map(row => [row[7][2], `${row[0]}-body`])),
  accessory: { tote:'butter-walk-accessory',satchel:'sunday-linen-accessory',watering:'pocket-garden-accessory',pouch:'rain-check-accessory',backpack:'alpine-cloud-accessory',camera:'forest-post-accessory',coffee:'coffee-break-accessory',book:'colour-study-accessory',skateboard:'sidewalk-skater-accessory',wings:'moon-garden-accessory',star:'cloud-postcard-accessory' },
  legwear: { loafers:'butter-walk-legwear',sneakers:'harbour-day-legwear',ballet:'sunday-linen-legwear',wellies:'rain-check-legwear',trail:'alpine-cloud-legwear',boots:'forest-post-legwear','high-top':'campus-club-legwear',socks:'court-date-legwear',legwarmers:'cosy-records-legwear' },
};

// Explicit shell / hardware pairings for the original 24 recipes. Orange
// remains the friendly default; quieter shells support the softer textiles.
const LEGACY_BODY_COLORS = [
  ['#e7a260','#f2c78b'],['#e8dfcc','#bd9468'],['#dae0c8','#d3ac72'],['#f2dcca','#b98577'],
  ['#f0d69a','#af8749'],['#dce4d6','#99b4aa'],['#dfe1c4','#be966c'],['#eee0c0','#ac936a'],
  ['#e5c6a7','#b77c5e'],['#ead5b9','#ab8a62'],['#dce8e1','#b5a57c'],['#f1e6d2','#bca875'],
  ['#dce3c9','#b88d64'],['#d8e7e4','#dcba73'],['#f3e4ba','#a2b077'],['#e1d7e7','#c4a58a'],
  ['#e7ddc8','#b39a73'],['#dce0de','#b89262'],['#f1dfc4','#bd976f'],['#efdbcc','#be8e79'],
  ['#e8d9e8','#c8ac77'],['#ddd9e6','#c3aa74'],['#e0e9e5','#b6a9bb'],['#f1dda4','#c59a51'],
];

// 76 additional recipes: silhouettes and component relationships come first.
// A recipe references shared objects; it cannot recolour an item behind the
// user's back. Multiple accessories occupy different, explicit regions.
const NEW_LOOKS = [
  ['oat-duffle','燕麦小牛角','Oat duffle','everyday','小扣子扣好，把温暖留住。','Toggle up and keep a little warmth close.','#f0dfbf','#c29a68',['cloche-check','round','duffle-toggle',['neck-scarf','tote'],'moccasins']],
  ['breakfast-club','早餐俱乐部','Breakfast club','everyday','纸袋里有面包，口袋里有好心情。','Fresh bread in a paper bag, good news in a pocket.','#ebd1b7','#c49765',['boater-ribbon','clear','workshirt-check',['pouch','baguette'],'loafers']],
  ['ballet-errands','芭蕾小日常','Ballet errands','everyday','系好软软的扣带，去买一束花。','Buckle up your little shoes and bring home some flowers.','#f2dce0','#c39990',['beret','cat-eye','bolero-ballet',['pendant','flower-bouquet'],'mary-jane']],
  ['berry-market','莓果小集市','Berry market','everyday','灯笼裙一晃，提篮里的莓果也笑了。','A swinging balloon skirt and a basket full of berries.','#ecd4d8','#b38187',['bonnet-lace',null,'balloon-berry',['brooch','basket'],'mary-jane']],
  ['window-seat','靠窗的暖座','Window seat','everyday','捧着咖啡，等一小束阳光。','A warm cup and a sunny seat by the window.','#eee1c8','#bea578',['short-beanie','round','fleece-weekend',['coffee'],'moccasins']],
  ['striped-stroll','条纹慢慢走','Striped stroll','everyday','横条纹和小草帽，一起绕过街角。','A striped rugby knit and a boater for the block.','#dee4cd','#b7a278',['boater-stripe','sunglasses','rugby-stripe',['neck-scarf','satchel'],'sneakers']],
  ['olive-quilt','橄榄小菱格','Olive quilt','outdoors','望远镜准备好，树林里有新朋友。','Diamond quilting and binoculars for a forest hello.','#dce3cd','#a8a076',['trapper-field','aviator','quilted-olive',['binoculars','backpack'],'trail']],
  ['trail-duffle','山径小侦察','Trail scout','outdoors','短款牛角扣，给攀登留一点轻快。','A cropped duffle, a coiled rope, and one cheerful climb.','#d5dfd0','#b6956b',['trailcap','sport','duffle-scout',['pouch','rope-coil'],'boots']],
  ['cloud-poncho','云边小雨披','Cloud poncho','outdoors','波浪下摆接住了今天的雨点。','A scalloped poncho catches the little raindrops.','#dce9e3','#b8ab7b',['bucket','clear','poncho-cloud',['umbrella'],'wellies']],
  ['camp-fleece','篝火绒绒鸭','Camp fleece','outdoors','背好毯子，晚风也会变温柔。','Pack the picnic blanket and soften the evening breeze.','#dce1cb','#b49a71',['trapper-plush',null,'fleece-camp',['thermos','rolled-blanket'],'moccasins']],
  ['garden-shell','花园工具站','Garden station','outdoors','小花帽系好，今天轮到小苗长高。','Tie a garden bonnet and help the seedlings grow.','#dce6c9','#baa66b',['bonnet-garden','sunglasses','shell-pocket',['brooch','watering','garden-pack'],'trail']],
  ['ridge-cape','山脊来风','Ridge breeze','outdoors','斜摆披肩轻轻飘，山风从身边路过。','An asymmetric capelet lets the mountain breeze pass by.','#d8e1df','#b9a077',['fedora','aviator','capelet-arrow',['binoculars','rope-coil'],'boots']],
  ['print-shop','印刷小工坊','Print shop','studio','交叠工装衫，翻开今天的新一页。','A wrapped workshirt and a fresh page to print.','#d9e2de','#b49a73',['workcap','round','workshirt-wrap',['charm','book'],'boots']],
  ['flower-studio','花束小工作室','Flower studio','studio','拼布袖口和花束，都有一点春天。','Patchwork bell sleeves and a bouquet full of spring.','#edd5c4','#bd9474',['bonnet-garden','clear','tunic-patch',['brooch','flower-bouquet','garden-pack'],'mary-jane']],
  ['music-room','民谣练习室','Music room','studio','把吉他背好，下一首唱给你听。','Soft leather, a guitar case, and a song just for you.','#e7d1be','#b58a69',['newsboy','clear','biker-soft',['neck-scarf','guitar','guitarcase'],'loafers']],
  ['kitchen-ledger','厨房小账本','Kitchen ledger','studio','小领结戴好，便当今天准时出发。','A bow tie over the apron, lunch packed right on time.','#efdfc5','#bca079',['short-beanie','round','apron',['bow-tie','lunchbox'],'moccasins']],
  ['glass-studio','玻璃与光','Glass and light','studio','喇叭袖一展开，色彩也变得轻盈。','Bell sleeves, a paint palette, and the softest studio light.','#e4d3d5','#bb8c95',['pillbox-pin','clear','bolero-jazz',['pendant','paint-palette'],'ballet']],
  ['indigo-workshop','蓝调手作日','Indigo workshop','studio','格纹衬衫卷起袖口，开始今天的创作。','A checked workshirt and a palette for hands-on happiness.','#e5d0b9','#b9906c',['workcap','aviator','workshirt-check',['pouch','paint-palette'],'boots']],
  ['road-ride','公路微风','Road breeze','sport','流线头盔戴好，向风打个招呼。','An aerodynamic helmet and a cropped shell greet the road.','#dce9e4','#b0a882',['cycling-road','sport','shell-cyclist',['medal','thermos'],'kneepads']],
  ['first-serve','第一记发球','First serve','sport','褶裙转个圈，下午三点球场见。','A pleated court skirt and a racket, see you at three.','#f1e6bf','#c9af6b',['visor','sunglasses','pleated-court',['tennis-racket'],'sneakers']],
  ['baseball-practice','棒球练习生','Baseball practice','sport','插肩球衣穿好，今天也是快乐队员。','A raglan baseball jersey and a happy little club medal.','#dbe2dd','#b79f7b',['baseball','clear','jersey-club',['medal','book'],'high-top']],
  ['clay-court','红土小球场','Clay court','sport','无袖球衣轻轻的，快乐跳得高高的。','A sleeveless court jersey for a light-footed afternoon.','#edd0b9','#c4916e',['sportband',null,'jersey-court',['neck-scarf','tennis-racket'],'socks']],
  ['rugby-crew','橄榄球小队','Rugby crew','sport','长款拼章衫，装得下全队的好消息。','A long patch rugby shirt carries the whole club’s good news.','#e2d1d7','#b58689',['slouch-beanie','sunglasses','rugby-college',['medal'],'chunky-sneakers']],
  ['bmx-block','街区骑行鸭','BMX block','sport','斜襟夹克和护膝，街角出发。','An asymmetric zip, knee guards, and one good little lap.','#dce3df','#bd9777',['cycling-city','sport','biker-zip',['pouch','skateboard'],'kneepads']],
  ['twenties-bloom','爵士花簇','Jazz bloom','heritage','钟形帽压低一点，纸扇扇来旧时光。','A bloom cloche, a wrap dress, and a fan from another afternoon.','#efd9da','#bb9393',['cloche-bloom','cat-eye','wrap-tea',['pendant','fan'],'mary-jane']],
  ['telegram-afternoon','电报小午后','Telegram afternoon','heritage','怀表轻轻晃，慢慢读完一封信。','A pillbox and peacoat, with time for one more page.','#e1dfd4','#b4986c',['pillbox-pin','aviator','peacoat',['pocketwatch','book'],'loafers']],
  ['french-picnic','法式小野餐','French picnic','heritage','格纹交叠裙和长面包，去草地坐坐。','A checked wrap, a baguette, and a blanket for the grass.','#e3e3c8','#b4a275',['boater-ribbon','round','wrap-check',['neck-scarf','baguette','rolled-blanket'],'moccasins']],
  ['tram-conductor','电车慢慢来','Slow tram','heritage','长大衣的牛角扣，扣住一段慢时光。','A long toggle coat and a pocket watch for the slow tram.','#ede0c6','#b49c73',['naval','clear','duffle-toggle',['pocketwatch','satchel'],'boots']],
  ['jazz-postcards','爵士明信片','Jazz postcards','heritage','礼帽一歪，唱一首寄给远方的歌。','Tilt a ribbon pillbox and sing a postcard for a friend.','#e7d3dd','#b48d9a',['pillbox-ribbon','cat-eye','bolero-jazz',['ribbon-pin','microphone'],'ballet']],
  ['heritage-field','旧地图探险','Old-map explorer','heritage','旧地图折好，工作衫口袋留给新发现。','A wrapped workshirt and an old map for new discoveries.','#dbe2d1','#b1976e',['trapper-field','aviator','workshirt-wrap',['pouch','binoculars','backpack'],'trail']],
  ['monday-chore','周一也轻快','Monday chores','city','小饭盒带好了，通勤也有好心情。','A chore jacket and a lunchbox make Monday a little lighter.','#e8d4bb','#b49071',['cloche-check','clear','chore',['pouch','lunchbox'],'chunky-sneakers']],
  ['metro-zip','地铁斜襟','Metro zip','city','拉好斜拉链，赶上今天的第一束光。','An asymmetric biker zip for the first bright train.','#d9e3df','#b4977c',['cycling-city','aviator','biker-zip',['neck-scarf','tote'],'high-top']],
  ['gallery-walk','画廊慢游','Gallery walk','city','百褶裙慢慢展开，今天看画不赶路。','A long pleated dress for an unhurried gallery day.','#e1dce9','#b5a2b5',['pillbox-pin','cat-eye','pleated-gallery',['brooch','book'],'mary-jane']],
  ['library-card','图书馆借书卡','Library card','city','马甲口袋装好怀表，借一本慢慢读。','A tweed waistcoat, a pocket watch, and a borrowed story.','#e4ddc6','#b29e76',['newsboy','round','waistcoat',['pocketwatch','book'],'moccasins']],
  ['city-bolero','城市泡泡袖','City puff sleeves','city','短外套和玛丽珍，去街角喝杯咖啡。','A puff-sleeve bolero and Mary Janes for a corner café.','#f0dae0','#bf939e',['cloche-bloom','sunglasses','bolero-ballet',['pendant','coffee'],'mary-jane']],
  ['station-parka','车站小风衣','Station parka','city','背包拉链扣好，下一站也会有阳光。','A field parka and a backpack for the next sunny stop.','#d9e0c7','#b6a073',['baseball','sport','parka',['pouch','thermos','backpack'],'chunky-sneakers']],
  ['busking-day','街角民谣','Street-corner folk','city','胸针别好，给路过的人唱一小段。','Pin on a flower and play one song for the passers-by.','#e6d2bf','#b88d72',['beret','round','biker-soft',['brooch','guitar','guitarcase'],'boots']],
  ['rooftop-rugby','天台学院风','Rooftop college','city','拼章长衫很轻快，饭盒装满午后。','A patch rugby knit and a lunchbox for the rooftop.','#e1d0d7','#b58a91',['boater-stripe','sunglasses','rugby-college',['medal','lunchbox'],'sneakers']],
  ['designer-daily','设计师日常','Designer daily','city','不对称亚麻长衫，装下一点灵感。','An asymmetric linen tunic with room for an idea.','#efdfc3','#bca17b',['workcap','clear','tunic-linen',['charm','tote'],'moccasins']],
  ['late-movie','夜场小电影','Late movie','city','菱格夹克暖暖的，散场后再慢慢走。','A quilted jacket for a slow walk after the late film.','#dfe5ce','#b3a078',['short-beanie','cat-eye','quilted-olive',['neck-scarf','coffee'],'high-top']],
  ['farmers-market','周末菜篮子','Farmers market','weekend','花园小帽系好，去挑今天的鲜花。','Tie a garden bonnet and visit the weekend stalls.','#e5e4cc','#baa477',['bonnet-garden',null,'wrap-check',['brooch','basket'],'mary-jane']],
  ['seaside-boater','海边平顶帽','Seaside boater','weekend','海盐条纹和单框墨镜，等一艘小船。','A Breton knit and a boater, waiting for a little boat.','#e1e7e4','#b6a27c',['boater-stripe','sunglasses','breton',['bow-tie','binoculars'],'moccasins']],
  ['picnic-pocket','野餐小口袋','Picnic pocket','weekend','无袖灯笼裙，留出草地上转圈的空间。','A sleeveless balloon dress for a picnic-sized twirl.','#e7d5d9','#b99291',['straw','clear','balloon-berry',['pendant','lunchbox','rolled-blanket'],'ballet']],
  ['bookstore-tea','书店下午茶','Bookshop tea','weekend','交叠茶歇裙，在书店坐到傍晚。','A wrap dress and a bookshop seat until the evening light.','#f1dcdb','#c29895',['cloche-bloom','round','wrap-tea',['ribbon-pin','book'],'loafers']],
  ['country-moc','乡间小软鞋','Country moccasins','weekend','亚麻下摆和软底鞋，一起踩过微风。','A linen tunic and moccasins for a country breeze.','#ebdfc6','#b9a178',['fedora','aviator','tunic-linen',['neck-scarf','thermos'],'moccasins']],
  ['meadow-kite','草地小纸鸢','Meadow kite','weekend','纸鸢背好，百褶裙跟着风轻轻摆。','A kite carrier and a pleated dress follow the meadow wind.','#e5dfea','#b8a6bd',['bonnet-lace','cat-eye','pleated-gallery',['brooch','star','mini-kite'],'mary-jane']],
  ['ferry-duffle','轮渡小牛角','Ferry duffle','weekend','短款牛角扣大衣，和轮渡一起慢下来。','A cropped duffle for an easy afternoon on the ferry.','#dde3d4','#b3a17b',['naval','clear','duffle-scout',['pocketwatch','tote'],'boots']],
  ['open-mic','周末开放麦','Weekend open mic','weekend','领结戴好，今天轮到你来唱。','A little bow tie and soft leather, your turn at the mic.','#e5d2bc','#bb9071',['paint-beret','round','biker-soft',['bow-tie','microphone','guitarcase'],'high-top']],
  ['sunday-bubble','周日泡泡裙','Sunday bubbles','weekend','泡泡袖和灯笼下摆，周日要甜一点。','Puff sleeves and a bubble hem for a sweeter Sunday.','#f0dce2','#c396a3',['pillbox-ribbon','cat-eye','balloon-birthday',['pendant','flower-bouquet'],'ballet']],
  ['stroll-in-mist','薄雾慢慢走','Misty stroll','weekend','不对称披衣，把晨雾穿成一个拥抱。','An asymmetric field poncho turns the mist into a hug.','#dfe4ce','#b7a477',['bucket','sport','poncho-field',['pouch','coffee'],'trail']],
  ['spring-bloom','春天的小花边','Spring scallops','seasons','小斗篷的花边，接住第一片花瓣。','A scalloped capelet catches the first spring petal.','#e7dceb','#bba6bd',['bonnet-garden','cat-eye','capelet-scallop',['brooch','flower-bouquet'],'mary-jane']],
  ['april-rain','四月小雨','April rain','seasons','小雨帽和波浪雨披，一起听雨。','A rain bonnet and scalloped poncho listen to April.','#deebe3','#b8b08d',['rainhood','clear','poncho-cloud',['charm','umbrella'],'wellies']],
  ['summer-linen','夏日亚麻风','Summer linen','seasons','短袖长衫和提篮，去收集一阵凉风。','A short-sleeve linen tunic for a basketful of cool air.','#f0e3c8','#bca575',['boater-ribbon','sunglasses','tunic-linen',['neck-scarf','basket'],'moccasins']],
  ['summer-sport','夏日小队员','Summer player','seasons','无袖球衣换上，快乐晒得暖暖的。','A sleeveless jersey and a warm little sunny medal.','#edd7ba','#c29975',['visor','sport','jersey-court',['medal','thermos'],'socks']],
  ['autumn-check','秋日格纹','Autumn checks','seasons','格纹口袋装好怀表，秋天不赶时间。','A checked workshirt and a pocket watch, autumn can wait.','#e9d6c0','#be9575',['cloche-check','round','workshirt-check',['pocketwatch','baguette'],'loafers']],
  ['october-quilt','十月小菱格','October quilting','seasons','橄榄色夹克和一本书，去看树叶慢慢变色。','An olive quilt and a little book watch the leaves turn.','#dfe4cd','#b7a378',['trapper-field','aviator','quilted-olive',['pouch','book','backpack'],'boots']],
  ['winter-toggle','冬天的小扣子','Winter toggles','seasons','护耳帽戴好，长大衣扣住暖意。','A plush trapper and a long duffle keep winter warm.','#efdfc5','#bca07e',['trapper-plush','clear','duffle-toggle',['neck-scarf','thermos'],'legwarmers']],
  ['snowday-fleece','雪天绒绒鸭','Snowday fleece','seasons','耳罩和抓绒，一起把冷风抱住。','Earmuffs and a long fleece for a snowy little hug.','#dee3cf','#b8a47e',['earmuffs','round','fleece-camp',['brooch','coffee'],'boots']],
  ['cold-sky','冷天小蓝云','Cold-day clouds','seasons','长款绗缝棉服，背着毯子去等雪。','A long quilted coat and a blanket, waiting for snow.','#dfe8e5','#b5ada0',['beanie','sport','quilted-long',['medal','thermos','rolled-blanket'],'trail']],
  ['between-seasons','换季小披肩','Between seasons','seasons','斜摆肩披轻轻的，给天气一点余地。','An asymmetric capelet gives the changing weather room.','#dce3e1','#b6a485',['pillbox-pin','cat-eye','capelet-arrow',['pendant','satchel'],'mary-jane']],
  ['birthday-bubble','生日泡泡愿','Birthday bubbles','celebration','拼布帽一歪，今天所有愿望都甜甜的。','A patchwork cap and a bubble dress, sweet wishes all round.','#f2dfe4','#cba0ad',['jester-patch','cat-eye','balloon-birthday',['ribbon-pin','flower-bouquet'],'ballet']],
  ['spring-lantern','春灯小花枝','Blossom lantern','celebration','交领和宽袖展开，提着花灯去看春天。','A crossed collar and bell sleeves for a blossom lantern walk.','#efd8dd','#c28e98',['bonnet-lace',null,'hanfu-blossom',['pendant','lantern'],'wraps']],
  ['new-year-note','新年小喜帖','New-year note','celebration','短款交领衫，扇来一整年的好消息。','A cropped crossed-collar jacket fans in a happy new year.','#f2e2b8','#cba66a',['pillbox-pin','round','hanfu-lantern',['bow-tie','fan'],'mary-jane']],
  ['ballet-recital','芭蕾小演出','Ballet recital','celebration','泡泡袖和蝴蝶结，上台前先转一圈。','Puff sleeves and a bow, one little twirl before the show.','#f0dce3','#c498a4',['pillbox-ribbon','cat-eye','bolero-ballet',['brooch','microphone'],'ballet']],
  ['club-anniversary','俱乐部纪念日','Club anniversary','celebration','奖章别好，今天和朋友一起庆祝。','Pin on a medal and celebrate with the whole little club.','#dee5ce','#b9a278',['baseball','sunglasses','varsity',['medal','lunchbox','mini-kite'],'chunky-sneakers']],
  ['tea-party-dress','茶会百褶裙','Tea-party pleats','celebration','钟形花帽和百褶裙，茶点已经准备好了。','A flower cloche and pleated dress, tea is ready.','#e7dfea','#b7a3b8',['cloche-bloom','round','pleated-gallery',['pocketwatch','coffee'],'mary-jane']],
  ['festival-jazz','节日小爵士','Festival jazz','celebration','铃铛帽响一响，喇叭袖跟着音乐摇。','Jester bells and jazz sleeves follow the festive beat.','#e6d9e7','#b7a0ba',['jester-bells','clear','bolero-jazz',['ribbon-pin','microphone'],'high-top']],
  ['picnic-party','草地小庆祝','Picnic party','celebration','格纹裙和野餐毯，把庆祝搬到草地上。','A checked wrap and picnic blanket take the party outside.','#e4e4ce','#baa87c',['boater-ribbon','sunglasses','wrap-check',['bow-tie','basket','rolled-blanket'],'moccasins']],
  ['orchard-banquet','果园小宴会','Orchard banquet','celebration','莓果灯笼裙，装下一整个果园的甜。','A berry balloon skirt holds an orchard’s worth of sweetness.','#ecd8df','#bd9299',['bonnet-garden','cat-eye','balloon-berry',['brooch','flower-bouquet'],'mary-jane']],
  ['first-show','第一场演出','First little show','celebration','拼布衣和小吉他，第一次上台也很勇敢。','A patchwork tunic and a little guitar, brave on your first stage.','#edd8c8','#be997d',['paint-beret','round','tunic-patch',['charm','guitar','wings'],'boots']],
  ['moon-balloon','月光小灯笼裙','Moon balloon','wonder','珍珠和小翅膀，把月光穿成裙摆。','Pearls and little wings turn moonlight into a balloon skirt.','#e8dce9','#baa6c1',['moon-pin','round','balloon-berry',['pendant','star','wings'],'wraps']],
  ['cloud-kite','云端小纸鸢','Cloud kite','wonder','云朵发夹别好，背着纸鸢去找风。','Pin on a cloud and carry a kite to the nearest breeze.','#dfeceb','#b8b4ad',['cloud-pin','clear','poncho-cloud',['charm','fan','mini-kite'],'socks']],
  ['bell-jester','铃铛小奇遇','Bell jester','wonder','双角帽摇一摇，波浪小斗篷开始冒险。','Twin bells and a scalloped capelet begin a tiny adventure.','#e5d9ec','#b69dbe',['jester-bells','cat-eye','capelet-scallop',['ribbon-pin','star'],'ballet']],
  ['satellite-letter','卫星小来信','Satellite letter','wonder','轻量风壳穿好，背着卫星寄一封信。','A light shell and a satellite pack carry a letter to the stars.','#dfeae7','#b5a7a1',['cycling-road','sport','shell-cyclist',['charm','book','satellite-pack'],'chunky-sneakers']],
  ['firefly-garden','萤火小花园','Firefly garden','wonder','拼布袖口和小翅膀，今晚花园会发光。','Patchwork sleeves and tiny wings make the garden glow.','#e3e8d4','#baa682',['antennae',null,'tunic-patch',['brooch','flower-bouquet','wings'],'mary-jane']],
  ['storybook-royal','绘本小花冠','Storybook bloom','wonder','交领花衣穿好，提着灯去读新的故事。','A blossom crossed-collar robe and a lantern for a new story.','#eadce5','#bea0af',['pillbox-ribbon','round','hanfu-blossom',['pendant','lantern'],'wraps']],
];

export const ITEMS = [...COLLECTION.flatMap(row=>row[7].flatMap((kind,index)=>kind?[{
  id:`${row[0]}-${SLOT_IDS[index]}`,slot:SLOT_IDS[index],kind,theme:row[3],palette:[...row[6]],name:NAMES[kind][0],en:NAMES[kind][1],description:row[4],descriptionEn:row[5],outfitId:row[0],
  ...(SLOT_IDS[index]==='accessory'?{region:['camera','pouch'].includes(kind)?'chest':['backpack','wings'].includes(kind)?'back':'side'}:{}),
}]:[])), ...SHARED_ITEMS];
const BY_ITEM_ID = new Map(ITEMS.map(item=>[item.id,item]));
export function normalizeSelection(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const result = { hat: null, eyewear: null, body: null, accessory: { chest: null, side: null, back: null }, legwear: null };
  for (const slot of SLOT_IDS) {
    if (slot === 'accessory') continue;
    const item = BY_ITEM_ID.get(source[slot]);
    if (item?.slot === slot) result[slot] = item.id;
  }
  if (typeof source.accessory === 'string') {
    const item = BY_ITEM_ID.get(source.accessory);
    if (item?.slot === 'accessory' && ACCESSORY_REGIONS.includes(item.region)) result.accessory[item.region] = item.id;
  } else if (source.accessory && typeof source.accessory === 'object') {
    for (const region of ACCESSORY_REGIONS) {
      const item = BY_ITEM_ID.get(source.accessory[region]);
      if (item?.slot === 'accessory' && item.region === region) result.accessory[region] = item.id;
    }
  }
  return result;
}
export function selectionKey(input) {
  const selection = normalizeSelection(input);
  return [selection.hat, selection.eyewear, selection.body, ...ACCESSORY_REGIONS.map(region => selection.accessory[region]), selection.legwear].map(id => id || '').join('|');
}
export function selectedItemIds(input, slot) {
  const selection = normalizeSelection(input);
  const slots = slot === undefined ? SLOT_IDS : SLOT_IDS.includes(slot) ? [slot] : [];
  return slots.flatMap(key => key === 'accessory' ? ACCESSORY_REGIONS.map(region => selection.accessory[region]).filter(Boolean) : selection[key] ? [selection[key]] : []);
}
export function equipItem(input, id) {
  const selection = normalizeSelection(input), item = BY_ITEM_ID.get(id);
  if (!item) return selection;
  if (item.slot === 'accessory') selection.accessory[item.region] = id;
  else selection[item.slot] = id;
  return selection;
}
export function removeItem(input, id) {
  const selection = normalizeSelection(input);
  for (const slot of SLOT_IDS) {
    if (slot === 'accessory') { for (const region of ACCESSORY_REGIONS) if (selection.accessory[region] === id) selection.accessory[region] = null; }
    else if (selection[slot] === id) selection[slot] = null;
  }
  return selection;
}
const DESIGN_LABELS = {
  cropped:['短款','Cropped'],regular:['标准长度','Regular length'],long:['长款','Long cut'],
  straight:['直下摆','Straight hem'],scallop:['波浪下摆','Scalloped hem'],asymmetric:['不对称下摆','Asymmetric hem'],bubble:['灯笼下摆','Bubble hem'],
  short:['短袖','Short sleeves'],bell:['喇叭袖','Bell sleeves'],puff:['泡泡袖','Puff sleeves'],raglan:['插肩袖','Raglan sleeves'],none:['无袖','Sleeveless'],
  buttons:['纽扣门襟','Button closure'],zip:['拉链门襟','Zip closure'],toggle:['牛角扣','Toggle closure'],wrap:['交叠门襟','Wrap closure'],bow:['系带蝴蝶结','Bow fastening'],
  pockets:['立体口袋','Dimensional pockets'],patches:['拼布与徽章','Patchwork and badges'],ruffles:['立体荷叶边','Sculpted ruffles'],ribbed:['针织罗纹','Knit ribs'],quilted:['绗缝结构','Quilted structure'],pleats:['立体褶裥','Sculpted pleats'],
  plain:['素面','Plain'],stripe:['立体条纹','Raised stripes'],check:['格纹织线','Checked weave'],dots:['立体波点','Raised dots'],petals:['花瓣纹样','Petal motifs'],
};
function recipeFeatures(selection, english = false) {
  return selectedItemIds(selection).map(id => {
    const item = BY_ITEM_ID.get(id), tags = Object.entries(item.design || {}).filter(([key]) => key !== 'tilt').map(([,value]) => DESIGN_LABELS[value]?.[english ? 1 : 0]).filter(Boolean);
    return `${english ? item.en : item.name}${tags.length ? ` · ${tags.join(' / ')}` : ''}`;
  });
}
function referenceId(slot, reference) {
  if (!reference) return null;
  const id = LEGACY_REFS[slot]?.[reference] || `${slot}-${reference}`;
  if (BY_ITEM_ID.get(id)?.slot !== slot) throw new Error(`Invalid wardrobe recipe reference: ${slot}/${reference}`);
  return id;
}
function recipeSelection(parts) {
  let selection = normalizeSelection({
    hat: referenceId('hat', parts[0]), eyewear: referenceId('eyewear', parts[1]),
    body: referenceId('body', parts[2]), legwear: referenceId('legwear', parts[4]),
  });
  for (const reference of parts[3] || []) selection = equipItem(selection, referenceId('accessory', reference));
  return selection;
}
const LEGACY_OUTFITS = COLLECTION.map((row,index) => {
  const selection = normalizeSelection(Object.fromEntries(SLOT_IDS.map((slot,i)=>[slot,row[7][i]?`${row[0]}-${slot}`:null])));
  return { id:row[0], name:row[1], en:row[2], theme:row[3], description:row[4], descriptionEn:row[5],
    palette:[...row[6]], bodyColors:{shell:LEGACY_BODY_COLORS[index][0],accent:LEGACY_BODY_COLORS[index][1]},
    selection, features:recipeFeatures(selection), featuresEn:recipeFeatures(selection,true),
  };
});
const EXPANDED_OUTFITS = NEW_LOOKS.map(row => {
  const selection = recipeSelection(row[8]), bodyItem = BY_ITEM_ID.get(selection.body);
  return { id:row[0], name:row[1], en:row[2], theme:row[3], description:row[4], descriptionEn:row[5],
    palette:[...bodyItem.palette], bodyColors:{shell:row[6],accent:row[7]},
    selection, features:recipeFeatures(selection), featuresEn:recipeFeatures(selection,true),
  };
});
// Theme order is stable; within each theme the original favourites come first.
export const OUTFITS = THEMES.flatMap(theme => [...LEGACY_OUTFITS,...EXPANDED_OUTFITS].filter(outfit => outfit.theme === theme.id));
export function createOutfitParts(selection={}) {
  const normalized = normalizeSelection(selection);
  const parts = SLOT_IDS.flatMap(slot=>{
    return selectedItemIds(normalized,slot).flatMap(id => { const item=BY_ITEM_ID.get(id);
    return createGarment(item).map(({bodyName,group},index)=>{
      group.name=`duckrobe:${slot}:${item.id}:${index}`;group.userData={...group.userData,slot,itemId:item.id,outfitId:item.outfitId,kind:item.kind,...(item.region?{region:item.region}:{})};
      group.traverse(child=>{if(child.isMesh)child.name=`${slot}:${item.kind}:${child.name||'detail'}`});
      return{slot,itemId:item.id,bodyName,group,...(item.region?{region:item.region}:{})};
    }); });
  });
  const envelope = new THREE.Box3();
  const bodyGroups = [];
  for (const part of parts) if (part.slot === 'body' && part.bodyName === 'trunk_base') {
    part.group.updateMatrixWorld(true); envelope.union(new THREE.Box3().setFromObject(part.group));
    bodyGroups.push(part.group);
  }
  for (const part of parts) if (part.slot === 'accessory') {
    if (part.region === 'chest') {
      // A pin has to touch its cloth. The broad skirt envelope is unsuitable
      // here: it would leave small badges floating in front of the chest.
      const ray = new THREE.Raycaster(new THREE.Vector3(.2, part.group.position.y, part.group.position.z), new THREE.Vector3(-1, 0, 0));
      const hit = ray.intersectObjects(bodyGroups, true).find(intersection => intersection.point.x > .018);
      // The pinned native trunk front is x <= .0345 m; this leaves a small
      // allowance when the garment has an open front or has been removed.
      const surface = Math.max(.037, hit?.point.x || .037);
      part.group.updateMatrixWorld(true);
      const propBounds = new THREE.Box3().setFromObject(part.group);
      if (!propBounds.isEmpty()) part.group.position.x += surface + .002 - propBounds.min.x;
      part.group.userData.fitSurfaceX = surface;
    }
    if (!envelope.isEmpty() && part.region === 'side') part.group.position.y -= Math.max(0, -envelope.min.y - .053);
    if (!envelope.isEmpty() && part.region === 'back') part.group.position.x -= Math.max(0, -envelope.min.x - .062);
    part.group.userData.fitTranslation = part.group.position.toArray();
  }
  return parts;
}
export function attachOutfitParts(robot,selection) {
  const parts=createOutfitParts(selection);parts.forEach(part=>{const anchor=robot.anchors.get(part.bodyName);if(!anchor)throw new Error(`Missing Microduck clothing anchor: ${part.bodyName}`);anchor.add(part.group)});return parts;
}

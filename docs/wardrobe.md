# DuckRobe wardrobe design ledger

100 complete Microduck looks in 10 collections, with 10 looks per collection. Ninety looks draw on everyday clothing, workwear, travel, sport and celebrations; ten add a little fantasy. The original 24 look IDs and all 112 original item IDs remain compatible with saved wardrobes.

The library contains 206 selectable items. The 94 additions are shared design objects, not per-look colour clones: 32 bodies with real cut, sleeve, hem and closure differences; 14 hats; 5 legwear types; and 43 accessories. Existing colour versions retain their IDs for compatibility. New recipes reuse these objects instead of creating duplicates.

## Structural vocabulary

Body templates added: duffle, biker, wrap-dress, pleated-dress, poncho, jersey, hanfu, fleece, bolero, quilted-jacket, tunic, shell-vest, balloon-dress, capelet, rugby and workshirt. Hat templates added: cloche, pillbox, trapper, boater, bonnet, cycling and jester. Legwear added: Mary Janes, moccasins, chunky sneakers, crossed ankle wraps and knee guards.

Wing forms include layered flight feathers, swept swallow wings, four-lobed butterfly wings, translucent dragonfly membranes, broad moth wings, segmented metal blades, sculpted leaves and scalloped clouds. Their closed curved panels have raised veins, feather shafts or small hinge details. Eight other crafted accessories add a layered lotus brooch, opal orbit brooch, instant camera, stitched mail satchel, acorn purse, lined picnic hamper, clockwork music box and folded contour-map case. The older little-wing item IDs remain available with the upgraded butterfly construction.

`item.design` records authored cut, hem, sleeve, closure, detail and pattern options. Hat tilt is in degrees. These fields are consumed by the geometry factory; colours do not establish a new design. Each recipe includes Chinese and English descriptions/features plus an explicitly chosen shell/accent colour pair for the original robot.

| Slot | Selectable items | Geometry kinds |
|---|---:|---:|
| hat | 38 | 31 |
| eyewear | 19 | 6 |
| body | 56 | 40 |
| accessory | 65 | 54 |
| legwear | 28 | 14 |

## Selection contract

```js
{ hat: null, eyewear: null, body: null,
  accessory: { chest: null, side: null, back: null }, legwear: null }
```

`normalizeSelection` migrates a legacy scalar accessory ID into its authored region. Unknown IDs, wrong slots and IDs placed in the wrong region become null. `equipItem` replaces only the matching clothing slot or accessory region; `removeItem` removes only the named item. `selectedItemIds` flattens the canonical selection, and `selectionKey` produces a stable key. UI state, saved looks, geometry generation and exports share these functions.

Accessories occupy chest, right side or back: 16, 32 and 17 selectable items respectively. A look can contain zero to three; 22 selected looks combine all three regions. A pair of wings is one back-region item, leaving chest and side available. The geometry wrapper retains the region on both the returned part and `group.userData`.

Chest pieces sit below the neck assembly and are pinned to the actual garment surface, found by a ray cast from the front, with a 2 mm allowance; an open or removed garment uses the native trunk front allowance. Side pieces are lifted above the hip motors, while short keepers retain their body attachment height and fit to ray-cast local cloth surfaces. Side and back objects move outward from the selected garment envelope when required. Wing panels stay behind that envelope, while two short rear keepers connect the root to ray-cast local garment surfaces, or the native back allowance when clothing is absent. The assembly follows the real trunk mount. Web preview and export use the same transformations.

## Complete recipe catalogue

### 日常好心情 · Everyday

| Look / ID | Body silhouette | Chest · Side · Back | Robot shell / accent |
|---|---|---|---|
| 奶油散步 / Butter walk · `butter-walk` | 麻花开衫 | — · 帆布手提包 · — | `#e7a260` / `#f2c78b` |
| 海盐假日 / Harbour day · `harbour-day` | 海盐条纹衫 | — · — · — | `#e8dfcc` / `#bd9468` |
| 口袋花园 / Pocket garden · `pocket-garden` | 牛仔背带裤 | — · 迷你洒水壶 · — | `#dae0c8` / `#d3ac72` |
| 周日亚麻 / Sunday linen · `sunday-linen` | 收褶亚麻裙 | — · 小邮差包 · — | `#f2dcca` / `#b98577` |
| 燕麦小牛角 / Oat duffle · `oat-duffle` | 燕麦牛角扣大衣 (cut:long, closure:toggle, detail:pockets, sleeve:raglan) | 胸前小领巾 · 帆布手提包 · — | `#f0dfbf` / `#c29a68` |
| 早餐俱乐部 / Breakfast club · `breakfast-club` | 格纹双袋工作衬衫 (cut:regular, sleeve:short, pattern:check, closure:buttons) | 腰间小包 · 纸袋长面包 · — | `#ebd1b7` / `#c49765` |
| 芭蕾小日常 / Ballet errands · `ballet-errands` | 泡泡袖芭蕾小外套 (cut:cropped, sleeve:puff, closure:bow, hem:scallop) | 珍珠小吊坠 · 春日小花束 · — | `#f2dce0` / `#c39990` |
| 莓果小集市 / Berry market · `berry-market` | 莓果无袖灯笼裙 (cut:long, hem:bubble, sleeve:none, detail:pleats) | 花朵小胸针 · 编织小提篮 · — | `#ecd4d8` / `#b38187` |
| 靠窗的暖座 / Window seat · `window-seat` | 周末拉链抓绒 (cut:regular, closure:zip, sleeve:raglan, detail:ribbed) | — · 外带咖啡 · — | `#eee1c8` / `#bea578` |
| 条纹慢慢走 / Striped stroll · `striped-stroll` | 横条纹橄榄球衫 (cut:cropped, sleeve:raglan, pattern:stripe, closure:buttons) | 胸前小领巾 · 小邮差包 · — | `#dee4cd` / `#b7a278` |

### 出门去玩 · Outdoors

| Look / ID | Body silhouette | Chest · Side · Back | Robot shell / accent |
|---|---|---|---|
| 雨天约定 / Rain check · `rain-check` | 双层雨披 | 腰间小包 · — · — | `#f0d69a` / `#af8749` |
| 山间云朵 / Alpine cloud · `alpine-cloud` | 绗缝羽绒马甲 | — · 折页地形地图夹 · 翻盖小背包 | `#dce4d6` / `#99b4aa` |
| 森林来信 / Forest post · `forest-post` | 口袋风衣 | 奶油拍立得相机 · 飞行邮差挎包 · — | `#dfe1c4` / `#be966c` |
| 野外笔记 / Safari notes · `safari-notes` | 探险马甲 | 腰间小包 · — · — | `#eee0c0` / `#ac936a` |
| 橄榄小菱格 / Olive quilt · `olive-quilt` | 橄榄菱格夹克 (cut:regular, closure:zip, detail:quilted, sleeve:raglan) | — · 双筒小望远镜 · 翻盖小背包 | `#dce3cd` / `#a8a076` |
| 山径小侦察 / Trail scout · `trail-duffle` | 短款侦察牛角扣 (cut:cropped, closure:toggle, detail:patches, hem:asymmetric) | 腰间小包 · — · 盘绕登山绳 | `#d5dfd0` / `#b6956b` |
| 云边小雨披 / Cloud poncho · `cloud-poncho` | 云边波浪雨披 (cut:regular, hem:scallop, closure:bow, pattern:dots) | — · 折边小雨伞 · — | `#dce9e3` / `#b8ab7b` |
| 篝火绒绒鸭 / Camp fleece · `camp-fleece` | 长款绒绒露营服 (cut:long, closure:toggle, detail:pockets, sleeve:puff) | — · 带绳小保温瓶 · 绑带野餐毯 | `#dce1cb` / `#b49a71` |
| 花园工具站 / Garden station · `garden-shell` | 多口袋户外风壳 (cut:long, sleeve:none, closure:buttons, detail:pockets) | 花朵小胸针 · 迷你洒水壶 · 园艺工具背包 | `#dce6c9` / `#baa66b` |
| 山脊来风 / Ridge breeze · `ridge-cape` | 斜摆牛角扣肩披 (cut:long, hem:asymmetric, closure:toggle, detail:pockets) | — · 双筒小望远镜 · 盘绕登山绳 | `#d8e1df` / `#b9a077` |

### 小小工作室 · At the studio

| Look / ID | Body silhouette | Chest · Side · Back | Robot shell / accent |
|---|---|---|---|
| 陶艺日 / Clay day · `clay-day` | 工装短外套 | — · 小邮差包 · — | `#e5c6a7` / `#b77c5e` |
| 咖啡时间 / Coffee break · `coffee-break` | 交叉背带围裙 | — · 外带咖啡 · — | `#ead5b9` / `#ab8a62` |
| 色彩练习 / Colour study · `colour-study` | 褶裥画家罩衣 | — · 口袋小书 · — | `#dce8e1` / `#b5a57c` |
| 小小主厨 / Little chef · `little-chef` | 双排扣厨师服 | — · 外带咖啡 · — | `#f1e6d2` / `#bca875` |
| 印刷小工坊 / Print shop · `print-shop` | 交叠长袖工装衫 (cut:long, sleeve:bell, closure:wrap, detail:pockets) | 云朵小挂章 · 口袋小书 · — | `#d9e2de` / `#b49a73` |
| 花束小工作室 / Flower studio · `flower-studio` | 拼布喇叭袖罩衫 (cut:regular, sleeve:bell, detail:patches, hem:scallop) | 花朵小胸针 · 春日小花束 · 园艺工具背包 | `#edd5c4` / `#bd9474` |
| 民谣练习室 / Music room · `music-room` | 软皮落肩夹克 (cut:regular, closure:zip, sleeve:raglan, detail:pockets) | 胸前小领巾 · 木纹小吉他 · 弧线吉他背盒 | `#e7d1be` / `#b58a69` |
| 厨房小账本 / Kitchen ledger · `kitchen-ledger` | 交叉背带围裙 | 奶油小领结 · 便当小饭盒 · — | `#efdfc5` / `#bca079` |
| 玻璃与光 / Glass and light · `glass-studio` | 喇叭袖爵士短衫 (cut:cropped, sleeve:bell, closure:buttons, detail:ruffles) | 珍珠小吊坠 · 五色画家调色盘 · — | `#e4d3d5` / `#bb8c95` |
| 蓝调手作日 / Indigo workshop · `indigo-workshop` | 格纹双袋工作衬衫 (cut:regular, sleeve:short, pattern:check, closure:buttons) | 腰间小包 · 五色画家调色盘 · — | `#e5d0b9` / `#b9906c` |

### 动起来 · Play club

| Look / ID | Body silhouette | Chest · Side · Back | Robot shell / accent |
|---|---|---|---|
| 校园俱乐部 / Campus club · `campus-club` | 校园棒球外套 | — · 口袋小书 · — | `#dce3c9` / `#b88d64` |
| 晨风慢跑 / Morning laps · `morning-laps` | 弧线运动外套 | 腰间小包 · — · — | `#d8e7e4` / `#dcba73` |
| 球场见 / Court date · `court-date` | 针织网球衫 | — · — · — | `#f3e4ba` / `#a2b077` |
| 街角滑板 / Sidewalk skater · `sidewalk-skater` | 口袋卫衣 | — · 小滑板 · — | `#e1d7e7` / `#c4a58a` |
| 公路微风 / Road breeze · `road-ride` | 轻量骑行风壳 (cut:cropped, sleeve:none, closure:zip, hem:asymmetric) | 快乐队员奖章 · 带绳小保温瓶 · — | `#dce9e4` / `#b0a882` |
| 第一记发球 / First serve · `first-serve` | 球场条纹褶裙 (cut:cropped, detail:pleats, sleeve:short, pattern:stripe) | — · 网线小球拍 · — | `#f1e6bf` / `#c9af6b` |
| 棒球练习生 / Baseball practice · `baseball-practice` | 插肩棒球球衣 (cut:regular, sleeve:raglan, closure:buttons, detail:patches) | 快乐队员奖章 · 口袋小书 · — | `#dbe2dd` / `#b79f7b` |
| 红土小球场 / Clay court · `clay-court` | 拼色无袖球衣 (cut:cropped, sleeve:none, pattern:stripe, detail:patches) | 胸前小领巾 · 网线小球拍 · — | `#edd0b9` / `#c4916e` |
| 橄榄球小队 / Rugby crew · `rugby-crew` | 学院拼章橄榄球衫 (cut:long, sleeve:raglan, detail:patches, closure:buttons) | 快乐队员奖章 · — · — | `#e2d1d7` / `#b58689` |
| 街区骑行鸭 / BMX block · `bmx-block` | 斜襟机车短夹克 (cut:cropped, closure:zip, hem:asymmetric, detail:ribbed) | 腰间小包 · 小滑板 · — | `#dce3df` / `#bd9777` |

### 旧时光 · Heritage

| Look / ID | Body silhouette | Chest · Side · Back | Robot shell / accent |
|---|---|---|---|
| 早报送达 / Morning paper · `morning-paper` | 人字纹马甲 | — · 小邮差包 · — | `#e7ddc8` / `#b39a73` |
| 老船长 / Old salt · `old-salt` | 海军双排扣外套 | 复古小相机 · — · — | `#dce0de` / `#b89262` |
| 左岸午后 / Left-bank afternoon · `left-bank` | 收腰小风衣 | — · 帆布手提包 · — | `#f1dfc4` / `#bd976f` |
| 暖调唱片 / Cosy records · `cosy-records` | 麻花针织衫 | — · 外带咖啡 · — | `#efdbcc` / `#be8e79` |
| 爵士花簇 / Jazz bloom · `twenties-bloom` | 交叠茶歇裙 (cut:long, closure:wrap, sleeve:bell, hem:asymmetric) | 珍珠小吊坠 · 折叠纸扇 · — | `#efd9da` / `#bb9393` |
| 电报小午后 / Telegram afternoon · `telegram-afternoon` | 海军双排扣外套 | 链条怀表 · 口袋小书 · — | `#e1dfd4` / `#b4986c` |
| 法式小野餐 / French picnic · `french-picnic` | 格纹交叠短裙 (cut:regular, closure:bow, sleeve:short, pattern:check) | 胸前小领巾 · 纸袋长面包 · 绑带野餐毯 | `#e3e3c8` / `#b4a275` |
| 电车慢慢来 / Slow tram · `tram-conductor` | 燕麦牛角扣大衣 (cut:long, closure:toggle, detail:pockets, sleeve:raglan) | 链条怀表 · 小邮差包 · — | `#ede0c6` / `#b49c73` |
| 爵士明信片 / Jazz postcards · `jazz-postcards` | 喇叭袖爵士短衫 (cut:cropped, sleeve:bell, closure:buttons, detail:ruffles) | 缎带纪念胸针 · 舞台小麦克风 · — | `#e7d3dd` / `#b48d9a` |
| 旧地图探险 / Old-map explorer · `heritage-field` | 交叠长袖工装衫 (cut:long, sleeve:bell, closure:wrap, detail:pockets) | 腰间小包 · 双筒小望远镜 · 翻盖小背包 | `#dbe2d1` / `#b1976e` |

### 城市慢生活 · City life

| Look / ID | Body silhouette | Chest · Side · Back | Robot shell / accent |
|---|---|---|---|
| 周一也轻快 / Monday chores · `monday-chore` | 工装短外套 | 腰间小包 · 便当小饭盒 · — | `#e8d4bb` / `#b49071` |
| 地铁斜襟 / Metro zip · `metro-zip` | 斜襟机车短夹克 (cut:cropped, closure:zip, hem:asymmetric, detail:ribbed) | 胸前小领巾 · 帆布手提包 · — | `#d9e3df` / `#b4977c` |
| 画廊慢游 / Gallery walk · `gallery-walk` | 画廊百褶长裙 (cut:long, detail:pleats, sleeve:none, closure:buttons) | 花朵小胸针 · 口袋小书 · — | `#e1dce9` / `#b5a2b5` |
| 图书馆借书卡 / Library card · `library-card` | 人字纹马甲 | 链条怀表 · 口袋小书 · — | `#e4ddc6` / `#b29e76` |
| 城市泡泡袖 / City puff sleeves · `city-bolero` | 泡泡袖芭蕾小外套 (cut:cropped, sleeve:puff, closure:bow, hem:scallop) | 珍珠小吊坠 · 外带咖啡 · — | `#f0dae0` / `#bf939e` |
| 车站小风衣 / Station parka · `station-parka` | 口袋风衣 | 腰间小包 · 带绳小保温瓶 · 翻盖小背包 | `#d9e0c7` / `#b6a073` |
| 街角民谣 / Street-corner folk · `busking-day` | 软皮落肩夹克 (cut:regular, closure:zip, sleeve:raglan, detail:pockets) | 花朵小胸针 · 木纹小吉他 · 弧线吉他背盒 | `#e6d2bf` / `#b88d72` |
| 天台学院风 / Rooftop college · `rooftop-rugby` | 学院拼章橄榄球衫 (cut:long, sleeve:raglan, detail:patches, closure:buttons) | 快乐队员奖章 · 便当小饭盒 · — | `#e1d0d7` / `#b58a91` |
| 设计师日常 / Designer daily · `designer-daily` | 亚麻不对称长衫 (cut:long, hem:asymmetric, sleeve:short, closure:buttons) | 蛋白石轨道胸针 · 帆布手提包 · — | `#efdfc3` / `#bca17b` |
| 夜场小电影 / Late movie · `late-movie` | 橄榄菱格夹克 (cut:regular, closure:zip, detail:quilted, sleeve:raglan) | 胸前小领巾 · 外带咖啡 · — | `#dfe5ce` / `#b3a078` |

### 周末小旅行 · Little weekends

| Look / ID | Body silhouette | Chest · Side · Back | Robot shell / accent |
|---|---|---|---|
| 周末菜篮子 / Farmers market · `farmers-market` | 格纹交叠短裙 (cut:regular, closure:bow, sleeve:short, pattern:check) | 花朵小胸针 · 格纹野餐提篮 · — | `#e5e4cc` / `#baa477` |
| 海边平顶帽 / Seaside boater · `seaside-boater` | 海盐条纹衫 | 奶油小领结 · 双筒小望远镜 · — | `#e1e7e4` / `#b6a27c` |
| 野餐小口袋 / Picnic pocket · `picnic-pocket` | 莓果无袖灯笼裙 (cut:long, hem:bubble, sleeve:none, detail:pleats) | 珍珠小吊坠 · 便当小饭盒 · 绑带野餐毯 | `#e7d5d9` / `#b99291` |
| 书店下午茶 / Bookshop tea · `bookstore-tea` | 交叠茶歇裙 (cut:long, closure:wrap, sleeve:bell, hem:asymmetric) | 缎带纪念胸针 · 口袋小书 · — | `#f1dcdb` / `#c29895` |
| 乡间小软鞋 / Country moccasins · `country-moc` | 亚麻不对称长衫 (cut:long, hem:asymmetric, sleeve:short, closure:buttons) | 胸前小领巾 · 带绳小保温瓶 · — | `#ebdfc6` / `#b9a178` |
| 草地小纸鸢 / Meadow kite · `meadow-kite` | 画廊百褶长裙 (cut:long, detail:pleats, sleeve:none, closure:buttons) | 花朵小胸针 · 星星小挂饰 · 纸鸢背部小架 | `#e5dfea` / `#b8a6bd` |
| 轮渡小牛角 / Ferry duffle · `ferry-duffle` | 短款侦察牛角扣 (cut:cropped, closure:toggle, detail:patches, hem:asymmetric) | 链条怀表 · 帆布手提包 · — | `#dde3d4` / `#b3a17b` |
| 周末开放麦 / Weekend open mic · `open-mic` | 软皮落肩夹克 (cut:regular, closure:zip, sleeve:raglan, detail:pockets) | 奶油小领结 · 舞台小麦克风 · 弧线吉他背盒 | `#e5d2bc` / `#bb9071` |
| 周日泡泡裙 / Sunday bubbles · `sunday-bubble` | 泡泡生日裙 (cut:regular, hem:bubble, sleeve:puff, closure:bow) | 珍珠小吊坠 · 春日小花束 · — | `#f0dce2` / `#c396a3` |
| 薄雾慢慢走 / Misty stroll · `stroll-in-mist` | 不对称山野披衣 (cut:long, hem:asymmetric, closure:toggle, detail:pockets) | 腰间小包 · 外带咖啡 · — | `#dfe4ce` / `#b7a477` |

### 四季的温度 · Four seasons

| Look / ID | Body silhouette | Chest · Side · Back | Robot shell / accent |
|---|---|---|---|
| 春天的小花边 / Spring scallops · `spring-bloom` | 波浪边小斗篷 (cut:cropped, hem:scallop, closure:bow, detail:ruffles) | 花朵小胸针 · 春日小花束 · — | `#e7dceb` / `#bba6bd` |
| 四月小雨 / April rain · `april-rain` | 云边波浪雨披 (cut:regular, hem:scallop, closure:bow, pattern:dots) | 云朵小挂章 · 折边小雨伞 · — | `#deebe3` / `#b8b08d` |
| 夏日亚麻风 / Summer linen · `summer-linen` | 亚麻不对称长衫 (cut:long, hem:asymmetric, sleeve:short, closure:buttons) | 胸前小领巾 · 编织小提篮 · — | `#f0e3c8` / `#bca575` |
| 夏日小队员 / Summer player · `summer-sport` | 拼色无袖球衣 (cut:cropped, sleeve:none, pattern:stripe, detail:patches) | 快乐队员奖章 · 带绳小保温瓶 · — | `#edd7ba` / `#c29975` |
| 秋日格纹 / Autumn checks · `autumn-check` | 格纹双袋工作衬衫 (cut:regular, sleeve:short, pattern:check, closure:buttons) | 链条怀表 · 纸袋长面包 · — | `#e9d6c0` / `#be9575` |
| 十月小菱格 / October quilting · `october-quilt` | 橄榄菱格夹克 (cut:regular, closure:zip, detail:quilted, sleeve:raglan) | 腰间小包 · 口袋小书 · 翻盖小背包 | `#dfe4cd` / `#b7a378` |
| 冬天的小扣子 / Winter toggles · `winter-toggle` | 燕麦牛角扣大衣 (cut:long, closure:toggle, detail:pockets, sleeve:raglan) | 胸前小领巾 · 带绳小保温瓶 · — | `#efdfc5` / `#bca07e` |
| 雪天绒绒鸭 / Snowday fleece · `snowday-fleece` | 长款绒绒露营服 (cut:long, closure:toggle, detail:pockets, sleeve:puff) | 花朵小胸针 · 外带咖啡 · — | `#dee3cf` / `#b8a47e` |
| 冷天小蓝云 / Cold-day clouds · `cold-sky` | 长款绗缝棉服 (cut:long, closure:buttons, detail:quilted, sleeve:puff) | 快乐队员奖章 · 带绳小保温瓶 · 绑带野餐毯 | `#dfe8e5` / `#b5ada0` |
| 换季小披肩 / Between seasons · `between-seasons` | 斜摆牛角扣肩披 (cut:long, hem:asymmetric, closure:toggle, detail:pockets) | 珍珠小吊坠 · 小邮差包 · — | `#dce3e1` / `#b6a485` |

### 快乐纪念日 · Small celebrations

| Look / ID | Body silhouette | Chest · Side · Back | Robot shell / accent |
|---|---|---|---|
| 生日泡泡愿 / Birthday bubbles · `birthday-bubble` | 泡泡生日裙 (cut:regular, hem:bubble, sleeve:puff, closure:bow) | 缎带纪念胸针 · 春日小花束 · — | `#f2dfe4` / `#cba0ad` |
| 春灯小花枝 / Blossom lantern · `spring-lantern` | 花枝交领汉服 (cut:long, sleeve:bell, closure:wrap, pattern:petals) | 叠瓣莲花胸针 · 缎边小灯笼 · — | `#efd8dd` / `#c28e98` |
| 新年小喜帖 / New-year note · `new-year-note` | 短款灯会交领衫 (cut:cropped, sleeve:short, closure:wrap, hem:asymmetric) | 奶油小领结 · 折叠纸扇 · — | `#f2e2b8` / `#cba66a` |
| 芭蕾小演出 / Ballet recital · `ballet-recital` | 泡泡袖芭蕾小外套 (cut:cropped, sleeve:puff, closure:bow, hem:scallop) | 花朵小胸针 · 舞台小麦克风 · — | `#f0dce3` / `#c498a4` |
| 俱乐部纪念日 / Club anniversary · `club-anniversary` | 校园棒球外套 | 快乐队员奖章 · 便当小饭盒 · 纸鸢背部小架 | `#dee5ce` / `#b9a278` |
| 茶会百褶裙 / Tea-party pleats · `tea-party-dress` | 画廊百褶长裙 (cut:long, detail:pleats, sleeve:none, closure:buttons) | 链条怀表 · 发条小八音盒 · — | `#e7dfea` / `#b7a3b8` |
| 节日小爵士 / Festival jazz · `festival-jazz` | 喇叭袖爵士短衫 (cut:cropped, sleeve:bell, closure:buttons, detail:ruffles) | 缎带纪念胸针 · 舞台小麦克风 · — | `#e6d9e7` / `#b7a0ba` |
| 草地小庆祝 / Picnic party · `picnic-party` | 格纹交叠短裙 (cut:regular, closure:bow, sleeve:short, pattern:check) | 奶油小领结 · 编织小提篮 · 绑带野餐毯 | `#e4e4ce` / `#baa87c` |
| 果园小宴会 / Orchard banquet · `orchard-banquet` | 莓果无袖灯笼裙 (cut:long, hem:bubble, sleeve:none, detail:pleats) | 花朵小胸针 · 春日小花束 · — | `#ecd8df` / `#bd9299` |
| 第一场演出 / First little show · `first-show` | 拼布喇叭袖罩衫 (cut:regular, sleeve:bell, detail:patches, hem:scallop) | 云朵小挂章 · 木纹小吉他 · 轻盈小翅膀 | `#edd8c8` / `#be997d` |

### 一点点魔法 · A little wonder

| Look / ID | Body silhouette | Chest · Side · Back | Robot shell / accent |
|---|---|---|---|
| 月亮花园 / Moon garden · `moon-garden` | 叠层花瓣裙 | 叠瓣莲花胸针 · — · 花园彩蝶翼 | `#e8d9e8` / `#c8ac77` |
| 图书馆魔法 / Library spell · `library-spell` | 垂褶星空斗篷 | 蛋白石轨道胸针 · 口袋小书 · 月光叠层羽翼 | `#ddd9e6` / `#c3aa74` |
| 云间明信片 / Cloud postcard · `cloud-postcard` | 交叠小和服 | 蛋白石轨道胸针 · 星星小挂饰 · 奶油层云翼 | `#e0e9e5` / `#b6a9bb` |
| 蜂蜜派送 / Honey delivery · `honey-delivery` | 蜂蜜花边围裙 | — · 橡果叶扣小袋 · 琥珀蜻蜓翼 | `#f1dda4` / `#c59a51` |
| 月光小灯笼裙 / Moon balloon · `moon-balloon` | 莓果无袖灯笼裙 (cut:long, hem:bubble, sleeve:none, detail:pleats) | 叠瓣莲花胸针 · 星星小挂饰 · 暮色丝绒蛾翼 | `#e8dce9` / `#baa6c1` |
| 云端小纸鸢 / Cloud kite · `cloud-kite` | 云边波浪雨披 (cut:regular, hem:scallop, closure:bow, pattern:dots) | 云朵小挂章 · 折叠纸扇 · 纸鸢背部小架 | `#dfeceb` / `#b8b4ad` |
| 铃铛小奇遇 / Bell jester · `bell-jester` | 波浪边小斗篷 (cut:cropped, hem:scallop, closure:bow, detail:ruffles) | 缎带纪念胸针 · 星星小挂饰 · 流线燕尾翼 | `#e5d9ec` / `#b69dbe` |
| 卫星小来信 / Satellite letter · `satellite-letter` | 轻量骑行风壳 (cut:cropped, sleeve:none, closure:zip, hem:asymmetric) | 奶油拍立得相机 · 口袋小书 · 折叠机械羽翼 | `#dfeae7` / `#b5a7a1` |
| 萤火小花园 / Firefly garden · `firefly-garden` | 拼布喇叭袖罩衫 (cut:regular, sleeve:bell, detail:patches, hem:scallop) | 叠瓣莲花胸针 · 春日小花束 · 森林层叶翼 | `#e3e8d4` / `#baa682` |
| 绘本小花冠 / Storybook bloom · `storybook-royal` | 花枝交领汉服 (cut:long, sleeve:bell, closure:wrap, pattern:petals) | 珍珠小吊坠 · 缎边小灯笼 · — | `#eadce5` / `#bea0af` |

## Verification

Catalogue checks confirm exactly 100 unique canonical recipes, 10 looks in each theme, 206 unique item IDs, and shell/accent plus bilingual feature metadata on every look. Compatibility checks cover legacy scalar accessory migration, region-preserving equip/remove, unknown and wrong-slot rejection, and caller input immutability.

The 100 recipes also have 100 distinct combinations of slot/kind plus accessory-region/kind, even when all colours, names, design parameters, hat tilt and fit offsets are ignored. Their count therefore does not depend on recolours or tiny geometric adjustments.

The complete 100-look geometry check builds every selected item, checks accessory-region metadata and rejects non-finite positions or normals. It compares position-plus-transform hashes, excluding materials and colours, to detect duplicate geometry across the recipes. This verifies catalogue coverage and accidental duplication; the visual contact sheets assess the actual fashion silhouettes. Export compilation and motion/ground-support validation run separately against the current factories.

`node scripts/validate-accessory-fit.mjs` checks actual native triangles, surface clearance and closed-solid containment in both directions. It covers standalone accessories, catalogue combinations and stated wing contexts with garments and all three accessory regions. Movement checks use finite samples from all 16 manual actions and 120 seconds of autonomous idle, including the visual jaw. Wing visibility is sampled from one front three-quarter view. These checks do not establish continuous-motion clearance, visibility from every angle or every possible cross-slot combination.

# URDF 与 MJCF 导出

网页的「导出搭配」始终下载一个 ZIP，同时包含 `microduck.urdf` 与 `microduck.xml`，以及它们引用的全部本体 STL、服饰 OBJ、材质、来源 manifest 和上游许可证。解压后保持目录结构，所有模型引用都是相对路径，无需依赖网站或联网加载。

当前衣橱有 24 套精选搭配。帽子、眼镜、衣服、配饰、腿装/鞋袜是五个独立槽位，整套和跨套混搭使用同一导出流程；卸下的槽位不会留下几何。

眼镜保持 Microduck 的独眼设计：每个单件仅有一个镜框和一片镜片，对齐原始相机。导出 manifest 的 `detailName` 记录这些部件，验证会检查镜框与镜片的数量。

本体使用固定版本的 [Pollen Robotics 官方 Microduck RL 模型](https://github.com/pollen-robotics/microduck_rl/tree/8d0db74916a4f833d1d9b95d6a1d7f4d13b9d5ec/src/mjlab_microduck/robot/microduck)。原始资产保留 Apache-2.0 许可证。服饰是 DuckRobe 生成的独立三维几何，并根据真实机器人 CAD 坐标挂到头部、躯干或对应腿部/足部。左右腿的服饰分别随真实关节运动。

本体的 visual geom 默认使用网页相同的橙色配色，也可以独立设置外壳 `shell` 与嘴脚 `accent` 颜色。规范后的两个色值记录在 `manifest.json` 的 `bodyColors` 中，每个原生 visual mesh 的实际颜色记录在 `visualPaletteOverrides` 中。此调整只影响视觉颜色；原始 STL、碰撞颜色、惯量与关节参数保持来源值。

## 文件内容

| 文件 | 用途 |
| --- | --- |
| `microduck.xml` | 完整 MuJoCo MJCF，保留原始 14 个驱动关节、浮动根节点、惯量、碰撞、传感器和 actuator 定义 |
| `microduck.urdf` | 同一机器人关节树、轴、限位、质量和完整惯量张量，服饰通过无质量 fixed link 挂载 |
| `meshes/robot/*.stl` | 38 个上游原始机器人 mesh |
| `meshes/outfits/*.obj` | 当前帽子、衣服、配饰的几何；嵌套缩放、旋转和平移已转换到对应 body 的局部坐标 |
| `materials.mtl` | 服饰颜色与透明度，MJCF 和 URDF 内也写入相同颜色 |
| `manifest.json` | 五槽单件选择、本体颜色、来源版本、关节参数、每个单件的实际 body 挂点和兼容性说明 |
| `LICENSE-Microduck.txt` | 原样保存的上游许可证 |

长度单位为米，角度为弧度。网页里的蹦跳和转台朝向不会冻结进导出模型。导出服饰在机器人参考坐标中随原有关节运动。

MJCF 另外包含 `duckrobe_preview` keyframe，可以恢复网页里的站立参考姿态和脚底地面高度。挂在左右 ankle 的鞋会按实际顶点最低点补偿根节点高度，记录为 `previewGroundAdjustment`；长裙、配饰与上腿暖套不改变脚底基准。源模型的 CAD 零位和关节定义仍保留。导出的 ZIP README 附有相同代码：

```python
import mujoco
model = mujoco.MjModel.from_xml_path('microduck.xml')
data = mujoco.MjData(model)
key = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_KEY, 'duckrobe_preview')
mujoco.mj_resetDataKeyframe(model, data, key)
mujoco.mj_forward(model, data)
```

URDF 消费者可以用 `manifest.json` 的 `previewJointPositions` 设置 14 个关节角，再用 `previewRootPose` 设置浮动根节点的世界坐标姿态，得到同样的站立展示。网页动画不会改变这些参考值。

## 仿真语义

服饰是视觉部件，没有碰撞，也没有质量。MJCF 在原始 body 上添加 `contype="0"`、`conaffinity="0"`、`mass="0"` 和 `density="0"` 的 mesh geom；不会意外改变本体动力学。URDF 服饰 link 没有 inertial 或 collision 元素。导出结果用于三维预览和机器人仿真，未包含布料仿真或可直接制作的纸样。

服饰的几何、顶点法线、基本颜色与透明度会导出；网页材质中的程序织纹和纹理贴图不会烘焙到 OBJ。相同单件保持相同轮廓与基本颜色。`selection` 使用独立单件 ID，包含 `hat`、`eyewear`、`body`、`accessory`、`legwear` 五个键，`null` 表示卸除。多 body 的腿装会在 `clothing` 中分别记录同一 `itemId` 与对应 `bodyName`。

调用 `buildExportBundle` 或 `exportLook` 可以传入 `colors: { shell, accent }`（也支持 `bodyColors`）。显式色值优先于 `robot.metadata.bodyColors`，并经过网页同一套颜色规范化处理。动画只改变当前展示姿态；导出仍使用稳定参考坐标和预览 keyframe。

MJCF 是保留上游 actuator、armature、传感器和接触参数的完整格式。URDF 无法表达这些 MuJoCo 特性：effort 使用上游 actuator 的力矩限值；源模型没有指定速度限制，URDF 必填的 velocity 使用明确记录的 **10 rad/s 导出约定**，并非 Microduck 硬件额定值。

## 验证

```bash
node scripts/validate-exports.mjs --all --out=/tmp/duckrobe-export-v2-validation
python scripts/validate-exports.py /tmp/duckrobe-export-v2-validation
```

第一步在 Node 中实际构造 24 套服饰、五槽混搭、多 body 腿装、卸除、裸机和自定义本体配色，生成 ZIP 并检查两个格式的全部相对 mesh 引用。也检查网页动作没有写进静态导出文件。第二步需要 Python 的 `mujoco` 与 `numpy`，实际编译每个 MJCF，对照官方源模型检查关节、actuator、质量、惯量与碰撞参数不变，同时解析 URDF 并逐 body 对照两格式的预览姿态和服饰挂点。

只检查代表性系列与混搭时可省略 `--all`。生成文件写到指定临时目录，不修改仓库资产。

后续只修复某几款服饰时，可以选择受影响的案例并输出到独立目录，再对该目录运行 Python 验证：

```bash
node scripts/validate-exports.mjs --all --cases=butter-walk,active-behavior-export --out=/tmp/duckrobe-export-fit-check
python scripts/validate-exports.py /tmp/duckrobe-export-fit-check
```

若完整动力学已验证通过，后续只调整视觉几何，可保留源 XML、惯量与 actuator 的保护检查，同时单独复验编译、几何、挂点、姿态、配色与地面高度：

```bash
python scripts/validate-exports.py /tmp/duckrobe-export-fit-check --geometry-only --prior-physics-report /tmp/duckrobe-export-v2-validation/mujoco-validation.json
```

这种报告会明确标记 `geometry-only` 和 `dynamicsCompared: false`，并引用之前的完整动力学结果。

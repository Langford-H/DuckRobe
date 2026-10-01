# Microduck source assets

See `/THIRD_PARTY_NOTICES.md` in the project source for provenance and license
details. `manifest.json` pins every input to a fixed official revision and stores
SHA-256 hashes. The upstream source files in `source/` are unmodified.

`web/microduck.glb` is generated entirely from the pinned native repository's
38 STL files by `node scripts/build-robot-glb.mjs`. The converter applies MJCF
mesh scale, welds identical vertices and retains all source triangles. It
contains individual geometries rather than an assembled rig.
`web/kinematics.json` is generated from the same pinned native MJCF by
`node scripts/build-robot-kinematics.mjs`. It has `bodies`, `actuated_joints` and
`mesh_dir`, including all 70 native visual mesh instances. Body and mesh
positions use metres; quaternions are `[w,x,y,z]`. The native robot frame is +X
forward, +Y left, +Z up. The browser rig retains this coordinate convention.

The assembled default standing simulation pose is approximately 0.123 m deep,
0.142 m wide and 0.272 m tall. This is a measured simulation bounding box, not
a garment manufacturing specification; the official product sheet lists 25 cm
height and 14 cm width.

Outfit anchors are child groups of the corresponding robot body, world-aligned
in the default pose. `jaw_soft` is the whole head body; `trunk_base` is the torso;
`ankle_left` and `ankle_right` are the feet. Native export must expand the anchor's
body-local transform rather than treating world-aligned garment geometry as CAD
body-local geometry.

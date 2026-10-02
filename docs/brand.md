# DuckRobe brand assets

**Every duck deserves a wardrobe.**

每只小鸭，都值得拥有自己的衣橱。

The mark reduces the real, single-eyed Microduck to its rounded head shell,
one camera eye and lower jaw seam. The lowercase wordmark has no trailing dot.
The wordmark is outlined from the local Lato font, so it has consistent shapes
across platforms. SVG counters are transparent, so the surrounding background
shows through.
The header uses cream lines on ink green; the favicon uses orange with a
slightly heavier stroke for small-size clarity.

- [Promotional cover](../public/brand/cover.png): 3840 × 1920 PNG.
- [Logo](../public/brand/logo.svg): scalable wordmark and single-eye mark.
- [Brand mark](../public/brand/logo-mark.svg): transparent monochrome SVG.
- [Favicon](../public/favicon.svg): the same head silhouette.

## Rebuild the cover

The cover is rendered directly from the project's native Microduck meshes and
shared garment geometry. Three ducks wear Harbour day, Butter walk and Sunday
linen, each with its coordinated body colors. They take a tiny step, tilt their
head to say hello and make a little hop using fixed frames from the real joint
animation library. An orthographic studio camera, soft environment lighting and a
blurred contact shadow derived from the models' actual depth ground the composition. The robot and text
are rendered sharply; there are no grain textures or image-generation steps.

After installing the project's dependencies and Playwright Chromium:

```bash
npx playwright install chromium
node scripts/render-brand.mjs --report=test-results/brand-render.json
```

The command overwrites `public/brand/cover.png`. To try three different existing looks
without replacing the published cover:

```bash
node scripts/render-brand.mjs --looks=harbour-day,butter-walk,sunday-linen --out=test-results/cover-preview.png
```

`scripts/brand-scene.js` controls the real 3D camera, lighting and contact shadow.
`scripts/brand-render.html` controls the cream background, vector branding and
slogan layout. `scripts/render-brand.mjs` starts a temporary local server, waits
for the native meshes and typography, and captures a 4K PNG in fresh Chromium.
No external image service or network font is used.

The source palette is warm cream `#f8f4e7`, orange and ink green `#29362d`.
The unmodified local Lato font used for cover typography is distributed with its
SIL Open Font License in `scripts/assets/`; see
[third-party notices](../THIRD_PARTY_NOTICES.md).

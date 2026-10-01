# DuckRobe

A playful 3D wardrobe for the real Microduck. Twenty-four curated designer-toy looks, five independent clothing categories, customizable orange robot colors, and a little companion who looks around, hops, dances and twirls.

## Run

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Open the address shown in your terminal. To build the static site:

```bash
npm run build
npm run preview
```

Robot assets are bundled locally. The wardrobe opens in English; the header switches between English and Chinese and remembers your choice. Favorites, colors and saved outfits stay in the current browser.

## GitHub Pages

The live wardrobe is at **[ruziniuuuuu.github.io/DuckRobe](https://ruziniuuuuu.github.io/DuckRobe/)**.

[Deploy to GitHub Pages](https://github.com/ruziniuuuuu/DuckRobe/actions/workflows/deploy-pages.yml) validates robot behavior, every outfit export and asset loading at both root and project paths before building. Pushes to `main` deploy automatically; pull requests run the same checks and build. You can also run the workflow manually from Actions. The repository's Pages source must be **GitHub Actions**.

The build uses the Pages configuration's base path, including for the 3D robot and export assets. Local development defaults to `/`. To preview the project path locally:

```bash
VITE_BASE_PATH=/DuckRobe/ npm run build
VITE_BASE_PATH=/DuckRobe/ npm run preview
```

Open the preview server's `/DuckRobe/` URL. `node scripts/validate-subpath-assets.mjs` checks actual model and export requests against a server that rejects paths outside that prefix.

## Play and dress up

- Choose a complete look, or browse **hats, eyewear, clothes, accessories and legwear** separately. Each piece has its own product preview and changes only its category. Eyewear has one frame around Microduck's single central eye. The Wearing now chips let you remove pieces individually.
- Customize the robot's shell and accent colors using palettes or color pickers. Saved looks include both the five-part combination and body colors.
- Your duck alternates calm observation, little hops, dance steps, twirls and rest. Move the mouse near it for a curious greeting. Dragging the camera briefly quiets the pet for inspection; the motion switch pauses idle activity. Hop, dance and twirl can also be triggered directly.
- Search in either language, filter by collection, favorite individual pieces or whole looks, and restore your saved combinations.
- Export a ZIP containing **URDF + MJCF**, original robot meshes, current clothing meshes, selected body colors, joint data, source versions and licenses.

The 24-look design catalog is in [docs/wardrobe.md](docs/wardrobe.md). The previous catalog has been removed; its browser storage is discarded when this revision loads.

Exports preserve the native robot's dynamics. Clothing is decorative geometry rather than simulated cloth or manufacturing specifications. Coordinates, attachment transforms and validation details are in [docs/export.md](docs/export.md).

## Verify

Start the development server, then run `npm run check:ui`. Fresh local Chromium exercises bilingual controls, five independent categories, product thumbnails, colors, saving, actions, responsive layouts and a real ZIP download. Its default address is `http://localhost:5173`; override with `DUCKROBE_URL`.

`npm run check:exports` validates every curated outfit plus mixtures, removed pieces, colors and the bare robot. Real MuJoCo compilation and dynamics comparisons are described in the export document.

`node scripts/validate-behavior.mjs` checks joint limits, foot contact, hopping, dance, turning, pointer response, drag suppression and immutable export metadata against the bundled robot model.

`node scripts/validate-eyewear-fit.mjs` compares all 19 eyepieces with the actual native head triangles, including the open-beak greeting pose. It checks separation across the frame, lens, hinges and curved temples; bounding boxes only prune candidate triangles.

## Files

- `src/outfits.js`: curated looks, independent pieces and garment geometry.
- `src/robot.js`: official robot geometry, native joints, clothing anchors and body colors.
- `src/behavior.js`: one joint-pose compositor for idle actions and interaction.
- `src/main.js`: wardrobe state, filtering, saving and controls.
- `src/i18n.js`: English and Chinese interface copy.
- `src/preview.js`: live fitting room and separate product/complete-look photography.
- `src/export.js`: URDF/MJCF and mesh packaging.
- `public/robot/manifest.json`: pinned upstream versions, source files and SHA-256 hashes.

## Sources

Robot assets come from [Pollen Robotics Microduck RL](https://github.com/pollen-robotics/microduck_rl), with the [official web simulator](https://huggingface.co/spaces/pollen-robotics/microduck-simulator) as a reference. Exact asset scope and licensing are recorded in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

# DuckRobe brand assets

**Every duck deserves a wardrobe.**
每只小鸭，都值得拥有自己的衣橱。

The logo is a simple monoline drawing of Microduck: one central camera eye, the head shell, a short mechanical neck and two legs. It uses no filled color blocks or background tile. A light lowercase wordmark accompanies the mark. The header displays cream lines on its dark background; the favicon uses orange lines for small-size contrast.

- [Promotional cover](../public/brand/cover.png): 1774 × 887 PNG, displayed in the README.
- [Logo](../public/brand/logo.svg): editable SVG wordmark and single-eye line drawing.
- [Brand mark](../public/brand/logo-mark.svg): transparent, monochrome SVG.
- [Actual robot reference](brand-reference.png): a render of the final Butter walk outfit, captured from this project's real Microduck mesh and garment geometry.

The cover was made with the **built-in image generation tool**, then edited with the same tool to adopt the final slogan and lighter typography. The SVG logo and mark were drawn directly as project-native vector assets. The promotional image is separate from the interactive renderer; selectable clothing uses actual application geometry. Warm cream `#f8f4e7`, orange and ink green `#29362d` match the interface.

## Cover specification

```text
Use case: ads-marketing
Asset type: refined wide promotional cover for the DuckRobe GitHub README, landscape about 2:1.
Primary request: create a minimal, polished studio cover for a playful 3D wardrobe for the real single-eyed Microduck robot.
Input images: Image 1 is the exact robot identity and outfit reference, a real rendered Microduck from this project. Preserve its anatomy, mechanical construction, visible joints, colors and clothes. It is a reference, not a backdrop.
Scene/backdrop: seamless warm cream studio background with a very soft grounded shadow and ample empty space.
Subject: one Microduck wearing the referenced butter-yellow tilted beret, one circular eyeglass frame around its single central camera eye, cream cable-knit cardigan, little cream tote, and cream shoes. Preserve the real orange rounded rectangular head, single camera aperture, short lower beak plate, exposed black mechanical neck, compact cylindrical torso, two articulated mechanical legs, and long small feet. No arms. Keep the head, joints, proportions and clothing silhouettes faithful to the reference; polish lighting and materials.
Style/medium: premium designer-toy product photography / clean physically based 3D studio render, soft matte plastic, fine cloth texture, crisp smooth edges. Simple and refined with a touch of playfulness.
Composition/framing: wide editorial composition. Entire full-body robot on the right half, facing slightly inward toward the left, feet and head completely in frame. Minimal wordmark on left with generous breathing room.
Lighting/mood: soft warm studio daylight, friendly and calm.
Color palette: warm cream #f8f4e7, butter and orange, deep ink green #29362d for type; restrained use of color.
Text (verbatim): "duckrobe" as the large simple lowercase wordmark, and "Every duck deserves a wardrobe." as a small elegant line below. Render only these two text elements, with crisp, light-to-regular-weight rounded sans-serif typography.
Constraints: exactly one robot, exactly one central eye and exactly one eyeglass ring, no arms, two real robot legs; preserve reference identity. Avoid turning it into an organic duck or humanoid mascot. Clothing stays away from exposed neck motors. No floating hat, no extra camera eyes, no watermark, no decorative clutter, no badges or numbers.
```

## Final edit prompt

The previously generated cover was the edit target; the exact prompt was:

```text
Use case: text-localization
Asset type: DuckRobe GitHub README promotional cover.
Primary request: edit the supplied cover to use the new brand slogan and a lighter, more refined wordmark.
Input images: Image 1 is the exact edit target, the current cover.
Text (verbatim): keep the large wordmark "duckrobe." and replace the small line below with exactly "Every duck deserves a wardrobe."
Typography: large wordmark should become a clean light-to-regular-weight rounded sans serif, considerably slimmer than the current heavy bold text. Small slogan remains elegant, readable, dark ink green, with generous spacing. Keep the two text elements centered within the left-side empty space, the new slogan fitting comfortably below.
Constraints: edit only the left text area. Preserve the single-eyed Microduck robot on the right exactly, its one eye and eyeglass frame, tilted beret, cream cardigan, tote, articulated legs and shoes, original anatomy, pose, colors, framing, cream studio background, light and shadows. Preserve the wide 2:1 composition. No extra logo icon, no added characters or ornaments, no watermark.
```

## Final typography cleanup

The counter of the initial lowercase d now shows the surrounding cream background. The large wordmark reads **duckrobe**, without a trailing dot. The slogan keeps its sentence punctuation.

Both changes used the built-in image editing tool, with these targeted prompts:

```text
Use case: precise-object-edit
Asset type: final DuckRobe README cover.
Primary request: make one small typography cleanup in the supplied image. Inside the lowercase "d" of the large "duckrobe." wordmark, the letter counter currently has a conspicuous solid white fill. Remove that white fill so the cream studio background shows through the counter seamlessly, matching the interior counters of the other letters.
Constraints: change only the white-filled counter inside that single letter d. Keep all wordmark strokes and weight, spacing, the exact slogan "Every duck deserves a wardrobe.", and every other pixel as close to the supplied image as possible. Preserve the robot anatomy, eye, clothes, pose, all lighting, shadows, cream backdrop and wide 2:1 framing. Add nothing else.
```

```text
Use case: precise-object-edit
Asset type: final DuckRobe promotional cover.
Primary request: remove only the large dark green period / circular dot immediately after the final e in the large "duckrobe." wordmark, near x=54%, y=49%. The large brand name must read exactly "duckrobe" without any dot. Seamlessly fill the removed dot area with the surrounding warm cream studio background.
Constraints: keep the cream background inside the d counter (already fixed), the exact smaller slogan "Every duck deserves a wardrobe." including that slogan's own final punctuation, all other typography, spacing, robot, outfit, anatomy, light and shadow unchanged. Preserve the wide 2:1 composition and every detail elsewhere. No additions or watermarks.
```

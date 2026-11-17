# Image Studio by Shifros

Convert images to WebP, JPG or PNG, then resize, crop and compress them in the browser. Images are never uploaded.

Live: https://webp.shifros.com

## Features

- Batch conversion of up to 20 images (JPG, PNG, WebP, GIF, SVG, BMP, AVIF) to WebP, JPG or PNG.
- Batch settings: format, quality, maximum size, filename suffix.
- Per-image overrides: format, quality, exact output size, crop, rotation, flip.
- Crop to an exact size: enter a width and height and the crop box locks to that ratio.
- Download one image or all images as a ZIP.
- Light and dark themes, keyboard shortcuts (Ctrl+O, paste), drag and drop.
- Responsive from phones to 4K displays.

Limits: 50 MB per file, 64 megapixels, 16,384 pixels per side. Animated images export as their first frame. JPG has no transparency; transparent areas become white.

## Privacy

All decoding, editing and encoding uses the browser's canvas. There is no server, no HTTP API, no analytics and no third-party requests. Files live in memory and are cleared when the tab closes.

## Development

Requires Node.js 20 or later.

```sh
npm ci
npm run dev      # http://localhost:3000
npm run build    # static site in dist/
```

## Deployment

`dist/` is a static site. Vercel builds it with `npm run build` and serves it with the headers in `vercel.json`. JavaScript bundles are content-hashed and cached for one year.

## Search and agents

- `src/site.json`: title, description, canonical URL and FAQ. Used by the page, the meta tags and the JSON-LD.
- `public/index.html`: meta tags, Open Graph, Twitter card, JSON-LD (WebApplication, Organization, FAQPage) and crawlable fallback content.
- `sitemap.xml`: generated at build time.
- `robots.txt`, `llms.txt`, `og-image.jpg`, `favicon.ico`, `icons/`: copied from `public/` at build time.
- `window.ShifrosImageStudio`: in-page API for browser agents. Spec in `public/llms.txt`.
- Link presets: `?format=webp&quality=80&width=1200&height=1200&suffix=-web`.

## Project structure

| Path | Purpose |
|------|---------|
| `src/App.js` | Workspace, batch settings, file lifecycle, dialogs |
| `src/ImageEditor.js` | Per-image crop, size, format, quality, rotation, flip |
| `src/image-tools.js` | Decoding, transforms, encoding, download helpers |
| `src/agent-api.js` | `window.ShifrosImageStudio` and WebMCP tool |
| `src/motion.js` | Dialog close animation, view transitions, segmented controls |
| `src/Icon.js` | Inline icon set |
| `src/styles.css` | Design tokens, layout, themes, motion |
| `src/site.json` | Site metadata and FAQ |
| `public/brand/` | Logos, fonts, background artwork |
| `public/icons/` | App icons and favicon sizes |

## License

Source code: MIT, see `LICENSE`.

The Shifros name, logos, app icon and background artwork in `public/brand/`, `public/icons/`, `public/favicon.ico` and `public/og-image.jpg` are not covered by the MIT license and may not be used without permission. Cal Sans and Inter are licensed under the SIL Open Font License; see `public/brand/`.

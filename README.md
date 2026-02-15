# PDF Merger

A browser-based PDF merge tool built with Angular. It supports importing images and PDFs, reordering files and pages, rotating/removing pages, previewing output, and exporting one merged PDF.

## Credits
- App implementation and engineering support: **OpenAI Codex (GPT-5)**
- Built and customized in collaboration with the project owner.

## Features
- Import `PDF`, `JPG`, `JPEG`, `PNG`, `WEBP`
- Drag-and-drop import
- File-level reorder (before page expansion)
- Page-level reorder across all imported files
- Page rotation and page removal
- Export settings:
  - file name
  - paper size (including common presets)
  - image quality
- Preview support:
  - file previews
  - page previews
  - export print preview (quick and full mode)
- Light/dark theme toggle

## Tech Stack
- Angular 21 (standalone components)
- Tailwind CSS v4 (CSS token-based theming)
- `pdf-lib` (composition/export)
- `pdfjs-dist` (preview rendering)
- `@angular/cdk` (drag/drop)
- `@ng-icons` + Lucide icons

## Requirements
- Node.js 20+ (Node 22 recommended)
- npm

## Local Development
Install dependencies:

```bash
npm install
```

Run dev server:

```bash
npm start
```

Open:

```text
http://localhost:4200/
```

## Build
Production build:

```bash
npm run build
```

Output directory:

```text
dist/pdf-merger/browser
```

## Tests
Run unit tests:

```bash
npm test
```

## GitHub Pages Deployment
This repo includes GitHub Actions workflow:

```text
.github/workflows/deploy-pages.yml
```

### Current deployment setup
- Trigger branch: `master`
- Workflow builds with repository-aware base href:
  - `--base-href "/<repo-name>/"`
- Uploads `dist/pdf-merger/browser` as Pages artifact
- Adds SPA fallback (`404.html`) for Angular routing

### One-time GitHub configuration
1. Go to `Settings > Pages`.
2. Set source to `GitHub Actions`.
3. Push to `master` (or run workflow manually).

## PDF Worker on GitHub Pages
To avoid worker 404 errors in subpath deployments:
- Worker file is copied into build assets via `angular.json`
- App resolves worker URL via app base URI in:
  - `src/app/core/services/pdf-preview/pdf-preview.ts`

Expected deployed worker path:

```text
/assets/pdf.worker.min.mjs
```

## Known Build Warnings
You may see warnings during build:
- Initial bundle size budget exceeded
- `pako` is CommonJS (via `pdf-lib`)

These are currently non-blocking for deployment.

## Project Structure (High-Level)
- `src/app/features/import` - file intake and validation
- `src/app/features/files` - file reorder step
- `src/app/features/pages` - page management step
- `src/app/features/export` - export options and merged preview
- `src/app/core/services` - import/edit/preview/composition logic
- `src/styles.css` - Tailwind v4 + theme tokens

## License
No license file is currently included. Add one if you plan to distribute publicly.

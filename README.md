# WebP Converter & Editor

React + Node.js app to convert images to WebP and perform edits (crop + resize) using Sharp.

## Features

- Image upload and WebP conversion
- Crop and resize controls
- Batch conversion
- Dark/light mode UI
- Supports common image formats (JPEG, PNG, GIF, WebP, TIFF, BMP)

## Tech stack

- Frontend: React + `react-native-web` + `react-image-crop`
- Backend (local dev): Node.js + Express + Sharp
- Build: Webpack + Babel
- Deployment: Vercel (API routes under `api/`)

## Local development

Install dependencies:

```bash
npm install
```

Start frontend + backend together:

```bash
npm run dev:full
```

Open:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`

## API

### Local Express server (`server.js`)

- `GET /health`
- `POST /convert` (single image; supports crop/resize options)
- `POST /convert-batch` (multiple images)

### Vercel routes (`api/`)

With `vercel.json` rewrites:

- `GET /api/health` → `api/health.js`
- `POST /api/convert` → `api/convert.js`
- `POST /api/convert-multiple` → `api/convert-multiple.js`

## Scripts

- `npm run dev`: start the frontend dev server
- `npm run dev:server`: start the backend with nodemon
- `npm run dev:full`: run frontend + backend concurrently
- `npm run build`: production build into `dist/`
- `npm run server`: run the backend server

## Project structure

```
.
├── api/                 # Vercel serverless functions (Sharp)
├── public/              # HTML template
├── src/                 # Frontend (React Native Web)
├── dist/                # Webpack build output
├── server.js            # Local Express backend
├── webpack.config.js
└── vercel.json
```

## License

MIT

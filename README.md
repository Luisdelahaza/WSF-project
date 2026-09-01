# WSF Timeframe Export Tool — scaffold

Starting point for the assignment in [ASSIGNMENT.md](ASSIGNMENT.md): an in-app
tool that exports an animated timeframe of the **World Settlement Footprint**
layer for a selected map area as a **GIF or video**, with a superimposed
MindEarth logo and WSF info — all processed **client-side**.

The tool is a **modal** launched from a map: pan/zoom to your area, open
"Export WSF timeframe", choose the period and parameters, preview, and export.

Built on **Next.js 15 (App Router) + React 19 + Tailwind v4** using components
ported from `wsf-platform`, so it drops in with minimal change.

## What's provided vs. what you implement

**Provided** (map-handling, data, UI scaffolding — fully implemented & tested):

- Next.js + Tailwind v4 setup with the wsf-platform design tokens and ported
  UI components (`button`, `input`, `slider` + `RangeSlider`, `select`,
  `dialog`, `collapsible`, `logo`).
- The full UI shell: map page (centered on Spain) + export modal with
  auto-loading metadata, epoch-based period slider, live canvas preview
  (play/pause/scrub with frame caching), export panel with budget display.
- All data-layer modules: `urlBuilder` (`infoUrl` + `tileUrl`),
  `wsfMetadata` (`fetchMetadata` + `normalize` + epoch/date helpers),
  `exportBudget` (`computeBudget`), `tileClient` (`fetchTile`),
  `frameCapture` (`renderEpochFrame`, `captureFrames` — WebMercator tile
  compositing).
- Types/contracts (`src/types.ts`), env config + the WSF colormap + epoch model
  (`src/config/wsf.ts`).
- Vitest setup (`vitest.config.ts`) with tests covering all provided modules.

**You implement** (search for `Not implemented`):

| File | What |
| --- | --- |
| `src/lib/overlay.ts` | `loadLogo` + `drawOverlay` — MindEarth branding overlay on each frame (§6.4) |
| `src/lib/gifEncoder.ts` | `encodeGif` — animated GIF via `gifenc` (§6.5) |
| `src/lib/videoEncoder.ts` | `encodeVideo` — WebCodecs/MediaRecorder capability ladder (§6.5) |

The `lib/` modules are React-free so they lift straight into `wsf-platform`.

## Prerequisites

- Node **24.11.1** (see `.nvmrc`: `nvm use`) and `pnpm`.
- A TiTiler endpoint — the **staging** TiTiler (simplest, no local Docker) or a
  local one from the `wsf-titiler` repo.

## Install & run

```bash
nvm use                     # Node 24.11.1
cp .env.example .env.local  # set NEXT_PUBLIC_TITILER_URL + NEXT_PUBLIC_WSF_DATASET_URL
pnpm install
pnpm dev                    # http://localhost:3000
```

Other scripts: `pnpm build`, `pnpm start`, `pnpm typecheck`, `pnpm test`,
`pnpm test:watch`.

Local TiTiler instead of staging (in the `wsf-titiler` repo):

```bash
cp .env.example .env && docker compose up --build
curl http://localhost:8000/healthz
# then set NEXT_PUBLIC_TITILER_URL=http://localhost:8000 in .env.local here
```

## Configuration

All config is env-driven — **no credentials in this repo**. Dataset, endpoint
type, and variable are **fixed by the environment** (not user-editable in the
UI). See [.env.example](.env.example):

| Var | Meaning | Default |
| --- | --- | --- |
| `NEXT_PUBLIC_TITILER_URL` | TiTiler base URL (staging or local) | staging CloudFront URL |
| `NEXT_PUBLIC_WSF_DATASET_URL` | Dataset path | staging WSF zarr |
| `NEXT_PUBLIC_WSF_API_PREFIX` | `geozarr` \| `md` \| `cog` | `geozarr` |
| `NEXT_PUBLIC_WSF_VARIABLE` | Variable name | `wsf_tracker` |

## Project layout

```text
src/
├── app/              layout.tsx, page.tsx, globals.css (App Router)
├── styles/           globals.css, generated-tokens.css (wsf-platform tokens)
├── components/
│   ├── ui/           button, input, slider (+RangeSlider), select, dialog,
│   │                 collapsible, logo (ported)
│   ├── WsfTimeframeExport.tsx   map page (Spain) + floating panel
│   ├── ExportDialog.tsx         modal (auto-loads metadata, wires everything)
│   ├── MapSelector.tsx          basemap; area = current viewport
│   ├── TimeframeControls.tsx    epoch range slider + Config-options collapsible
│   ├── ExportPanel.tsx          budget, export, download, cancel
│   └── PreviewPlayer.tsx        live canvas preview (play/pause/scrub/cache)
├── lib/              urlBuilder ✅, wsfMetadata ✅, tileClient ✅,
│                     frameCapture ✅, exportBudget ✅, utils ✅,
│                     overlay 🔲, gifEncoder 🔲, videoEncoder 🔲
├── config/wsf.ts     env config, budget constants, WSF colormap, epoch model
└── types.ts
```

Legend: ✅ = provided & tested · 🔲 = you implement

## Reusing in wsf-platform

The tool is one client component (`ExportDialog`) over React-free `lib/`
modules. To integrate: copy `lib/*` + `ExportDialog` and the bits of
`TimeframeControls`/`ExportPanel` you want, mount the dialog from the existing
map UI, and reuse the platform's TiTiler/zarr env vars and basemap.

## Notes & known limitations

- **Styling:** uses the wsf-platform tokens (`generated-tokens.css`) verbatim,
  except its custom `--spacing-*` scale is removed so Tailwind's numeric
  utilities (`h-6`, `p-4`, …) size normally. `Button` is the platform's, minus
  the `motion`-based `MotionButton`. `Logo` is adapted to drop the jotai
  color-mode store (dark-only). `Select` is the platform's Radix select.
- **Basemap:** MapLibre's keyless demo style. Swap for the platform basemap on
  integration. (maplibre-gl forces `position: relative` on its container, so
  the map is sized with `h-full`, not `absolute inset-0`.)
- **Staging TiTiler is public (read-only) with open CORS** (`access-control-
  allow-origin: *`) — browser `fetch()` works cross-origin with no auth. It
  serves the `/geozarr` router only (tiles, point, info — **no bbox endpoint**),
  so frames are composited from tiles. A local `wsf-titiler` also exposes
  `/bbox` if you prefer that path.
- The MindEarth logo (`public/logos/ME-logo-white.png`) is the official asset
  copied from `wsf-platform`; a black variant is included for light frames.
- Area selection = current map viewport (editable in the modal); free-form
  rectangle draw is a Phase 3 enhancement.
- TiTiler `/info` shapes vary by version — `normalize` is already defensive.

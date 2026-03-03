# InfraDev Website - Living Brand DNA

## Purpose
This repository hosts the InfraDev.Africa web surfaces and institutional document experiences, including the TRIOMF command-center section.

## Frozen Brand Tokens (v2.0)
- `Primary Navy`: `#0A1F44` (grounding/body)
- `Accent Gold`: `#F9C70C` (highlights only)
- `Surface Off-White`: `#F7F7F5` (document surfaces)
- `Slate`: `#334155` (secondary headers/body on light surfaces)

## Rotation Law (Non-Negotiable)
- Institutional geometric tilt: `3deg`
- Governed tile radius: `12px`
- Standard governed shadow: Navy at `10%` opacity

## Typography Governance
- Headings: `Montserrat`
- Body: `Inter`
- Scaling system: `Major Third` (`1.25` ratio)

## Governance Ledger Structure
- `src/assets/branding/`
  - Tokens, marks, certification stamp, and metadata
- `src/components/institutional/`
  - Insight boxes, governed table patterns, signature block templates
- `src/content/projects/triomf/`
  - Consolidated TRIOMF pack source files

## BrandKit Versioning
- Previous baseline: `v1.1.0`
- Current governance baseline: `v2.0.0`
- Metadata source: `src/assets/branding/brandkit.metadata.json`

## Private SOKIMO Access Gate
The path ` /portals/sokimo/* ` is protected by an edge access code gate in `worker.js`.

### How it works
- Public pages remain open.
- Requests to ` /portals/sokimo/* ` require a valid signed session cookie.
- If no valid session exists, users are redirected to ` /_sokimo-unlock `.
- Successful code entry grants a 12-hour browser session.

### Required Cloudflare secret
- `SOKIMO_ACCESS_CODE` (required)
- `SOKIMO_SESSION_SECRET` (optional but recommended for cookie-signing separation)

### Setup in Cloudflare dashboard
1. Open `Workers & Pages` -> `infradev-website` -> `Settings` -> `Variables and Secrets`.
2. Add secret `SOKIMO_ACCESS_CODE` with your shared code value.
3. Optionally add `SOKIMO_SESSION_SECRET` with a long random string.
4. Redeploy the Worker.

### Security note
- Do not commit real access codes into Git.
- Share the code out-of-band (for example via WhatsApp), and rotate it when needed.

## Private FIS RDC Access Gate
The path ` /portals/fis-rdc/* ` is protected by an edge access code gate in `worker.js`.

### How it works
- Requests to ` /portals/fis-rdc/* ` require a valid signed session cookie.
- If no valid session exists, users are redirected to ` /_fis-rdc-unlock `.
- Successful code entry grants a 12-hour browser session.

### Access code configuration
- `FIS_RDC_ACCESS_CODE` (optional env/secret override)
- `FIS_RDC_SESSION_SECRET` (optional, recommended for dedicated signing)

### Current fallback
- Worker fallback code: `FSI.DGA.NM.01!`

### Optional repo API (still available)
- `GET /api/fis-rdc/repo`
- Default repo target is `tise05/FIS-RDC`.

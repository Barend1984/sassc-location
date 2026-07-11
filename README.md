# SASSC Location CRM v3

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

A delivery confirmation and location intelligence platform for managing SASSA customer coordinates and logistics operations. Built with React 19, Vite, and Google Gemini AI.

**Live Instance:** https://ai.studio/apps/aa5d361c-e975-4747-ae6b-eb47ea7841d0

## Features

- 📍 GPS-based customer location capture and what3words address mapping
- 🚛 Real-time driver tracking and dispatch queue management
- 🔐 POPIA-compliant consent and data handling
- 📱 QR code generation for delivery confirmation links
- 💬 WhatsApp integration for customer communication
- 📊 Customer audit trails and location history
- 🗂️ Offline-first localStorage persistence

## Prerequisites

- **Node.js** 16+ (LTS recommended)
- **npm** or **yarn**
- **GEMINI_API_KEY** — Google Generative AI API key

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/Barend1984/sassc-location.git
cd sassc-location
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env.local` and update with your API keys:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
GEMINI_API_KEY=sk-your-actual-gemini-api-key-here
APP_URL=http://localhost:3000
```

### 3. Run Development Server

```bash
npm run dev
```

The app will open at **http://localhost:3000**

### 4. Build for Production

```bash
npm run build
npm run preview
```

### 5. Deploy to GitHub Pages

```bash
npm run deploy
```

## Project Structure

```
src/
  App.tsx              Main application component (~2,300 lines)
  main.tsx             React entry point
  types.ts             TypeScript interfaces (Customer, LocationHistory, Config)
  index.css            Tailwind CSS imports

index.html             HTML entry point
package.json           Dependencies and build scripts
vite.config.ts         Vite configuration with path aliases
tsconfig.json          TypeScript compiler options
.env.example           Environment variable template
.env.local             Local environment (git-ignored)
```

## Key Components

### App.tsx
The main React component containing:
- **Dashboard** — Summary metrics, driver tracking, recent confirmations
- **Customers** — Directory with search and filtering
- **Add Customer** — Registration form with GPS capture
- **Dispatch Queue** — Logistics assignment and route planning
- **Settings** — System configuration and data export
- **Customer Detail** — Audit file with location history and communications

### types.ts
Core TypeScript interfaces:

```typescript
interface Customer {
  id: string;                        // e.g., LOC-XXXXX
  name: string;
  idNumber?: string;                 // South African ID
  cell?: string;
  whatsappCell?: string;
  area?: string;
  grantType?: string;                // SASSA grant type
  church?: string;
  pastor?: string;
  nextOfKin?: string;
  homeW3W?: string;                  // what3words address
  currentW3W?: string | null;        // Latest location
  lastLocationTs?: string | null;    // ISO timestamp
  locationHistory: LocationHistoryRecord[];
  consentSigned: boolean;
  notes?: string;
  createdAt: string;
}

interface LocationHistoryRecord {
  w3w: string;
  lat: number;
  lng: number;
  accuracy: number;
  nearestPlace?: string;
  capturedAt: string;
  source: 'self-locate-link' | 'agent-capture' | 'manual-entry';
  label?: string;
}

interface SystemConfig {
  w3wApiKey: string;
  sheetEndpoint: string;
  freshGreenThresholdHours: number;  // Default: 24
  freshOrangeThresholdHours: number; // Default: 168 (7 days)
}
```

## API Integration

### What3Words
The app converts GPS coordinates ↔ what3words addresses. Requires an API key:

```
https://api.what3words.com/v3/convert-to-coordinates?words=table.lamp.river&key=YOUR_KEY
```

Falls back to local mock W3W generator if quota exceeded.

### Google Sheets Webhook
Post delivery telemetry to a Google Apps Script endpoint:

```
https://script.google.com/macros/s/[SCRIPT_ID]/exec
```

Captures customer coordinates, driver assignment, and delivery status.

### Gemini AI
Integrated via `@google/genai` for potential AI-powered features (prepared but not actively used in current build).

## Usage

### Add a Customer

1. Go to **Add Customer** tab
2. Fill demographic details (name, ID, phone, area)
3. Optionally use **"Store Agent Current Coords"** to capture GPS as home location
4. Check POPIA consent
5. Click **"Store SASSA Recipient Profile"**

### Capture Delivery Location

1. Send customer a **QR code** (print or WhatsApp)
2. Customer scans and taps **"Capture Coordinates"**
3. Browser requests geolocation permission
4. GPS coordinates are converted to what3words
5. Data syncs to Google Sheets and local storage

### Assign Driver

1. Go to **Dispatch Queue**
2. System auto-matches drivers by area
3. Click **"Launch Navigation Map"** to open Google Maps
4. Driver confirms delivery; coordinates update automatically

## Troubleshooting

### "Repository does not open" / Blank Page

**Solution:** Ensure `.env.local` exists with valid `GEMINI_API_KEY`:

```bash
cp .env.example .env.local
# Edit .env.local with your actual key
npm run dev
```

### Port 3000 Already in Use

**Solution:** Vite will auto-increment to 3001, 3002, etc. Or kill the process:

```bash
lsof -i :3000  # List processes
kill -9 <PID>
```

### TypeScript Errors

**Solution:** Ensure all types compile:

```bash
npm run lint
```

### GPS/W3W API Quota Exceeded

The app gracefully falls back to mock W3W (`gps.latitude_longitude` format) and high-precision GPS coordinates when APIs are unavailable.

## Tech Stack

| Layer | Technology |
|-------|------------|
| **UI** | React 19, Tailwind CSS 4, Lucide Icons |
| **Build** | Vite 6.2, esbuild, TypeScript 5.8 |
| **Backend** | Express.js (optional; included for WebApp Script relay) |
| **APIs** | Google Genai, What3Words, Google Sheets |
| **Storage** | Browser localStorage (offline-first), Google Sheets (authoritative) |

## License

This project is part of the SASSC (South African Social Services Collective) initiative. No explicit license specified; check with maintainer.

## Contributing

Pull requests welcome. Please ensure:

1. `npm run lint` passes (TypeScript check)
2. `npm run build` succeeds
3. Commit message describes the change

## Author

**Barend du Plessis** (@Barend1984)  
NCR Compliant SASSA Logistics Network

---

**Questions?** Open an issue or check the AI Studio instance linked above.

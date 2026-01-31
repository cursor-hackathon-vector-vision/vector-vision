# Cursor Vector Vision

> *"Watch your code come to life – from first prompt to final commit"*

![Demo](https://img.shields.io/badge/Demo-Live-brightgreen)
![Three.js](https://img.shields.io/badge/Three.js-r182-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## What is this?

**Vector Vision** is a 3D visualization tool that brings your code development journey to life. Drop any project folder and watch it transform into an interactive "Code City" where:

- **Files become buildings** – height represents lines of code
- **Folders become districts** – grouped by directory structure  
- **Time becomes navigable** – scrub through your project's evolution
- **AI chats become visible** – see how Cursor conversations shaped your code

## Features

- **3D Code City Visualization** – Files as buildings, colored by type
- **Timeline Navigation** – Travel through your project's history
- **Particle Effects** – Beautiful animations for file creation/modification
- **AR Mode** (coming soon) – View your project on a table via WebXR
- **Video Export** (coming soon) – Create shareable timelapses

## Tech Stack

- **Frontend**: Vite + TypeScript
- **3D Engine**: Three.js r182
- **State Management**: Zustand
- **AR**: WebXR + MindAR (planned)

## Quick Start

```bash
# Clone the repo
git clone https://github.com/cursor-hackathon-vector-vision/vector-vision.git
cd vector-vision

# Install dependencies
npm install

# Start development server
npm run dev
```

Open `https://localhost:5173` and drop a project folder to visualize it!

## Usage

1. **Drop a folder** – Drag any project folder onto the drop zone
2. **Explore** – Use mouse to orbit, scroll to zoom
3. **Navigate time** – Use the timeline slider to see project evolution
4. **Click buildings** – Select files to see details
5. **Press Play** – Watch your project grow automatically

## File Color Legend

| Color | File Type |
|-------|-----------|
| 🔵 Blue | TypeScript (.ts, .tsx) |
| 🟡 Yellow | JavaScript (.js, .jsx) |
| 💜 Pink | CSS/SCSS |
| 🟠 Orange | HTML |
| 🟢 Green | JSON/YAML |
| ⚪ White | Other |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Play/Pause timeline |
| ← → | Previous/Next snapshot |
| R | Reset camera |
| F | Focus on selected building |

## Roadmap

- [x] Basic 3D Code City
- [x] Timeline navigation
- [x] File type coloring
- [x] Particle effects
- [ ] Cursor chat integration
- [ ] Git diff visualization
- [ ] AR mode (WebXR)
- [ ] Video export
- [ ] ElevenLabs narration

## Team

Built at the **Cursor 2-Day AI Hackathon** (Hamburg, Jan 31 - Feb 1, 2026)

## License

MIT

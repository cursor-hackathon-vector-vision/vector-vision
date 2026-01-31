# Cursor Vector Vision

> *"Watch your code come to life – from first prompt to final commit"*

## Übersicht

Eine 3D/AR/VR-Visualisierung der Projekt-Entstehung basierend auf Cursor-Daten, Git-History und Terminal-Logs – mit Zeitstrahl-Navigation und Video-Export.

## Kern-Features

### MVP (Tag 1 Abend)
1. **3D Code City**: Dateien als Gebäude, Höhe = Lines of Code, Ordner als Stadtteile
2. **Zeitstrahl**: Scrubben durch Git-History
3. **Basic Animations**: Gebäude "wachsen" bei Commits

### V1 (Tag 2 Mittag)
4. **Cursor Chat Integration**: Chat-Bubbles schweben über relevanten Dateien
5. **Kausalitäts-Linien**: Animierte Verbindung Chat → betroffene Datei
6. **Video-Export**: Kamera-Pfad + Record-Funktion

### Polish (wenn Zeit)
7. **ElevenLabs Narration**: AI-generierte Stimme erzählt die Projekt-Story
8. **AR-Mode**: Marker-basiert auf Tisch
9. **Time-Lapse-Mode**: 30-Sekunden Auto-Zusammenfassung

## Visual Identity

```
┌─────────────────────────────────────────────────────────────┐
│                    CURSOR VECTOR VISION                      │
│                                                              │
│    ╭──────╮  ╭────╮     💬 "Add auth..."                    │
│    │██████│  │████│    ╱                                    │
│    │██████│  │████│───●                                     │
│    │██████│  │████│  ╲                                      │
│    │██████│  └────┘   └──→ auth.ts spawns                   │
│    └──────┘                                                 │
│    src/     components/                                      │
│                                                              │
│  ◄━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━►      │
│  Commit 1        Commit 47                    Now            │
│                                                              │
│  [▶ Play] [📹 Record] [🎤 Narrate] [📱 AR Mode]             │
└─────────────────────────────────────────────────────────────┘
```

## Technologie-Stack

```
┌─────────────────────────────────────────┐
│              FRONTEND                    │
├─────────────────────────────────────────┤
│  Framework:    Vite + TypeScript         │
│  3D Engine:    Three.js r169             │
│  AR:           WebXR + MindAR            │
│  UI:           HTML/CSS (minimal)        │
│  State:        Zustand                   │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│              DATA LAYER                  │
├─────────────────────────────────────────┤
│  Git:          isomorphic-git            │
│  Cursor:       Custom JSON Parser        │
│  Files:        Native File API           │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│              OPTIONAL                    │
├─────────────────────────────────────────┤
│  Voice:        ElevenLabs API            │
│  Video:        MediaRecorder API         │
│  Hosting:      Vercel (Static)           │
└─────────────────────────────────────────┘
```

## Datenstrukturen

### ProjectSnapshot
```typescript
interface ProjectSnapshot {
  timestamp: Date;
  commitHash: string;
  commitMessage: string;
  author: string;
  files: FileNode[];
  chats: ChatMessage[];
  terminalCommands: TerminalCommand[];
}

interface FileNode {
  path: string;
  name: string;
  extension: string;
  linesOfCode: number;
  directory: string;
  createdAt: Date;
  modifiedAt: Date;
  status: 'added' | 'modified' | 'deleted' | 'unchanged';
  diff?: string;
}

interface ChatMessage {
  id: string;
  timestamp: Date;
  role: 'user' | 'assistant';
  content: string;
  relatedFiles: string[];
}

interface TerminalCommand {
  timestamp: Date;
  command: string;
  output: string;
  exitCode: number;
  duration: number;
}
```

### 3D Scene Objects
```typescript
interface Building {
  fileNode: FileNode;
  position: Vector3;
  height: number;      // based on LOC
  width: number;       // fixed or based on complexity
  color: Color;        // based on file type
  mesh: THREE.Mesh;
}

interface District {
  directory: string;
  buildings: Building[];
  position: Vector3;
  bounds: Box3;
}

interface ChatBubble {
  chat: ChatMessage;
  position: Vector3;
  targetBuilding: Building | null;
  connectionLine: THREE.Line | null;
}
```

## Farbschema nach Dateityp

| Extension | Farbe | Hex |
|-----------|-------|-----|
| .ts/.tsx | Blau | #3178c6 |
| .js/.jsx | Gelb | #f7df1e |
| .css/.scss | Pink | #cc6699 |
| .html | Orange | #e34c26 |
| .json | Grün | #4caf50 |
| .md | Grau | #888888 |
| .py | Blau-Grün | #3776ab |
| andere | Weiß | #ffffff |

## Animation Timeline

1. **Idle**: Leichtes "Atmen" der Gebäude
2. **Commit Event**: 
   - Neue Dateien: Wachsen aus dem Boden mit Partikel-Burst
   - Modifizierte: Kurzes Aufleuchten + Höhenänderung
   - Gelöschte: Zerfall-Animation
3. **Chat Erscheint**: Bubble fährt ein, Linie animiert zur Datei
4. **Terminal**: Puls-Welle über betroffene Dateien

## Kamera-Modi

1. **Orbit**: Standard, um Projekt rotieren
2. **Fly**: WASD + Maus für freie Bewegung
3. **Follow**: Automatisch wichtigen Events folgen
4. **Cinematic**: Vordefinierte Kamerafahrt für Video

## AR-Implementation

- **Marker**: Hiro-Marker oder Custom-Image
- **Scale**: Projekt passt auf ~30cm² Tischfläche
- **Interaction**: Tippen auf Gebäude zeigt Details

## Umsetzungsplan

### Phase 0: Setup (30 min)
- [x] Repo klonen
- [ ] Vite + Three.js + TypeScript Setup
- [ ] Basic Folder-Struktur

### Phase 1: Data Layer (2h)
- [ ] Git-Parser implementieren
- [ ] Cursor-Daten-Parser
- [ ] Datenstrukturen definieren

### Phase 2: 3D Visualization (3h)
- [ ] Code City Generator
- [ ] Gebäude-Meshes erstellen
- [ ] Ordner-Layout-Algorithmus

### Phase 3: Timeline (2h)
- [ ] Zeitstrahl-UI
- [ ] Snapshot-Navigation
- [ ] Animations-System

### Phase 4: Polish (2h)
- [ ] Chat-Bubbles
- [ ] Video-Export
- [ ] AR-Mode

## Demo-Strategie

**Die "Money Shot" Sequenz:**
1. **Start**: Leere Szene, erster Commit erscheint
2. **Build-Up**: Zeitraffer der Projekt-Entstehung
3. **Highlight**: Chat-Bubble erscheint → Linie → Neue Datei spawnt
4. **AR-Moment**: Handy auf Tisch richten, Projekt steht als Miniatur da
5. **Finale**: "Watch your code come to life"

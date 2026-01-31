# Vector Vision - Visual Concept v2

## Grundlayout

```
                    NORD (z > 20)
    ┌─────────────────────────────────────────┐
    │  ┌─────┐  ┌─────────┐  ┌───────────┐   │
    │  │ src │  │ server  │  │   types   │   │  ← Districts (Ordner)
    │  │     │  │         │  │           │   │
    │  └─────┘  └─────────┘  └───────────┘   │
    │       🌲        🌲           🌲         │  ← Bäume
    ├─────────────────────────────────────────┤
    │  ════ BÜRGERSTEIG (Katzen 🐱) ════     │
    │  ────────────────────────────────────   │
    │  ═══════ HAUPTSTRASSE (Timeline) ═════  │  ← z = 0
    │  ────────────────────────────────────   │
    │  ════ BÜRGERSTEIG (Katzen 🐱) ════     │
    ├─────────────────────────────────────────┤
    │       🌲        🌲           🌲         │  ← Bäume
    │  ┌─────────┐  ┌─────┐  ┌───────────┐   │
    │  │  3d    │  │ api │  │  styles   │   │  ← Districts (Ordner)
    │  │        │  │     │  │           │   │
    │  └─────────┘  └─────┘  └───────────┘   │
    └─────────────────────────────────────────┘
                    SÜD (z < -20)
    
    ←──────────── X-ACHSE (Zeitstrahl) ────────────→
    VERGANGENHEIT                           GEGENWART
```

## Elemente

### 1. Hauptstraße (Timeline Highway)
- **Position**: z = 0, erstreckt sich entlang X-Achse
- **Breite**: 12 Units Fahrbahn + 2 Units Bürgersteig je Seite = 16 Total
- **Features**:
  - Dunkler Asphalt (0x1a1a2e)
  - Leuchtende Cyan-Mittellinie
  - Gestrichelte Fahrspurmarkierungen
  - Bürgersteige mit Randstein-Glow
  - Data-Stream Partikel die entlang fließen
  - Zeit-Marker Pfosten

### 2. Districts (Ordner-Viertel)
- **Position**: 
  - NORD: z > 20 (oberhalb der Straße)
  - SÜD: z < -20 (unterhalb der Straße)
- **Darstellung**:
  - NUR Umrandungslinien (keine soliden Platten)
  - Leuchtende Eckpunkte
  - Labels für größere Districts
- **Größe**: Proportional zur LOC im Ordner

### 3. Gebäude (Dateien)
- **Position**: Innerhalb ihrer District-Grenzen
- **Höhe**: Basiert auf LOC (logarithmisch gedämpft)
- **Breite**: Größere Dateien = breitere Gebäude
- **Textur**: Code-Inhalt als Textur auf den Wänden
- **Farbe**: Nach Dateityp
  - .ts/.js: Cyan/Blau
  - .html: Orange
  - .css: Pink
  - .json: Gelb
  - .md: Grün

### 4. Bäume
- **Position**: Beiderseits der Straße, hinter den Bürgersteigen
- **Typen**:
  - Tanne (3 Kegel-Schichten)
  - Laubbaum (Ikosaeder-Krone)
  - Cyber-Baum (leuchtender Kristall)
- **Abstand**: ~25 Units zwischen Bäumen

### 5. Katzen
- **Position**: Auf den Bürgersteigen (z = ±7)
- **Bewegung**: Entlang X-Achse
- **Features**:
  - Low-Poly Orange
  - Animierte Beine und Schwanz
  - Meow-Bubbles

### 6. Verbindungen
- **Darstellung**: Leuchtende Bögen zwischen verbundenen Dateien
- **Animation**: Partikel fließen entlang der Kurve
- **Höhe**: Basiert auf Entfernung

## Kamera & Beleuchtung

- **Fog**: 100-800 (weite Sicht)
- **Max Distance**: 500 (zoom out möglich)
- **Ambient Light**: 0.6 Intensität
- **Directional Light**: Von oben-vorne

## Demo-Projekt

**Standard**: Vector Vision Projekt selbst
**Pfad**: `/mnt/private1/ai-projects/hackathon-cursor-vector-vision/vector-vision`

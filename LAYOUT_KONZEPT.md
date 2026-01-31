# Layout-Konzept: Advanced Code City

## Algorithmen-Analyse

### 1. Squarified Treemap (Bruls et al.)
**Ideal für:** Ordner-Grundstücke
- Erzeugt nahezu quadratische Rechtecke
- Optimiert für hierarchische Daten
- Nutzt Fläche effizient
- npm: `squarify`

### 2. Force-Directed (d3-force)
**Ideal für:** Verbindungen zwischen Dateien
- Natürliche Clustering
- Import-Beziehungen als Kräfte
- Verwandte Dateien ziehen sich an

### 3. GroupInABox (forceInABox)
**Ideal für:** Hybrid-Ansatz
- Kombiniert Treemap + Force
- Gruppen (Ordner) als Boxen
- Dateien innerhalb per Force

## Unser Layout-System

### Phase 1: District Layout (Treemap)
```
┌─────────────────────────────────────┐
│  src/                               │
│  ┌───────────┬──────────────────┐   │
│  │components/│    utils/        │   │
│  │           │                  │   │
│  ├───────────┼──────────────────┤   │
│  │   api/    │    types/        │   │
│  └───────────┴──────────────────┘   │
└─────────────────────────────────────┘
```

### Phase 2: Straßen-Netzwerk
- **Hauptstraße**: Zeitachse durch die Mitte
- **Boulevard**: Umrundet jeden District
- **Verbindungsstraßen**: Zwischen verwandten Districts
- Straßen entstehen entlang der Treemap-Grenzen!

### Phase 3: Gebäude-Platzierung
Innerhalb jedes Districts:
- Force-Simulation für natürliche Anordnung
- Größere Dateien im Zentrum
- Import-Beziehungen als Anziehungskraft

### Phase 4: Verbindungs-Bögen
```
    ╭──────────╮
   ╱            ╲
  ╱   GLOW ARC   ╲
 ●────────────────●
FileA            FileB
```
- Leuchtende Bögen zwischen verbundenen Dateien
- Partikel fließen entlang der Bögen
- Höhe basiert auf Entfernung

## KI-gestütztes Layout (Optional)

### Prompt-Template für Layout-Generierung:
```
Gegeben diese Dateistruktur:
{files: [...], imports: [...], directories: [...]}

Generiere ein optimales 2D-Layout mit:
1. Positionsvorschlägen (x, z) für jeden Ordner
2. Cluster-Zuordnungen basierend auf Imports
3. Straßen-Verbindungspunkte
4. Wichtigkeits-Ranking für zentrale Positionierung

Format: JSON mit positions[], clusters[], roads[]
```

### Wann KI-Layout sinnvoll:
- Bei sehr großen Projekten (1000+ Dateien)
- Bei komplexen Dependency-Graphen
- Für "semantisches" Clustering (ähnliche Funktionen zusammen)

## Implementation Priority

1. ✅ Squarified Treemap für Districts
2. ✅ Straßen entlang District-Grenzen  
3. ✅ Verbindungs-Bögen mit Animation
4. ✅ Klickbare Gebäude → Navigation
5. ✅ Image/Text Preview auf Gebäuden
6. ⏳ KI-Layout als Premium-Feature

## Datenfluss

```
ProjectData
    │
    ▼
┌──────────────────┐
│ Squarify Layout  │ → District-Rechtecke
└──────────────────┘
    │
    ▼
┌──────────────────┐
│ Force Simulation │ → Gebäude-Positionen
└──────────────────┘
    │
    ▼
┌──────────────────┐
│ Road Generator   │ → Straßen-Meshes
└──────────────────┘
    │
    ▼
┌──────────────────┐
│ Arc Generator    │ → Verbindungs-Bögen
└──────────────────┘
    │
    ▼
3D Scene
```

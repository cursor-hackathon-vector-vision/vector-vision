# Vector Vision - Semantic Visual Concept v3

## Kernprinzip: Alles hat eine Funktion

Jedes visuelle Element repräsentiert echte Daten aus dem Projekt.

---

## Die Hauptstraße = Zeitstrahl

```
VERGANGENHEIT ←────── HAUPTSTRASSE (X-Achse) ──────→ GEGENWART
                    (älteste Commits)            (neueste Commits)
```

- **X-Position** = Zeitpunkt (Commit/File Creation)
- **Länge** = Projektdauer

---

## Chat-Bäume = AI Conversations

Jeder **Baum** entlang der Straße ist ein **Chat-Eintrag** aus Cursor:

```
    🌲 Chat 1       🌲 Chat 2           🌲 Chat 3
    "Add auth"      "Fix bug"           "Refactor"
    ────────────────────────────────────────────────→ Zeit
```

- **Position X** = Zeitpunkt des Chats
- **Baumtyp**:
  - 🌲 **Tanne** = User Message
  - 🌳 **Laubbaum** = Assistant Response  
  - 💎 **Cyber-Baum** = Tool Call (Code-Änderung)
- **Größe** = Länge der Nachricht
- **Hover** = Zeigt Chat-Inhalt

---

## Nord-Seite (z > 0) = Source Code

Alle **programmatischen Dateien**:
- `.ts`, `.tsx`, `.js`, `.jsx`
- `.py`, `.go`, `.rs`
- Executable code

```
NORD-SEITE (Source Code)
┌─────────────────────────────────────────────────────┐
│    ┌─────────┐                                      │
│    │ Branch: │──→ Seitenstraße für "src/"          │
│    │  src/   │    ├── main.ts (Gebäude)            │
│    └─────────┘    ├── app.ts                       │
│                   └── utils.ts                      │
│    ┌─────────┐                                      │
│    │ Branch: │──→ Seitenstraße für "server/"       │
│    │ server/ │    ├── index.ts                     │
│    └─────────┘    └── api.ts                       │
└─────────────────────────────────────────────────────┘
```

---

## Süd-Seite (z < 0) = Assets & Config

Alle **nicht-programmatischen Dateien**:
- `.json`, `.yaml`, `.toml` (Config)
- `.md`, `.txt` (Docs)
- `.css`, `.scss` (Styles)
- `.html` (Markup)
- Images, Media

```
SÜD-SEITE (Assets & Config)
┌─────────────────────────────────────────────────────┐
│    ┌─────────┐                                      │
│    │ Branch: │──→ Seitenstraße für "styles/"       │
│    │ styles/ │    ├── main.css                     │
│    └─────────┘    └── theme.css                    │
│    ┌─────────┐                                      │
│    │ Branch: │──→ Seitenstraße für "assets/"       │
│    │ assets/ │    └── logo.png                     │
│    └─────────┘                                      │
└─────────────────────────────────────────────────────┘
```

---

## Ordner = Branches (Seitenstraßen)

Jeder **Ordner** wird zu einer **Seitenstraße** die von der Hauptstraße abzweigt:

```
         Branch "types/"
              ↗
HAUPTSTRASSE ─────────────────────→
              ↘
         Branch "utils/"
```

- **Abzweigpunkt X** = Wann wurde der Ordner erstellt
- **Straßenlänge** = Anzahl Dateien im Ordner
- **Tiefe** = Verschachtelungstiefe (Unterordner = Unter-Branches)

---

## Gebäude = Dateien

Position und Eigenschaften der Gebäude:

| Eigenschaft | Bedeutung |
|-------------|-----------|
| **X-Position** | Erstellungszeit der Datei |
| **Z-Position** | Auf welchem Branch (Ordner) |
| **Höhe** | Lines of Code (log-skaliert) |
| **Breite** | Anzahl Funktionen/Exports |
| **Farbe** | Dateityp |
| **Textur** | Echte Code-Zeilen |
| **Glow** | Kürzlich modifiziert |

---

## Verbindungsbögen = Imports

Leuchtende Bögen zwischen Dateien zeigen **Import-Beziehungen**:

```
    FileA.ts ─────────╮
                      │ Import-Arc
    FileB.ts ←────────╯
```

- Partikel fließen in Richtung des Imports
- Dicke = Anzahl importierter Items

---

## Katzen = Active Watchers 🐱

Die Katzen repräsentieren **aktive File Watchers**:
- Laufen auf den Bürgersteigen
- "Patrouillieren" die Dateien
- Meow-Bubble = File Change Event

---

## Data Stream Partikel = Git Commits

Die leuchtenden Partikel die entlang der Hauptstraße fließen:
- Jeder Partikel = Ein Commit
- Geschwindigkeit = Commit-Frequenz
- Farbe = Commit-Autor

---

## Zusammenfassung Mapping

| Visual Element | Repräsentiert |
|----------------|---------------|
| Hauptstraße | Timeline (X = Zeit) |
| Bäume | Chat-Einträge |
| Nord-Seite | Source Code |
| Süd-Seite | Assets/Config |
| Seitenstraßen | Ordner |
| Gebäude | Dateien |
| Gebäudehöhe | LOC |
| Bögen | Imports |
| Partikel | Commits |
| Katzen | File Watchers |

# Handpan-Stimmung: Recherche-Zusammenfassung für App-Projekt

Ziel: Grundlage für eine App mit optischer Oberfläche, die beim Stimmen zeigt,
wo (und wie) gehämmert werden muss.

---

## 1. Bestehende Tuning-Apps (keine zeigt Hammerposition)

| App | Plattform | Preis | Anmerkung |
|---|---|---|---|
| **Linotune** | Win/Mac/iOS/Android | 399 € (Kauf) oder 20 €/Monat (Miete) | Multi-Harmonic-Strobe-Tuner, zeigt Grundton + Obertöne gleichzeitig. Branchenstandard, u.a. genutzt von Pantheon Steel, Saraz Handpans, Lombardo Handpan, Hardcase Technologies. |
| **TonalEnergy Tuner** | iOS/Android | – | Ebenfalls mit Obertonanzeige, häufig empfohlen |
| **Spectroid** | Android | kostenlos | Reiner Echtzeit-Spektrumanalysator (FFT), keine Instrumenten-Logik |
| **n-Track Tuner** | iOS/Android | kostenlos/Pro | Hat Spektrumanalyse-Modus |

**Kernbefund:** Alle bestehenden Tools zeigen nur Frequenz-/Cent-Abweichung
(Nadel, Strobe-Muster, Spektrum). **Keine App zeigt eine räumliche Zuordnung
auf dem Tonfeld selbst** (wo hämmern, welche Achse, innen/außen) – das scheint
eine echte Lücke zu sein.

Quellen:
- https://linotune.com/purchase.php
- https://www.xenithhandpans.com/linotune
- https://www.puresmusic.com/blogs/handpan/how-to-tune-your-handpan

---

## 2. Physikalische Grundlagen fürs Tonfeld-Modell

### 2.1 Drei Frequenzen pro Tonfeld
Jedes Tonfeld schwingt gleichzeitig auf drei Frequenzen:
- **Grundton** (Zentrum/Dimple)
- **Oktave** – liegt auf der **langen Achse** des ovalen Feldes
- **Quinte** (genauer: "compound fifth", Oktave + Quinte über Grundton) – liegt auf der **kurzen Achse**

> "sugli assi lunghi ci sono le ottave armoniche, assi corti quinta armonica"
> — Italia Handpan (italiahandpan.it/pages/chi-sono)

> "Tap along the long axis of the tone field, near its outer edge, to identify
> the octave partial. Tap along the short axis... to isolate the compound fifth."
> — Pures Music, puresmusic.com/blogs/handpan/how-to-tune-your-handpan

### 2.2 Zentrum vs. Rand
- **Hämmern im Zentrum** → Tonhöhe steigt
- **Hämmern am äußeren Rand** → Tonhöhe sinkt

> "Strucks in the center raise the tone, those at the edges lower it."
> — Miłość i Spokój, miloscispokoj.pl

> "A linear hit towards the dimple will augment the level of the note and
> raise the octave, in reverse hitting from inside toward the edge will also
> increase the level but lower the octave."
> — handpan.ca/making-your-own-hanpan

### 2.3 Von außen vs. von innen hämmern
Zusätzlich zur Position auf dem Feld kommt die Frage, **von welcher Seite**
der Schale man schlägt:
- **Von außen (Spielseite):** Normalfall, Standard-Zentrum/Rand-Logik
- **Von innen durch den Gu (Bodenloch):** Feinabstimmung, mit kleinem
  (oft gebogenem) Hammer, der durchs Loch passt. Wirkt in gewisser Weise
  gegenläufig zur Außen-Bearbeitung, da die Kraftrichtung umgekehrt ist.

Quellen:
- https://www.masterthehandpan.com/blog/jimmys-house-of-hammers
- https://www.yishama.com/fine-tuning-the-pantam-5/ ("we will stick our hand
  with a small hammer inside the instrument through the port")
- https://handpanshop.eu/where-does-the-handpan-come-from/

### 2.4 Schlagmuster – keine Linie, sondern verteilte Schläge mit Richtungsbias
Kein exakter Pfad "Mitte unten → Mitte oben", sondern mehrere Schläge
verteilt rund um den Feldrand, mit Gewichtung in eine Achse:

> "give 4 quick firm blows on all around the top flat surface... make sure
> hit with the intent of making the short axis up and the long down."
> — handpan.ca/making-your-own-hanpan

### 2.5 Nachbarfelder / Übersprechen ("Crosstalk")
- Tonfelder werden bewusst durch ausreichend Abstand und geformte Stege
  ("interstitial work") akustisch isoliert, damit ein Schlag nicht ins
  Nachbarfeld durchschlägt.
- Manche Bauer verformen ein Tonfeld sogar bewusst leicht, um Crosstalk zu
  vermeiden – kein Fehler, sondern Absicht.
- **Offene Frage (nicht belastbar recherchiert):** Ob die Schlag-*Achse*
  (lang/kurz) systematisch unterschiedlich stark auf Nachbarfelder wirkt,
  oder ob primär die Nähe zum gemeinsamen Steg entscheidend ist.

Quellen:
- https://handpanshop.eu/where-does-the-handpan-come-from/
- https://www.masterthehandpan.com/blog/how-are-handpans-made

### 2.6 Übliche Praxis beim Prüfen: alle anderen Felder abdämpfen
Beim Messen/Stimmen eines einzelnen Feldes werden die übrigen Felder
gedämpft (z. B. mit der freien Hand), um sauberes Signal zu bekommen – das
ist Standardpraxis, nicht app-spezifisch.

---

## 3. Mögliche App-Architektur (eigene Idee, keine Quelle)

Für eine minimale Version reicht im Kern:

1. **Pitch-Detection** (Autocorrelation oder FFT-Peak-Picking über
   Web Audio API/Mikrofon-Input), idealerweise mit Erkennung mehrerer
   Partialtöne gleichzeitig (Grundton + Oktave + Quinte), da genau das
   der Unterschied zu einem normalen chromatischen Tuner ist.
2. **Ovale Tonfeld-Grafik** (SVG/Canvas) mit:
   - radialer Zone (Zentrum ↔ Rand) für Grundton-Korrektur
   - zwei Achsen-Markierungen (lang = Oktave, kurz = Quinte) für
     Obertonkorrektur
   - Farbcodierung je nach Soll/Ist-Abweichung in Cent
3. Optional: Umschalter "von außen / von innen hämmern"

Technisch nichts Ungewöhnliches – Pitch-Detection-Bibliotheken sind
Standardware, die Visualisierung ist einfaches SVG/Canvas.

---

## 4. Internationale Tutorials/Quellen (nach Sprache)

### Deutsch
- Handpan-Planet – Doku über Bau & Stimmung mit Alfonso von Pandakini
  Handpans (Berlin): https://handpan-planet.de/blogs/news/bau-und-stimmen-einer-handpan
- Handpan-Portal – Schlagtechnik & Obertöne:
  https://handpan-portal.de/handpan-lernen/video-schlagtechnik-perfekter-klang/
- Handpan-Portal – Verstimmen & Nachstimmen:
  https://handpan-portal.de/verstimmte-handpan-nachstimmen/

### Französisch
- easka-handpan.fr (Aix-Marseille) – Maker-Perspektive, u.a. zur
  Unmöglichkeit der Mechanisierung des Stimmens:
  https://easka-handpan.fr/fabrication-handpan-maker-france/
- hangdrum.fr – Materialien & Zeitaufwand (50–70 h manuelle Stimmung):
  https://www.hangdrum.fr/fabriquer-son-propre-handpan-par-ou-commencer/
- choisir-son-handpan.fr – 5-Schritte-Guide:
  https://choisir-son-handpan.fr/blog/fabrication-handpan/

### Italienisch
- Italia Handpan – Maker-Statement zu Achsen (Oktave/Quinte) und dazu,
  dass das Handwerk nicht lehrbar ist, nur durch Erfahrung:
  https://www.italiahandpan.it/pages/chi-sono
- Shaktipan – Stimmung mit Stroboskop-Gerät:
  https://shaktipan.com/lavorazione/
- Vision Handpan (Maker-Interview):
  https://theundermeg.wordpress.com/2015/02/17/vision-handmade-handpan/

### Chinesisch (手碟 = Handpan)
- Zhihu-Threads zu Grundlagen (Ding, Gu, 泛音/Obertöne, Marken wie
  鲁儒/Hluru): https://www.zhihu.com/question/321324870
- Bilibili: primär Spiel-Tutorials (Slap-Technik), keine Bau-/Stimm-Anleitungen
  gefunden
- **Einschränkung:** Keine detaillierten Hammertechnik-Tutorials gefunden;
  chinesische Bau-Communities laufen vermutlich stärker über WeChat/Douyin
  als über durchsuchbare Portale

---

## 5. Offene Punkte / Unsicherheiten

- Keine belastbare Quelle zu systematischem Unterschied Achse↔Nachbarfeld-Kopplung
- Keine Quelle mit exaktem, reproduzierbarem "Schlagpfad"-Diagramm –
  scheint tatsächlich Erfahrungswissen zu sein, nicht standardisiert
- Manche der zitierten Blog-Quellen (z. B. cosmoshandpan.com, puresmusic.com)
  wirken teils wie SEO-/KI-generierter Content mit werblichem Unterton –
  die dort genannten physikalischen Grundregeln (Zentrum/Rand, Achsen)
  decken sich aber mit unabhängigen Maker-Quellen (Italia Handpan,
  handpan.ca, xenithhandpans.com) und wurden deshalb übernommen.

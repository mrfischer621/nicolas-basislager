# Marker

Der hellblaue Textmarker hinter einem Teil eines Titels: das eine Element, an dem man Blauwasser erkennt.

- Klasse `bw-marker` um die markierten Wörter innerhalb eines `bw-title`. Der Balken liegt zwischen `marker-from` (58 %) und `marker-to` (92 %) der Zeile, in `marker` (= `cta`), Überstand `marker-inset`.
- **Höchstens ein Marker pro Titel und pro Seite, Grafik oder Szene.** Markiert wird die Pointe, nie ein ganzer Titel (Ausnahme: das Cover, «EXPEDITION»).
- Der markierte Teil muss wörtlich im Titel stehen. Ab Tablet bleibt er auf einer Zeile (`bw-marker--nowrap`).
- Auf Tinte (`bw-on-ink`, Thema `dark`) wird das Wort hellblau statt hinterlegt, weil heller Text auf dem Balken nur 2.9:1 hält. `bw-marker--force` behält den Balken auf Tinte; nur für Cover und Abspann in sehr grosser Schrift.
- Bewegung: auf der Website fährt der Balken beim Einblenden in 2 s (`ease`) von links aus (`background-size` 0 bis 100 %). Unter reduzierter Bewegung steht er sofort da.

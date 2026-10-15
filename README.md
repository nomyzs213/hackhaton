# Odkryj Gliwice

Edukacyjna gra 2D w stylu retro Pixel-Art stworzona w Phaser.js i Vite na hackathon.

Wciel się w rolę podróżnika odwiedzającego Gliwice! Przemierzaj ulice miasta, mosty nad rzeką Kłodnicą i parki, zbieraj unikalne odznaki, odpowiadaj na pytania quizowe o historii i kulturze miasta, poznawaj fascynujące ciekawostki i unikaj kolizji z ruchem drogowym.

---

## 🏛️ 12 Miejsc i Odznak do Odkrycia w Gliwicach
1. **Radiostacja Gliwicka** – najwyższa drewniana wieża na świecie (111 m).
2. **Dworzec PKP Gliwice** – historyczny węzeł kolejowy z 1845 r. z modernistyczną halą.
3. **Palmiarnia Miejska** – ponad 5000 egzotycznych roślin w Parku Chopina ze stuletnimi feniksami.
4. **Kościół Wszystkich Świętych** – zabytkowa świątynia z 63-metrową ceglaną wieżą widokową.
5. **Rynek i Ratusz z Fontanną Neptuna** – serce miasta z fontanną z 1794 r. i arkadami.
6. **Zamek Piastowski** – XIV-wieczna baszta obronna i zamek książęcy.
7. **Willa Caro** – neorenesansowa rezydencja przemysłowca Oscara Caro z 1885 r.
8. **Ruiny Teatru Victoria** – nastrojowa przestrzeń kulturalna i historyczny teatr miejski.
9. **Politechnika Śląska** – renomowana uczelnia techniczna założona w 1945 r. o lwowskich korzeniach.
10. **Teatr Miejski im. W. Korfantego** – główna scena dramatyczna przy ul. Nowy Świat.
11. **PreZero Arena Gliwice** – jedna z największych i najnowocześniejszych hal widowiskowych w Europie.
12. **Stadion Miejski (Piast Gliwice)** – dom Mistrzów Polski w Ekstraklasie z 2019 roku.

---

## 🎮 Cechy Gry
- **Oprawa retro pixel-art** zgodna ze specyfikacją `PIXEL_ART_SPEC.txt` (16x16 / 32x32 / 48x48 / 64x64, spójna paleta retro).
- **Żywe miasto**: ulice z ruchem samochodowym w dwóch osiach (czerwone, niebieskie, żółte auta), kwartały kamienic z kolizjami fizycznymi, mosty nad rzeką Kłodnicą.
- **Kompas GPS w HUD**: wskaźnik ze strzałką i odległością w metrach prowadzący do najbliższego nieodkrytego celu.
- **Wartość edukacyjna**: po poprawnej odpowiedzi gracz otrzymuje okno z ciekawostką o danym zabytku.
- **Ruch uliczny i kary**: zderzenie z autem zabiera 1 życie i wywołuje i-frames (migotanie), błędna odpowiedź odejmuje 10 sekund z 3-minutowego limitu.
- **Efekty dźwiękowe i muzyka 8-bit**: wbudowany generator Web Audio API (brak problemów z brakującymi plikami audio), wyciszanie klawiszem [M].
- **Obsługa urządzeń mobilnych**: wirtualny D-pad oraz przycisk akcji dotykowej.
- **Zapis rekordów**: najlepszy czas przejścia zapisywany w `localStorage`.

---

## ⌨️ Sterowanie
- **Strzałki / WASD**: poruszanie się postacią
- **E / dotykowy przycisk [E]**: interakcja z zabytkiem / wejście do quizu
- **1 - 4**: wybór odpowiedzi w quizie (lub kliknięcie myszą/dotykiem)
- **Spacja / Enter**: przejście dalej po przeczytaniu ciekawostki
- **Esc**: pauza gry
- **M**: szybkie wyciszenie / włączenie dźwięku

---

## 🚀 Uruchomienie i Rozwój

Wymagania: Node.js >= 18 oraz npm.

```bash
# Instalacja zależności
npm install

# Uruchomienie serwera deweloperskiego
npm run dev

# Generowanie grafik Pixel-Art na podstawie PIXEL_ART_SPEC.txt
npm run generate:assets

# Budowa wersji produkcyjnej
npm run build

# Podgląd buildu produkcyjnego
npm run preview
```

---

## 📜 Licencje i Credits
Szczegółowe informacje o autorstwie i licencjach znajdują się w pliku `public/assets/CREDITS.md`.
import json
import re
import urllib.request
from pathlib import Path

# Frei lizenzierte deutsche Wortliste (MIT / Open Source)
SOURCE_URL = "https://raw.githubusercontent.com/enz/german-wordlist/master/words"

def normalize(word: str) -> str:
    w = word.strip().upper()
    w = (
        w.replace("Ä", "AE")
        .replace("Ö", "OE")
        .replace("Ü", "UE")
        .replace("SS", "SS")
        .replace("ß", "SS")
    )
    return w

def main():
    print("Lade deutsche Wortliste...")
    req = urllib.request.urlopen(SOURCE_URL)
    raw_lines = req.read().decode("utf-8").splitlines()

    words = set()
    for line in raw_lines:
        w = normalize(line)
        if re.fullmatch(r"[A-Z]{4,15}", w):
            words.add(w)

    # Sicherstellen, dass alle Spielwörter enthalten sind
    required = {
        "DANKE", "HORRORFILME", "WEAPONS", "SINISTER",
        "CONJURING", "SHINING", "SCREAM"
    }
    words.update(required)

    out_path = Path("public/german-words.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(sorted(words), f, ensure_ascii=False)

    print(f"Fertig! {len(words)} normalisierte Wörter in {out_path} gespeichert.")

if __name__ == "__main__":
    main()

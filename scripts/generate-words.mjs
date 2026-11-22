import fs from 'node:fs';
import path from 'node:path';

const SOURCE_URL = 'https://raw.githubusercontent.com/enz/german-wordlist/master/words';

function normalize(word) {
  return word
    .trim()
    .toUpperCase()
    .replaceAll('Ä', 'AE')
    .replaceAll('Ö', 'OE')
    .replaceAll('Ü', 'UE')
    .replaceAll('ß', 'SS');
}

async function main() {
  console.log('Lade deutsche Wortliste...');
  const res = await fetch(SOURCE_URL);
  if (!res.ok) {
    throw new Error(`Download fehlgeschlagen: HTTP ${res.status}`);
  }
  const text = await res.text();
  const words = new Set();

  for (const line of text.split(/\r?\n/)) {
    const w = normalize(line);
    if (/^[A-Z]{4,15}$/.test(w)) {
      words.add(w);
    }
  }

  for (const req of [
    'DANKE',
    'HORRORFILME',
    'WEAPONS',
    'SINISTER',
    'CONJURING',
    'SHINING',
    'SCREAM',
  ]) {
    words.add(req);
  }

  const outPath = path.resolve('public/german-words.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify([...words].sort()), 'utf8');
  console.log(`Fertig! ${words.size} normalisierte Wörter in ${outPath} gespeichert.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

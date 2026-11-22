let dictionaryPromise: Promise<Set<string>> | null = null;

/**
 * Lädt public/german-words.json einmalig asynchron und cached ein Set<string> für O(1)-Lookups.
 */
export function loadGermanDictionary(): Promise<Set<string>> {
  if (!dictionaryPromise) {
    const url = `${import.meta.env.BASE_URL}german-words.json`;
    dictionaryPromise = fetch(url)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Wörterbuch konnte nicht geladen werden (${res.status})`);
        }
        return res.json() as Promise<string[]>;
      })
      .then((words) => new Set<string>(words))
      .catch((err) => {
        dictionaryPromise = null;
        throw err;
      });
  }
  return dictionaryPromise;
}

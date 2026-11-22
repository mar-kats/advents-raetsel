export type LetterState = 'correct' | 'present' | 'absent';

const PRIORITY: Record<LetterState, number> = {
  absent: 1,
  present: 2,
  correct: 3,
};

/**
 * Bewertet einen 5-Buchstaben-Versuch exakt nach Häufigkeit doppelter Buchstaben im Zielwort.
 */
export function evaluateGuess(guess: string, target: string): LetterState[] {
  const length = target.length;
  const result: LetterState[] = new Array<LetterState>(length).fill('absent');
  const remainingCounts: Record<string, number> = {};

  // Pass 1: Exakte Treffer markieren und übrige Buchstaben im Zielwort zählen
  for (let i = 0; i < length; i++) {
    if (guess[i] === target[i]) {
      result[i] = 'correct';
    } else {
      const ch = target[i];
      remainingCounts[ch] = (remainingCounts[ch] ?? 0) + 1;
    }
  }

  // Pass 2: Vorhandene Buchstaben an falscher Position nur bis zur Rest-Häufigkeit markieren
  for (let i = 0; i < length; i++) {
    if (result[i] === 'correct') continue;
    const ch = guess[i];
    if ((remainingCounts[ch] ?? 0) > 0) {
      result[i] = 'present';
      remainingCounts[ch] -= 1;
    }
  }

  return result;
}

export function getKeyboardStates(
  guesses: string[],
  target: string
): Record<string, LetterState> {
  const states: Record<string, LetterState> = {};

  for (const guess of guesses) {
    const evals = evaluateGuess(guess, target);
    for (let i = 0; i < guess.length; i++) {
      const ch = guess[i];
      const next = evals[i];
      const prev = states[ch];
      if (!prev || PRIORITY[next] > PRIORITY[prev]) {
        states[ch] = next;
      }
    }
  }

  return states;
}

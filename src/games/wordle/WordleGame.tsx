import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Delete, Award, RotateCcw } from 'lucide-react';
import type { WordleConfig } from '../../types/puzzles';
import { normalizeGerman } from '../../utils/normalize';
import { loadGermanDictionary } from '../../utils/dictionary';
import { loadFromStorage, saveToStorage, removeFromStorage } from '../../utils/storage';
import { evaluateGuess, getKeyboardStates, type LetterState } from './wordleLogic';
import { GameShell } from '../../components/GameShell';
import { Toast } from '../../components/Toast';
import { CompletionModal } from '../../components/CompletionModal';

const STORAGE_KEY = 'gift_game_wordle_v1';

const KEYBOARD_ROWS: string[][] = [
  ['Q', 'W', 'E', 'R', 'T', 'Z', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Y', 'X', 'C', 'V', 'B', 'N', 'M', 'BACKSPACE'],
];

interface SavedWordleState {
  targetWord: string;
  guesses: string[];
  status: 'playing' | 'won' | 'lost';
}

interface WordleGameProps {
  config: WordleConfig;
}

const TILE_COLORS: Record<LetterState, string> = {
  correct: 'bg-[#6aaa64] border-[#6aaa64] text-white',
  present: 'bg-[#c9b458] border-[#c9b458] text-white',
  absent: 'bg-[#787c7e] border-[#787c7e] text-white',
};

const KEY_COLORS: Record<LetterState, string> = {
  correct: 'bg-[#6aaa64] text-white hover:bg-[#5f9d59]',
  present: 'bg-[#c9b458] text-white hover:bg-[#bca64c]',
  absent: 'bg-[#787c7e] text-white hover:bg-[#6d7173]',
};

export const WordleGame: React.FC<WordleGameProps> = ({ config }) => {
  const targetWord = useMemo(() => normalizeGerman(config.targetWord), [config.targetWord]);
  const wordLength = targetWord.length;
  const maxAttempts = config.maxAttempts;

  const [guesses, setGuesses] = useState<string[]>(() => {
    const saved = loadFromStorage<SavedWordleState>(STORAGE_KEY);
    if (saved && saved.targetWord === targetWord && Array.isArray(saved.guesses)) {
      return saved.guesses;
    }
    return [];
  });

  const [status, setStatus] = useState<'playing' | 'won' | 'lost'>(() => {
    const saved = loadFromStorage<SavedWordleState>(STORAGE_KEY);
    if (saved && saved.targetWord === targetWord) {
      return saved.status;
    }
    return 'playing';
  });

  const [currentGuess, setCurrentGuess] = useState('');
  const [dictionary, setDictionary] = useState<Set<string> | null>(null);
  const [dictError, setDictError] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [shakeRow, setShakeRow] = useState(false);
  const [revealingRow, setRevealingRow] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState<boolean>(() => {
    const saved = loadFromStorage<SavedWordleState>(STORAGE_KEY);
    return Boolean(saved && saved.targetWord === targetWord && saved.status !== 'playing');
  });

  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 2200);
  }, []);

  useEffect(() => {
    let active = true;
    loadGermanDictionary()
      .then((words) => {
        if (active) setDictionary(words);
      })
      .catch(() => {
        if (active) setDictError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    saveToStorage<SavedWordleState>(STORAGE_KEY, {
      targetWord,
      guesses,
      status,
    });
  }, [targetWord, guesses, status]);

  const triggerShake = useCallback(() => {
    setShakeRow(false);
    window.requestAnimationFrame(() => {
      setShakeRow(true);
    });
    window.setTimeout(() => setShakeRow(false), 450);
  }, []);

  const submitGuess = useCallback(() => {
    if (status !== 'playing') return;

    if (currentGuess.length < wordLength) {
      triggerShake();
      showToast('Zu kurz');
      return;
    }

    const normalized = normalizeGerman(currentGuess);

    if (!dictionary && !dictError) {
      showToast('Wörterbuch wird geladen...');
      return;
    }

    const isValidWord =
      normalized === targetWord || (dictionary ? dictionary.has(normalized) : true);

    if (!isValidWord) {
      triggerShake();
      showToast('Nicht in der Wortliste');
      return;
    }

    const nextGuesses = [...guesses, normalized];
    const rowIdx = guesses.length;
    setGuesses(nextGuesses);
    setCurrentGuess('');
    setRevealingRow(rowIdx);

    window.setTimeout(() => {
      setRevealingRow(null);
    }, 650);

    if (normalized === targetWord) {
      setStatus('won');
      window.setTimeout(() => setModalOpen(true), 680);
    } else if (nextGuesses.length >= maxAttempts) {
      setStatus('lost');
      window.setTimeout(() => setModalOpen(true), 680);
    }
  }, [
    status,
    currentGuess,
    wordLength,
    dictionary,
    dictError,
    targetWord,
    guesses,
    maxAttempts,
    triggerShake,
    showToast,
  ]);

  const handleKeyInput = useCallback(
    (rawKey: string) => {
      if (status !== 'playing') return;

      if (rawKey === 'ENTER') {
        submitGuess();
        return;
      }

      if (rawKey === 'BACKSPACE') {
        setCurrentGuess((prev) => prev.slice(0, -1));
        return;
      }

      const normalized = normalizeGerman(rawKey);
      if (!normalized) return;

      setCurrentGuess((prev) => {
        const combined = prev + normalized;
        return combined.length <= wordLength ? combined : prev;
      });
    },
    [status, submitGuess, wordLength]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        handleKeyInput('ENTER');
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleKeyInput('BACKSPACE');
      } else if (e.key.length === 1) {
        handleKeyInput(e.key);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleKeyInput]);

  const handleReset = useCallback(() => {
    removeFromStorage(STORAGE_KEY);
    setGuesses([]);
    setCurrentGuess('');
    setStatus('playing');
    setModalOpen(false);
    setRevealingRow(null);
    setToast(null);
  }, []);

  const keyboardStates = useMemo(
    () => getKeyboardStates(guesses, targetWord),
    [guesses, targetWord]
  );

  return (
    <GameShell
      title={config.title}
      onReset={handleReset}
      headerRight={
        status === 'won' ? (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            aria-label="Nachricht anzeigen"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-amber-600 transition hover:bg-amber-50"
          >
            <Award className="h-5 w-5" />
          </button>
        ) : status === 'lost' ? (
          <button
            type="button"
            onClick={handleReset}
            aria-label="Neu starten"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-stone-600 transition hover:bg-stone-200/70"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
        ) : undefined
      }
    >
      <Toast message={toast} />

      {dictError && (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs text-amber-800">
          Wörterbuch konnte nicht geladen werden – freie Eingabe aktiv.
        </div>
      )}

      {/* 6x5 Spielfeld */}
      <div className="my-auto flex flex-col items-center justify-center py-2">
        <div
          className="grid w-full max-w-[330px] gap-1.5"
          style={{ gridTemplateRows: `repeat(${maxAttempts}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: maxAttempts }).map((_, rowIdx) => {
            const isSubmitted = rowIdx < guesses.length;
            const isCurrent = rowIdx === guesses.length && status === 'playing';
            const word = isSubmitted ? guesses[rowIdx] : isCurrent ? currentGuess : '';
            const evals = isSubmitted ? evaluateGuess(word, targetWord) : null;

            return (
              <div
                key={rowIdx}
                className={`grid gap-1.5 ${isCurrent && shakeRow ? 'animate-shake' : ''}`}
                style={{ gridTemplateColumns: `repeat(${wordLength}, minmax(0, 1fr))` }}
              >
                {Array.from({ length: wordLength }).map((__, colIdx) => {
                  const char = word[colIdx] ?? '';
                  const state = evals ? evals[colIdx] : null;
                  const isFlipping = revealingRow === rowIdx;

                  let tileClass =
                    'border-stone-300 bg-white text-stone-900';
                  if (state) {
                    tileClass = TILE_COLORS[state];
                  } else if (char) {
                    tileClass = 'border-stone-500 bg-white text-stone-900 animate-pop';
                  }

                  return (
                    <div
                      key={colIdx}
                      style={
                        isFlipping
                          ? { animationDelay: `${colIdx * 90}ms` }
                          : undefined
                      }
                      className={`flex aspect-square items-center justify-center rounded-lg border-2 text-2xl font-bold uppercase select-none transition-colors ${tileClass} ${
                        isFlipping ? 'animate-flip' : ''
                      }`}
                    >
                      {char}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Neustart-Banner bei Niederlage, falls Modal geschlossen wurde */}
      {status === 'lost' && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-stone-800 active:scale-95"
          >
            <RotateCcw className="h-4 w-4" />
            Spiel neu starten
          </button>
        </div>
      )}

      {/* Deutsche QWERTZ Bildschirmtastatur ohne Umlaute */}
      <div className="mt-4 flex flex-col gap-1.5 select-none">
        {KEYBOARD_ROWS.map((row, rowIdx) => (
          <div key={rowIdx} className="flex justify-center gap-1">
            {row.map((key) => {
              const isAction = key === 'ENTER' || key === 'BACKSPACE';
              const keyState = !isAction ? keyboardStates[key] : undefined;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleKeyInput(key)}
                  disabled={status !== 'playing'}
                  aria-label={
                    key === 'BACKSPACE'
                      ? 'Löschen'
                      : key === 'ENTER'
                        ? 'Eingabe'
                        : key
                  }
                  className={`flex h-12 items-center justify-center rounded-lg font-bold transition active:scale-95 disabled:opacity-60 ${
                    isAction
                      ? 'flex-[1.5] bg-stone-300/90 px-1.5 text-[11px] tracking-wide text-stone-800 hover:bg-stone-300'
                      : `flex-1 text-sm ${
                          keyState
                            ? KEY_COLORS[keyState]
                            : 'bg-stone-200/90 text-stone-900 hover:bg-stone-300/80'
                        }`
                  }`}
                >
                  {key === 'BACKSPACE' ? <Delete className="h-5 w-5" /> : key}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <CompletionModal
        open={modalOpen}
        won={status === 'won'}
        title={status === 'won' ? 'Geschafft!' : 'Keine Versuche mehr'}
        subtitle={
          status === 'won'
            ? `Gelöst in ${guesses.length} von ${maxAttempts} Versuchen`
            : 'Leider noch nicht ganz – probier es einfach nochmal!'
        }
        message={status === 'won' ? config.completionMessage : undefined}
        onClose={() => setModalOpen(false)}
        onReset={handleReset}
      />
    </GameShell>
  );
};

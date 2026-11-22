import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { Shuffle, XCircle, Check, Award, RotateCcw } from 'lucide-react';
import type { ConnectionsConfig, ConnectionsCategory } from '../../types/puzzles';
import { loadFromStorage, saveToStorage, removeFromStorage } from '../../utils/storage';
import { GameShell } from '../../components/GameShell';
import { Toast } from '../../components/Toast';
import { CompletionModal } from '../../components/CompletionModal';

const STORAGE_KEY = 'gift_game_connections_v1';

interface SavedConnectionsState {
  signature: string;
  boardItems: string[];
  solvedLevels: number[];
  mistakesLeft: number;
  pastGuesses: string[];
  status: 'playing' | 'won' | 'lost';
}

interface ConnectionsGameProps {
  config: ConnectionsConfig;
}

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function makeGuessKey(items: string[]): string {
  return [...items].sort().join('||');
}

/**
 * Tauscht die 4 erratenen Begriffe in die oberste Reihe (Indizes 0..3)
 * und setzt die verdrängten Begriffe an die freigewordenen Plätze.
 */
function reorderToTopRow(
  currentBoard: string[],
  matchedSet: Set<string>
): { nextBoard: string[]; moved: boolean } {
  const matchedInBoardOrder = currentBoard.filter((item) => matchedSet.has(item));
  const displacedFromTop = currentBoard
    .slice(0, 4)
    .filter((item) => !matchedSet.has(item));

  if (displacedFromTop.length === 0) {
    return { nextBoard: currentBoard, moved: false };
  }

  const nextBoard = [...currentBoard];
  let displacedIdx = 0;

  for (let i = 4; i < currentBoard.length; i++) {
    if (matchedSet.has(currentBoard[i])) {
      nextBoard[i] = displacedFromTop[displacedIdx++];
    }
  }

  for (let i = 0; i < 4; i++) {
    nextBoard[i] = matchedInBoardOrder[i];
  }

  return { nextBoard, moved: true };
}

export const ConnectionsGame: React.FC<ConnectionsGameProps> = ({ config }) => {
  const allItems = useMemo(
    () => config.categories.flatMap((c) => c.items),
    [config.categories]
  );

  const puzzleSignature = useMemo(
    () => config.categories.map((c) => `${c.level}:${c.items.join(',')}`).join('|'),
    [config.categories]
  );

  const initialState = useMemo((): SavedConnectionsState => {
    const saved = loadFromStorage<SavedConnectionsState>(STORAGE_KEY);
    if (saved && saved.signature === puzzleSignature) {
      return saved;
    }
    return {
      signature: puzzleSignature,
      boardItems: shuffleArray(allItems),
      solvedLevels: [],
      mistakesLeft: config.maxMistakes,
      pastGuesses: [],
      status: 'playing',
    };
  }, [puzzleSignature, allItems, config.maxMistakes]);

  const [boardItems, setBoardItems] = useState<string[]>(initialState.boardItems);
  const [solvedLevels, setSolvedLevels] = useState<number[]>(initialState.solvedLevels);
  const [mistakesLeft, setMistakesLeft] = useState<number>(initialState.mistakesLeft);
  const [pastGuesses, setPastGuesses] = useState<string[]>(initialState.pastGuesses);
  const [status, setStatus] = useState<'playing' | 'won' | 'lost'>(initialState.status);
  const [selected, setSelected] = useState<string[]>([]);
  const [shakingItems, setShakingItems] = useState<Set<string>>(new Set());
  const [hoppingItems, setHoppingItems] = useState<string[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState<boolean>(initialState.status !== 'playing');

  const cardRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const flipSnapshotRef = useRef<{
    rects: Map<string, DOMRect>;
    elevated: Set<string>;
  } | null>(null);
  const timersRef = useRef<number[]>([]);
  const toastTimerRef = useRef<number | null>(null);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  const clearScheduledTimers = useCallback(() => {
    for (const id of timersRef.current) {
      window.clearTimeout(id);
    }
    timersRef.current = [];
  }, []);

  useEffect(() => clearScheduledTimers, [clearScheduledTimers]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 2200);
  }, []);

  // FLIP-Animation nach dem Umsortieren in die oberste Reihe
  useLayoutEffect(() => {
    const snapshot = flipSnapshotRef.current;
    if (!snapshot) return;
    flipSnapshotRef.current = null;

    const animatedEls: HTMLButtonElement[] = [];

    for (const [item, prevRect] of snapshot.rects.entries()) {
      const el = cardRefs.current.get(item);
      if (!el) continue;

      const nextRect = el.getBoundingClientRect();
      const dx = prevRect.left - nextRect.left;
      const dy = prevRect.top - nextRect.top;

      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        el.style.transition = 'none';
        el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
        el.style.zIndex = snapshot.elevated.has(item) ? '20' : '10';
        animatedEls.push(el);
      }
    }

    if (animatedEls.length === 0) return;

    // Reflow erzwingen, damit der Browser die Startposition übernimmt
    void document.body.offsetHeight;

    for (const el of animatedEls) {
      el.style.transition = 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1)';
      el.style.transform = 'translate3d(0, 0, 0)';
    }

    schedule(() => {
      for (const el of animatedEls) {
        el.style.transition = '';
        el.style.transform = '';
        el.style.zIndex = '';
      }
    }, 450);
  }, [boardItems, schedule]);

  useEffect(() => {
    saveToStorage<SavedConnectionsState>(STORAGE_KEY, {
      signature: puzzleSignature,
      boardItems,
      solvedLevels,
      mistakesLeft,
      pastGuesses,
      status,
    });
  }, [puzzleSignature, boardItems, solvedLevels, mistakesLeft, pastGuesses, status]);

  const solvedCategories = useMemo(
    () =>
      solvedLevels
        .map((lvl) => config.categories.find((c) => c.level === lvl))
        .filter((c): c is ConnectionsCategory => Boolean(c)),
    [solvedLevels, config.categories]
  );

  const remainingCategories = useMemo(
    () => config.categories.filter((c) => !solvedLevels.includes(c.level)),
    [config.categories, solvedLevels]
  );

  const toggleItem = (item: string) => {
    if (status !== 'playing' || isAnimating) return;
    setSelected((prev) => {
      if (prev.includes(item)) {
        return prev.filter((x) => x !== item);
      }
      if (prev.length >= 4) {
        return prev;
      }
      return [...prev, item];
    });
  };

  const handleShuffle = () => {
    if (status !== 'playing' || isAnimating) return;
    setBoardItems((prev) => shuffleArray(prev));
  };

  const handleDeselectAll = () => {
    if (status !== 'playing' || isAnimating) return;
    setSelected([]);
  };

  const triggerShake = (items: string[]) => {
    setShakingItems(new Set(items));
    schedule(() => {
      setShakingItems(new Set());
    }, 460);
  };

  const handleSubmit = () => {
    if (status !== 'playing' || isAnimating || selected.length !== 4) return;

    const guessKey = makeGuessKey(selected);
    if (pastGuesses.includes(guessKey)) {
      showToast('Bereits versucht');
      return;
    }

    const nextPastGuesses = [...pastGuesses, guessKey];
    setPastGuesses(nextPastGuesses);

    // Prüfen, ob alle 4 zu einer noch ungelösten Kategorie gehören
    const matchedCategory = remainingCategories.find((cat) =>
      selected.every((item) => cat.items.includes(item))
    );

    if (matchedCategory) {
      const matchedSet = new Set(matchedCategory.items);
      const orderedMatched = boardItems.filter((item) => matchedSet.has(item));

      setIsAnimating(true);
      // Phase 1: Gestaffeltes kleines Wackeln/Hüpfen der 4 Felder
      setHoppingItems(orderedMatched);

      schedule(() => {
        setHoppingItems([]);

        // Phase 2: Positionen erfassen (FLIP) und die 4 Felder in die oberste Reihe gleiten lassen
        const rects = new Map<string, DOMRect>();
        for (const item of boardItems) {
          const el = cardRefs.current.get(item);
          if (el) {
            rects.set(item, el.getBoundingClientRect());
          }
        }

        const { nextBoard, moved } = reorderToTopRow(boardItems, matchedSet);
        if (moved) {
          flipSnapshotRef.current = { rects, elevated: matchedSet };
          setBoardItems(nextBoard);
        }

        // Phase 3: Nach dem Zusammenführen in der obersten Reihe zum Kategorie-Banner zusammenklappen
        const mergeDelay = moved ? 460 : 80;
        schedule(() => {
          const nextSolved = [...solvedLevels, matchedCategory.level];
          const remainingBoard = nextBoard.filter((item) => !matchedSet.has(item));

          setSolvedLevels(nextSolved);
          setBoardItems(remainingBoard);
          setSelected([]);
          setIsAnimating(false);

          if (nextSolved.length === config.categories.length) {
            setStatus('won');
            schedule(() => setModalOpen(true), 450);
          }
        }, mergeDelay);
      }, 540);
      return;
    }

    // Prüfen, ob 3 von 4 zu derselben Kategorie gehören
    const isOneAway = remainingCategories.some((cat) => {
      const count = selected.filter((item) => cat.items.includes(item)).length;
      return count === 3;
    });

    const nextMistakes = mistakesLeft - 1;
    setMistakesLeft(nextMistakes);

    if (isOneAway) {
      showToast('Fast! Einer fehlt...');
    } else {
      triggerShake(selected);
    }

    if (nextMistakes <= 0) {
      setSelected([]);
      setStatus('lost');
      schedule(() => setModalOpen(true), 550);
    }
  };

  const handleReset = useCallback(() => {
    clearScheduledTimers();
    flipSnapshotRef.current = null;
    removeFromStorage(STORAGE_KEY);
    setBoardItems(shuffleArray(allItems));
    setSolvedLevels([]);
    setMistakesLeft(config.maxMistakes);
    setPastGuesses([]);
    setStatus('playing');
    setSelected([]);
    setShakingItems(new Set());
    setHoppingItems([]);
    setIsAnimating(false);
    setModalOpen(false);
    setToast(null);
  }, [allItems, config.maxMistakes, clearScheduledTimers]);

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

      <p className="mb-3 text-center text-xs font-medium text-stone-500">
        Finde vier Gruppen aus je vier zusammengehörenden Begriffen.
      </p>

      {/* Gelöste Kategorien als farbige Banner */}
      <div className="flex flex-col gap-2">
        {solvedCategories.map((cat) => (
          <div
            key={cat.level}
            style={{ backgroundColor: cat.color }}
            className="animate-banner flex flex-col items-center justify-center rounded-xl px-3 py-3 text-center text-stone-900 shadow-xs"
          >
            <span className="text-xs font-extrabold uppercase tracking-wider">
              {cat.title}
            </span>
            <span className="mt-0.5 text-xs font-medium text-stone-900/90">
              {cat.items.join(', ')}
            </span>
          </div>
        ))}
      </div>

      {/* 4x4 Spielfeld für verbleibende Begriffe */}
      {boardItems.length > 0 && (
        <div
          className={`grid grid-cols-4 gap-2 ${solvedCategories.length > 0 ? 'mt-2' : ''}`}
        >
          {boardItems.map((item) => {
            const isSelected = selected.includes(item);
            const isShaking = shakingItems.has(item);
            const hopIndex = hoppingItems.indexOf(item);
            const isHopping = hopIndex !== -1;

            return (
              <button
                key={item}
                ref={(el) => {
                  if (el) {
                    cardRefs.current.set(item, el);
                  } else {
                    cardRefs.current.delete(item);
                  }
                }}
                type="button"
                onClick={() => toggleItem(item)}
                disabled={status !== 'playing' || isAnimating}
                style={
                  isHopping ? { animationDelay: `${hopIndex * 75}ms` } : undefined
                }
                className={`relative flex aspect-[1.08/1] items-center justify-center rounded-xl border px-1.5 text-center text-[11px] font-bold leading-tight tracking-tight break-words transition-colors select-none active:scale-[0.96] sm:text-xs ${
                  isSelected
                    ? 'border-stone-900 bg-stone-800 text-white shadow-sm'
                    : 'border-stone-200/90 bg-stone-200/70 text-stone-900 hover:bg-stone-200'
                } ${isShaking ? 'animate-shake' : ''} ${
                  isHopping ? 'animate-hop' : ''
                }`}
              >
                <span className="line-clamp-3">{item}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Lebensanzeige (4 Punkte) */}
      <div className="mt-5 flex items-center justify-center gap-2 text-xs font-medium text-stone-600">
        <span>Verbleibende Versuche:</span>
        <div
          className="flex items-center gap-1.5"
          aria-label={`${mistakesLeft} von ${config.maxMistakes} Versuchen übrig`}
        >
          {Array.from({ length: config.maxMistakes }).map((_, idx) => (
            <span
              key={idx}
              className={`h-3 w-3 rounded-full transition-all duration-300 ${
                idx < mistakesLeft
                  ? 'scale-100 bg-stone-800'
                  : 'scale-75 bg-stone-300'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Steuerungs-Buttons */}
      <div className="mt-5 flex items-center justify-center gap-2">
        {status === 'lost' ? (
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-stone-800 active:scale-95"
          >
            <RotateCcw className="h-4 w-4" />
            Spiel neu starten
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleShuffle}
              disabled={status !== 'playing' || isAnimating || boardItems.length === 0}
              className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-stone-800 transition hover:bg-stone-100 active:scale-95 disabled:opacity-40"
            >
              <Shuffle className="h-3.5 w-3.5" />
              Mischen
            </button>

            <button
              type="button"
              onClick={handleDeselectAll}
              disabled={status !== 'playing' || isAnimating || selected.length === 0}
              className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-stone-800 transition hover:bg-stone-100 active:scale-95 disabled:opacity-40"
            >
              <XCircle className="h-3.5 w-3.5" />
              Auswahl aufheben
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={status !== 'playing' || isAnimating || selected.length !== 4}
              className="inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-stone-800 active:scale-95 disabled:bg-stone-300 disabled:text-stone-500"
            >
              <Check className="h-3.5 w-3.5" />
              Prüfen
            </button>
          </>
        )}
      </div>

      <CompletionModal
        open={modalOpen}
        won={status === 'won'}
        title={status === 'won' ? 'Alle Gruppen gefunden!' : 'Keine Versuche mehr'}
        subtitle={
          status === 'won'
            ? `${config.maxMistakes - mistakesLeft} Fehlversuch${
                config.maxMistakes - mistakesLeft === 1 ? '' : 'e'
              }`
            : 'Leider noch nicht ganz – probier es einfach nochmal!'
        }
        message={status === 'won' ? config.completionMessage : undefined}
        onClose={() => setModalOpen(false)}
        onReset={handleReset}
      />
    </GameShell>
  );
};

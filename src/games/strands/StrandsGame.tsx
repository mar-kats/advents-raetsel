import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Lightbulb, Award } from 'lucide-react';
import type { StrandsConfig, GridCoord } from '../../types/puzzles';
import { normalizeGerman } from '../../utils/normalize';
import { loadGermanDictionary } from '../../utils/dictionary';
import { loadFromStorage, saveToStorage, removeFromStorage } from '../../utils/storage';
import { GameShell } from '../../components/GameShell';
import { Toast } from '../../components/Toast';
import { CompletionModal } from '../../components/CompletionModal';

const STORAGE_KEY = 'gift_game_strands_v1';
const BONUS_PER_HINT = 3;

interface FoundWordEntry {
  word: string;
  path: GridCoord[];
  isSpangram: boolean;
}

interface SavedStrandsState {
  signature: string;
  foundWords: FoundWordEntry[];
  bonusWords: string[];
  hintsUsed: number;
  activeHintWord: string | null;
}

interface StrandsGameProps {
  config: StrandsConfig;
}

function coordKey([r, c]: GridCoord): string {
  return `${r},${c}`;
}

function isAdjacent(a: GridCoord, b: GridCoord): boolean {
  const dr = Math.abs(a[0] - b[0]);
  const dc = Math.abs(a[1] - b[1]);
  return dr <= 1 && dc <= 1 && (dr !== 0 || dc !== 0);
}

function sameCellSet(a: GridCoord[], b: GridCoord[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a.map(coordKey));
  return b.every((coord) => setA.has(coordKey(coord)));
}

function pathToPoints(path: GridCoord[]): string {
  return path.map(([r, c]) => `${c * 100 + 50},${r * 100 + 50}`).join(' ');
}

export const StrandsGame: React.FC<StrandsGameProps> = ({ config }) => {
  const totalTargets = config.themeWords.length + 1; // 5 Themenwörter + 1 Spangram = 6

  const puzzleSignature = useMemo(
    () =>
      `${config.theme}|${config.spangram.word}|${config.themeWords
        .map((w) => w.word)
        .join(',')}`,
    [config]
  );

  const initialState = useMemo((): SavedStrandsState => {
    const saved = loadFromStorage<SavedStrandsState>(STORAGE_KEY);
    if (saved && saved.signature === puzzleSignature) {
      return saved;
    }
    return {
      signature: puzzleSignature,
      foundWords: [],
      bonusWords: [],
      hintsUsed: 0,
      activeHintWord: null,
    };
  }, [puzzleSignature]);

  const [foundWords, setFoundWords] = useState<FoundWordEntry[]>(
    initialState.foundWords
  );
  const [bonusWords, setBonusWords] = useState<string[]>(initialState.bonusWords);
  const [hintsUsed, setHintsUsed] = useState<number>(initialState.hintsUsed);
  const [activeHintWord, setActiveHintWord] = useState<string | null>(
    initialState.activeHintWord
  );

  const [currentPath, setCurrentPath] = useState<GridCoord[]>([]);
  const [dictionary, setDictionary] = useState<Set<string> | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState<boolean>(
    initialState.foundWords.length >= totalTargets
  );

  const gridRef = useRef<HTMLDivElement | null>(null);
  const isPointerDownRef = useRef(false);
  const hasDraggedRef = useRef(false);
  const pointerDownCellRef = useRef<GridCoord | null>(null);
  const currentPathRef = useRef<GridCoord[]>([]);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    currentPathRef.current = currentPath;
  }, [currentPath]);

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
        // Fallback: Themenwörter bleiben immer lösbar
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    saveToStorage<SavedStrandsState>(STORAGE_KEY, {
      signature: puzzleSignature,
      foundWords,
      bonusWords,
      hintsUsed,
      activeHintWord,
    });
  }, [puzzleSignature, foundWords, bonusWords, hintsUsed, activeHintWord]);

  const isCompleted = foundWords.length >= totalTargets;

  const lockedCellMap = useMemo(() => {
    const map = new Map<string, 'theme' | 'spangram'>();
    for (const entry of foundWords) {
      const kind = entry.isSpangram ? 'spangram' : 'theme';
      for (const coord of entry.path) {
        map.set(coordKey(coord), kind);
      }
    }
    return map;
  }, [foundWords]);

  const hintedCellSet = useMemo(() => {
    const set = new Set<string>();
    if (!activeHintWord) return set;

    if (normalizeGerman(config.spangram.word) === activeHintWord) {
      for (const coord of config.spangram.path) set.add(coordKey(coord));
      return set;
    }

    const tw = config.themeWords.find(
      (w) => normalizeGerman(w.word) === activeHintWord
    );
    if (tw) {
      for (const coord of tw.path) set.add(coordKey(coord));
    }
    return set;
  }, [activeHintWord, config]);

  const selectedCellSet = useMemo(
    () => new Set(currentPath.map(coordKey)),
    [currentPath]
  );

  const currentWord = useMemo(
    () => currentPath.map(([r, c]) => config.grid[r][c]).join(''),
    [currentPath, config.grid]
  );

  const unusedBonusCount = Math.max(0, bonusWords.length - hintsUsed * BONUS_PER_HINT);
  const availableHints = Math.floor(unusedBonusCount / BONUS_PER_HINT);
  const progressTowardNextHint =
    availableHints > 0 ? BONUS_PER_HINT : unusedBonusCount % BONUS_PER_HINT;

  const submitPath = useCallback(
    (path: GridCoord[]) => {
      if (path.length === 0) return;

      const word = normalizeGerman(
        path.map(([r, c]) => config.grid[r][c]).join('')
      );

      if (word.length < 4) {
        if (path.length >= 2) {
          showToast('Zu kurz');
        }
        setCurrentPath([]);
        return;
      }

      const alreadyFoundWords = new Set(foundWords.map((f) => f.word));

      // 1. Spangram prüfen
      const spangramWord = normalizeGerman(config.spangram.word);
      if (word === spangramWord && !alreadyFoundWords.has(spangramWord)) {
        const resolvedPath = sameCellSet(path, config.spangram.path)
          ? path
          : config.spangram.path;
        const nextFound: FoundWordEntry[] = [
          ...foundWords,
          { word: spangramWord, path: resolvedPath, isSpangram: true },
        ];
        setFoundWords(nextFound);
        if (activeHintWord === spangramWord) setActiveHintWord(null);
        setCurrentPath([]);
        showToast('Spangram!');

        if (nextFound.length >= totalTargets) {
          window.setTimeout(() => setModalOpen(true), 650);
        }
        return;
      }

      // 2. Themenwort prüfen
      const matchedTheme = config.themeWords.find((tw) => {
        const twNorm = normalizeGerman(tw.word);
        return twNorm === word && !alreadyFoundWords.has(twNorm);
      });

      if (matchedTheme) {
        const twNorm = normalizeGerman(matchedTheme.word);
        const resolvedPath = sameCellSet(path, matchedTheme.path)
          ? path
          : matchedTheme.path;
        const nextFound: FoundWordEntry[] = [
          ...foundWords,
          { word: twNorm, path: resolvedPath, isSpangram: false },
        ];
        setFoundWords(nextFound);
        if (activeHintWord === twNorm) setActiveHintWord(null);
        setCurrentPath([]);

        if (nextFound.length >= totalTargets) {
          window.setTimeout(() => setModalOpen(true), 650);
        }
        return;
      }

      // 3. Bereits gefunden?
      if (alreadyFoundWords.has(word) || bonusWords.includes(word)) {
        showToast('Bereits gefunden');
        setCurrentPath([]);
        return;
      }

      // 4. Bonuswort aus Wörterbuch (>= 4 Buchstaben)
      if (dictionary && dictionary.has(word)) {
        setBonusWords((prev) => [...prev, word]);
        showToast('Bonuswort! (+1)');
        setCurrentPath([]);
        return;
      }

      showToast('Nicht in der Wortliste');
      setCurrentPath([]);
    },
    [
      config,
      foundWords,
      bonusWords,
      dictionary,
      activeHintWord,
      totalTargets,
      showToast,
    ]
  );

  const getCellFromPoint = useCallback(
    (clientX: number, clientY: number, strictRadius: boolean): GridCoord | null => {
      const el = gridRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) {
        return null;
      }

      const cellW = rect.width / config.cols;
      const cellH = rect.height / config.rows;
      const col = Math.floor(x / cellW);
      const row = Math.floor(y / cellH);

      if (row < 0 || row >= config.rows || col < 0 || col >= config.cols) {
        return null;
      }

      if (strictRadius) {
        const cx = (col + 0.5) * cellW;
        const cy = (row + 0.5) * cellH;
        const dist = Math.hypot(x - cx, y - cy);
        const maxRadius = Math.min(cellW, cellH) * 0.44;
        if (dist > maxRadius) {
          return null;
        }
      }

      return [row, col];
    },
    [config.cols, config.rows]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isCompleted) return;
    const cell = getCellFromPoint(e.clientX, e.clientY, false);
    if (!cell) return;
    if (lockedCellMap.has(coordKey(cell))) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    isPointerDownRef.current = true;
    hasDraggedRef.current = false;
    pointerDownCellRef.current = cell;

    // Wenn noch kein Tap-Pfad aktiv ist, direkt beim Ansetzen starten
    if (currentPathRef.current.length === 0) {
      setCurrentPath([cell]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current || isCompleted) return;

    const cell = getCellFromPoint(e.clientX, e.clientY, true);
    if (!cell) return;
    if (lockedCellMap.has(coordKey(cell))) return;

    const startCell = pointerDownCellRef.current;
    const path = currentPathRef.current;

    if (startCell && (cell[0] !== startCell[0] || cell[1] !== startCell[1])) {
      if (!hasDraggedRef.current) {
        hasDraggedRef.current = true;
        // Wenn vorher ein Tap-Pfad woanders war, von startCell neu beginnen
        const last = path[path.length - 1];
        if (!last || last[0] !== startCell[0] || last[1] !== startCell[1]) {
          if (isAdjacent(startCell, cell)) {
            setCurrentPath([startCell, cell]);
          } else {
            setCurrentPath([startCell]);
          }
          return;
        }
      }
    }

    if (path.length === 0) {
      setCurrentPath([cell]);
      return;
    }

    const last = path[path.length - 1];
    if (last[0] === cell[0] && last[1] === cell[1]) {
      return;
    }

    // Zurückziehen auf vorletzten Buchstaben macht letzten Schritt rückgängig
    if (path.length >= 2) {
      const prev = path[path.length - 2];
      if (prev[0] === cell[0] && prev[1] === cell[1]) {
        setCurrentPath(path.slice(0, -1));
        return;
      }
    }

    const key = coordKey(cell);
    const alreadyInPath = path.some((p) => coordKey(p) === key);
    if (!alreadyInPath && isAdjacent(last, cell)) {
      setCurrentPath([...path, cell]);
    }
  };

  const handlePointerUp = () => {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;

    const cell = pointerDownCellRef.current;
    pointerDownCellRef.current = null;
    const path = currentPathRef.current;

    if (hasDraggedRef.current) {
      hasDraggedRef.current = false;
      submitPath(path);
      return;
    }

    // Tap-Modus (ohne Drag)
    if (!cell) return;
    const key = coordKey(cell);
    const existingIdx = path.findIndex((p) => coordKey(p) === key);

    if (path.length === 1 && existingIdx === 0) {
      // Erster Tap hat die Zelle gerade erst hinzugefügt -> ausgewählt lassen
      return;
    }

    if (existingIdx === path.length - 1 && path.length >= 2) {
      // Erneutes Tippen auf den letzten Buchstaben -> Wort einreichen
      submitPath(path);
      return;
    }

    if (existingIdx !== -1) {
      // Tippen auf früheren Buchstaben -> Pfad bis dorthin kürzen
      setCurrentPath(path.slice(0, existingIdx + 1));
      return;
    }

    const last = path[path.length - 1];
    if (last && isAdjacent(last, cell)) {
      setCurrentPath([...path, cell]);
    } else {
      // Nicht benachbart -> neue Auswahl starten
      setCurrentPath([cell]);
    }
  };

  const handleHint = () => {
    if (isCompleted || availableHints < 1 || activeHintWord) return;

    const foundSet = new Set(foundWords.map((f) => f.word));
    const nextTheme = config.themeWords.find(
      (tw) => !foundSet.has(normalizeGerman(tw.word))
    );

    const targetHint = nextTheme
      ? normalizeGerman(nextTheme.word)
      : !foundSet.has(normalizeGerman(config.spangram.word))
        ? normalizeGerman(config.spangram.word)
        : null;

    if (!targetHint) return;

    setHintsUsed((prev) => prev + 1);
    setActiveHintWord(targetHint);
    showToast('Hinweis aktiviert');
  };

  const handleReset = useCallback(() => {
    removeFromStorage(STORAGE_KEY);
    setFoundWords([]);
    setBonusWords([]);
    setHintsUsed(0);
    setActiveHintWord(null);
    setCurrentPath([]);
    setModalOpen(false);
    setToast(null);
  }, []);

  return (
    <GameShell
      title={config.title}
      onReset={handleReset}
      headerRight={
        isCompleted ? (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            aria-label="Nachricht anzeigen"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-amber-600 transition hover:bg-amber-50"
          >
            <Award className="h-5 w-5" />
          </button>
        ) : undefined
      }
    >
      <Toast message={toast} />

      {/* Themenkarte */}
      <div className="mx-auto w-full max-w-[360px] overflow-hidden rounded-2xl border border-stone-200 bg-white text-center shadow-xs">
        <div className="bg-[#a3d5ff]/45 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-stone-700">
          Thema des Tages
        </div>
        <div className="px-4 py-2.5 text-base font-bold tracking-tight text-stone-900">
          {config.theme}
        </div>
      </div>

      {/* Live-Wortanzeige */}
      <div className="mt-3 flex h-8 items-center justify-center">
        {currentWord ? (
          <span className="rounded-lg bg-stone-900/5 px-3 py-1 text-lg font-extrabold tracking-[0.14em] text-stone-900">
            {currentWord}
          </span>
        ) : (
          <span className="text-xs font-medium text-stone-400">
            Ziehe oder tippe über benachbarte Buchstaben
          </span>
        )}
      </div>

      {/* 6x8 Buchstabengitter + SVG-Verbindungslinien */}
      <div className="mx-auto mt-2 w-full max-w-[360px]">
        <div
          ref={gridRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="relative aspect-[6/8] w-full touch-none select-none rounded-2xl bg-white p-1 shadow-xs ring-1 ring-stone-200/80"
        >
          {/* SVG-Linien für gefundene Wörter und aktive Auswahl */}
          <svg
            viewBox={`0 0 ${config.cols * 100} ${config.rows * 100}`}
            className="pointer-events-none absolute inset-1 h-[calc(100%-0.5rem)] w-[calc(100%-0.5rem)]"
          >
            {foundWords.map((entry) => (
              <polyline
                key={entry.word}
                points={pathToPoints(entry.path)}
                fill="none"
                stroke={entry.isSpangram ? '#f8cd46' : '#a3d5ff'}
                strokeWidth="24"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}

            {currentPath.length > 1 && (
              <polyline
                points={pathToPoints(currentPath)}
                fill="none"
                stroke="#d6d3d1"
                strokeWidth="22"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>

          {/* 48 Buchstaben-Kreise */}
          <div
            className="relative z-10 grid h-full w-full"
            style={{
              gridTemplateColumns: `repeat(${config.cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${config.rows}, minmax(0, 1fr))`,
            }}
          >
            {config.grid.map((row, rIdx) =>
              row.map((letter, cIdx) => {
                const key = `${rIdx},${cIdx}`;
                const lockedKind = lockedCellMap.get(key);
                const isSelected = selectedCellSet.has(key);
                const isHinted = !lockedKind && hintedCellSet.has(key);

                let circleClass = 'bg-transparent text-stone-800';
                if (lockedKind === 'spangram') {
                  circleClass = 'bg-[#f8cd46] text-stone-900 shadow-xs';
                } else if (lockedKind === 'theme') {
                  circleClass = 'bg-[#a3d5ff] text-stone-900 shadow-xs';
                } else if (isSelected) {
                  circleClass = 'bg-stone-300 text-stone-950 scale-105';
                }

                return (
                  <div
                    key={key}
                    className="flex items-center justify-center p-1"
                  >
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold transition-transform duration-100 sm:h-11 sm:w-11 ${circleClass} ${
                        isHinted
                          ? 'border-2 border-dashed border-sky-600 bg-sky-50/70'
                          : ''
                      }`}
                    >
                      {letter}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Hinweis-Button & Fortschritt */}
      <div className="mx-auto mt-4 flex w-full max-w-[360px] items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleHint}
          disabled={isCompleted || availableHints < 1 || Boolean(activeHintWord)}
          className={`relative inline-flex items-center gap-2 overflow-hidden rounded-full border px-4 py-2 text-xs font-bold transition active:scale-95 ${
            availableHints >= 1 && !activeHintWord && !isCompleted
              ? 'border-stone-900 bg-stone-900 text-white hover:bg-stone-800'
              : 'border-stone-300 bg-white text-stone-500 disabled:opacity-75'
          }`}
        >
          {/* Fortschrittsfüllung bis zum nächsten Hinweis */}
          {availableHints < 1 && !isCompleted && (
            <span
              className="pointer-events-none absolute inset-y-0 left-0 bg-stone-200/80 transition-all duration-300"
              style={{
                width: `${(progressTowardNextHint / BONUS_PER_HINT) * 100}%`,
              }}
            />
          )}
          <span className="relative z-10 inline-flex items-center gap-1.5">
            <Lightbulb className="h-3.5 w-3.5" />
            {activeHintWord
              ? 'Hinweis aktiv'
              : availableHints >= 1
                ? `Hinweis (${availableHints})`
                : `Hinweis (${progressTowardNextHint}/${BONUS_PER_HINT})`}
          </span>
        </button>

        <div className="text-right text-xs font-semibold text-stone-600">
          {foundWords.length} von {totalTargets} Themenwörtern gefunden
        </div>
      </div>

      <CompletionModal
        open={modalOpen}
        won={isCompleted}
        title="Alle Wörter gefunden!"
        subtitle={`${foundWords.length} von ${totalTargets} Themenwörtern gelöst`}
        message={config.completionMessage}
        onClose={() => setModalOpen(false)}
        onReset={handleReset}
      />
    </GameShell>
  );
};

import React from 'react';
import { Grid2X2, Hash, Compass, ChevronRight } from 'lucide-react';
import type { GameId, PuzzlesData } from '../types/puzzles';

interface OverviewProps {
  puzzles: PuzzlesData;
  onSelectGame: (game: GameId) => void;
}

export const Overview: React.FC<OverviewProps> = ({ puzzles, onSelectGame }) => {
  const games: {
    id: GameId;
    title: string;
    description: string;
    accent: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'wordle',
      title: puzzles.wordle.title,
      description: 'Errate das 5-Buchstaben-Wort in 6 Versuchen.',
      accent: 'bg-[#6aaa64]/15 text-[#4a8544]',
      icon: <Hash className="h-5 w-5" />,
    },
    {
      id: 'connections',
      title: puzzles.connections.title,
      description: 'Finde vier Gruppen aus je vier zusammengehörenden Begriffen.',
      accent: 'bg-[#ba81c5]/20 text-[#7d4988]',
      icon: <Grid2X2 className="h-5 w-5" />,
    },
    {
      id: 'strands',
      title: puzzles.strands.title,
      description: `Entdecke alle Themenwörter zu „${puzzles.strands.theme}“.`,
      accent: 'bg-[#a3d5ff]/35 text-[#1f6da8]',
      icon: <Compass className="h-5 w-5" />,
    },
  ];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col justify-center px-5 py-10">
      <div className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-400">
          Persönliche Rätsel
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-stone-900">
          Wort- & Logikspiele
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          Wähle eines der drei Rätsel aus, um direkt zu starten.
        </p>
      </div>

      <div className="flex flex-col gap-3.5">
        {games.map((game) => (
          <button
            key={game.id}
            type="button"
            onClick={() => onSelectGame(game.id)}
            className="group flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4 text-left shadow-xs transition hover:border-stone-300 hover:shadow-md active:scale-[0.99]"
          >
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${game.accent}`}
            >
              {game.icon}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-stone-900">{game.title}</h2>
              <p className="mt-0.5 text-xs leading-relaxed text-stone-500">
                {game.description}
              </p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-stone-600" />
          </button>
        ))}
      </div>
    </div>
  );
};

import React, { useState, useEffect, useCallback } from 'react';
import puzzlesJson from './data/puzzles.json';
import type { GameId, PuzzlesData } from './types/puzzles';
import { Overview } from './components/Overview';
import { WordleGame } from './games/wordle/WordleGame';
import { ConnectionsGame } from './games/connections/ConnectionsGame';
import { StrandsGame } from './games/strands/StrandsGame';

const puzzles = puzzlesJson as PuzzlesData;

function getGameFromUrl(): GameId | null {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('game')?.toLowerCase();
  if (raw === 'wordle' || raw === 'connections' || raw === 'strands') {
    return raw;
  }
  return null;
}

export const App: React.FC = () => {
  const [activeGame, setActiveGame] = useState<GameId | null>(() => getGameFromUrl());

  useEffect(() => {
    const onPopState = () => {
      setActiveGame(getGameFromUrl());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (activeGame === 'wordle') {
      document.title = puzzles.wordle.title;
    } else if (activeGame === 'connections') {
      document.title = puzzles.connections.title;
    } else if (activeGame === 'strands') {
      document.title = puzzles.strands.title;
    } else {
      document.title = 'Wort- & Logikspiele';
    }
  }, [activeGame]);

  const navigateToGame = useCallback((game: GameId | null) => {
    const url = new URL(window.location.href);
    if (game) {
      url.searchParams.set('game', game);
    } else {
      url.searchParams.delete('game');
    }
    window.history.pushState({}, '', url.toString());
    setActiveGame(game);
  }, []);

  if (activeGame === 'wordle') {
    return <WordleGame config={puzzles.wordle} />;
  }

  if (activeGame === 'connections') {
    return <ConnectionsGame config={puzzles.connections} />;
  }

  if (activeGame === 'strands') {
    return <StrandsGame config={puzzles.strands} />;
  }

  return <Overview puzzles={puzzles} onSelectGame={navigateToGame} />;
};

export default App;

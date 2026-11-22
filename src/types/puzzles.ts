export type GameId = 'wordle' | 'connections' | 'strands';

export interface WordleConfig {
  title: string;
  targetWord: string;
  maxAttempts: number;
  completionMessage: string;
}

export interface ConnectionsCategory {
  level: number;
  color: string;
  title: string;
  items: string[];
}

export interface ConnectionsConfig {
  title: string;
  maxMistakes: number;
  categories: ConnectionsCategory[];
  completionMessage: string;
}

export type GridCoord = [number, number];

export interface StrandsWord {
  word: string;
  path: GridCoord[];
}

export interface StrandsConfig {
  title: string;
  theme: string;
  rows: number;
  cols: number;
  grid: string[][];
  spangram: StrandsWord;
  themeWords: StrandsWord[];
  completionMessage: string;
}

export interface PuzzlesData {
  wordle: WordleConfig;
  connections: ConnectionsConfig;
  strands: StrandsConfig;
}

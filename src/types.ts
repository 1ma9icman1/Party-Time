export type GameMode = 'story' | 'tournament' | 'solo';

export interface Player {
  id: string;
  name: string;
  color?: string;
  score?: number;
  avatar?: string;
}

export interface Room {
  id: string;
  host: string;
  players: Player[];
  status: 'waiting' | 'playing' | 'finished';
  mode: GameMode;
  currentTurnIndex: number;
}

export interface GameState {
  level: number;
  score: number;
  birds: string[]; // e.g. 'red', 'yellow', 'bomb'
  birdsLeft: number;
  currentTurn: string; // playerId
  status: 'playing' | 'level_complete' | 'level_failed';
}

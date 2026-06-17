import { useSyncExternalStore } from 'react';
import type { GameStore, GameState } from '../../app/GameStore';

/** Subscribes a component to the game store's coarse state. */
export function useGameState(store: GameStore): GameState {
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

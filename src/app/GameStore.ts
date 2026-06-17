/**
 * Minimal observable store bridging the imperative engine to the React HUD.
 * React subscribes via `useSyncExternalStore`; the engine writes coarse state
 * transitions only. Per-frame values (e.g. the catch gauge) are pushed
 * imperatively to DOM refs, never through this store, to protect frame rate.
 */

import type { GhostDef } from '../data/catalog.types';
import type { CollectionMap } from '../services/persistence/schema';

export type GamePhase = 'permission' | 'hunting' | 'result' | 'dogam' | 'settings';

export interface PermissionIssue {
  /** Whether motion-sensor access was granted. */
  orientation: boolean;
  /** Whether camera access was granted. */
  camera: boolean;
  /** User-facing explanation (Korean for now; routed through i18n in M5). */
  message: string;
}

/** Details of a just-captured ghost, shown in the result modal. */
export interface CatchResultInfo {
  def: GhostDef;
  reward: number;
  ambush: boolean;
  /** True the first time this species is captured (collection bonus, M4). */
  firstCatch: boolean;
}

export interface GameState {
  phase: GamePhase;
  permissionIssue: PermissionIssue | null;
  /** True once live gyro readings are flowing (HUD shows a readiness hint). */
  hasOrientationData: boolean;
  /** Earned credits (persisted via SaveStore). */
  credits: number;
  /** 도감: captured species → record. Persisted. */
  collection: CollectionMap;
  /** The ghost just captured (drives the result modal). */
  result: CatchResultInfo | null;
  /** Transient message (e.g. a ghost fled). Auto-cleared. */
  toast: string | null;
  /** Dread warning shown briefly before an ambush ghost pops. Auto-cleared. */
  warning: string | null;
}

export const INITIAL_STATE: GameState = {
  phase: 'permission',
  permissionIssue: null,
  hasOrientationData: false,
  credits: 0,
  collection: {},
  result: null,
  toast: null,
  warning: null,
};

export class GameStore {
  private state: GameState;
  private readonly listeners = new Set<() => void>();

  constructor(initial: GameState = INITIAL_STATE) {
    this.state = initial;
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly getSnapshot = (): GameState => this.state;

  get value(): GameState {
    return this.state;
  }

  setState(patch: Partial<GameState>): void {
    let changed = false;
    for (const key of Object.keys(patch) as Array<keyof GameState>) {
      if (patch[key] !== this.state[key]) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
}

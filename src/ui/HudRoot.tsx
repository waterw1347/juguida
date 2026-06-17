import { useCallback, useRef, useState } from 'react';
import type { GameApp } from '../app/GameApp';
import { useGameState } from './bridge/useGameStore';
import { OnboardingGate } from './screens/OnboardingGate';
import { HuntView } from './screens/HuntView';
import { ResultModal } from './screens/ResultModal';
import { Dogam } from './screens/Dogam';
import { Settings } from './screens/Settings';

interface HudRootProps {
  app: GameApp;
}

/** React overlay layer. Renders the screen for the current phase. */
export function HudRoot({ app }: HudRootProps) {
  const state = useGameState(app.store);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const handleStart = useCallback(() => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    void app.beginSession().finally(() => {
      inFlight.current = false;
      setBusy(false);
    });
  }, [app]);

  const onHoldStart = useCallback(() => app.setHolding(true), [app]);
  const onHoldEnd = useCallback(() => app.setHolding(false), [app]);
  const onDismissResult = useCallback(() => app.dismissResult(), [app]);
  const onOpenDogam = useCallback(() => app.openDogam(), [app]);
  const onCloseDogam = useCallback(() => app.closeDogam(), [app]);
  const onOpenSettings = useCallback(() => app.openSettings(), [app]);
  const onCloseSettings = useCallback(() => app.closeSettings(), [app]);
  const onReset = useCallback(() => app.resetProgress(), [app]);

  const hunting =
    state.phase === 'hunting' ||
    state.phase === 'result' ||
    state.phase === 'dogam' ||
    state.phase === 'settings';

  return (
    <div className="hud">
      {state.phase === 'permission' && (
        <OnboardingGate onStart={handleStart} busy={busy} issue={state.permissionIssue} />
      )}

      {hunting && (
        <HuntView
          hasOrientationData={state.hasOrientationData}
          credits={state.credits}
          onHoldStart={onHoldStart}
          onHoldEnd={onHoldEnd}
          onOpenDogam={onOpenDogam}
          onOpenSettings={onOpenSettings}
        />
      )}

      {state.phase === 'result' && state.result && (
        <ResultModal result={state.result} onClose={onDismissResult} />
      )}

      {state.phase === 'dogam' && (
        <Dogam catalog={app.catalogGhosts} collection={state.collection} onClose={onCloseDogam} />
      )}

      {state.phase === 'settings' && (
        <Settings service={app.settings} onClose={onCloseSettings} onReset={onReset} />
      )}

      {state.warning && (
        <div className="warning" role="alert">
          <span className="warning__text" data-text={state.warning}>
            {state.warning}
          </span>
        </div>
      )}

      {state.toast && <div className="toast">{state.toast}</div>}
    </div>
  );
}

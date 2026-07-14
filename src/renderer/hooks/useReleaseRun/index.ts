import { useEffect, useRef, useState } from 'react';
import { normalizeErrorMessage } from '@renderer/utils/formatting';
import type {
  ReleaseRunViewState,
  UseReleaseRunResult,
} from '@hooks/useReleaseRun/index.types';

const initialState: ReleaseRunViewState = {
  activePhase: null,
  completedPhases: 0,
  logs: [],
  percent: 0,
  platform: null,
  result: null,
  runId: null,
  status: 'idle',
  totalPhases: 0,
};

export const useReleaseRun = (): UseReleaseRunResult => {
  const [state, setState] = useState<ReleaseRunViewState>(initialState);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const activeRunId = useRef<string | null>(null);

  useEffect(() =>
    window.desktopApi.onReleaseEvent((event) => {
      if (activeRunId.current !== event.runId) {
        return;
      }
      if (event.type === 'logReceived') {
        setState((current) => ({
          ...current,
          logs: [...current.logs, event.entry].slice(-500),
        }));
        return;
      }
      if (event.type === 'phaseChanged') {
        setState((current) => ({
          ...current,
          activePhase: event.activePhase,
          completedPhases: event.completedPhases,
          percent: event.percent,
          platform: event.platform ?? null,
          status: current.status === 'cancelling' ? 'cancelling' : 'running',
          totalPhases: event.totalPhases,
        }));
        return;
      }
      setState((current) => ({ ...current, percent: 100, result: event.result, status: 'finished' }));
    }), []);

  const start = async (planId: string): Promise<void> => {
    setErrorMessage(null);
    setState({ ...initialState, status: 'starting' });
    try {
      const startResult = await window.desktopApi.startRelease(planId);
      if (!startResult.started) {
        setErrorMessage(startResult.error.message);
        setState((current) => ({ ...current, status: 'failedToStart' }));
        return;
      }
      activeRunId.current = startResult.runId;
      setState((current) => ({ ...current, runId: startResult.runId, status: 'running' }));
    } catch (error) {
      setErrorMessage(normalizeErrorMessage(error));
      setState((current) => ({ ...current, status: 'failedToStart' }));
    }
  };

  const cancel = async (): Promise<void> => {
    if (activeRunId.current === null) return;
    setState((current) => ({ ...current, status: 'cancelling' }));
    try {
      await window.desktopApi.cancelRelease(activeRunId.current);
    } catch (error) {
      setErrorMessage(normalizeErrorMessage(error));
    }
  };

  return { ...state, cancel, errorMessage, start };
};

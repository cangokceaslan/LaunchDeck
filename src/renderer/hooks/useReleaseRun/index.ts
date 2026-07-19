import { useEffect, useRef, useState } from 'react';
import { normalizeErrorMessage } from '@renderer/utils/formatting';
import type {
  ReleaseRunViewState,
  UseReleaseRunResult,
} from '@hooks/useReleaseRun/index.types';
import type { ReleaseEvent } from '@shared/contracts/release';

const initialState: ReleaseRunViewState = {
  activePhase: null,
  completedPhases: 0,
  logs: [],
  percent: 0,
  platform: null,
  progressKind: 'verified',
  result: null,
  runId: null,
  status: 'idle',
  totalPhases: 0,
};

export const useReleaseRun = (): UseReleaseRunResult => {
  const [state, setState] = useState<ReleaseRunViewState>(initialState);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const activeRunId = useRef<string | null>(null);
  const isStarting = useRef(false);
  const pendingEvents = useRef<ReleaseEvent[]>([]);

  const applyEvent = (event: ReleaseEvent): void => {
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
        progressKind: event.progressKind,
        status: current.status === 'cancelling' ? 'cancelling' : 'running',
        totalPhases: event.totalPhases,
      }));
      return;
    }
    setState((current) => ({
      ...current,
      percent: 100,
      progressKind: 'verified',
      result: event.result,
      status: 'finished',
    }));
  };

  useEffect(() =>
    window.desktopApi.onReleaseEvent((event) => {
      if (activeRunId.current !== event.runId) {
        if (activeRunId.current === null && isStarting.current) {
          pendingEvents.current = [...pendingEvents.current, event].slice(-500);
        }
        return;
      }
      applyEvent(event);
    }), []);

  const start = async (planId: string): Promise<void> => {
    setErrorMessage(null);
    setState({ ...initialState, status: 'starting' });
    activeRunId.current = null;
    pendingEvents.current = [];
    isStarting.current = true;
    try {
      const startResult = await window.desktopApi.startRelease(planId);
      if (!startResult.started) {
        setErrorMessage(startResult.error.message);
        setState((current) => ({ ...current, status: 'failedToStart' }));
        return;
      }
      activeRunId.current = startResult.runId;
      setState((current) => ({ ...current, runId: startResult.runId, status: 'running' }));
      for (const event of pendingEvents.current) {
        if (event.runId === startResult.runId) applyEvent(event);
      }
      pendingEvents.current = [];
    } catch (error) {
      setErrorMessage(normalizeErrorMessage(error));
      setState((current) => ({ ...current, status: 'failedToStart' }));
    } finally {
      isStarting.current = false;
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

  const reset = (): void => {
    activeRunId.current = null;
    isStarting.current = false;
    pendingEvents.current = [];
    setErrorMessage(null);
    setState(initialState);
  };

  return { ...state, cancel, errorMessage, reset, start };
};

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AndroidProjectMetadataRequest,
  AndroidProjectMetadataResult,
} from '@shared/contracts/domain';
import type { UseAndroidProjectConfigurationResult } from '@hooks/useAndroidProjectConfiguration/index.types';
import { normalizeErrorMessage } from '@renderer/utils/formatting';

export const useAndroidProjectConfiguration = (): UseAndroidProjectConfigurationResult => {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const requestId = useRef(0);

  const resolveProjectMetadata = useCallback(async (
    request: AndroidProjectMetadataRequest,
  ): Promise<AndroidProjectMetadataResult | null> => {
    const activeRequestId = requestId.current + 1;
    requestId.current = activeRequestId;
    setError(null);
    setIsLoading(true);
    try {
      const result = await window.desktopApi.resolveAndroidProjectMetadata(request);
      return requestId.current === activeRequestId ? result : null;
    } catch (metadataError) {
      if (requestId.current === activeRequestId) {
        setError(normalizeErrorMessage(metadataError));
      }
      return null;
    } finally {
      if (requestId.current === activeRequestId) setIsLoading(false);
    }
  }, []);

  const reset = useCallback((): void => {
    requestId.current += 1;
    setError(null);
    setIsLoading(false);
  }, []);

  useEffect(() => () => {
    requestId.current += 1;
  }, []);

  return { error, isLoading, reset, resolveProjectMetadata };
};

import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeErrorMessage } from '@renderer/utils/formatting';
import type { IosProjectMetadataRequest, IosProjectMetadataResult } from '@shared/contracts/domain';
import type { UseIosProjectConfigurationResult } from '@hooks/useIosProjectConfiguration/index.types';

export const useIosProjectConfiguration = (): UseIosProjectConfigurationResult => {
  const [schemes, setSchemes] = useState<string[]>([]);
  const [schemeError, setSchemeError] = useState<string | null>(null);
  const [developmentTeamError, setDevelopmentTeamError] = useState<string | null>(null);
  const [isLoadingSchemes, setIsLoadingSchemes] = useState(false);
  const [isLoadingDevelopmentTeam, setIsLoadingDevelopmentTeam] = useState(false);
  const schemeRequestId = useRef(0);
  const developmentTeamRequestId = useRef(0);

  const loadSchemes = useCallback(async (
    workspaceOrProjectPath: string,
  ): Promise<string[] | null> => {
    const requestId = schemeRequestId.current + 1;
    schemeRequestId.current = requestId;
    developmentTeamRequestId.current += 1;
    setSchemeError(null);
    setDevelopmentTeamError(null);
    setIsLoadingSchemes(true);
    setIsLoadingDevelopmentTeam(false);
    try {
      const result = await window.desktopApi.listIosSchemes(workspaceOrProjectPath);
      if (schemeRequestId.current !== requestId) return null;
      setSchemes(result.schemes);
      return result.schemes;
    } catch (error) {
      if (schemeRequestId.current !== requestId) return null;
      setSchemes([]);
      setSchemeError(normalizeErrorMessage(error));
      return null;
    } finally {
      if (schemeRequestId.current === requestId) setIsLoadingSchemes(false);
    }
  }, []);

  const resolveProjectMetadata = useCallback(async (
    request: IosProjectMetadataRequest,
  ): Promise<IosProjectMetadataResult | null> => {
    const requestId = developmentTeamRequestId.current + 1;
    developmentTeamRequestId.current = requestId;
    setDevelopmentTeamError(null);
    setIsLoadingDevelopmentTeam(true);
    try {
      const result = await window.desktopApi.resolveIosProjectMetadata(request);
      return developmentTeamRequestId.current === requestId ? result : null;
    } catch (error) {
      if (developmentTeamRequestId.current === requestId) {
        setDevelopmentTeamError(normalizeErrorMessage(error));
      }
      return null;
    } finally {
      if (developmentTeamRequestId.current === requestId) {
        setIsLoadingDevelopmentTeam(false);
      }
    }
  }, []);

  const reset = useCallback((): void => {
    schemeRequestId.current += 1;
    developmentTeamRequestId.current += 1;
    setSchemes([]);
    setSchemeError(null);
    setDevelopmentTeamError(null);
    setIsLoadingSchemes(false);
    setIsLoadingDevelopmentTeam(false);
  }, []);

  const resetDevelopmentTeam = useCallback((): void => {
    developmentTeamRequestId.current += 1;
    setDevelopmentTeamError(null);
    setIsLoadingDevelopmentTeam(false);
  }, []);

  useEffect(() => () => {
    schemeRequestId.current += 1;
    developmentTeamRequestId.current += 1;
  }, []);

  return {
    developmentTeamError,
    isLoadingDevelopmentTeam,
    isLoadingSchemes,
    loadSchemes,
    reset,
    resetDevelopmentTeam,
    resolveProjectMetadata,
    schemeError,
    schemes,
  };
};

import type { IosProjectMetadataRequest, IosProjectMetadataResult } from '@shared/contracts/domain';

export type UseIosProjectConfigurationResult = {
  developmentTeamError: string | null;
  isLoadingDevelopmentTeam: boolean;
  isLoadingSchemes: boolean;
  loadSchemes: (workspaceOrProjectPath: string) => Promise<string[] | null>;
  reset: () => void;
  resetDevelopmentTeam: () => void;
  resolveProjectMetadata: (
    request: IosProjectMetadataRequest,
  ) => Promise<IosProjectMetadataResult | null>;
  schemeError: string | null;
  schemes: string[];
};

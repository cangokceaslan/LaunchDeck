import type { PipelineHook, ReleasePlatform } from '@shared/contracts/domain';

export type HookEditorProps = {
  hooks: PipelineHook[];
  onChange: (hooks: PipelineHook[]) => void;
  supportedPlatforms: ReleasePlatform[];
};

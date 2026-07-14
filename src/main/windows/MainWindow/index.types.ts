export type MainWindowOptions = {
  hasActiveRun: () => boolean;
  onCancelActiveRun: () => Promise<void>;
};

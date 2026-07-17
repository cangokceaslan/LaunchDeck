export type ProcessOutput = {
  level: 'info' | 'error';
  line: string;
};

export type RunExecutableOptions = {
  args: readonly string[];
  cwdPath: string;
  environment?: Readonly<Record<string, string>>;
  executablePath: string;
  maxLineLength?: number;
  onOutput: (output: ProcessOutput) => void;
  signal: AbortSignal;
};

export type ProcessExecutionResult = {
  exitCode: number;
  signal: NodeJS.Signals | null;
};

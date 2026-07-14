export type PathFieldProps = {
  buttonLabel?: string;
  disabled?: boolean;
  helpText?: string;
  label: string;
  onBrowse: () => void;
  onChange?: (value: string) => void;
  required?: boolean;
  value: string;
};

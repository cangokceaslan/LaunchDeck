export type PathFieldProps = {
  buttonLabel?: string;
  disabled?: boolean;
  helpText?: string;
  label: string;
  onBrowse: () => void;
  onChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  value: string;
};

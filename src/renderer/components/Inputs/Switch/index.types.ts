import type { InputHTMLAttributes, ReactNode } from 'react';

export type SwitchProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'checked' | 'children' | 'className' | 'onChange' | 'type'
> & {
  checked: boolean;
  description?: string;
  label: ReactNode;
  onChange: (isChecked: boolean) => void;
};

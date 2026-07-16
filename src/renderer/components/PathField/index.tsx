import { Button, Form, InputGroup } from 'react-bootstrap';
import type { PathFieldProps } from '@components/PathField/index.types';
import styles from '@components/PathField/index.module.scss';

export const PathField = ({
  buttonLabel = 'Select',
  disabled = false,
  helpText,
  label,
  onBrowse,
  onChange,
  required = false,
  value,
}: PathFieldProps): React.JSX.Element => (
  <Form.Group className={styles.group}>
    <Form.Label>{label}</Form.Label>
    <InputGroup>
      <Form.Control
        className={styles.pathInput}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder="Not selected yet"
        readOnly={onChange === undefined}
        required={required}
        value={value}
      />
      <Button disabled={disabled} onClick={onBrowse} type="button" variant="outline-secondary">
        {buttonLabel}
      </Button>
    </InputGroup>
    {helpText !== undefined && <Form.Text>{helpText}</Form.Text>}
  </Form.Group>
);

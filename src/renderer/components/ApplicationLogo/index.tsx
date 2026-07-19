import type { ApplicationLogoProps } from '@components/ApplicationLogo/index.types';

export const ApplicationLogo = ({
  className,
  iconDataUrl,
  name,
}: ApplicationLogoProps): React.JSX.Element => (
  <span aria-hidden="true" className={className}>
    {iconDataUrl === null ? (
      name.slice(0, 1).toLocaleUpperCase('en-US')
    ) : (
      <img alt="" draggable={false} src={iconDataUrl} />
    )}
  </span>
);

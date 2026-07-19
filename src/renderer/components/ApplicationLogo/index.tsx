import type { ApplicationLogoProps } from '@components/ApplicationLogo/index.types';

export const ApplicationLogo = ({
  className,
  iconDataUrl,
}: ApplicationLogoProps): React.JSX.Element => (
  <span aria-hidden="true" className={className}>
    {iconDataUrl === null ? (
      <svg fill="none" height="58%" viewBox="0 0 24 24" width="58%">
        <rect
          height="16"
          rx="4"
          stroke="currentColor"
          strokeWidth="1.6"
          width="16"
          x="4"
          y="4"
        />
        <rect fill="currentColor" height="4" rx="1.2" width="4" x="7" y="7" />
        <rect fill="currentColor" height="4" opacity="0.55" rx="1.2" width="4" x="13" y="7" />
        <rect fill="currentColor" height="4" opacity="0.55" rx="1.2" width="4" x="7" y="13" />
        <rect fill="currentColor" height="4" rx="1.2" width="4" x="13" y="13" />
      </svg>
    ) : (
      <img alt="" draggable={false} src={iconDataUrl} />
    )}
  </span>
);

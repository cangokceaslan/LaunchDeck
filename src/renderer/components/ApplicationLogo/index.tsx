import type { ApplicationLogoProps } from '@components/ApplicationLogo/index.types';

export const ApplicationLogo = ({
  className,
  iconDataUrl,
}: ApplicationLogoProps): React.JSX.Element => (
  <span aria-hidden="true" className={className}>
    {iconDataUrl === null ? (
      <svg
        fill="none"
        height="64%"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        viewBox="0 0 24 24"
        width="64%"
      >
        <rect
          height="16"
          rx="2.2"
          strokeWidth="1.7"
          width="9"
          x="7.5"
          y="4"
        />
        <path d="M10.5 6h3M10.75 18h2.5" strokeWidth="1.25" />
      </svg>
    ) : (
      <img alt="" draggable={false} src={iconDataUrl} />
    )}
  </span>
);

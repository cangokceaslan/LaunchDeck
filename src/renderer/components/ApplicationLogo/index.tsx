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
          height="20"
          rx="3.2"
          strokeWidth="1.7"
          width="13"
          x="5.5"
          y="2"
        />
        <path d="M10 5h4" strokeWidth="1.5" />
        <rect
          fill="currentColor"
          fillOpacity="0.14"
          height="7"
          rx="1.8"
          strokeWidth="1.3"
          width="8"
          x="8"
          y="8"
        />
        <path d="M10.25 10.25h3.5M10.25 12.75h2" strokeWidth="1.3" />
        <circle cx="12" cy="18.5" fill="currentColor" r="0.8" stroke="none" />
      </svg>
    ) : (
      <img alt="" draggable={false} src={iconDataUrl} />
    )}
  </span>
);

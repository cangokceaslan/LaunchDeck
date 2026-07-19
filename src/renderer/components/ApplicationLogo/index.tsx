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
          fill="currentColor"
          fillOpacity="0.1"
          height="18"
          rx="4.5"
          strokeWidth="1.7"
          width="18"
          x="3"
          y="3"
        />
        <rect
          fill="currentColor"
          height="5"
          rx="1.5"
          stroke="none"
          width="5"
          x="6.5"
          y="6.5"
        />
        <rect
          fill="currentColor"
          fillOpacity="0.38"
          height="5"
          rx="1.5"
          stroke="none"
          width="5"
          x="12.5"
          y="6.5"
        />
        <rect
          fill="currentColor"
          fillOpacity="0.38"
          height="5"
          rx="1.5"
          stroke="none"
          width="5"
          x="6.5"
          y="12.5"
        />
        <path d="M15 13v4M13 15h4" strokeWidth="1.7" />
      </svg>
    ) : (
      <img alt="" draggable={false} src={iconDataUrl} />
    )}
  </span>
);

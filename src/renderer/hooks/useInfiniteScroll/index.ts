import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { UseInfiniteScrollOptions } from '@hooks/useInfiniteScroll/index.types';

export const useInfiniteScroll = ({
  hasMore,
  isLoading,
  onLoadMore,
}: UseInfiniteScrollOptions): RefObject<HTMLDivElement | null> => {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (sentinel === null || !hasMore || isLoading) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting === true) onLoadMore();
      },
      { rootMargin: '160px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading, onLoadMore]);

  return sentinelRef;
};

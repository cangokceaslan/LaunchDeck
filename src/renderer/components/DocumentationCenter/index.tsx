import { isValidElement, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Modal } from 'react-bootstrap';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import userGuideMarkdown from '@docs/USER_GUIDE.md?raw';
import type {
  DocumentationCenterProps,
  DocumentationCategoryId,
} from '@components/DocumentationCenter/index.types';
import {
  DOCUMENTATION_CATEGORIES,
  findDocumentationDestination,
  getContextualSectionId,
  parseDocumentationSections,
  searchDocumentation,
  slugifyDocumentationHeading,
} from '@components/DocumentationCenter/index.utils';
import { isApprovedExternalUrl } from '@shared/contracts/externalLinks';
import styles from '@components/DocumentationCenter/index.module.scss';

const documentationSections = parseDocumentationSections(userGuideMarkdown);
const screenshotAssets = import.meta.glob<string>('@docs/images/screenshots/*.png', {
  eager: true,
  import: 'default',
  query: '?url',
});

const getTextContent = (value: React.ReactNode): string =>
  Array.isArray(value)
    ? value.map(getTextContent).join('')
    : isValidElement<{ children?: React.ReactNode }>(value)
      ? getTextContent(value.props.children)
      : typeof value === 'string' || typeof value === 'number'
        ? String(value)
        : '';

const resolveScreenshot = (source: string): string | null => {
  const normalizedSource = source.replace(/^\.\//, '').replace(/^docs\//, '');
  if (!normalizedSource.startsWith('images/screenshots/')) return null;
  const assetEntry = Object.entries(screenshotAssets).find(([assetPath]) =>
    assetPath.endsWith(normalizedSource),
  );
  return assetEntry?.[1] ?? null;
};

export const DocumentationCenter = ({
  context,
  isOpen,
  onClose,
  onOpen,
}: DocumentationCenterProps): React.JSX.Element => {
  const [selectedSectionId, setSelectedSectionId] = useState(() =>
    getContextualSectionId(context),
  );
  const [query, setQuery] = useState('');
  const [readingProgress, setReadingProgress] = useState(0);
  const [openCategories, setOpenCategories] = useState<Set<DocumentationCategoryId>>(
    () => new Set(DOCUMENTATION_CATEGORIES.map(({ id }) => id)),
  );
  const articleRef = useRef<HTMLElement | null>(null);
  const pendingHeadingId = useRef<string | null>(null);
  const hasOpened = useRef(false);
  const wasOpen = useRef(false);

  const selectedSection =
    documentationSections.find(({ id }) => id === selectedSectionId) ?? documentationSections[0];
  const selectedIndex = documentationSections.findIndex(({ id }) => id === selectedSection.id);
  const previousSection = selectedIndex > 0 ? documentationSections[selectedIndex - 1] : null;
  const nextSection =
    selectedIndex < documentationSections.length - 1
      ? documentationSections[selectedIndex + 1]
      : null;
  const searchResults = useMemo(
    () => searchDocumentation(documentationSections, query),
    [query],
  );

  useEffect(() => {
    if (isOpen && !wasOpen.current && !hasOpened.current) {
      setSelectedSectionId(getContextualSectionId(context));
      hasOpened.current = true;
    }
    wasOpen.current = isOpen;
  }, [context, isOpen]);

  useEffect(() => {
    setOpenCategories((currentCategories) => {
      if (currentCategories.has(selectedSection.categoryId)) return currentCategories;
      return new Set([...currentCategories, selectedSection.categoryId]);
    });
    articleRef.current?.scrollTo({ top: 0 });
    setReadingProgress(0);
    const headingId = pendingHeadingId.current;
    if (headingId !== null) {
      pendingHeadingId.current = null;
      window.requestAnimationFrame(() => {
        document
          .getElementById(`documentation-heading-${headingId}`)
          ?.scrollIntoView({ block: 'start' });
      });
    }
  }, [selectedSection.categoryId, selectedSection.id]);

  const selectSection = (sectionId: string, headingId?: string): void => {
    if (sectionId === selectedSection.id && headingId !== undefined) {
      document
        .getElementById(`documentation-heading-${headingId}`)
        ?.scrollIntoView({ block: 'start' });
      setQuery('');
      return;
    }
    pendingHeadingId.current = headingId ?? null;
    setSelectedSectionId(sectionId);
    setQuery('');
  };

  const handleArticleScroll = (): void => {
    const article = articleRef.current;
    if (article === null) return;
    const scrollableDistance = article.scrollHeight - article.clientHeight;
    setReadingProgress(
      scrollableDistance <= 0 ? 100 : Math.round((article.scrollTop / scrollableDistance) * 100),
    );
  };

  const handleInternalLink = (href: string): void => {
    const destination = findDocumentationDestination(documentationSections, href);
    if (destination !== null) {
      selectSection(destination.sectionId, destination.headingId);
    }
  };

  const markdownComponents: Components = {
    a: ({ children, href }) => {
      if (href?.startsWith('#')) {
        return (
          <button className={styles.inlineLink} onClick={() => handleInternalLink(href)} type="button">
            {children}
          </button>
        );
      }
      if (href !== undefined && isApprovedExternalUrl(href)) {
        return (
          <a href={href} rel="noreferrer" target="_blank">
            {children}
          </a>
        );
      }
      return <span className={styles.blockedLink}>{children}</span>;
    },
    h3: ({ children }) => {
      const headingId = slugifyDocumentationHeading(getTextContent(children));
      return <h3 id={`documentation-heading-${headingId}`}>{children}</h3>;
    },
    h4: ({ children }) => {
      const headingId = slugifyDocumentationHeading(getTextContent(children));
      return <h4 id={`documentation-heading-${headingId}`}>{children}</h4>;
    },
    img: ({ alt, src }) => {
      const resolvedSource = typeof src === 'string' ? resolveScreenshot(src) : null;
      if (resolvedSource === null) {
        return (
          <span className={styles.blockedImage}>
            Image unavailable: {alt ?? 'Untrusted source'}
          </span>
        );
      }
      return <img alt={alt ?? ''} loading="lazy" src={resolvedSource} />;
    },
    table: ({ children }) => (
      <div className={styles.tableScroller} tabIndex={0}>
        <table>{children}</table>
      </div>
    ),
  };

  return (
    <>
      {!isOpen && (
        <button
          aria-label="Open help center"
          className={styles.floatingButton}
          onClick={onOpen}
          title="Open Help Center"
          type="button"
        >
          <span aria-hidden="true" className={styles.floatingIcon}>
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="8.25" />
              <path d="M8.75 9.15a3.28 3.28 0 0 1 6.47.82c0 2.38-3.22 2.68-3.22 4.8" />
              <path d="M12 18.05h.01" />
            </svg>
          </span>
          <span className={styles.floatingCopy}>
            <strong>Help center</strong>
            <small>Guides &amp; troubleshooting</small>
          </span>
          <span aria-hidden="true" className={styles.floatingArrow}>
            <svg viewBox="0 0 16 16">
              <path d="m6 3.75 4.25 4.25L6 12.25" />
            </svg>
          </span>
        </button>
      )}
      <Modal
        aria-labelledby="documentation-center-title"
        className={styles.modal}
        fullscreen
        onHide={onClose}
        restoreFocus
        show={isOpen}
      >
        <Modal.Header className={styles.header}>
          <div className={styles.branding}>
            <span aria-hidden="true" className={styles.helpMark}>
              ?
            </span>
            <div>
              <span>LaunchDeck Help Center</span>
              <small>Last verified: 2026-07-20</small>
            </div>
          </div>
          <div className={styles.searchField}>
            <svg aria-hidden="true" viewBox="0 0 20 20">
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path d="m12.5 12.5 4 4" />
            </svg>
            <input
              aria-label="Search documentation"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search topics, credentials, errors…"
              type="search"
              value={query}
            />
            {query.length > 0 && (
              <button aria-label="Clear search" onClick={() => setQuery('')} type="button">
                ×
              </button>
            )}
          </div>
          <button
            aria-label="Close documentation"
            className={styles.closeButton}
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </Modal.Header>
        <div aria-hidden="true" className={styles.progressTrack}>
          <span style={{ width: `${readingProgress}%` }} />
        </div>
        <Modal.Body className={styles.body}>
          <aside aria-label="Documentation topics" className={styles.sidebar}>
            {query.trim().length > 0 ? (
              <div className={styles.searchResults}>
                <div className={styles.searchSummary}>
                  <strong>
                    {searchResults.length}{' '}
                    {searchResults.length === 1 ? 'match' : 'matches'}
                  </strong>
                  <button onClick={() => setQuery('')} type="button">
                    Clear
                  </button>
                </div>
                {searchResults.length === 0 ? (
                  <div className={styles.emptySearch}>
                    <span aria-hidden="true">?</span>
                    <strong>No topics found</strong>
                    <p>Try a provider, credential name, or error message.</p>
                  </div>
                ) : (
                  searchResults.map(({ excerpt, section }) => (
                    <button
                      className={styles.searchResult}
                      key={section.id}
                      onClick={() => selectSection(section.id)}
                      type="button"
                    >
                      <strong>{section.title}</strong>
                      <span>{excerpt}</span>
                    </button>
                  ))
                )}
              </div>
            ) : (
              DOCUMENTATION_CATEGORIES.map((category) => {
                const isExpanded = openCategories.has(category.id);
                const categorySections = documentationSections.filter(
                  ({ categoryId }) => categoryId === category.id,
                );
                return (
                  <section className={styles.category} key={category.id}>
                    <button
                      aria-expanded={isExpanded}
                      className={styles.categoryButton}
                      onClick={() =>
                        setOpenCategories((currentCategories) => {
                          const nextCategories = new Set(currentCategories);
                          if (nextCategories.has(category.id)) nextCategories.delete(category.id);
                          else nextCategories.add(category.id);
                          return nextCategories;
                        })
                      }
                      type="button"
                    >
                      <span>{category.title}</span>
                      <span aria-hidden="true">{isExpanded ? '−' : '+'}</span>
                    </button>
                    {isExpanded && (
                      <div className={styles.topicList}>
                        {categorySections.map((section) => (
                          <button
                            aria-current={section.id === selectedSection.id ? 'page' : undefined}
                            className={
                              section.id === selectedSection.id
                                ? styles.topicActive
                                : styles.topic
                            }
                            key={section.id}
                            onClick={() => selectSection(section.id)}
                            type="button"
                          >
                            {section.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })
            )}
          </aside>
          <article
            className={styles.article}
            onScroll={handleArticleScroll}
            ref={articleRef}
          >
            <div className={styles.articleInner}>
              <span className={styles.eyebrow}>
                {DOCUMENTATION_CATEGORIES.find(({ id }) => id === selectedSection.categoryId)?.title}
              </span>
              <h1 id="documentation-center-title">{selectedSection.title}</h1>
              <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]} skipHtml>
                {selectedSection.markdown}
              </ReactMarkdown>
              <nav aria-label="Adjacent documentation topics" className={styles.topicPager}>
                {previousSection === null ? (
                  <span />
                ) : (
                  <Button
                    onClick={() => selectSection(previousSection.id)}
                    variant="outline-secondary"
                  >
                    <small>Previous topic</small>
                    <strong>← {previousSection.title}</strong>
                  </Button>
                )}
                {nextSection !== null && (
                  <Button onClick={() => selectSection(nextSection.id)} variant="outline-secondary">
                    <small>Next topic</small>
                    <strong>{nextSection.title} →</strong>
                  </Button>
                )}
              </nav>
            </div>
          </article>
          <aside aria-label="On this page" className={styles.onThisPage}>
            <strong>On this page</strong>
            <button onClick={() => articleRef.current?.scrollTo({ top: 0 })} type="button">
              {selectedSection.title}
            </button>
            {selectedSection.headings.map((heading) => (
              <button
                className={heading.depth === 4 ? styles.subheadingLink : undefined}
                key={`${heading.depth}-${heading.id}`}
                onClick={() =>
                  document
                    .getElementById(`documentation-heading-${heading.id}`)
                    ?.scrollIntoView({ block: 'start' })
                }
                type="button"
              >
                {heading.title}
              </button>
            ))}
          </aside>
        </Modal.Body>
      </Modal>
    </>
  );
};

import type {
  DocumentationCategory,
  DocumentationCategoryId,
  DocumentationContext,
  DocumentationSearchResult,
  DocumentationSection,
} from '@components/DocumentationCenter/index.types';

export const DOCUMENTATION_CATEGORIES: DocumentationCategory[] = [
  { id: 'overview', title: 'Overview' },
  { id: 'architecture-security', title: 'Architecture & Security' },
  { id: 'installation', title: 'Installation' },
  { id: 'application-setup', title: 'Application Setup' },
  { id: 'release-operations', title: 'Release Operations' },
  { id: 'operations-safety', title: 'Operations & Safety' },
  { id: 'developer-reference', title: 'Developer Reference' },
];

const categorySectionIds: Record<DocumentationCategoryId, string[]> = {
  overview: [
    'overview',
    'what-launchdeck-does',
    'screenshots',
    'in-app-documentation',
    'platform-support',
    'choose-the-right-workflow',
    'quick-start',
  ],
  'architecture-security': ['how-launchdeck-works', 'security-architecture'],
  installation: [
    'install-the-development-environment',
    'run-build-and-package-the-source',
    'first-launch-and-doctor',
    'macos-file-permissions',
  ],
  'application-setup': [
    'complete-application-setup-reference',
    'firebase-app-distribution-setup',
    'android-signing-and-keystores',
    'google-play-setup',
    'app-store-connect-setup',
  ],
  'release-operations': [
    'run-a-release',
    'release-results-history-and-fast-actions',
    'custom-pipeline-steps',
  ],
  'operations-safety': [
    'data-storage-and-backups',
    'credential-rotation-and-revocation',
    'troubleshooting',
    'security-checklist',
    'known-limitations',
  ],
  'developer-reference': [
    'screenshot-renderer',
    'project-structure',
    'glossary',
    'official-resource-index',
  ],
};

const contextSectionIds: Record<DocumentationContext, string> = {
  detail: 'release-results-history-and-fast-actions',
  edit: 'complete-application-setup-reference',
  history: 'release-results-history-and-fast-actions',
  home: 'quick-start',
  release: 'run-a-release',
  setup: 'complete-application-setup-reference',
};

export const slugifyDocumentationHeading = (heading: string): string =>
  heading
    .toLocaleLowerCase('en-US')
    .replace(/[`*_~]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const stripMarkdown = (markdown: string): string =>
  markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`~|\[\]()-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const resolveCategory = (sectionId: string): DocumentationCategoryId =>
  DOCUMENTATION_CATEGORIES.find(({ id }) => categorySectionIds[id].includes(sectionId))?.id ??
  'developer-reference';

const createSection = (
  title: string,
  markdownLines: string[],
  forcedId?: string,
): DocumentationSection => {
  const id = forcedId ?? slugifyDocumentationHeading(title);
  const markdown = markdownLines.join('\n').trim();
  const headings = markdownLines.flatMap((line) => {
    const match = /^(#{3,4})\s+(.+?)\s*$/.exec(line);
    if (match === null) return [];
    const headingTitle = stripMarkdown(match[2]);
    return [
      {
        depth: match[1].length as 3 | 4,
        id: slugifyDocumentationHeading(headingTitle),
        title: headingTitle,
      },
    ];
  });

  return {
    categoryId: resolveCategory(id),
    headings,
    id,
    markdown,
    plainText: stripMarkdown(`${title} ${markdown}`),
    title,
  };
};

export const parseDocumentationSections = (source: string): DocumentationSection[] => {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const sections: DocumentationSection[] = [];
  let currentTitle = 'Welcome to LaunchDeck';
  let currentId = 'overview';
  let currentLines: string[] = [];

  const saveCurrentSection = (): void => {
    if (currentTitle !== 'Table of contents') {
      sections.push(createSection(currentTitle, currentLines, currentId));
    }
  };

  for (const line of lines) {
    const levelTwoHeading = /^##\s+(.+?)\s*$/.exec(line);
    if (levelTwoHeading !== null) {
      saveCurrentSection();
      currentTitle = stripMarkdown(levelTwoHeading[1]);
      currentId = slugifyDocumentationHeading(currentTitle);
      currentLines = [];
      continue;
    }
    if (/^#\s+/.test(line)) continue;
    currentLines.push(line);
  }
  saveCurrentSection();

  return sections.filter(({ markdown, id }) => id === 'overview' || markdown.length > 0);
};

export const getContextualSectionId = (context: DocumentationContext): string =>
  contextSectionIds[context];

const createExcerpt = (plainText: string, normalizedQuery: string): string => {
  const normalizedText = plainText.toLocaleLowerCase('en-US');
  const matchIndex = normalizedText.indexOf(normalizedQuery);
  const excerptStart = Math.max(0, matchIndex - 58);
  const excerptEnd = Math.min(plainText.length, matchIndex + normalizedQuery.length + 90);
  const prefix = excerptStart > 0 ? '…' : '';
  const suffix = excerptEnd < plainText.length ? '…' : '';
  return `${prefix}${plainText.slice(excerptStart, excerptEnd).trim()}${suffix}`;
};

export const searchDocumentation = (
  sections: DocumentationSection[],
  query: string,
): DocumentationSearchResult[] => {
  const normalizedQuery = query.trim().toLocaleLowerCase('en-US');
  if (normalizedQuery.length === 0) return [];

  return sections.flatMap((section) => {
    const searchableText = `${section.title} ${section.plainText}`;
    if (!searchableText.toLocaleLowerCase('en-US').includes(normalizedQuery)) return [];
    return [{ excerpt: createExcerpt(searchableText, normalizedQuery), section }];
  });
};

export const findDocumentationDestination = (
  sections: DocumentationSection[],
  hash: string,
): { headingId?: string; sectionId: string } | null => {
  const destinationId = slugifyDocumentationHeading(decodeURIComponent(hash.replace(/^#/, '')));
  const directSection = sections.find(({ id }) => id === destinationId);
  if (directSection !== undefined) return { sectionId: directSection.id };

  for (const section of sections) {
    if (section.headings.some(({ id }) => id === destinationId)) {
      return { headingId: destinationId, sectionId: section.id };
    }
  }
  return null;
};

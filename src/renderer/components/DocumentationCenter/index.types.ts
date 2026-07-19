export type DocumentationContext =
  | 'home'
  | 'setup'
  | 'edit'
  | 'detail'
  | 'history'
  | 'release';

export type DocumentationCenterProps = {
  context: DocumentationContext;
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
};

export type DocumentationHeading = {
  depth: 3 | 4;
  id: string;
  title: string;
};

export type DocumentationSection = {
  categoryId: DocumentationCategoryId;
  headings: DocumentationHeading[];
  id: string;
  markdown: string;
  plainText: string;
  title: string;
};

export type DocumentationCategoryId =
  | 'overview'
  | 'architecture-security'
  | 'installation'
  | 'application-setup'
  | 'release-operations'
  | 'operations-safety'
  | 'developer-reference';

export type DocumentationCategory = {
  id: DocumentationCategoryId;
  title: string;
};

export type DocumentationSearchResult = {
  excerpt: string;
  section: DocumentationSection;
};

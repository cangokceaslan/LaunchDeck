import type { SchemaMigration } from '@main/database/index.types';
import { initialSchemaMigration } from '@main/database/migrations/001_initial';

export const schemaMigrations: readonly SchemaMigration[] = [initialSchemaMigration];

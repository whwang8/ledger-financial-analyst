import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
export const records = sqliteTable(
  'ledger_records',
  {
    id: text('id').primaryKey(),
    owner: text('owner').notNull(),
    kind: text('kind').notNull(),
    parent: text('parent'),
    createdAt: text('created_at').notNull(),
    metadata: text('metadata').notNull(),
    payloadKey: text('payload_key').notNull(),
  },
  (t) => [
    index('idx_records_owner_kind_created').on(t.owner, t.kind, t.createdAt),
    index('idx_records_owner_parent').on(t.owner, t.parent),
  ],
);

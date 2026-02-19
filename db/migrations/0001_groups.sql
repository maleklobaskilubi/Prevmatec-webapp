-- Installation groups feature

CREATE TABLE IF NOT EXISTS installation_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS groups_created_by_idx ON installation_groups(created_by);

CREATE TABLE IF NOT EXISTS installation_group_items (
  group_id UUID NOT NULL REFERENCES installation_groups(id) ON DELETE CASCADE,
  installation_id UUID NOT NULL REFERENCES installations(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT group_items_pk UNIQUE (group_id, installation_id)
);

CREATE INDEX IF NOT EXISTS group_items_installation_idx ON installation_group_items(installation_id);

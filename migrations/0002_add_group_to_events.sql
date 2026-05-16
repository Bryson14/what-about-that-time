ALTER TABLE events ADD COLUMN group_name TEXT NOT NULL DEFAULT 'Adams Family';
CREATE INDEX IF NOT EXISTS idx_events_group_name ON events(group_name);
    
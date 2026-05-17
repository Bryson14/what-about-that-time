-- groups table
CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

-- seed default groups matching existing data
INSERT OR IGNORE INTO groups (name) VALUES ('Adams Family'), ('Meiling Family');

-- add group_id to events
ALTER TABLE events ADD COLUMN group_id INTEGER REFERENCES groups(id);

-- migrate existing group_name data to group_id
UPDATE events SET group_id = (SELECT id FROM groups WHERE name = events.group_name);
-- default to group 1 for any that didn't match
UPDATE events SET group_id = 1 WHERE group_id IS NULL;

-- tags table
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

-- event_tags join table
CREATE TABLE IF NOT EXISTS event_tags (
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, tag_id)
);

-- subjects table
CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

-- event_subjects join table
CREATE TABLE IF NOT EXISTS event_subjects (
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, subject_id)
);

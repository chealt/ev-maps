-- Support multiple proof photos per charger suggestion (JSON array of data URLs).
ALTER TABLE charger_suggestions ADD COLUMN photos TEXT;

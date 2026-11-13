SET @migration_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'track_strand') = 0,
  'ALTER TABLE users ADD COLUMN track_strand VARCHAR(255) DEFAULT NULL',
  'SELECT 1'
);
PREPARE migration_stmt FROM @migration_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

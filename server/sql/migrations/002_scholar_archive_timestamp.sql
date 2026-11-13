SET @migration_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'archived_at') = 0,
  'ALTER TABLE users ADD COLUMN archived_at DATETIME DEFAULT NULL',
  'SELECT 1'
);
PREPARE migration_stmt FROM @migration_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

UPDATE users
SET archived_at = COALESCE(updated_at, created_at, NOW())
WHERE role = 'scholar'
  AND status = 'archived'
  AND archived_at IS NULL;

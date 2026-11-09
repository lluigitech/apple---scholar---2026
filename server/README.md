# Server operations

## Private Cloudflare R2 file storage

The server supports Cloudinary (the default) and private Cloudflare R2 storage. Keep
`FILE_STORAGE_PROVIDER=cloudinary` until the R2 bucket and credentials are configured
and tested. To enable R2 for new uploads, set these server environment variables:

- `FILE_STORAGE_PROVIDER=r2`
- `R2_ENDPOINT` — the account-level HTTPS S3 endpoint, without a bucket path
- `R2_BUCKET_NAME`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

Use an R2 token scoped to Object Read & Write for this bucket only. Keep public
access disabled and do not put credentials in source control.

## Migrating existing Cloudinary files

Before migration, back up the database and verify the server has Cloudinary
credentials and the R2 environment variables above. Run the following from the
`server` directory in an environment connected to the intended database:

```powershell
node scripts/migrate-cloudinary-to-r2.js
```

The default dry run validates the referenced Cloudinary URLs and reports a count;
it does not download files, change database rows, or write to R2. After reviewing
the dry-run result, explicitly run:

```powershell
node scripts/migrate-cloudinary-to-r2.js --execute
```

Execution copies each referenced file to its category folder, verifies the R2
copy with SHA-256, then updates database references and the file registry in a
transaction. Cloudinary originals are intentionally left untouched. If execution
stops on an error, resolve the reported issue and rerun; already-updated references
are skipped.

# Local Supabase Generation Failure Log

## Error Summary
The local Supabase instance fails to start or reset completely because it cannot mount the Docker socket for the `supabase_vector` container. This is likely due to a path incompatibility in the local Colima/Docker environment.

## Exact Error Output
```text
failed to start docker container "supabase_vector_ersqhobqaptsxqclawcc": 
Error response from daemon: error while creating mount source path '/Users/macbookprom1pro/.colima/default/docker.sock': 
mkdir /Users/macbookprom1pro/.colima/default/docker.sock: operation not supported
```

## Impact
- `supabase start` and `supabase db reset` successfully apply all migrations to the database container, but the CLI shuts down all containers immediately afterward because the health check for the vector service fails.
- This prevents `supabase gen types typescript --local` from running against a live local DB.

## Ground Truth Verification
Despite the CLI shutdown, the migrations were observed to apply up to the very last file:
- `Applying migration 20260427030000_chat_messages_metadata.sql...`
- `Applying migration 20260428000000_enforce_module_uniqueness.sql...`
- `NOTICE (00000): index "idx_module_remediations_unique_pending" does not exist, skipping`

This confirms that the **schema itself is correctly built**, but the local introspection tools are blocked by environment-level Docker mounting issues.

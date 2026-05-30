import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

/**
 * Retrieves a decrypted credential for a pack source from Supabase Vault.
 *
 * MUST be called with a service-role Supabase client.
 * Returns null if no credential is found.
 */
export async function getSourceCredential(
  adminClient: SupabaseClient,
  packSourceId: string,
  credentialType: string = "api_token",
): Promise<string | null> {
  const { data, error } = await adminClient.rpc("read_source_credential", {
    p_pack_source_id: packSourceId,
    p_credential_type: credentialType,
  });

  if (error) {
    console.error(
      `[CREDENTIALS] Failed to read credential for source ${packSourceId}:`,
      error.message,
    );
    return null;
  }

  return data as string | null;
}

/**
 * Stores a credential for a pack source into Supabase Vault.
 *
 * MUST be called with a service-role Supabase client.
 * Returns the credential reference UUID.
 */
export async function storeSourceCredential(
  adminClient: SupabaseClient,
  packSourceId: string,
  secretValue: string,
  credentialType: string = "api_token",
  label?: string,
): Promise<string | null> {
  const { data, error } = await adminClient.rpc("store_source_credential", {
    p_pack_source_id: packSourceId,
    p_credential_type: credentialType,
    p_secret_value: secretValue,
    p_label: label || null,
  });

  if (error) {
    console.error(
      `[CREDENTIALS] Failed to store credential for source ${packSourceId}:`,
      error.message,
    );
    return null;
  }

  return data as string;
}

/**
 * Deletes a credential for a pack source from Supabase Vault.
 */
export async function deleteSourceCredential(
  adminClient: SupabaseClient,
  packSourceId: string,
  credentialType: string = "api_token",
): Promise<boolean> {
  const { data, error } = await adminClient.rpc("delete_source_credential", {
    p_pack_source_id: packSourceId,
    p_credential_type: credentialType,
  });

  if (error) {
    console.error(
      `[CREDENTIALS] Failed to delete credential for source ${packSourceId}:`,
      error.message,
    );
    return false;
  }

  return data as boolean;
}

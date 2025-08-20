import type { PasskeyAdapter, StoredCredential } from "../types/index";

/**
 * Supabase adapter for passkey credential storage
 * Works with Supabase PostgreSQL database
 */
export class SupabaseAdapter implements PasskeyAdapter {
  constructor(
    private readonly supabase: any, // Use 'any' to be compatible with @supabase/supabase-js
    /** Table name for passkeys (default: "passkeys") */
    private readonly tableName = "passkeys"
  ) {}

  async createPasskey(
    data: Omit<StoredCredential, "id" | "createdAt">
  ): Promise<StoredCredential> {
    const insertData = {
      user_id: data.userId,
      credential_id: data.credentialId,
      public_key: data.publicKey,
      counter: data.counter,
      transports: data.transports || [],
      user_name: data?.userName,
      user_display_name: data?.userDisplayName,
      // Enhanced metadata fields
      authenticator_attachment: data.authenticatorAttachment,
      device_info: data.deviceInfo || {},
      backup_eligible: data.backupEligible || false,
      backup_state: data.backupState || false,
      last_used_at: data.lastUsedAt
        ? new Date(data.lastUsedAt).toISOString()
        : null,
    };

    const { data: result, error } = await this.supabase
      .from(this.tableName)
      .insert(insertData)
      .select();

    if (error) {
      throw new Error(`Failed to create passkey: ${error.message}`);
    }

    if (!result || result.length === 0) {
      throw new Error("Failed to create passkey: No data returned");
    }

    return this.mapSupabaseToStored(result[0]);
  }

  async findByCredentialId(
    credentialId: string
  ): Promise<StoredCredential | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select()
      .eq("credential_id", credentialId);

    if (error) {
      throw new Error(`Failed to find passkey: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return null;
    }

    return this.mapSupabaseToStored(data[0]);
  }

  async listUserPasskeys(userId: string): Promise<StoredCredential[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select()
      .order("created_at", { ascending: false })
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Failed to list passkeys: ${error.message}`);
    }

    if (!data) {
      return [];
    }

    return data.map((item: any) => this.mapSupabaseToStored(item));
  }

  async updateCounter(id: string, counter: number): Promise<void> {
    const { error } = await this.supabase
      .from(this.tableName)
      .update({ counter })
      .eq("id", id);

    if (error) {
      throw new Error(`Failed to update counter: ${error.message}`);
    }
  }

  async deletePasskey(id: string): Promise<void> {
    const { error } = await this.supabase
      .from(this.tableName)
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(`Failed to delete passkey: ${error.message}`);
    }
  }

  private mapSupabaseToStored(supabaseResult: any): StoredCredential {
    return {
      id: supabaseResult.id,
      userId: supabaseResult.user_id,
      credentialId: supabaseResult.credential_id,
      publicKey: supabaseResult.public_key,
      counter: supabaseResult.counter,
      transports: supabaseResult.transports || undefined,
      userName: supabaseResult?.user_name || undefined,
      userDisplayName: supabaseResult?.user_display_name || undefined,
      // Enhanced metadata fields
      authenticatorAttachment:
        supabaseResult.authenticator_attachment || undefined,
      deviceInfo: supabaseResult.device_info || undefined,
      backupEligible: supabaseResult.backup_eligible || undefined,
      backupState: supabaseResult.backup_state || undefined,
      lastUsedAt: supabaseResult.last_used_at || undefined,
      // Standard timestamps
      createdAt: supabaseResult.created_at,
      updatedAt: supabaseResult.updated_at,
    };
  }
}

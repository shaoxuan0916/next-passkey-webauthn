import type { PasskeyAdapter, StoredCredential } from "../types/index.js";

/**
 * Supabase client interface for passkey operations
 * Compatible with @supabase/supabase-js
 */
export interface SupabaseClient {
  from(table: string): {
    insert(data: {
      user_id: string;
      credential_id: string;
      public_key: string;
      counter: number;
      transports?: string[];
      user_name?: string;
      user_display_name?: string;
    }): {
      select(columns?: string): Promise<{
        data: Array<{
          id: string;
          user_id: string;
          credential_id: string;
          public_key: string;
          counter: number;
          transports: string[] | null;
          user_name?: string;
          user_display_name?: string;
          created_at: string;
          updated_at: string;
        }> | null;
        error: { message: string } | null;
      }>;
    };

    select(columns?: string): {
      eq(
        column: string,
        value: string
      ): Promise<{
        data: Array<{
          id: string;
          user_id: string;
          credential_id: string;
          public_key: string;
          counter: number;
          transports: string[] | null;
          user_name?: string;
          user_display_name?: string;
          created_at: string;
          updated_at: string;
        }> | null;
        error: { message: string } | null;
      }>;
      order(
        column: string,
        options?: { ascending: boolean }
      ): {
        eq(
          column: string,
          value: string
        ): Promise<{
          data: Array<{
            id: string;
            user_id: string;
            credential_id: string;
            public_key: string;
            counter: number;
            transports: string[] | null;
            user_name?: string;
            user_display_name?: string;
            created_at: string;
            updated_at: string;
          }> | null;
          error: { message: string } | null;
        }>;
      };
    };

    update(data: { counter: number }): {
      eq(
        column: string,
        value: string
      ): Promise<{
        data: unknown;
        error: { message: string } | null;
      }>;
    };

    delete(): {
      eq(
        column: string,
        value: string
      ): Promise<{
        data: unknown;
        error: { message: string } | null;
      }>;
    };
  };
}

/**
 * Supabase adapter for passkey credential storage
 * Works with Supabase PostgreSQL database
 */
export class SupabaseAdapter implements PasskeyAdapter {
  constructor(
    private readonly supabase: SupabaseClient,
    /** Table name for passkeys (default: "passkeys") */
    private readonly tableName = "passkeys"
  ) {}

  async createPasskey(
    data: Omit<StoredCredential, "id" | "createdAt">
  ): Promise<StoredCredential> {
    const { data: result, error } = await this.supabase
      .from(this.tableName)
      .insert({
        user_id: data.userId,
        credential_id: data.credentialId,
        public_key: data.publicKey,
        counter: data.counter,
        transports: data.transports || [],
        user_name: data?.userName,
        user_display_name: data?.userDisplayName,
      })
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

    return data.map((item) => this.mapSupabaseToStored(item));
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

  private mapSupabaseToStored(supabaseResult: {
    id: string;
    user_id: string;
    credential_id: string;
    public_key: string;
    counter: number;
    transports: string[] | null;
    user_name?: string;
    user_display_name?: string;
    created_at: string;
    updated_at: string;
  }): StoredCredential {
    return {
      id: supabaseResult.id,
      userId: supabaseResult.user_id,
      credentialId: supabaseResult.credential_id,
      publicKey: supabaseResult.public_key,
      counter: supabaseResult.counter,
      transports: supabaseResult.transports || undefined,
      userName: supabaseResult?.user_name || undefined,
      userDisplayName: supabaseResult?.user_display_name || undefined,
      createdAt: supabaseResult.created_at,
      updatedAt: supabaseResult.updated_at,
    };
  }
}

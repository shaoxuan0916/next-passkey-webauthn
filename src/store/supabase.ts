import type { ChallengeRecord, ChallengeStore, Flow } from "../types/index";

/**
 * Supabase-based challenge store for production use
 * Stores challenges in a database table for persistence across server restarts
 */
export class SupabaseStore implements ChallengeStore {
  constructor(
    private readonly supabase: any, // Compatible with @supabase/supabase-js
    /** Table name for challenges (default: "passkey_challenges") */
    private readonly tableName = "passkey_challenges"
  ) {}

  async set(record: ChallengeRecord): Promise<void> {
    const { error } = await this.supabase.from(this.tableName).upsert({
      id: record.id,
      user_id: record.userId,
      flow: record.flow,
      challenge: record.challenge,
      expires_at: new Date(record.expiresAt).toISOString(),
    });

    if (error) {
      throw new Error(`Failed to store challenge: ${error.message}`);
    }
  }

  async get(userId: string, flow: Flow): Promise<ChallengeRecord | null> {
    const challengeId = `${userId}:${flow}`;

    const { data, error } = await this.supabase
      .from(this.tableName)
      .select("*")
      .eq("id", challengeId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No rows returned - challenge not found
        return null;
      }
      throw new Error(`Failed to retrieve challenge: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    // Check if expired
    const expiresAt = new Date(data.expires_at).getTime();
    if (Date.now() > expiresAt) {
      // Clean up expired challenge
      await this.delete(userId, flow);
      return null;
    }

    return {
      id: data.id,
      userId: data.user_id,
      flow: data.flow as Flow,
      challenge: data.challenge,
      expiresAt,
    };
  }

  async delete(userId: string, flow: Flow): Promise<void> {
    const challengeId = `${userId}:${flow}`;

    const { error } = await this.supabase
      .from(this.tableName)
      .delete()
      .eq("id", challengeId);

    if (error) {
      throw new Error(`Failed to delete challenge: ${error.message}`);
    }
  }

  /**
   * Clean up all expired challenges (optional maintenance method)
   */
  async cleanupExpired(): Promise<void> {
    const now = new Date().toISOString();

    const { error } = await this.supabase
      .from(this.tableName)
      .delete()
      .lt("expires_at", now);

    if (error) {
      throw new Error(`Failed to cleanup expired challenges: ${error.message}`);
    }
  }
}

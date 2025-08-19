// src/adapters/prisma.ts
var PrismaAdapter = class {
  constructor(prisma) {
    this.prisma = prisma;
  }
  async createPasskey(data) {
    const result = await this.prisma.passkey.create({
      data: {
        userId: data.userId,
        credentialId: data.credentialId,
        publicKey: data.publicKey,
        counter: data.counter,
        transports: data.transports || [],
        userName: data?.userName,
        userDisplayName: data?.userDisplayName
      }
    });
    return this.mapPrismaToStored(result);
  }
  async findByCredentialId(credentialId) {
    const result = await this.prisma.passkey.findUnique({
      where: { credentialId }
    });
    return result ? this.mapPrismaToStored(result) : null;
  }
  async listUserPasskeys(userId) {
    const results = await this.prisma.passkey.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });
    return results.map((result) => this.mapPrismaToStored(result));
  }
  async updateCounter(id, counter) {
    await this.prisma.passkey.update({
      where: { id },
      data: { counter }
    });
  }
  async deletePasskey(id) {
    await this.prisma.passkey.delete({
      where: { id }
    });
  }
  mapPrismaToStored(prismaResult) {
    return {
      id: prismaResult.id,
      userId: prismaResult.userId,
      credentialId: prismaResult.credentialId,
      publicKey: prismaResult.publicKey,
      counter: prismaResult.counter,
      transports: prismaResult.transports,
      userName: prismaResult?.userName || void 0,
      userDisplayName: prismaResult?.userDisplayName || void 0,
      createdAt: prismaResult.createdAt.toISOString(),
      updatedAt: prismaResult.updatedAt.toISOString()
    };
  }
};

// src/adapters/supabase.ts
var SupabaseAdapter = class {
  constructor(supabase, tableName = "passkeys") {
    this.supabase = supabase;
    this.tableName = tableName;
  }
  async createPasskey(data) {
    const { data: result, error } = await this.supabase.from(this.tableName).insert({
      user_id: data.userId,
      credential_id: data.credentialId,
      public_key: data.publicKey,
      counter: data.counter,
      transports: data.transports || [],
      user_name: data?.userName,
      user_display_name: data?.userDisplayName
    }).select();
    if (error) {
      throw new Error(`Failed to create passkey: ${error.message}`);
    }
    if (!result || result.length === 0) {
      throw new Error("Failed to create passkey: No data returned");
    }
    return this.mapSupabaseToStored(result[0]);
  }
  async findByCredentialId(credentialId) {
    const { data, error } = await this.supabase.from(this.tableName).select().eq("credential_id", credentialId);
    if (error) {
      throw new Error(`Failed to find passkey: ${error.message}`);
    }
    if (!data || data.length === 0) {
      return null;
    }
    return this.mapSupabaseToStored(data[0]);
  }
  async listUserPasskeys(userId) {
    const { data, error } = await this.supabase.from(this.tableName).select().order("created_at", { ascending: false }).eq("user_id", userId);
    if (error) {
      throw new Error(`Failed to list passkeys: ${error.message}`);
    }
    if (!data) {
      return [];
    }
    return data.map((item) => this.mapSupabaseToStored(item));
  }
  async updateCounter(id, counter) {
    const { error } = await this.supabase.from(this.tableName).update({ counter }).eq("id", id);
    if (error) {
      throw new Error(`Failed to update counter: ${error.message}`);
    }
  }
  async deletePasskey(id) {
    const { error } = await this.supabase.from(this.tableName).delete().eq("id", id);
    if (error) {
      throw new Error(`Failed to delete passkey: ${error.message}`);
    }
  }
  mapSupabaseToStored(supabaseResult) {
    return {
      id: supabaseResult.id,
      userId: supabaseResult.user_id,
      credentialId: supabaseResult.credential_id,
      publicKey: supabaseResult.public_key,
      counter: supabaseResult.counter,
      transports: supabaseResult.transports || void 0,
      userName: supabaseResult?.user_name || void 0,
      userDisplayName: supabaseResult?.user_display_name || void 0,
      createdAt: supabaseResult.created_at,
      updatedAt: supabaseResult.updated_at
    };
  }
};

export {
  PrismaAdapter,
  SupabaseAdapter
};
//# sourceMappingURL=chunk-62DGVYXI.js.map
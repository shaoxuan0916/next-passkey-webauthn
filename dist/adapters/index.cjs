"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/adapters/index.ts
var adapters_exports = {};
__export(adapters_exports, {
  PrismaAdapter: () => PrismaAdapter,
  SupabaseAdapter: () => SupabaseAdapter
});
module.exports = __toCommonJS(adapters_exports);

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
        userDisplayName: data?.userDisplayName,
        // Enhanced metadata fields
        authenticatorAttachment: data.authenticatorAttachment,
        deviceInfo: data.deviceInfo,
        backupEligible: data.backupEligible || false,
        backupState: data.backupState || false,
        lastUsedAt: data.lastUsedAt ? new Date(data.lastUsedAt) : void 0
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
      // Enhanced metadata fields
      authenticatorAttachment: prismaResult.authenticatorAttachment || void 0,
      deviceInfo: prismaResult.deviceInfo || void 0,
      backupEligible: prismaResult.backupEligible || void 0,
      backupState: prismaResult.backupState || void 0,
      lastUsedAt: prismaResult.lastUsedAt?.toISOString() || void 0,
      // Standard timestamps
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
      last_used_at: data.lastUsedAt ? new Date(data.lastUsedAt).toISOString() : null
    };
    const { data: result, error } = await this.supabase.from(this.tableName).insert(insertData).select();
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
      // Enhanced metadata fields
      authenticatorAttachment: supabaseResult.authenticator_attachment || void 0,
      deviceInfo: supabaseResult.device_info || void 0,
      backupEligible: supabaseResult.backup_eligible || void 0,
      backupState: supabaseResult.backup_state || void 0,
      lastUsedAt: supabaseResult.last_used_at || void 0,
      // Standard timestamps
      createdAt: supabaseResult.created_at,
      updatedAt: supabaseResult.updated_at
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PrismaAdapter,
  SupabaseAdapter
});
//# sourceMappingURL=index.cjs.map
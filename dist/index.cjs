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

// src/index.ts
var src_exports = {};
__export(src_exports, {
  DbStore: () => DbStore,
  ErrorCodes: () => ErrorCodes,
  MemoryStore: () => MemoryStore,
  PasskeyError: () => PasskeyError,
  PrismaAdapter: () => PrismaAdapter,
  RedisStore: () => RedisStore,
  SupabaseAdapter: () => SupabaseAdapter,
  deletePasskey: () => deletePasskey,
  finishAuthentication: () => finishAuthentication,
  finishRegistration: () => finishRegistration,
  listUserPasskeys: () => listUserPasskeys,
  startAuthentication: () => startAuthentication,
  startRegistration: () => startRegistration,
  useAuthenticatePasskey: () => useAuthenticatePasskey,
  useManagePasskeys: () => useManagePasskeys,
  useRegisterPasskey: () => useRegisterPasskey
});
module.exports = __toCommonJS(src_exports);

// src/server/register.ts
var import_server = require("@simplewebauthn/server");

// src/types/index.ts
var PasskeyError = class extends Error {
  constructor(message, code, details) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = "PasskeyError";
  }
};
var ErrorCodes = {
  CHALLENGE_NOT_FOUND: "CHALLENGE_NOT_FOUND",
  CHALLENGE_EXPIRED: "CHALLENGE_EXPIRED",
  CREDENTIAL_NOT_FOUND: "CREDENTIAL_NOT_FOUND",
  VERIFICATION_FAILED: "VERIFICATION_FAILED",
  INVALID_INPUT: "INVALID_INPUT",
  STORAGE_ERROR: "STORAGE_ERROR"
};

// src/server/register.ts
async function startRegistration(userId, options, registrationOptions) {
  try {
    const existingCredentials = await options.adapter.listUserPasskeys(userId);
    const excludeCredentials = existingCredentials.map((cred) => ({
      id: cred.credentialId,
      type: "public-key",
      transports: cred.transports
    }));
    const registrationOpts = await (0, import_server.generateRegistrationOptions)({
      rpName: options.rpConfig.rpName,
      rpID: options.rpConfig.rpID,
      userID: Buffer.from(userId, "utf-8"),
      userName: registrationOptions?.userName || userId,
      userDisplayName: registrationOptions?.userDisplayName || userId,
      timeout: registrationOptions?.timeout || 3e5,
      // 5 minutes
      attestationType: "none",
      excludeCredentials,
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
        authenticatorAttachment: "platform"
      },
      supportedAlgorithmIDs: [-7, -257]
      // ES256, RS256
    });
    const expiresAt = Date.now() + (registrationOptions?.timeout || 3e5);
    const challengeRecord = {
      id: `${userId}:registration`,
      userId,
      flow: "registration",
      challenge: registrationOpts.challenge,
      expiresAt
    };
    await options.store.set(challengeRecord);
    return registrationOpts;
  } catch (error) {
    if (error instanceof PasskeyError) {
      throw error;
    }
    throw new PasskeyError(
      "Failed to start registration",
      ErrorCodes.STORAGE_ERROR,
      error
    );
  }
}
async function finishRegistration(userId, credential, options, registrationOptions) {
  try {
    const challengeRecord = await options.store.get(userId, "registration");
    if (!challengeRecord) {
      throw new PasskeyError(
        "Challenge not found or expired",
        ErrorCodes.CHALLENGE_NOT_FOUND
      );
    }
    if (Date.now() > challengeRecord.expiresAt) {
      await options.store.delete(userId, "registration");
      throw new PasskeyError("Challenge expired", ErrorCodes.CHALLENGE_EXPIRED);
    }
    const verification = await (0, import_server.verifyRegistrationResponse)({
      response: credential,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: options.rpConfig.expectedOrigin,
      expectedRPID: options.rpConfig.rpID,
      requireUserVerification: false
    });
    await options.store.delete(userId, "registration");
    if (!verification.verified || !verification.registrationInfo) {
      throw new PasskeyError(
        "Registration verification failed",
        ErrorCodes.VERIFICATION_FAILED,
        verification
      );
    }
    const {
      credential: {
        id: credentialID,
        publicKey: credentialPublicKey,
        counter,
        transports
      }
    } = verification.registrationInfo;
    const credentialIdString = Buffer.from(credentialID).toString("base64url");
    const existingCredential = await options.adapter.findByCredentialId(
      credentialIdString
    );
    if (existingCredential) {
      throw new PasskeyError(
        "Credential already registered",
        ErrorCodes.INVALID_INPUT
      );
    }
    const storedCredential = await options.adapter.createPasskey({
      userId,
      credentialId: credentialID,
      publicKey: Buffer.from(credentialPublicKey).toString("base64url"),
      counter,
      transports,
      userName: registrationOptions?.userName,
      userDisplayName: registrationOptions?.userDisplayName
    });
    return {
      verified: true,
      credential: storedCredential
    };
  } catch (error) {
    try {
      await options.store.delete(userId, "registration");
    } catch {
    }
    if (error instanceof PasskeyError) {
      throw error;
    }
    throw new PasskeyError(
      "Failed to finish registration",
      ErrorCodes.VERIFICATION_FAILED,
      error
    );
  }
}

// src/server/authenticate.ts
var import_server2 = require("@simplewebauthn/server");
async function startAuthentication(userId, options, authOptions) {
  try {
    const userCredentials = await options.adapter.listUserPasskeys(userId);
    if (userCredentials.length === 0) {
      throw new PasskeyError(
        "No passkeys found for user",
        ErrorCodes.CREDENTIAL_NOT_FOUND
      );
    }
    const allowCredentials = userCredentials.map((cred) => ({
      id: cred.credentialId,
      type: "public-key",
      transports: cred.transports
    }));
    const authenticationOpts = await (0, import_server2.generateAuthenticationOptions)({
      rpID: options.rpConfig.rpID,
      timeout: authOptions?.timeout || 3e5,
      // 5 minutes
      allowCredentials,
      userVerification: authOptions?.userVerification || "preferred"
    });
    const expiresAt = Date.now() + (authOptions?.timeout || 3e5);
    const challengeRecord = {
      id: `${userId}:authentication`,
      userId,
      flow: "authentication",
      challenge: authenticationOpts.challenge,
      expiresAt
    };
    await options.store.set(challengeRecord);
    return authenticationOpts;
  } catch (error) {
    if (error instanceof PasskeyError) {
      throw error;
    }
    throw new PasskeyError(
      "Failed to start authentication",
      ErrorCodes.STORAGE_ERROR,
      error
    );
  }
}
async function finishAuthentication(userId, credential, options) {
  try {
    const challengeRecord = await options.store.get(userId, "authentication");
    if (!challengeRecord) {
      throw new PasskeyError(
        "Challenge not found or expired",
        ErrorCodes.CHALLENGE_NOT_FOUND
      );
    }
    if (Date.now() > challengeRecord.expiresAt) {
      await options.store.delete(userId, "authentication");
      throw new PasskeyError("Challenge expired", ErrorCodes.CHALLENGE_EXPIRED);
    }
    const credentialIdString = credential.id;
    const storedCredential = await options.adapter.findByCredentialId(
      credentialIdString
    );
    if (!storedCredential) {
      await options.store.delete(userId, "authentication");
      throw new PasskeyError(
        "Credential not found",
        ErrorCodes.CREDENTIAL_NOT_FOUND
      );
    }
    if (storedCredential.userId !== userId) {
      await options.store.delete(userId, "authentication");
      throw new PasskeyError(
        "Credential does not belong to user",
        ErrorCodes.VERIFICATION_FAILED
      );
    }
    const authenticator = {
      id: storedCredential.credentialId,
      publicKey: Buffer.from(storedCredential.publicKey, "base64url"),
      counter: storedCredential.counter,
      transports: storedCredential.transports
    };
    const verification = await (0, import_server2.verifyAuthenticationResponse)({
      response: credential,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: options.rpConfig.expectedOrigin,
      expectedRPID: options.rpConfig.rpID,
      credential: authenticator,
      requireUserVerification: false
    });
    await options.store.delete(userId, "authentication");
    if (!verification.verified) {
      throw new PasskeyError(
        "Authentication verification failed",
        ErrorCodes.VERIFICATION_FAILED,
        verification
      );
    }
    const newCounter = verification.authenticationInfo.newCounter;
    if (newCounter > storedCredential.counter) {
      await options.adapter.updateCounter(storedCredential.id, newCounter);
      storedCredential.counter = newCounter;
    }
    return {
      verified: true,
      credential: storedCredential
    };
  } catch (error) {
    try {
      await options.store.delete(userId, "authentication");
    } catch {
    }
    if (error instanceof PasskeyError) {
      throw error;
    }
    throw new PasskeyError(
      "Failed to finish authentication",
      ErrorCodes.VERIFICATION_FAILED,
      error
    );
  }
}

// src/server/delete.ts
async function deletePasskey(userId, credentialId, options) {
  try {
    const credential = await options.adapter.findByCredentialId(credentialId);
    if (!credential) {
      throw new PasskeyError(
        "Credential not found",
        ErrorCodes.CREDENTIAL_NOT_FOUND
      );
    }
    if (credential.userId !== userId) {
      throw new PasskeyError(
        "Credential does not belong to user",
        ErrorCodes.VERIFICATION_FAILED
      );
    }
    await options.adapter.deletePasskey(credential.id);
  } catch (error) {
    if (error instanceof PasskeyError) {
      throw error;
    }
    throw new PasskeyError(
      "Failed to delete passkey",
      ErrorCodes.STORAGE_ERROR,
      error
    );
  }
}
async function listUserPasskeys(userId, options) {
  try {
    return await options.adapter.listUserPasskeys(userId);
  } catch (error) {
    if (error instanceof PasskeyError) {
      throw error;
    }
    throw new PasskeyError(
      "Failed to list passkeys",
      ErrorCodes.STORAGE_ERROR,
      error
    );
  }
}

// src/client/useRegisterPasskey.ts
var import_browser = require("@simplewebauthn/browser");
var import_react = require("react");
function useRegisterPasskey(config) {
  const [loading, setLoading] = (0, import_react.useState)(false);
  const [error, setError] = (0, import_react.useState)(null);
  const register = (0, import_react.useCallback)(
    async (userId, options) => {
      setLoading(true);
      setError(null);
      try {
        const startResponse = await fetch(config.endpoints.registerStart, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "include",
          body: JSON.stringify({ userId, ...options })
        });
        if (!startResponse.ok) {
          const errorData = await startResponse.json();
          throw new PasskeyError(
            errorData.error || "Failed to start registration",
            ErrorCodes.INVALID_INPUT
          );
        }
        const creationOptions = await startResponse.json();
        let credential;
        try {
          credential = await (0, import_browser.startRegistration)({
            optionsJSON: creationOptions
          });
        } catch (browserError) {
          if (browserError instanceof Error) {
            if (browserError.name === "NotAllowedError") {
              throw new PasskeyError(
                "User cancelled passkey creation or operation timed out",
                ErrorCodes.VERIFICATION_FAILED,
                browserError
              );
            }
            if (browserError.name === "InvalidStateError") {
              throw new PasskeyError(
                "Authenticator is already registered",
                ErrorCodes.INVALID_INPUT,
                browserError
              );
            }
            if (browserError.name === "NotSupportedError") {
              throw new PasskeyError(
                "Passkeys are not supported on this device/browser",
                ErrorCodes.INVALID_INPUT,
                browserError
              );
            }
          }
          throw new PasskeyError(
            "Failed to create passkey",
            ErrorCodes.VERIFICATION_FAILED,
            browserError
          );
        }
        const finishResponse = await fetch(config.endpoints.registerFinish, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "include",
          body: JSON.stringify({ userId, credential })
        });
        if (!finishResponse.ok) {
          const errorData = await finishResponse.json();
          throw new PasskeyError(
            errorData.error || "Failed to finish registration",
            ErrorCodes.VERIFICATION_FAILED
          );
        }
        const result = await finishResponse.json();
        return result;
      } catch (err) {
        const errorMessage = err instanceof PasskeyError ? err.message : "Registration failed";
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [config.endpoints]
  );
  return {
    register,
    loading,
    error
  };
}

// src/client/useAuthenticatePasskey.ts
var import_browser2 = require("@simplewebauthn/browser");
var import_react2 = require("react");
function useAuthenticatePasskey(config) {
  const [loading, setLoading] = (0, import_react2.useState)(false);
  const [error, setError] = (0, import_react2.useState)(null);
  const authenticate = (0, import_react2.useCallback)(
    async (userId, options) => {
      setLoading(true);
      setError(null);
      try {
        const startResponse = await fetch(config.endpoints.authenticateStart, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "include",
          body: JSON.stringify({ userId, ...options })
        });
        if (!startResponse.ok) {
          const errorData = await startResponse.json();
          throw new PasskeyError(
            errorData.error || "Failed to start authentication",
            ErrorCodes.INVALID_INPUT
          );
        }
        const requestOptions = await startResponse.json();
        let credential;
        try {
          credential = await (0, import_browser2.startAuthentication)({
            optionsJSON: requestOptions
          });
        } catch (browserError) {
          if (browserError instanceof Error) {
            if (browserError.name === "NotAllowedError") {
              throw new PasskeyError(
                "User cancelled authentication or operation timed out",
                ErrorCodes.VERIFICATION_FAILED,
                browserError
              );
            }
            if (browserError.name === "InvalidStateError") {
              throw new PasskeyError(
                "Authenticator is not available",
                ErrorCodes.CREDENTIAL_NOT_FOUND,
                browserError
              );
            }
            if (browserError.name === "NotSupportedError") {
              throw new PasskeyError(
                "Passkeys are not supported on this device/browser",
                ErrorCodes.INVALID_INPUT,
                browserError
              );
            }
          }
          throw new PasskeyError(
            "Failed to authenticate with passkey",
            ErrorCodes.VERIFICATION_FAILED,
            browserError
          );
        }
        const finishResponse = await fetch(
          config.endpoints.authenticateFinish,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({ userId, credential })
          }
        );
        if (!finishResponse.ok) {
          const errorData = await finishResponse.json();
          throw new PasskeyError(
            errorData.error || "Failed to finish authentication",
            ErrorCodes.VERIFICATION_FAILED
          );
        }
        const result = await finishResponse.json();
        return result;
      } catch (err) {
        const errorMessage = err instanceof PasskeyError ? err.message : "Authentication failed";
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [config.endpoints]
  );
  return {
    authenticate,
    loading,
    error
  };
}

// src/client/useManagePasskeys.ts
var import_react3 = require("react");
function useManagePasskeys(config) {
  const [loading, setLoading] = (0, import_react3.useState)(false);
  const [error, setError] = (0, import_react3.useState)(null);
  const list = (0, import_react3.useCallback)(
    async (userId) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(config.endpoints.listPasskeys, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "include",
          body: JSON.stringify({ userId })
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new PasskeyError(
            errorData.error || "Failed to list passkeys",
            ErrorCodes.STORAGE_ERROR
          );
        }
        const passkeys = await response.json();
        return passkeys;
      } catch (err) {
        const errorMessage = err instanceof PasskeyError ? err.message : "Failed to list passkeys";
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [config.endpoints]
  );
  const remove = (0, import_react3.useCallback)(
    async (credentialId) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(config.endpoints.deletePasskey, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "include",
          body: JSON.stringify({ credentialId })
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new PasskeyError(
            errorData.error || "Failed to delete passkey",
            ErrorCodes.STORAGE_ERROR
          );
        }
      } catch (err) {
        const errorMessage = err instanceof PasskeyError ? err.message : "Failed to delete passkey";
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [config.endpoints]
  );
  return {
    list,
    remove,
    loading,
    error
  };
}

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

// src/store/memory.ts
var MemoryStore = class {
  constructor(cleanupIntervalMs = 6e4) {
    this.cleanupIntervalMs = cleanupIntervalMs;
    this.challenges = /* @__PURE__ */ new Map();
    this.startCleanup();
  }
  async set(record) {
    const key = this.getChallengeKey(record.userId, record.flow);
    this.challenges.set(key, record);
  }
  async get(userId, flow) {
    const key = this.getChallengeKey(userId, flow);
    const record = this.challenges.get(key);
    if (!record) {
      return null;
    }
    if (Date.now() > record.expiresAt) {
      this.challenges.delete(key);
      return null;
    }
    return record;
  }
  async delete(userId, flow) {
    const key = this.getChallengeKey(userId, flow);
    this.challenges.delete(key);
  }
  /**
   * Get challenge count (for testing/debugging)
   */
  size() {
    return this.challenges.size;
  }
  /**
   * Clear all challenges (for testing)
   */
  clear() {
    this.challenges.clear();
  }
  /**
   * Stop cleanup interval and clear memory
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = void 0;
    }
    this.clear();
  }
  getChallengeKey(userId, flow) {
    return `${userId}:${flow}`;
  }
  startCleanup() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, this.cleanupIntervalMs);
    this.cleanupInterval.unref?.();
  }
  cleanupExpired() {
    const now = Date.now();
    for (const [key, record] of this.challenges.entries()) {
      if (now > record.expiresAt) {
        this.challenges.delete(key);
      }
    }
  }
};

// src/store/redis.ts
var RedisStore = class {
  constructor(redis, defaultTTL = 300) {
    this.redis = redis;
    this.defaultTTL = defaultTTL;
  }
  async set(record) {
    const key = this.getChallengeKey(record.userId, record.flow);
    const value = JSON.stringify(record);
    const ttlSeconds = Math.ceil((record.expiresAt - Date.now()) / 1e3);
    const finalTTL = Math.min(Math.max(ttlSeconds, 1), this.defaultTTL);
    await this.redis.set(key, value, { EX: finalTTL });
  }
  async get(userId, flow) {
    const key = this.getChallengeKey(userId, flow);
    const value = await this.redis.get(key);
    if (!value) {
      return null;
    }
    try {
      const record = JSON.parse(value);
      if (Date.now() > record.expiresAt) {
        await this.redis.del(key);
        return null;
      }
      return record;
    } catch {
      await this.redis.del(key);
      return null;
    }
  }
  async delete(userId, flow) {
    const key = this.getChallengeKey(userId, flow);
    await this.redis.del(key);
  }
  getChallengeKey(userId, flow) {
    return `passkey:challenge:${userId}:${flow}`;
  }
};

// src/store/db.ts
var DbStore = class {
  constructor(db, tableName = "passkey_challenges") {
    this.db = db;
    this.tableName = tableName;
  }
  async set(record) {
    const sql = `
			INSERT INTO ${this.tableName} (id, user_id, flow, challenge, expires_at)
			VALUES (?, ?, ?, ?, ?)
			ON CONFLICT(id) DO UPDATE SET
				challenge = excluded.challenge,
				expires_at = excluded.expires_at
		`;
    const expiresAt = new Date(record.expiresAt).toISOString();
    await this.db.execute(sql, [
      record.id,
      record.userId,
      record.flow,
      record.challenge,
      expiresAt
    ]);
  }
  async get(userId, flow) {
    await this.cleanupExpired();
    const id = this.getChallengeId(userId, flow);
    const sql = `
			SELECT id, user_id, flow, challenge, expires_at
			FROM ${this.tableName}
			WHERE id = ? AND expires_at > ?
		`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const rows = await this.db.query(sql, [id, now]);
    if (rows.length === 0) {
      return null;
    }
    const row = rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      flow: row.flow,
      challenge: row.challenge,
      expiresAt: new Date(row.expires_at).getTime()
    };
  }
  async delete(userId, flow) {
    const id = this.getChallengeId(userId, flow);
    const sql = `DELETE FROM ${this.tableName} WHERE id = ?`;
    await this.db.execute(sql, [id]);
  }
  /**
   * Clean up expired challenges (called automatically in get)
   */
  async cleanupExpired() {
    const sql = `DELETE FROM ${this.tableName} WHERE expires_at <= ?`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await this.db.execute(sql, [now]);
  }
  /**
   * Initialize the challenges table
   * Call this during setup to create the table
   */
  async initializeTable() {
    const sql = `
			CREATE TABLE IF NOT EXISTS ${this.tableName} (
				id TEXT PRIMARY KEY,
				user_id TEXT NOT NULL,
				flow TEXT NOT NULL,
				challenge TEXT NOT NULL,
				expires_at TIMESTAMP NOT NULL
			)
		`;
    await this.db.execute(sql);
    const indexSql = `
			CREATE INDEX IF NOT EXISTS idx_${this.tableName}_expires_at
			ON ${this.tableName} (expires_at)
		`;
    await this.db.execute(indexSql);
  }
  getChallengeId(userId, flow) {
    return `${userId}:${flow}`;
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DbStore,
  ErrorCodes,
  MemoryStore,
  PasskeyError,
  PrismaAdapter,
  RedisStore,
  SupabaseAdapter,
  deletePasskey,
  finishAuthentication,
  finishRegistration,
  listUserPasskeys,
  startAuthentication,
  startRegistration,
  useAuthenticatePasskey,
  useManagePasskeys,
  useRegisterPasskey
});
//# sourceMappingURL=index.cjs.map
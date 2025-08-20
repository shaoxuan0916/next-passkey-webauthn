import type {
  PasskeyAdapter,
  StoredCredential,
  AuthenticatorAttachment,
} from "../types/index";

/**
 * Prisma client interface for passkey operations
 * Compatible with generated Prisma client
 */
export interface PrismaClient {
  passkey: {
    create(args: {
      data: {
        userId: string;
        credentialId: string;
        publicKey: string;
        counter: number;
        transports?: string[];
        userName?: string;
        userDisplayName?: string;
        // Enhanced metadata fields
        authenticatorAttachment?: string;
        deviceInfo?: any;
        backupEligible?: boolean;
        backupState?: boolean;
        lastUsedAt?: Date;
      };
    }): Promise<{
      id: string;
      userId: string;
      credentialId: string;
      publicKey: string;
      counter: number;
      transports: string[];
      userName?: string;
      userDisplayName?: string;
      authenticatorAttachment?: string;
      deviceInfo?: any;
      backupEligible?: boolean;
      backupState?: boolean;
      lastUsedAt?: Date;
      createdAt: Date;
      updatedAt: Date;
    }>;

    findUnique(args: { where: { credentialId: string } }): Promise<{
      id: string;
      userId: string;
      credentialId: string;
      publicKey: string;
      counter: number;
      transports: string[];
      userName?: string;
      userDisplayName?: string;
      authenticatorAttachment?: string;
      deviceInfo?: any;
      backupEligible?: boolean;
      backupState?: boolean;
      lastUsedAt?: Date;
      createdAt: Date;
      updatedAt: Date;
    } | null>;

    findMany(args: {
      where: { userId: string };
      orderBy?: { createdAt: "asc" | "desc" };
    }): Promise<
      Array<{
        id: string;
        userId: string;
        credentialId: string;
        publicKey: string;
        counter: number;
        transports: string[];
        userName?: string;
        userDisplayName?: string;
        authenticatorAttachment?: string;
        deviceInfo?: any;
        backupEligible?: boolean;
        backupState?: boolean;
        lastUsedAt?: Date;
        createdAt: Date;
        updatedAt: Date;
      }>
    >;

    update(args: {
      where: { id: string };
      data: { counter: number };
    }): Promise<{
      id: string;
      userId: string;
      credentialId: string;
      publicKey: string;
      counter: number;
      transports: string[];
      userName?: string;
      userDisplayName?: string;
      createdAt: Date;
      updatedAt: Date;
    }>;

    delete(args: { where: { id: string } }): Promise<{
      id: string;
    }>;
  };
}

/**
 * Prisma adapter for passkey credential storage
 * Works with PostgreSQL, MySQL, SQLite via Prisma ORM
 */
export class PrismaAdapter implements PasskeyAdapter {
  constructor(private readonly prisma: PrismaClient) {}

  async createPasskey(
    data: Omit<StoredCredential, "id" | "createdAt">
  ): Promise<StoredCredential> {
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
        lastUsedAt: data.lastUsedAt ? new Date(data.lastUsedAt) : undefined,
      },
    });

    return this.mapPrismaToStored(result);
  }

  async findByCredentialId(
    credentialId: string
  ): Promise<StoredCredential | null> {
    const result = await this.prisma.passkey.findUnique({
      where: { credentialId },
    });

    return result ? this.mapPrismaToStored(result) : null;
  }

  async listUserPasskeys(userId: string): Promise<StoredCredential[]> {
    const results = await this.prisma.passkey.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return results.map((result) => this.mapPrismaToStored(result));
  }

  async updateCounter(id: string, counter: number): Promise<void> {
    await this.prisma.passkey.update({
      where: { id },
      data: { counter },
    });
  }

  async deletePasskey(id: string): Promise<void> {
    await this.prisma.passkey.delete({
      where: { id },
    });
  }

  private mapPrismaToStored(prismaResult: {
    id: string;
    userId: string;
    credentialId: string;
    publicKey: string;
    counter: number;
    transports: string[];
    userName?: string;
    userDisplayName?: string;
    authenticatorAttachment?: string;
    deviceInfo?: any;
    backupEligible?: boolean;
    backupState?: boolean;
    lastUsedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
  }): StoredCredential {
    return {
      id: prismaResult.id,
      userId: prismaResult.userId,
      credentialId: prismaResult.credentialId,
      publicKey: prismaResult.publicKey,
      counter: prismaResult.counter,
      transports: prismaResult.transports,
      userName: prismaResult?.userName || undefined,
      userDisplayName: prismaResult?.userDisplayName || undefined,
      // Enhanced metadata fields
      authenticatorAttachment:
        (prismaResult.authenticatorAttachment as AuthenticatorAttachment) ||
        undefined,
      deviceInfo: prismaResult.deviceInfo || undefined,
      backupEligible: prismaResult.backupEligible || undefined,
      backupState: prismaResult.backupState || undefined,
      lastUsedAt: prismaResult.lastUsedAt?.toISOString() || undefined,
      // Standard timestamps
      createdAt: prismaResult.createdAt.toISOString(),
      updatedAt: prismaResult.updatedAt.toISOString(),
    };
  }
}

import { PasskeyAdapter, StoredCredential } from '../types/index.cjs';

/**
 * Prisma client interface for passkey operations
 * Compatible with generated Prisma client
 */
interface PrismaClient {
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
        findUnique(args: {
            where: {
                credentialId: string;
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
        } | null>;
        findMany(args: {
            where: {
                userId: string;
            };
            orderBy?: {
                createdAt: "asc" | "desc";
            };
        }): Promise<Array<{
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
        }>>;
        update(args: {
            where: {
                id: string;
            };
            data: {
                counter: number;
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
            createdAt: Date;
            updatedAt: Date;
        }>;
        delete(args: {
            where: {
                id: string;
            };
        }): Promise<{
            id: string;
        }>;
    };
}
/**
 * Prisma adapter for passkey credential storage
 * Works with PostgreSQL, MySQL, SQLite via Prisma ORM
 */
declare class PrismaAdapter implements PasskeyAdapter {
    private readonly prisma;
    constructor(prisma: PrismaClient);
    createPasskey(data: Omit<StoredCredential, "id" | "createdAt">): Promise<StoredCredential>;
    findByCredentialId(credentialId: string): Promise<StoredCredential | null>;
    listUserPasskeys(userId: string): Promise<StoredCredential[]>;
    updateCounter(id: string, counter: number): Promise<void>;
    deletePasskey(id: string): Promise<void>;
    private mapPrismaToStored;
}

/**
 * Supabase adapter for passkey credential storage
 * Works with Supabase PostgreSQL database
 */
declare class SupabaseAdapter implements PasskeyAdapter {
    private readonly supabase;
    /** Table name for passkeys (default: "passkeys") */
    private readonly tableName;
    constructor(supabase: any, // Use 'any' to be compatible with @supabase/supabase-js
    /** Table name for passkeys (default: "passkeys") */
    tableName?: string);
    createPasskey(data: Omit<StoredCredential, "id" | "createdAt">): Promise<StoredCredential>;
    findByCredentialId(credentialId: string): Promise<StoredCredential | null>;
    listUserPasskeys(userId: string): Promise<StoredCredential[]>;
    updateCounter(id: string, counter: number): Promise<void>;
    deletePasskey(id: string): Promise<void>;
    private mapSupabaseToStored;
}

export { PrismaAdapter, type PrismaClient, SupabaseAdapter };

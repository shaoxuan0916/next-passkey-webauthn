import { PasskeyAdapter, StoredCredential } from '../types/index.js';

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
 * Supabase client interface for passkey operations
 * Compatible with @supabase/supabase-js
 */
interface SupabaseClient {
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
                error: {
                    message: string;
                } | null;
            }>;
        };
        select(columns?: string): {
            eq(column: string, value: string): Promise<{
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
                error: {
                    message: string;
                } | null;
            }>;
            order(column: string, options?: {
                ascending: boolean;
            }): {
                eq(column: string, value: string): Promise<{
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
                    error: {
                        message: string;
                    } | null;
                }>;
            };
        };
        update(data: {
            counter: number;
        }): {
            eq(column: string, value: string): Promise<{
                data: unknown;
                error: {
                    message: string;
                } | null;
            }>;
        };
        delete(): {
            eq(column: string, value: string): Promise<{
                data: unknown;
                error: {
                    message: string;
                } | null;
            }>;
        };
    };
}
/**
 * Supabase adapter for passkey credential storage
 * Works with Supabase PostgreSQL database
 */
declare class SupabaseAdapter implements PasskeyAdapter {
    private readonly supabase;
    /** Table name for passkeys (default: "passkeys") */
    private readonly tableName;
    constructor(supabase: SupabaseClient, 
    /** Table name for passkeys (default: "passkeys") */
    tableName?: string);
    createPasskey(data: Omit<StoredCredential, "id" | "createdAt">): Promise<StoredCredential>;
    findByCredentialId(credentialId: string): Promise<StoredCredential | null>;
    listUserPasskeys(userId: string): Promise<StoredCredential[]>;
    updateCounter(id: string, counter: number): Promise<void>;
    deletePasskey(id: string): Promise<void>;
    private mapSupabaseToStored;
}

export { PrismaAdapter, type PrismaClient, SupabaseAdapter, type SupabaseClient };

import { supabase } from '../../services/supabaseClient';

export interface SupabaseAuthResult {
  success: boolean;
  userId?: string;
  error?: string;
}

/**
 * Sign up with Supabase Auth and create users row.
 * Includes VEK metadata for v2 architecture.
 */
export async function supabaseSignUp(
  email: string,
  password: string,
  publicKey: number[],
  salt: number[],
  x25519PublicKey?: number[],
  encryptedVEKPassword?: string,
  encryptedVEKRecovery?: string,
): Promise<SupabaseAuthResult> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data.user) {
      return { success: false, error: 'Sign up failed — no user returned' };
    }

    const { error: profileError } = await supabase
      .from('users')
      .insert({
        id: data.user.id,
        email,
        public_key: JSON.stringify(publicKey),
        salt: JSON.stringify(salt),
        x25519_public_key: x25519PublicKey ? JSON.stringify(x25519PublicKey) : null,
        encrypted_vek_password: encryptedVEKPassword ?? null,
        encrypted_vek_recovery: encryptedVEKRecovery ?? null,
        crypto_version: encryptedVEKPassword ? 2 : 1,
      });

    if (profileError) {
      return { success: false, error: `Failed to create profile: ${profileError.message}` };
    }

    return { success: true, userId: data.user.id };
  } catch (err: any) {
    return { success: false, error: err.message || 'Sign up failed' };
  }
}

/**
 * Sign in with Supabase Auth.
 */
export async function supabaseSignIn(
  email: string,
  password: string
): Promise<SupabaseAuthResult> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data.user) {
      return { success: false, error: 'Sign in failed — no user returned' };
    }

    return { success: true, userId: data.user.id };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Sign in failed' };
  }
}

/**
 * Fetch a user's X25519 public key (for ECDH sharing).
 */
export async function fetchX25519PublicKey(
  userId: string,
): Promise<number[] | null> {
  const { data, error } = await supabase
    .from('users')
    .select('x25519_public_key')
    .eq('id', userId)
    .single();

  if (error || !data?.x25519_public_key) return null;
  return JSON.parse(data.x25519_public_key);
}

/**
 * Get user ID by email.
 */
export async function getUserIdByEmail(email: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  if (error || !data) return null;
  return data.id;
}

/**
 * Sign out from Supabase Auth.
 */
export async function supabaseSignOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Failed to sign out from Supabase:', error);
  }
}

/**
 * Get current Supabase user ID.
 */
export async function getSupabaseUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

/**
 * Listen to auth state changes.
 */
export function onAuthStateChange(
  callback: (userId: string | null) => void
): { unsubscribe: () => void } {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user?.id ?? null);
  });

  return { unsubscribe: data.subscription.unsubscribe.bind(data.subscription) };
}

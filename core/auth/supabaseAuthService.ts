import { supabase } from '../../services/supabaseClient';

export interface SupabaseAuthResult {
  success: boolean;
  userId?: string;
  error?: string;
}

/**
 * Sign up with Supabase Auth using email/password.
 * This creates a Supabase Auth user AND a corresponding row in the `users` table
 * with the public key, salt, and x25519 public key from the local identity.
 */
export async function supabaseSignUp(
  email: string,
  password: string,
  publicKey: number[],
  salt: number[],
  x25519PublicKey?: number[],
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

    // Insert the users row with public key and salt
    // This is needed for sharing and RLS
    const { error: profileError } = await supabase
      .from('users')
      .insert({
        id: data.user.id, // Use Supabase auth UID as the users.id
        email,
        public_key: JSON.stringify(publicKey),
        salt: JSON.stringify(salt),
        x25519_public_key: x25519PublicKey ? JSON.stringify(x25519PublicKey) : null,
      });

    if (profileError) {
      // Note: We can't delete the auth user from client-side on profile insert failure.
      // The orphaned auth user will need manual cleanup in Supabase dashboard.
      return { success: false, error: `Failed to create profile: ${profileError.message}` };
    }

    return { success: true, userId: data.user.id };
  } catch (err: any) {
    return { success: false, error: err.message || 'Sign up failed' };
  }
}

/**
 * Sign in with Supabase Auth.
 * Returns the Supabase user ID on success.
 */
export async function supabaseSignIn(
  email: string,
  password: string
): Promise<SupabaseAuthResult> {
  try {
    console.log('[SupabaseAuth] Attempting sign in for:', email);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('[SupabaseAuth] Sign-in error:', error.message, 'status:', error.status);
      return { success: false, error: error.message };
    }

    if (!data.user) {
      console.error('[SupabaseAuth] Sign-in failed — no user returned');
      return { success: false, error: 'Sign in failed — no user returned' };
    }

    console.log('[SupabaseAuth] Sign-in successful, userId:', data.user.id);
    return { success: true, userId: data.user.id };
  } catch (err: any) {
    console.error('[SupabaseAuth] Sign-in exception:', err?.message || err);
    return { success: false, error: err?.message || 'Sign in failed' };
  }
}

/**
 * Fetch the user's salt and public key from the users table.
 * Used to bootstrap a second device that doesn't have a local identity yet.
 * Salt is retrieved via the get_my_salt() security definer function — the
 * column itself is not directly readable due to column-level RLS grants.
 */
export async function fetchUserCryptoParams(
  userId: string
): Promise<{ salt: number[]; publicKey: number[] } | { error: string }> {
  // Fetch public key directly (column is granted to authenticated)
  const { data: profileData, error: profileError } = await supabase
    .from('users')
    .select('public_key')
    .eq('id', userId)
    .single();

  if (profileError || !profileData) {
    return { error: 'Failed to fetch user profile' };
  }

  // Fetch salt via security definer function (column is not directly readable)
  const { data: saltData, error: saltError } = await supabase.rpc('get_my_salt');

  if (saltError || !saltData) {
    return { error: 'Failed to fetch user salt' };
  }

  return {
    salt: JSON.parse(saltData as string),
    publicKey: JSON.parse(profileData.public_key),
  };
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
 * Get a user ID by email (for sharing).
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
 * Get the current Supabase session user ID.
 * Returns null if not authenticated.
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

import { createClient } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';

export class AuthService {
  private static supabase = createClient();

  static async signIn(email: string, password: string): Promise<User | null> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    return data.user;
  }

  static async signUp(email: string, password: string): Promise<User | null> {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    return data.user;
  }

  static async getCurrentUser(): Promise<User | null> {
    const { data, error } = await this.supabase.auth.getUser();
    
    if (error) {
      console.error('Failed to get current user:', error);
      return null;
    }

    return data.user;
  }

  static onAuthStateChange(callback: (user: User | null) => void) {
    const { data } = this.supabase.auth.onAuthStateChange((event, session) => {
      callback(session?.user ?? null);
    });

    return data.subscription;
  }

  static async signOut(): Promise<void> {
    await this.supabase.auth.signOut();
  }
}
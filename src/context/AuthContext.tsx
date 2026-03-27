import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// Gera um hash SHA-256 da senha para uso local (lock screen)
async function hashSenha(senha: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(senha);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const SENHA_HASH_KEY = 'vault_lock_hash';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  cadastrar: (email: string, senha: string) => Promise<boolean>;
  login: (email: string, senha: string) => Promise<boolean>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  cadastrar: async () => false,
  login: async () => false,
  logout: async () => {},
  deleteAccount: async () => false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const cadastrar = async (email: string, senha: string) => {
    try {
      const { error } = await supabase.auth.signUp({ email, password: senha });
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Erro ao cadastrar:', error);
      return false;
    }
  };

  const login = async (email: string, senha: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) throw error;
      // Salva um hash local da senha para uso na tela de bloqueio
      const h = await hashSenha(senha);
      sessionStorage.setItem(SENHA_HASH_KEY, h);
      return true;
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      return false;
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const deleteAccount = async () => {
    try {
      const { error } = await supabase.rpc('delete_user');
      if (error) throw error;
      
      await supabase.auth.signOut();
      setUser(null);
      return true;
    } catch (error: any) {
      console.error('Erro ao excluir conta:', error);
      alert('Houve um erro ao tentar excluir sua conta: ' + (error.message || JSON.stringify(error)));
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, cadastrar, login, logout, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

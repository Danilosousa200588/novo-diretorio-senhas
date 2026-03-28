import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { PasswordEntry, Category } from '@/types/password';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { deriveKey, encryptPassword, decryptPassword } from '@/lib/crypto';
import { toast } from 'sonner';

interface PasswordContextType {
  entries: PasswordEntry[];
  addEntry: (entry: Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateEntry: (id: string, entry: Partial<PasswordEntry>) => void;
  deleteEntry: (id: string) => void;
  toggleFavorite: (id: string) => void;
  getByCategory: (category: Category) => PasswordEntry[];
  search: (query: string) => PasswordEntry[];
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const PasswordContext = createContext<PasswordContextType | null>(null);

const STORAGE_KEY = 'vault_passwords';
const THEME_KEY = 'vault_theme';

export function PasswordProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<PasswordEntry[]>([]);
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('vault_theme');
    return (stored as 'light' | 'dark') || 'dark';
  });

  // Tema local (pode continuar no localStorage)
  useEffect(() => {
    localStorage.setItem('vault_theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Inicializar chave criptográfica e buscar senhas
  useEffect(() => {
    if (!user) {
      setEntries([]);
      setCryptoKey(null);
      return;
    }

    const init = async () => {
      try {
        const pepper = import.meta.env.VITE_CRYPTO_PEPPER as string;
        if (!pepper) throw new Error('Missing VITE_CRYPTO_PEPPER');

        const key = await deriveKey(user.id, pepper);
        setCryptoKey(key);

        const { data, error } = await supabase
          .from('vault_entries')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Descriptografar todas as senhas recebidas
        const decryptedEntries = await Promise.all(
          (data || []).map(async (row) => ({
            id: row.id,
            name: row.nome,
            domain: row.dominio || '',
            username: row.usuario || '',
            password: await decryptPassword(row.senha, key).catch(() => 'ERRO_DECRIPT'),
            category: row.categoria as Category,
            favorite: row.favorito,
            description: row.descricao || '',
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }))
        );

        setEntries(decryptedEntries);
      } catch (err) {
        console.error('Erro ao inicializar senhas:', err);
        toast.error('Erro ao descriptografar cofre');
      }
    };

    init();
  }, [user]);

  const addEntry = useCallback(async (entry: Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!user || !cryptoKey) return;

    try {
      const encrypted = await encryptPassword(entry.password, cryptoKey);
      
      const { data, error } = await supabase
        .from('vault_entries')
        .insert({
          user_id: user.id,
          nome: entry.name,
          dominio: entry.domain,
          usuario: entry.username,
          senha: encrypted,
          categoria: entry.category,
          favorito: entry.favorite,
          descricao: entry.description,
        })
        .select()
        .single();
        
      if (error) throw error;

      setEntries(prev => [...prev, {
        id: data.id,
        name: data.nome,
        domain: data.dominio || '',
        username: data.usuario || '',
        password: entry.password,
        category: data.categoria as Category,
        favorite: data.favorito,
        description: data.descricao || '',
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      }]);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar senha');
    }
  }, [user, cryptoKey]);

  const updateEntry = useCallback(async (id: string, updates: Partial<PasswordEntry>) => {
    if (!user || !cryptoKey) return;
    try {
      const updateData: any = {};
      if (updates.name !== undefined) updateData.nome = updates.name;
      if (updates.domain !== undefined) updateData.dominio = updates.domain;
      if (updates.username !== undefined) updateData.usuario = updates.username;
      
      // Se a senha mudou, recriptografe
      if (updates.password !== undefined) {
        updateData.senha = await encryptPassword(updates.password, cryptoKey);
      }
      
      if (updates.category !== undefined) updateData.categoria = updates.category;
      if (updates.favorite !== undefined) updateData.favorito = updates.favorite;
      if (updates.description !== undefined) updateData.descricao = updates.description;

      const { data, error } = await supabase
        .from('vault_entries')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setEntries(prev => prev.map(e =>
        e.id === id ? { ...e, ...updates, updatedAt: data.updated_at } : e
      ));
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar senha');
    }
  }, [user, cryptoKey]);

  const deleteEntry = useCallback(async (id: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('vault_entries').delete().eq('id', id);
      if (error) throw error;
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch (err: any) {
      toast.error(err.message || 'Erro ao remover senha');
    }
  }, [user]);

  const toggleFavorite = useCallback(async (id: string) => {
    if (!user) return;
    const entry = entries.find(e => e.id === id);
    if (!entry) return;

    try {
      const newFav = !entry.favorite;
      const { data, error } = await supabase
        .from('vault_entries')
        .update({ favorito: newFav })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setEntries(prev => prev.map(e =>
        e.id === id ? { ...e, favorite: newFav, updatedAt: data.updated_at } : e
      ));
    } catch (err: any) {
      toast.error('Erro ao atualizar favorito');
    }
  }, [user, entries]);

  const getByCategory = useCallback((category: Category) => {
    if (category === 'favorites') return entries.filter(e => e.favorite);
    return entries.filter(e => e.category === category);
  }, [entries]);

  const searchEntries = useCallback((query: string) => {
    const q = query.toLowerCase();
    return entries.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.username.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q)
    );
  }, [entries]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  }, []);

  return (
    <PasswordContext.Provider value={{
      entries, addEntry, updateEntry, deleteEntry,
      toggleFavorite, getByCategory, search: searchEntries,
      theme, toggleTheme,
    }}>
      {children}
    </PasswordContext.Provider>
  );
}

export function usePasswords() {
  const ctx = useContext(PasswordContext);
  if (!ctx) throw new Error('usePasswords must be used within PasswordProvider');
  return ctx;
}

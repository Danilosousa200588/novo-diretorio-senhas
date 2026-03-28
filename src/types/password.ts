export type Category = 'banks' | 'social' | 'games' | 'work' | 'email' | 'favorites' | 'other';

export interface PasswordEntry {
  id: string;
  name: string;
  domain: string;
  username: string;
  password: string;
  category: Category;
  favorite: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryInfo {
  id: Category;
  label: string;
  icon: string;
  color: string;
}

export interface PresetService {
  name: string;
  domain: string;
  category: Category;
}

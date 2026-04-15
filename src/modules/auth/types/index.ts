export interface User {
  id: string;
  username: string;
  role: 'admin' | 'user';
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface ThemeConfig {
  name: string;
  gradient: string;
  accent: string;
  blur: string;
  icon: string;
  button: string;
}

export type Themes = {
  [key: string]: ThemeConfig;
}

export interface ThemeGroups {
  solid: string[];
  gradient: string[];
}

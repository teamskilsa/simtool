#!/bin/bash

# Verify we're in the project root
if [ ! -d "src" ] || [ ! -f "package.json" ]; then
    echo "Error: Please run this script from your project root directory (where src/ and package.json are located)"
    exit 1
fi

# Create the main auth module directory structure
mkdir -p src/modules/auth/{components,lib,types,hooks,context}

# Create type definitions
cat > src/modules/auth/types/index.ts << 'EOL'
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
EOL

# Create auth utilities
cat > src/modules/auth/lib/auth-utils.ts << 'EOL'
import { LoginCredentials, User } from '../types';
import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const mockAuthService = {
  login: async (credentials: LoginCredentials): Promise<{ user: User }> => {
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (credentials.username === 'admin' && credentials.password === 'admin') {
      return {
        user: {
          id: '1',
          username: credentials.username,
          role: 'admin'
        }
      };
    }
    throw new Error('Invalid credentials');
  }
};
EOL

# Create auth context
cat > src/modules/auth/context/auth-context.tsx << 'EOL'
import { createContext, useContext, useState, ReactNode } from 'react';
import { AuthState, User } from '../types';

interface AuthContextType extends AuthState {
  login: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: false,
  });

  const login = (user: User) => {
    setAuthState({
      user,
      isAuthenticated: true,
      isLoading: false,
    });
  };

  const logout = () => {
    setAuthState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  };

  return (
    <AuthContext.Provider value={{ ...authState, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
EOL

# Create auth hook
cat > src/modules/auth/hooks/use-login.ts << 'EOL'
import { useState } from 'react';
import { LoginCredentials } from '../types';
import { mockAuthService } from '../lib/auth-utils';
import { useAuth } from '../context/auth-context';

export function useLogin() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();

  const handleLogin = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    setError(null);

    try {
      const { user } = await mockAuthService.login(credentials);
      login(user);
      return user;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    login: handleLogin,
    isLoading,
    error,
  };
}
EOL

# Create component barrel file
cat > src/modules/auth/components/index.ts << 'EOL'
export { default as LoginForm } from './login-form';
export { default as ThemeSelector } from './theme-selector';
EOL

# Create placeholder files for the larger components
touch src/modules/auth/components/login-form.tsx
touch src/modules/auth/components/theme-selector.tsx

# Create index.ts for the auth module
cat > src/modules/auth/index.ts << 'EOL'
export * from './components';
export * from './context/auth-context';
export * from './hooks/use-login';
export * from './lib/auth-utils';
export * from './types';
EOL

echo "Auth module structure created successfully!"
echo "Now manually copy the LoginForm and ThemeSelector component implementations."

# Verify the creation
if [ -d "src/modules/auth" ]; then
    echo "✅ Directory structure created successfully"
    echo "📁 Created directories:"
    ls -R src/modules/auth
else
    echo "❌ Something went wrong with the directory creation"
fi

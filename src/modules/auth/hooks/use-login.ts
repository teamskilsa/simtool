// modules/auth/hooks/use-login.ts
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoginCredentials } from '../types';
import { mockAuthService } from '../lib/auth-utils';
import { useAuth } from '../context/auth-context';

export function useLogin() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    setError(null);

    try {
      const { user } = await mockAuthService.login(credentials);
      login(user);
      router.push('/dashboard');
      return user;
    } catch (err) {
      let errorMessage = 'Authentication failed';
      
      if (err instanceof Error) {
        switch (err.message) {
          case 'User not found':
            errorMessage = 'No user found with this username';
            break;
          case 'Invalid password':
            errorMessage = 'Incorrect password';
            break;
          default:
            errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    login: handleLogin,
    isLoading,
    error,
    clearError: () => setError(null),
  };
}
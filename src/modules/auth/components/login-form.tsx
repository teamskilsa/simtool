// src/modules/auth/components/login-form.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTheme } from '@/components/theme/context/theme-context';
import { themes } from '@/components/theme/themes';
import { ThemeSelector } from '@/components/theme/theme-selector';
import { LoginFormFields } from './login-form-fields';
import { loginSchema } from '../lib/auth-utils';
import { useLogin } from '../hooks/use-login';
import type { LoginCredentials } from '../types';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function LoginForm() {
  const { theme, mode } = useTheme();
  const { login, isLoading } = useLogin();
  const themeConfig = themes[theme];

  const form = useForm<LoginCredentials>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginCredentials) => {
    try {
      await login(data);
    } catch (error) {
      form.setError('root', { 
        message: error instanceof Error ? error.message : 'Login failed'
      });
    }
  };

  return (
    <div className={cn(
      "min-h-screen w-full relative",
      "bg-gradient-to-br",
      `from-${theme}-400/20 via-${theme}-50/10 to-white`,
      `dark:from-${theme}-900/20 dark:via-${theme}-900/10 dark:to-black/40`
    )}>
      {/* Grid overlay */}
      <div 
        className="absolute inset-0" 
        style={{
          backgroundImage: `
            linear-gradient(to right, ${mode === 'light' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)'} 1px, transparent 1px),
            linear-gradient(to bottom, ${mode === 'light' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)'} 1px, transparent 1px)
          `,
          backgroundSize: '64px 64px',
          opacity: 0.4
        }}
      />

      {/* Theme Selector */}
      <div className="absolute right-8 top-6 z-50">
        <ThemeSelector />
      </div>

      {/* Content Wrapper */}
      <div className="min-h-screen flex items-center justify-center px-4 relative z-10">
        <Card className={cn(
          "w-[380px]",
          mode === 'light' ? "bg-white/80" : "bg-gray-900/80",
          "backdrop-blur-md",
          "shadow-xl",
          "border-0"
        )}>
          <div className={cn("h-0.5", themeConfig.gradients.header)} />
          
          <CardHeader className="space-y-2 pt-8 px-6">
            <CardTitle className={cn(
              "text-2xl font-semibold text-center",
              themeConfig.colors.primary[700]
            )}>
              Welcome back
            </CardTitle>
            <CardDescription className={cn(
              "text-center",
              themeConfig.colors.primary[600]
            )}>
              Sign in to your account
            </CardDescription>
          </CardHeader>

          <LoginFormFields 
            form={form}
            onSubmit={onSubmit}
            isLoading={isLoading}
          />
        </Card>
      </div>

      {/* Footer */}
      <div className={cn(
        "absolute left-8 bottom-6",
        "text-sm",
        themeConfig.colors.primary[700]
      )}>
        Network Testing Portal © 2024
      </div>
    </div>
  );
}
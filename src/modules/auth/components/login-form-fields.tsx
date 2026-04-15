// src/modules/auth/components/login-form-fields.tsx
'use client';

import { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { useTheme } from '@/components/theme/context/theme-context';
import { themes } from '@/components/theme/themes';
import { cn } from "@/lib/utils";
import type { LoginCredentials } from '../types';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  CardContent,
  CardFooter,
} from "@/components/ui/card";

interface LoginFormFieldsProps {
  form: UseFormReturn<LoginCredentials>;
  onSubmit: (data: LoginCredentials) => Promise<void>;
  isLoading: boolean;
}

export function LoginFormFields({ form, onSubmit, isLoading }: LoginFormFieldsProps) {
  const [showPassword, setShowPassword] = useState(false);
  const { theme, mode } = useTheme();
  const themeConfig = themes[theme];

  const inputClasses = cn(
    "h-11",
    mode === 'light' ? "bg-white/50" : "bg-gray-900/50",
    `border-${theme}-200`,
    `focus:border-${theme}-400`,
    `focus:ring-${theme}-400`,
    "focus:ring-2",
    "focus:ring-offset-0",
    "placeholder:text-gray-400"
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <CardContent className="space-y-4 px-8">
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={cn(
                  "text-sm font-semibold",
                  themeConfig.colors.primary[700]
                )}>
                  Username
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    className={inputClasses}
                    placeholder="Enter your username"
                  />
                </FormControl>
                <FormMessage className="text-xs font-medium" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={cn(
                  "text-sm font-semibold",
                  themeConfig.colors.primary[700]
                )}>
                  Password
                </FormLabel>
                <div className="relative">
                  <FormControl>
                    <Input
                      {...field}
                      type={showPassword ? 'text' : 'password'}
                      className={cn(inputClasses, "pr-10")}
                      placeholder="Enter your password"
                    />
                  </FormControl>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={cn(
                      "absolute right-3 top-1/2 -translate-y-1/2",
                      themeConfig.colors.primary[400],
                      `hover:${themeConfig.colors.primary[600]}`,
                      "focus:outline-none"
                    )}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <FormMessage className="text-xs font-medium" />
              </FormItem>
            )}
          />

          {form.formState.errors.root && (
            <div className="text-sm font-medium text-red-500 bg-red-500/10 px-4 py-2.5 rounded-lg">
              {form.formState.errors.root.message}
            </div>
          )}

          <Button 
            type="submit" 
            className={cn(
              "w-full h-11 font-medium",
              themeConfig.components.button.variants.default,
              themeConfig.effects.transition.default,
              "shadow-lg"
            )}
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Signing in...
              </div>
            ) : (
              'Sign In'
            )}
          </Button>
        </CardContent>

        <CardFooter className="px-8 pb-8">
          <div className={cn(
            "w-full text-sm text-center",
            themeConfig.colors.primary[600]
          )}>
            Default credentials:
            <code className={cn(
              "px-2.5 py-1.5 ml-2",
              mode === 'light' ? "bg-black/5" : "bg-white/5",
              "rounded-md font-mono text-xs"
            )}>
              admin / admin123
            </code>
          </div>
        </CardFooter>
      </form>
    </Form>
  );
}
// modules/users/components/user-management/EditUserDialog.tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTheme } from '@/components/theme/context/theme-context';
import { themes } from '@/components/theme/themes';
import { Loader2 } from 'lucide-react';
import { useUserOperations } from '../../hooks/use-user-operations';
import type { User } from '../../types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

const editUserSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must not exceed 20 characters'),
  role: z.enum(['admin', 'user']),
  team: z.string().optional(),
  password: z.string()
    .min(6, 'Password must be at least 6 characters')
    .optional()
    .or(z.literal('')),
  preferences: z.object({
    notifications: z.object({
      configChanges: z.boolean(),
      teamUpdates: z.boolean(),
    }),
  }),
});

type EditUserForm = z.infer<typeof editUserSchema>;

interface EditUserDialogProps {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditUserDialog({ user, open, onOpenChange }: EditUserDialogProps) {
  const { theme } = useTheme();
  const themeConfig = themes[theme];
  const { updateUser } = useUserOperations();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EditUserForm>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      username: user.username,
      role: user.role,
      team: user.team || '',
      password: '',
      preferences: {
        notifications: {
          configChanges: user.preferences.notifications.configChanges,
          teamUpdates: user.preferences.notifications.teamUpdates,
        },
      },
    },
  });

  const onSubmit = async (data: EditUserForm) => {
    try {
      setIsSubmitting(true);
      await updateUser(user.id, {
        ...data,
        // Only include password if it was changed
        ...(data.password ? { password: data.password } : {}),
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update user:', error);
      form.setError('root', { 
        message: error instanceof Error ? error.message : 'Failed to update user' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update user information and preferences.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input 
                      type="password" 
                      placeholder="Leave blank to keep current password" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Only fill this if you want to change the password
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="team"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Team</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter team name (optional)" {...field} />
                  </FormControl>
                  <FormDescription>
                    Team helps organize users and manage permissions
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <h4 className="text-sm font-medium">Notifications</h4>
              
              <FormField
                control={form.control}
                name="preferences.notifications.configChanges"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Configuration Changes
                      </FormLabel>
                      <FormDescription>
                        Get notified when configurations are modified
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="preferences.notifications.teamUpdates"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Team Updates
                      </FormLabel>
                      <FormDescription>
                        Receive notifications about team activities
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            {form.formState.errors.root && (
              <div className="text-sm font-medium text-red-500 bg-red-50 p-3 rounded-md">
                {form.formState.errors.root.message}
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className={themeConfig.components.button.variants.default}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

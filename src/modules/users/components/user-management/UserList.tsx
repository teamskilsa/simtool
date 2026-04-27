// modules/users/components/user-management/UserList.tsx
'use client';

import {
  MoreVertical,
  Edit2,
  Trash2,
  Shield,
  UserCog,
  AlertCircle,
  Users,
} from 'lucide-react';
import { useTheme } from '@/components/theme/context/theme-context';
import { THEME_CHROME_BG } from '@/components/theme/utils/theme-chrome';
import { Skeleton } from '@/components/ui/skeleton';
import type { User } from '../../types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface UserListProps {
  users: User[];
  isLoading: boolean;
  error: string | null;
  onEdit: (user: User) => void;
  onDelete: (userId: string) => Promise<void>;
}

// Dark-safe role badge colours
const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border border-violet-500/20',
  user:  'bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20',
};

function UserSkeleton() {
  return (
    <div className="p-4 rounded-lg border border-border flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Skeleton className="w-10 h-10 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="h-8 w-8 rounded" />
    </div>
  );
}

export function UserList({ users, isLoading, error, onEdit, onDelete }: UserListProps) {
  const { theme } = useTheme();
  const avatarBg = THEME_CHROME_BG[theme] ?? 'bg-indigo-600';
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!userToDelete) return;
    try {
      setIsDeleting(true);
      await onDelete(userToDelete.id);
    } finally {
      setIsDeleting(false);
      setUserToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((n) => <UserSkeleton key={n} />)}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Users className="w-7 h-7 text-muted-foreground" />
        </div>
        <h3 className="text-base font-semibold text-foreground mb-1">No users found</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          No users match your current search or filter criteria.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {users.map((user) => (
          <div
            key={user.id}
            className="p-4 rounded-lg border border-border bg-card flex items-center justify-between hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg ${avatarBg} flex items-center justify-center flex-shrink-0`}>
                <span className="text-white font-medium text-sm">
                  {user.username[0].toUpperCase()}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-foreground">{user.username}</h3>
                  {user.role === 'admin' && (
                    <Shield className="w-3.5 h-3.5 text-violet-500" />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[user.role] ?? ROLE_BADGE.user}`}>
                    {user.role}
                  </span>
                  {user.team && (
                    <span className="text-xs text-muted-foreground">· {user.team}</span>
                  )}
                </div>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 focus-visible:ring-2 focus-visible:ring-ring">
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">User options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover border-border">
                <DropdownMenuItem onClick={() => onEdit(user)}>
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit User
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(user)}>
                  <UserCog className="w-4 h-4 mr-2" />
                  Preferences
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setUserToDelete(user)}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete User
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>

      {/* Delete confirmation */}
      <Dialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <DialogContent className="bg-background border-border">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to delete <strong>{userToDelete?.username}</strong>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setUserToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// modules/users/components/user-management/UserList.tsx
'use client';

import { 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Shield, 
  UserCog,
  AlertCircle
} from 'lucide-react';
import { useTheme } from '@/components/theme/context/theme-context';
import { themes } from '@/components/theme/themes';
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

export function UserList({ users, isLoading, error, onEdit, onDelete }: UserListProps) {
  const { theme } = useTheme();
  const themeConfig = themes[theme];
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
    return <div>Loading...</div>;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {users.map((user) => (
          <div
            key={user.id}
            className={`
              p-4 rounded-lg
              ${themeConfig.surfaces.card.background}
              ${themeConfig.surfaces.card.border}
              flex items-center justify-between
            `}
          >
            <div className="flex items-center space-x-4">
              <div className={`
                w-10 h-10 rounded-lg
                ${themeConfig.components.button.variants.default}
                flex items-center justify-center
              `}>
                <span className="text-white font-medium">
                  {user.username[0].toUpperCase()}
                </span>
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-medium">{user.username}</h3>
                  {user.role === 'admin' && (
                    <Shield className="w-4 h-4 text-purple-500" />
                  )}
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <span className={`
                    px-2 py-0.5 rounded-full text-xs
                    ${user.role === 'admin' 
                      ? 'bg-purple-100 text-purple-700' 
                      : 'bg-blue-100 text-blue-700'
                    }
                  `}>
                    {user.role}
                  </span>
                  {user.team && (
                    <span>• {user.team}</span>
                  )}
                </div>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
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
                  className="text-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete User
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}

        {users.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No users found matching your search criteria
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {userToDelete?.username}? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUserToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

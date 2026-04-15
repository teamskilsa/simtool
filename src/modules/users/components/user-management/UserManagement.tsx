// modules/users/components/user-management/UserManagement.tsx
'use client';

import { useState } from 'react';
import { useTheme } from '@/components/theme/context/theme-context';
import { themes } from '@/components/theme/themes';
import { Plus, Search, Filter } from 'lucide-react';
import { useUserOperations } from '../../hooks/use-user-operations';
import { CreateUserDialog } from './CreateUserDialog';
import { EditUserDialog } from './EditUserDialog';
import { UserList } from './UserList';
import type { User, UserFilters } from '../../types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function UserManagement() {
  const { theme } = useTheme();
  const themeConfig = themes[theme];
  const { users, loading, error, deleteUser } = useUserOperations();
  
  const [filters, setFilters] = useState<UserFilters>({
    role: undefined,
    search: ''
  });
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Filter users based on search term and role
  const filteredUsers = users.filter(user => {
    const matchesSearch = !filters.search || 
      user.username.toLowerCase().includes(filters.search.toLowerCase()) ||
      user.team?.toLowerCase().includes(filters.search.toLowerCase());

    const matchesRole = !filters.role || user.role === filters.role;

    return matchesSearch && matchesRole;
  });

  const handleDelete = async (userId: string) => {
    await deleteUser(userId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">User Management</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage users and their permissions
          </p>
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          className={themeConfig.components.button.variants.default}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* Filters */}
      <div className="flex space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            placeholder="Search users..."
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            className="pl-10"
          />
        </div>
        <Select
          value={filters.role}
          onValueChange={(value: any) => 
            setFilters(prev => ({ ...prev, role: value }))
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={undefined}>All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="user">User</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* User List */}
      <UserList
        users={filteredUsers}
        isLoading={loading}
        error={error}
        onEdit={setEditingUser}
        onDelete={handleDelete}
      />

      {/* Dialogs */}
      <CreateUserDialog 
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />

      {editingUser && (
        <EditUserDialog
          user={editingUser}
          open={!!editingUser}
          onOpenChange={(open) => !open && setEditingUser(null)}
        />
      )}
    </div>
  );
}
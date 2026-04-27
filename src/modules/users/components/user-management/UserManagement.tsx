// modules/users/components/user-management/UserManagement.tsx
'use client';

import { useState } from 'react';
import { useTheme } from '@/components/theme/context/theme-context';
import { THEME_CHROME_BG } from '@/components/theme/utils/theme-chrome';
import { Plus, Search } from 'lucide-react';
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
  const btnBg = THEME_CHROME_BG[theme] ?? 'bg-indigo-600';
  const { users, loading, error, deleteUser } = useUserOperations();

  const [filters, setFilters] = useState<UserFilters>({ role: undefined, search: '' });
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      !filters.search ||
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
      {/* Page header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">User Management</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage users and their permissions
          </p>
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          className={`${btnBg} text-white hover:opacity-90 gap-2 focus-visible:ring-2 focus-visible:ring-ring`}
        >
          <Plus className="w-4 h-4" />
          Add User
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 pointer-events-none" />
          <Input
            placeholder="Search users…"
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            className="pl-9 bg-background border-input"
          />
        </div>
        <Select
          value={filters.role ?? 'all'}
          onValueChange={(v: any) =>
            setFilters((prev) => ({ ...prev, role: v === 'all' ? undefined : v }))
          }
        >
          <SelectTrigger className="w-[160px] bg-background border-input">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="user">User</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <UserList
        users={filteredUsers}
        isLoading={loading}
        error={error}
        onEdit={setEditingUser}
        onDelete={handleDelete}
      />

      {/* Dialogs */}
      <CreateUserDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
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

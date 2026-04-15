// modules/users/components/user-list.tsx
'use client';

import { useState } from 'react';
import { useTheme } from '@/components/theme/context/theme-context';
import { themes } from '@/components/theme/themes';
import { User } from '../types';
import { logActivity } from '../utils/activity-logger';
import { 
  Users, 
  UserPlus, 
  Settings, 
  Activity,
  Search,
  Filter,
  MoreVertical 
} from 'lucide-react';

interface UserListProps {
  users: User[];
  onAddUser: () => void;
  onEditUser: (user: User) => void;
}

export function UserList({ users, onAddUser, onEditUser }: UserListProps) {
  const { theme } = useTheme();
  const themeConfig = themes[theme];
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.team?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUserClick = async (user: User) => {
    setSelectedUser(user);
    await logActivity({
      userId: user.id,
      action: 'view',
      resourceType: 'user',
      resourceId: user.id,
      details: { event: 'user_selected' }
    });
  };

  return (
    <div className={`
      rounded-lg shadow-lg overflow-hidden
      ${themeConfig.surfaces.card.background}
    `}>
      {/* Header */}
      <div className={`
        p-4 border-b
        ${themeConfig.surfaces.card.border}
        flex items-center justify-between
      `}>
        <div className="flex items-center space-x-3">
          <div className={`
            w-8 h-8 rounded-lg
            ${themeConfig.components.button.variants.default}
            flex items-center justify-center
          `}>
            <Users className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-lg font-semibold">User Management</h2>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onAddUser}
            className={`
              flex items-center space-x-2 px-4 py-2 rounded-lg
              ${themeConfig.components.button.variants.default}
            `}
          >
            <UserPlus className="w-4 h-4" />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className={`
        p-4 border-b
        ${themeConfig.surfaces.card.border}
        bg-opacity-50
      `}>
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`
                w-full pl-10 pr-4 py-2 rounded-lg
                ${themeConfig.components.input.variants.default}
              `}
            />
            <Search className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
          </div>
          <button className={`
            p-2 rounded-lg
            ${themeConfig.components.button.variants.outline}
          `}>
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* User List */}
      <div className="divide-y">
        {filteredUsers.map((user) => (
          <div
            key={user.id}
            onClick={() => handleUserClick(user)}
            className={`
              p-4 hover:bg-opacity-50 cursor-pointer
              ${selectedUser?.id === user.id ? themeConfig.surfaces.card.hover : ''}
              transition-colors duration-150
            `}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className={`
                  w-10 h-10 rounded-full
                  ${themeConfig.components.button.variants.default}
                  flex items-center justify-center
                `}>
                  <span className="text-white font-medium">
                    {user.username[0].toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="font-medium">{user.username}</h3>
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <span className={`
                      px-2 py-0.5 rounded-full text-xs
                      ${user.role === 'admin' 
                        ? `${themeConfig.components.badge.variants.default}` 
                        : `${themeConfig.components.badge.variants.secondary}`
                      }
                    `}>
                      {user.role}
                    </span>
                    {user.team && (
                      <span className="text-gray-400">• {user.team}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditUser(user);
                  }}
                  className={`
                    p-2 rounded-lg
                    ${themeConfig.components.button.variants.ghost}
                  `}
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className={`
                    p-2 rounded-lg
                    ${themeConfig.components.button.variants.ghost}
                  `}
                >
                  <Activity className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className={`
                    p-2 rounded-lg
                    ${themeConfig.components.button.variants.ghost}
                  `}
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Activity Timestamp */}
            <div className="mt-2 text-xs text-gray-400">
              Last active: {new Date(user.updatedAt).toLocaleDateString()}
            </div>
          </div>
        ))}

        {filteredUsers.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No users found matching your search criteria.
          </div>
        )}
      </div>
    </div>
  );
}

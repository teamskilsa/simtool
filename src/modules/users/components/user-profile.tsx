// modules/users/components/user-profile.tsx
'use client';

import { useUser } from '../context/user-context';
import { useTheme } from '@/components/theme/context/theme-context';
import { themes } from '@/components/theme/themes';
import { 
  User,
  Settings,
  Bell,
  Shield,
  Lock
} from 'lucide-react';

export function UserProfile() {
  const { user, updatePreferences } = useUser();
  const { theme } = useTheme();
  const themeConfig = themes[theme];

  if (!user) return null;

  return (
    <div className={`
      rounded-lg shadow-lg overflow-hidden
      ${themeConfig.surfaces.card.background}
    `}>
      {/* Header */}
      <div className={`p-6 ${themeConfig.components.button.variants.default}`}>
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
            <User className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">{user.username}</h2>
            <div className="flex items-center space-x-2 mt-1">
              <span className="text-white/70">{user.role}</span>
              {user.team && (
                <>
                  <span className="text-white/50">•</span>
                  <span className="text-white/70">{user.team}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Theme Settings */}
        <section>
          <div className="flex items-center space-x-2 mb-4">
            <Settings className="w-5 h-5" />
            <h3 className="text-lg font-semibold">Theme & Visibility</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Theme</label>
              <select
                value={user.preferences.theme}
                onChange={(e) => updatePreferences({ theme: e.target.value })}
                className={`
                  w-full px-3 py-2 rounded-lg
                  ${themeConfig.components.input.variants.default}
                `}
              >
                <option value="indigo">Indigo</option>
                <option value="rose">Rose</option>
                <option value="amber">Amber</option>
                <option value="emerald">Emerald</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Default Visibility</label>
              <select
                value={user.preferences.defaultVisibility}
                onChange={(e) => updatePreferences({ 
                  defaultVisibility: e.target.value as 'private' | 'team' | 'public' 
                })}
                className={`
                  w-full px-3 py-2 rounded-lg
                  ${themeConfig.components.input.variants.default}
                `}
              >
                <option value="private">Private</option>
                <option value="team">Team</option>
                <option value="public">Public</option>
              </select>
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section>
          <div className="flex items-center space-x-2 mb-4">
            <Bell className="w-5 h-5" />
            <h3 className="text-lg font-semibold">Notifications</h3>
          </div>
          
          <div className="space-y-3">
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={user.preferences.notifications.configChanges}
                onChange={(e) => updatePreferences({
                  notifications: {
                    ...user.preferences.notifications,
                    configChanges: e.target.checked
                  }
                })}
                className="rounded"
              />
              <span className="text-sm">Configuration Changes</span>
            </label>

            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={user.preferences.notifications.teamUpdates}
                onChange={(e) => updatePreferences({
                  notifications: {
                    ...user.preferences.notifications,
                    teamUpdates: e.target.checked
                  }
                })}
                className="rounded"
              />
              <span className="text-sm">Team Updates</span>
            </label>
          </div>
        </section>

        {/* Security */}
        <section>
          <div className="flex items-center space-x-2 mb-4">
            <Shield className="w-5 h-5" />
            <h3 className="text-lg font-semibold">Security</h3>
          </div>
          
          <button
            className={`
              flex items-center space-x-3 px-4 py-2 w-full rounded-lg
              ${themeConfig.components.button.variants.outline}
            `}
          >
            <Lock className="w-4 h-4" />
            <span>Change Password</span>
          </button>
        </section>
      </div>
    </div>
  );
}

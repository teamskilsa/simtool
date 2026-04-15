# User Management System

## Large Components to be Implemented Manually

The following components should be implemented manually due to their complexity:

1. `components/user-list.tsx` - User management interface for admins
2. `components/user-profile.tsx` - User profile management
3. `components/visibility/config-visibility.tsx` - Configuration visibility controls
4. `context/user-context.tsx` - Main user context provider
5. `context/auth-persist.tsx` - Authentication persistence logic

Please refer to the documentation for implementation details of these components.

## Integration Steps

1. Add UserProvider to your app layout:
```tsx
import { UserProvider } from '@/modules/users/context/user-context';

export default function RootLayout({ children }) {
  return (
    <UserProvider>
      {children}
    </UserProvider>
  );
}
```

2. Add AuthPersistProvider to your app:
```tsx
import { AuthPersistProvider } from '@/modules/users/context/auth-persist';

export default function App({ children }) {
  return (
    <AuthPersistProvider>
      {children}
    </AuthPersistProvider>
  );
}
```

3. Use the hooks in your components:
```tsx
import { useUser } from '@/modules/users/context/user-context';
import { useVisibility } from '@/modules/users/hooks/use-visibility';
```

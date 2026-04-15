import { useState, useCallback } from 'react';

interface UseDialogOptions {
  onOpen?: () => void;
  onClose?: () => void;
}

export function useDialog(options: UseDialogOptions = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(() => {
    setIsOpen(true);
    options.onOpen?.();
  }, [options]);

  const close = useCallback(() => {
    setIsOpen(false);
    setError(null);
    options.onClose?.();
  }, [options]);

  const handleSubmit = useCallback(async <T>(
    handler: () => Promise<T>
  ): Promise<T | undefined> => {
    try {
      setLoading(true);
      setError(null);
      const result = await handler();
      close();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return undefined;
    } finally {
      setLoading(false);
    }
  }, [close]);

  return {
    isOpen,
    loading,
    error,
    open,
    close,
    setError,
    handleSubmit
  };
}

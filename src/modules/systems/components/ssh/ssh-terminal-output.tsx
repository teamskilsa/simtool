// modules/systems/components/ssh/ssh-terminal-output.tsx
import { useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export function SSHTerminalOutput({ loading, output }: SSHTerminalOutputProps) {
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  return (
    <div 
      ref={outputRef}
      className="h-full w-full overflow-y-auto p-4 font-mono text-sm 
                 bg-black text-green-400 dark:bg-gray-900"
      style={{
        fontFamily: '"JetBrains Mono", "Fira Code", monospace'
      }}
    >
      {loading && (
        <div className="flex items-center gap-2 text-green-400/70 mb-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Connecting...</span>
        </div>
      )}
      {output.map((line, i) => (
        <div 
          key={i} 
          className={`
            leading-relaxed mb-1
            ${line.startsWith('$') ? 'text-cyan-400 font-semibold mt-2' : ''}
            ${line.startsWith('Error:') ? 'text-red-400' : ''}
            ${!line.startsWith('$') ? 'whitespace-pre-wrap break-all' : ''}
          `}
        >
          {line}
        </div>
      ))}
    </div>
  );
}
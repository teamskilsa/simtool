// src/modules/testExecution/components/DebugConfigView.tsx
import { useConfigs } from '../context/ConfigContext/ConfigContext';

export function DebugConfigView() {
  const { configs, loading, error } = useConfigs();
  
  return (
    <div className="p-4 bg-gray-50 rounded-lg text-sm font-mono">
      <h3 className="font-bold mb-2">Config Debug Info</h3>
      <div>
        <p>Loading: {loading.toString()}</p>
        <p>Error: {error?.message || 'None'}</p>
        <p>Available Modules: {Object.keys(configs).join(', ')}</p>
        <div className="mt-2">
          <p>Config Counts:</p>
          {Object.entries(configs).map(([module, moduleConfigs]) => (
            <p key={module}>- {module}: {moduleConfigs.length} configs</p>
          ))}
        </div>
        
        <div className="mt-4">
          <p>Raw Config Data:</p>
          <pre className="text-xs mt-1 overflow-auto max-h-40">
            {JSON.stringify(configs, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
// app/scenarios/edit/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ScenarioCreator } from '@/modules/testExecution/components/ScenarioCreator';
import { useToast } from '@/components/ui/use-toast';

export default function EditScenarioPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { toast } = useToast();
  const [scenario, setScenario] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadScenario() {
      try {
        const response = await fetch(`/api/scenarios/${params.id}`);
        if (!response.ok) throw new Error('Failed to load scenario');
        const data = await response.json();
        setScenario(data);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load scenario",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    }

    loadScenario();
  }, [params.id]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!scenario) {
    return <div>Scenario not found</div>;
  }

  return (
    <div className="container max-w-5xl py-6">
      <h1 className="text-2xl font-bold mb-6">Edit Scenario</h1>
      <ScenarioCreator 
        initialData={scenario}
        onSave={() => router.push('/scenarios')}
      />
    </div>
  );
}
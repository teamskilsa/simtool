// src/modules/testExecution/views/Results/ResultsView.tsx
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { resultsService } from '../../services';

export const ResultsView: React.FC = () => {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchResults();
  }, []);

  const fetchResults = async () => {
    try {
      setLoading(true);
      const data = await resultsService.getResults();
      setResults(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch results',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const resultIds = results.map(r => r.id);
      const blob = await resultsService.exportResults(resultIds);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'test-results.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Success',
        description: 'Results exported successfully'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to export results',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Test Results</h1>
        <Button onClick={handleExport} disabled={loading || results.length === 0}>
          <Download className="w-4 h-4 mr-2" />
          Export Results
        </Button>
      </div>

      <Card className="p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : results.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No test results available
          </div>
        ) : (
          // Results table or grid here
          <div>Results will be displayed here</div>
        )}
      </Card>
    </div>
  );
};
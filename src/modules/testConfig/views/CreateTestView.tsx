// src/modules/testConfig/views/CreateTestView.tsx
import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/theme/context/theme-context';
import { themes } from '@/components/theme/themes';
import { Plus, Download } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ConfigEditor } from '../components/ConfigEditor';

export const CreateTestView: React.FC = () => {
  const { theme } = useTheme();
  const themeConfig = themes[theme];

  return (
    <div className="flex-1 p-6 space-y-6">
      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-xl font-semibold">Create Test</h2>
          <div className="flex items-center space-x-3">
            <Button variant="secondary" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Import Template
            </Button>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Create Test
            </Button>
          </div>
        </div>

        <div className="p-6">
          <Tabs defaultValue="config" className="space-y-4">
            <TabsList>
              <TabsTrigger value="config">Configuration</TabsTrigger>
              <TabsTrigger value="parameters">Parameters</TabsTrigger>
              <TabsTrigger value="validation">Validation</TabsTrigger>
            </TabsList>

            <TabsContent value="config" className="space-y-4">
              <TooltipProvider>
                <ConfigEditor
                  config={null}
                  content=""
                  onChange={() => {}}
                  readOnly={false}
                />
              </TooltipProvider>
            </TabsContent>

            <TabsContent value="parameters">
              <Card className="p-4">
                <p className="text-muted-foreground">
                  Test parameters configuration will be implemented here.
                </p>
              </Card>
            </TabsContent>

            <TabsContent value="validation">
              <Card className="p-4">
                <p className="text-muted-foreground">
                  Test validation rules will be implemented here.
                </p>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </Card>
    </div>
  );
};
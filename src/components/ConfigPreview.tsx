import React from 'react';
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ConfigPreviewProps {
  children?: React.ReactNode;
}

export const ConfigPreview: React.FC<ConfigPreviewProps> = ({ children }) => {
  return (
    <Card className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Configuration</h2>
        <div className="space-x-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Load</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Load Configuration</DialogTitle>
              </DialogHeader>
              {/* Load dialog content */}
            </DialogContent>
          </Dialog>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="default">Save</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save Configuration</DialogTitle>
              </DialogHeader>
              {/* Save dialog content */}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Separator />

      <Tabs defaultValue="general" className="w-full">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
          <TabsTrigger value="theme">Theme</TabsTrigger>
        </TabsList>
        <TabsContent value="general">
          {/* General settings content */}
        </TabsContent>
        <TabsContent value="advanced">
          {/* Advanced settings content */}
        </TabsContent>
        <TabsContent value="theme">
          {/* Theme settings content */}
        </TabsContent>
      </Tabs>

      {children}
    </Card>
  );
};

export default ConfigPreview;

// File: src/modules/statLogs/components/enb/EnbTestPage.tsx
import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import EnbStats from './EnbStats';  // Import directly
import type { EnbStats as EnbStatsType } from '../../types/enb.types';

export default function EnbTestPage(): JSX.Element {
  const [ip, setIp] = useState('192.168.86.28');  // Updated default IP
  const [isConfigured, setIsConfigured] = useState(false);

  const handleStatsUpdate = (stats: EnbStatsType) => {
    console.log('Stats Update:', stats);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>ENB Stats Monitor</CardTitle>
        </CardHeader>
        <CardContent>
          {!isConfigured ? (
            <div className="flex gap-4 items-center">
              <Input
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                placeholder="Enter ENB IP address"
                className="max-w-xs"
              />
              <Button 
                onClick={() => setIsConfigured(true)}
                disabled={!ip}
              >
                Connect
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm">Monitoring ENB at: {ip}</p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsConfigured(false)}
                >
                  Change IP
                </Button>
              </div>
              
              <EnbStats
                ip={ip}
                pollInterval={5000}
                onStatsUpdate={handleStatsUpdate}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
// UE-summary donut card, matching Simnovator's Statistics → Global header row:
// a ring with the total in the centre and a legend of "label — count" rows.
'use client';

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/card';
import { Kicker } from '@/components/ui/stat';
import type { SummaryDonut } from './statsModel';

export function Donut({ donut }: { donut: SummaryDonut }) {
  const segments = donut.segments.filter(s => s.value > 0);
  // An all-zero donut still needs a ring to draw, so fall back to a single
  // slate track rather than an empty SVG.
  const data = segments.length ? segments : [{ label: 'none', value: 1, color: '#8FA9B3' }];

  return (
    <Card accent className="p-4">
      <Kicker>{donut.title}</Kicker>
      <div className="mt-2 flex items-center gap-3">
        <div className="relative h-[104px] w-[104px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                innerRadius={34}
                outerRadius={50}
                startAngle={90}
                endAngle={-270}
                stroke="none"
                isAnimationActive={false}
              >
                {data.map((s, i) => <Cell key={i} fill={s.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="num text-lg font-bold leading-none">{donut.total}</span>
            <span className="text-[10px] text-muted-foreground">Total</span>
          </div>
        </div>

        <ul className="min-w-0 flex-1 space-y-1">
          {donut.segments.map(s => (
            <li key={s.label} className="flex items-center gap-2 text-xs">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{s.label}</span>
              <span className="num shrink-0 font-semibold">{s.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

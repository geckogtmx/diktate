'use client';

import React, { useState, useEffect } from 'react';
import { Container } from './Container';
import { useScrollReveal } from '@/lib/animations/useScrollReveal';
import { SectionHeading } from './SectionHeading';

const comparisonData = [
  {
    metric: 'Privacy',
    diktate: '100% Local',
    others: 'Sent to servers',
  },
  {
    metric: 'Speed',
    diktate: '~3 seconds',
    others: '6-12 seconds',
  },
  {
    metric: 'Consistency',
    diktate: 'Hardware-Bound',
    others: 'Varies by day',
  },
  {
    metric: 'Censorship',
    diktate: 'Zero Restrictions',
    others: 'Aggressive Filtering',
  },
  {
    metric: 'Cost',
    diktate: '$25 once',
    others: '$240/year',
  },
  {
    metric: 'Word Limits',
    diktate: 'Unlimited',
    others: 'Capped at 60k',
  },
  {
    metric: 'Offline Use',
    diktate: 'Works in a Bunker',
    others: 'Requires WiFi',
  },
];

export function VersusSection() {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.1 });
  const [visibleRows, setVisibleRows] = useState<boolean[]>([]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const timeouts: NodeJS.Timeout[] = [];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisibleRows(Array(comparisonData.length).fill(false));

    comparisonData.forEach((_, index) => {
      const timeout = setTimeout(() => {
        setVisibleRows((prev) => {
          const newRows = [...prev];
          newRows[index] = true;
          return newRows;
        });
      }, index * 100);
      timeouts.push(timeout);
    });

    return () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [isVisible]);

  return (
    <section
      id="comparison"
      ref={ref}
      className="py-20 sm:py-32 relative overflow-hidden"
    >
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-orange-900/10 to-transparent" />
      </div>

      <Container>
        <SectionHeading
          title="vs The Others"
          description="See how dIKtate compares to Dragon, Talon, and other dictation tools"
          centered
          className="mb-16 sm:mb-24"
        />

        <div className="max-w-4xl mx-auto overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-4 px-4 text-gray-400 font-semibold">Metric</th>
                <th className="text-left py-4 px-4 text-blue-300 font-semibold">dIKtate</th>
                <th className="text-left py-4 px-4 text-gray-400 font-semibold">The Others</th>
              </tr>
            </thead>
            <tbody>
              {comparisonData.map((row, index) => (
                <tr
                  key={row.metric}
                  className={`border-b border-white/5 transition-all duration-500 ${
                    visibleRows[index]
                      ? 'opacity-100'
                      : 'opacity-0'
                  }`}
                >
                  <td className="py-4 px-4 text-white font-medium">{row.metric}</td>
                  <td className="py-4 px-4 text-green-400">✓ {row.diktate}</td>
                  <td className="py-4 px-4 text-red-400">✗ {row.others}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Container>
    </section>
  );
}

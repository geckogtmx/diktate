'use client';

import React, { useState } from 'react';
import { Container } from './Container';
import { PricingCard } from './PricingCard';
import { SectionHeading } from './SectionHeading';
import { useScrollReveal } from '@/lib/animations/useScrollReveal';
import { Button } from './Button';

const pricingTiers = [
  {
    tier: 'Barebones Local',
    price: '10',
    description: 'The essentials',
    features: [
      'Dictation Mode',
      'Local-only processing',
      'No telemetry',
      'Easy installer',
      'Community support',
    ],
    cta: 'Download',
    ctaHref: '#download',
  },
  {
    tier: 'Power Version',
    price: '25',
    description: 'Unlock everything',
    features: [
      'All Barebones features',
      'Ask Mode (LLM)',
      'Refine Mode (editing)',
      'Bilingual translation',
      'Context modes',
      'Voice macros',
      'Custom API key support',
      'Priority email support',
    ],
    featured: true,
    cta: 'Get Power',
    ctaHref: '#download',
  },
  {
    tier: 'Build It Yourself',
    price: '0',
    description: 'Full source access',
    features: [
      'Complete source code',
      'MIT License',
      'Learning resources',
      'Community fork rights',
      'Compile from source',
      'Full customization',
    ],
    cta: 'View on GitHub',
    ctaHref: 'https://github.com/geckogtmx/diktate',
  },
];

interface Feature {
  name: string;
  barebones: boolean;
  power: boolean;
  diy: boolean;
}

const allFeatures: Feature[] = [
  { name: 'Dictation Mode', barebones: true, power: true, diy: true },
  { name: 'Ask Mode', barebones: false, power: true, diy: true },
  { name: 'Refine Mode', barebones: false, power: true, diy: true },
  { name: 'Structured Notes', barebones: false, power: true, diy: true },
  { name: 'Bilingual (EN↔ES)', barebones: false, power: true, diy: true },
  { name: 'Context Modes', barebones: false, power: true, diy: true },
  { name: 'Voice Macros', barebones: false, power: true, diy: true },
  { name: 'Custom API Keys', barebones: false, power: true, diy: true },
  { name: 'Encryption', barebones: true, power: true, diy: true },
  { name: 'Privacy Guard', barebones: true, power: true, diy: true },
  { name: 'Offline Support', barebones: true, power: true, diy: true },
  { name: 'Hotkey Customization', barebones: true, power: true, diy: true },
  { name: 'Cloud Trial Credits', barebones: false, power: true, diy: false },
  { name: 'Priority Support', barebones: false, power: true, diy: false },
];

export function PricingSection() {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.1 });
  const [showAllFeatures, setShowAllFeatures] = useState(false);

  return (
    <section
      id="pricing"
      ref={ref}
      className="py-20 sm:py-32 relative overflow-hidden"
    >
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-900/10 to-transparent" />
      </div>

      <Container>
        <SectionHeading
          title="Simple, Transparent Pricing"
          description="No subscriptions. No hidden fees. Choose what works for you."
          centered
          className="mb-16 sm:mb-24"
        />

        {/* Pricing Cards */}
        <div className={`grid grid-cols-1 md:grid-cols-3 gap-8 mb-16 transition-all duration-700 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}>
          {pricingTiers.map((tier) => (
            <PricingCard key={tier.tier} {...tier} />
          ))}
        </div>

        {/* See All Features Button */}
        <div className="text-center mb-16">
          <Button
            onClick={() => setShowAllFeatures(!showAllFeatures)}
            variant="outline"
            size="lg"
          >
            {showAllFeatures ? 'Hide' : 'See'} all 45+ features
          </Button>
        </div>

        {/* All Features Table */}
        {showAllFeatures && (
          <div className={`max-w-4xl mx-auto overflow-x-auto transition-all duration-500 ${
            showAllFeatures ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-4 px-4 text-gray-400 font-semibold">Feature</th>
                  <th className="text-center py-4 px-4 text-gray-400 font-semibold">Barebones</th>
                  <th className="text-center py-4 px-4 text-blue-300 font-semibold">Power</th>
                  <th className="text-center py-4 px-4 text-gray-400 font-semibold">DIY</th>
                </tr>
              </thead>
              <tbody>
                {allFeatures.map((feature) => (
                  <tr key={feature.name} className="border-b border-white/5">
                    <td className="py-4 px-4 text-white">{feature.name}</td>
                    <td className="text-center py-4 px-4">
                      {feature.barebones ? (
                        <span className="text-green-400">✓</span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="text-center py-4 px-4">
                      {feature.power ? (
                        <span className="text-green-400">✓</span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="text-center py-4 px-4">
                      {feature.diy ? (
                        <span className="text-green-400">✓</span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Container>
    </section>
  );
}

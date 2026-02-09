'use client';

import React, { useState, useEffect } from 'react';
import { Container } from './Container';
import { SpecCard } from './SpecCard';
import { useScrollReveal } from '@/lib/animations/useScrollReveal';
import { SectionHeading } from './SectionHeading';

const group1Specs = [
  { icon: '🎙️', title: 'Whisper V3', description: 'State-of-the-art speech recognition' },
  { icon: '🤖', title: 'Local Models', description: 'Run entirely on your machine' },
  { icon: '⌨️', title: 'Global Hotkeys', description: 'Instant activation from anywhere' },
  { icon: '🎯', title: 'Precision Injection', description: 'Inject text exactly where your cursor is' },
  { icon: '⚡', title: 'Four Modes', description: 'Dictate, Ask, Refine, Structured Notes' },
  { icon: '☁️', title: 'Cloud Bridge', description: 'Optional cloud backup for trial credits' },
  { icon: '🔓', title: 'API Freedom', description: 'Use any LLM provider (local or cloud)' },
  { icon: '🌍', title: 'Translation', description: 'Bilingual support out of the box' },
];

const group2Specs = [
  { icon: '🔐', title: 'Privacy Guard', description: 'Your data never leaves your computer' },
  { icon: '🔒', title: 'Encrypted Storage', description: 'All local data is encrypted' },
  { icon: '💬', title: 'Floating Pill', description: 'Minimal UI that stays out of the way' },
  { icon: '📦', title: 'Self-Contained Binary', description: 'One executable, no dependencies' },
  { icon: '🎙️', title: 'Voice Macros (v2.0)', description: 'Program voice commands in Python' },
  { icon: '🔄', title: 'Model Agnostic', description: 'Switch models without reconfiguring' },
  { icon: '🎯', title: 'Smart Fallback', description: 'Automatic failover to backup providers' },
  { icon: '🔧', title: 'Hackable Core', description: 'Open source, fully customizable' },
];

export function SpecsSection() {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.1 });
  const [activeGroup, setActiveGroup] = useState(1);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const interval = setInterval(() => {
      setActiveGroup((prev) => (prev === 1 ? 2 : 1));
    }, 6000);
    return () => clearInterval(interval);
  }, [isVisible]);

  const specs = activeGroup === 1 ? group1Specs : group2Specs;

  return (
    <section
      ref={ref}
      className="py-20 sm:py-32 relative overflow-hidden"
    >
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-900/5 via-transparent to-blue-900/5" />
      </div>

      <Container>
        <SectionHeading
          title="45+ Features"
          description="Everything you need to revolutionize your workflow"
          centered
          className="mb-16 sm:mb-24"
        />

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {specs.map((spec) => (
            <SpecCard
              key={spec.title}
              {...spec}
              isVisible={isVisible}
            />
          ))}
        </div>

        {/* Group Toggle */}
        <div className="flex justify-center gap-3 items-center mt-12">
          <button
            onClick={() => setActiveGroup(1)}
            className={`w-3 h-3 rounded-full transition-all ${
              activeGroup === 1
                ? 'bg-blue-500 w-8 h-3'
                : 'bg-gray-600 hover:bg-gray-500'
            }`}
            aria-label="Show group 1"
          />
          <button
            onClick={() => setActiveGroup(2)}
            className={`w-3 h-3 rounded-full transition-all ${
              activeGroup === 2
                ? 'bg-blue-500 w-8 h-3'
                : 'bg-gray-600 hover:bg-gray-500'
            }`}
            aria-label="Show group 2"
          />
        </div>
      </Container>
    </section>
  );
}

'use client';

import React from 'react';
import { Container } from './Container';
import { FeatureCard } from './FeatureCard';
import { useScrollReveal } from '@/lib/animations/useScrollReveal';
import { SectionHeading } from './SectionHeading';

const features = [
  {
    number: '01',
    title: 'Dictate',
    description: 'Transform your voice into perfect text. Use it everywhere - emails, documents, code.',
    hotkey: 'Ctrl+Alt+D',
    icon: '🎤',
  },
  {
    number: '02',
    title: 'Ask',
    description: 'Query your AI assistant with a voice command. Get instant answers without typing.',
    hotkey: 'Ctrl+Alt+A',
    icon: '💬',
  },
  {
    number: '03',
    title: 'Refine',
    description: 'Edit and improve your text with AI. Fix grammar, rephrase, or change tone.',
    hotkey: 'Ctrl+Alt+R',
    icon: '✨',
  },
  {
    number: '04',
    title: 'Structured Notes',
    description: 'Record timestamped notes that your AI organizes automatically.',
    hotkey: 'Ctrl+Alt+N',
    icon: '📝',
  },
];

export function CoreArsenalSection() {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.1 });

  return (
    <section
      id="features"
      ref={ref}
      className="py-20 sm:py-32 relative overflow-hidden"
    >
      <Container>
        <SectionHeading
          title="The Core Arsenal"
          description="Four powerful modes to supercharge your workflow"
          centered
          className="mb-16 sm:mb-24"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {features.map((feature, index) => (
            <FeatureCard
              key={feature.number}
              {...feature}
              isVisible={isVisible && index < 2}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mt-8">
          {features.slice(2).map((feature, index) => (
            <FeatureCard
              key={feature.number}
              {...feature}
              isVisible={isVisible && index < 2}
            />
          ))}
        </div>

        {/* Progress Indicator */}
        <div className="mt-16 flex justify-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 opacity-30" />
          <div className="w-2 h-2 rounded-full bg-blue-500 opacity-30" />
        </div>
      </Container>
    </section>
  );
}

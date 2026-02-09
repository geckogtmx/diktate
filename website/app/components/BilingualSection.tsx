'use client';

import React from 'react';
import { Container } from './Container';
import { GlassCard } from './GlassCard';
import { useScrollReveal } from '@/lib/animations/useScrollReveal';
import { useTypewriter } from '@/lib/animations/useTypewriter';

export function BilingualSection() {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.2 });
  const { displayedText } = useTypewriter({
    text: '¿Cuál es la capital de Madagascar?',
    speed: 30,
    startAnimation: isVisible,
  });

  return (
    <section ref={ref} className="py-20 sm:py-32 relative overflow-hidden">
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: Text */}
          <div className={`transition-all duration-700 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}`}>
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
              Bilingual Mastery
            </h2>
            <p className="text-lg text-gray-400 mb-6">
              Seamlessly switch between languages. dIKtate understands context and delivers accurate translations without API calls.
            </p>
            <ul className="space-y-3">
              <li className="flex gap-3 items-start">
                <span className="text-green-400 mt-1">✓</span>
                <span className="text-gray-300">No API keys needed - everything happens locally</span>
              </li>
              <li className="flex gap-3 items-start">
                <span className="text-green-400 mt-1">✓</span>
                <span className="text-gray-300">English to Spanish (and more coming)</span>
              </li>
              <li className="flex gap-3 items-start">
                <span className="text-green-400 mt-1">✓</span>
                <span className="text-gray-300">Context-aware translations that understand idioms</span>
              </li>
            </ul>
          </div>

          {/* Right: Demo Card */}
          <div className={`transition-all duration-700 delay-100 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}>
            <GlassCard glow>
              <div className="space-y-6">
                {/* Input */}
                <div>
                  <div className="text-sm text-gray-500 mb-2">Spanish Input:</div>
                  <div className="font-mono text-blue-300">
                    {displayedText}
                    <span className="animate-pulse">|</span>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex justify-center">
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m0 0l4 4m10-4v12m0 0l4-4m0 0l-4-4" />
                  </svg>
                </div>

                {/* Output */}
                <div>
                  <div className="text-sm text-gray-500 mb-2">English Output:</div>
                  <div className="font-mono text-green-300">
                    What is the capital of Madagascar?
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      </Container>
    </section>
  );
}

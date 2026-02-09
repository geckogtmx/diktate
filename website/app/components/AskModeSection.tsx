'use client';

import React from 'react';
import { Container } from './Container';
import { GlassCard } from './GlassCard';
import { useScrollReveal } from '@/lib/animations/useScrollReveal';

export function AskModeSection() {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.2 });

  return (
    <section ref={ref} className="py-20 sm:py-32 relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-900/10 to-transparent" />
      </div>

      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: Demo Card */}
          <div className={`transition-all duration-700 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}`}>
            <GlassCard glow>
              <div className="space-y-6">
                {/* Input */}
                <div>
                  <div className="text-sm text-gray-500 mb-2">Voice Input:</div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      <div className="w-1 h-6 bg-blue-400 rounded-full animate-pulse" />
                      <div className="w-1 h-8 bg-blue-400 rounded-full animate-pulse delay-100" />
                      <div className="w-1 h-6 bg-blue-400 rounded-full animate-pulse delay-200" />
                    </div>
                    <span className="text-blue-300 font-mono">What is the capital of Madagascar?</span>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex justify-center">
                  <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m0 0l4 4m10-4v12m0 0l4-4m0 0l-4-4" />
                  </svg>
                </div>

                {/* Output */}
                <div>
                  <div className="text-sm text-gray-500 mb-2">AI Response:</div>
                  <div className="font-mono text-green-300">
                    Antananarivo, ~4.4M people
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>

          {/* Right: Text */}
          <div className={`transition-all duration-700 delay-100 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}>
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
              Ask Your AI
            </h2>
            <p className="text-lg text-gray-400 mb-6">
              Get instant answers without typing. Ask questions with your voice and get responses in milliseconds.
            </p>
            <ul className="space-y-3">
              <li className="flex gap-3 items-start">
                <span className="text-green-400 mt-1">✓</span>
                <span className="text-gray-300">Microphone input to instant answers</span>
              </li>
              <li className="flex gap-3 items-start">
                <span className="text-green-400 mt-1">✓</span>
                <span className="text-gray-300">Works with local models or your API key</span>
              </li>
              <li className="flex gap-3 items-start">
                <span className="text-green-400 mt-1">✓</span>
                <span className="text-gray-300">Automatic clipboard copy of responses</span>
              </li>
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
}

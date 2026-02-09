'use client';

import React from 'react';
import { Container } from './Container';
import { GlassCard } from './GlassCard';
import { useScrollReveal } from '@/lib/animations/useScrollReveal';

export function TokensSection() {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.2 });

  return (
    <section ref={ref} className="py-20 sm:py-32 relative overflow-hidden">
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: Text */}
          <div className={`transition-all duration-700 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}`}>
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
              Your Tokens, Your Choice
            </h2>
            <p className="text-lg text-gray-400 mb-6">
              Complete control over your AI provider. Use local models, or bring your own API keys.
            </p>
            <ul className="space-y-3">
              <li className="flex gap-3 items-start">
                <span className="text-green-400 mt-1">✓</span>
                <span className="text-gray-300">Switch between Ollama, Anthropic, Google, OpenAI</span>
              </li>
              <li className="flex gap-3 items-start">
                <span className="text-green-400 mt-1">✓</span>
                <span className="text-gray-300">Encryption enabled - keys never leave your machine</span>
              </li>
              <li className="flex gap-3 items-start">
                <span className="text-green-400 mt-1">✓</span>
                <span className="text-gray-300">Pay only for what you use, no subscriptions</span>
              </li>
            </ul>
          </div>

          {/* Right: Demo Card */}
          <div className={`transition-all duration-700 delay-100 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}>
            <GlassCard glow>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">LLM Provider</span>
                  <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>

                <div className="space-y-2">
                  <div className="p-3 rounded-lg bg-blue-500/20 border border-blue-500/30">
                    <div className="text-sm font-mono text-blue-300">Ollama (Local)</div>
                    <div className="text-xs text-gray-400 mt-1">Running on port 11434</div>
                  </div>

                  <div className="p-3 rounded-lg bg-gray-700/20 border border-gray-600/30 opacity-60">
                    <div className="text-sm font-mono text-gray-400">Anthropic Claude</div>
                    <div className="text-xs text-gray-500 mt-1">API key required</div>
                  </div>

                  <div className="p-3 rounded-lg bg-gray-700/20 border border-gray-600/30 opacity-60">
                    <div className="text-sm font-mono text-gray-400">Google Gemini</div>
                    <div className="text-xs text-gray-500 mt-1">API key required</div>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414L8.586 5 5.293 1.707a1 1 0 011.414-1.414L10 3.586l3.293-3.293a1 1 0 111.414 1.414L11.414 5l3.293 3.293a1 1 0 01-1.414 1.414L10 6.414l-3.293 3.293a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-xs text-green-400">Encryption enabled</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    Keys never leave this machine
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

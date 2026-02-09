'use client';

import React, { useState, useEffect } from 'react';
import { Container } from './Container';
import { Button } from './Button';

const words = ['TALKING', 'THINKING', 'WORKING', 'WINNING'];

export function HeroSection() {
  const [currentWord, setCurrentWord] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentWord((prev) => (prev + 1) % words.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-900/20 via-transparent to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl opacity-40" />
      </div>

      <Container className="relative">
        <div className="text-center">
          {/* Badge */}
          <div className="inline-block mb-8 px-4 py-2 rounded-full border border-blue-500/30 bg-blue-500/10 backdrop-blur">
            <p className="text-sm font-semibold text-blue-300">
              ✨ LOCAL. PRIVATE. NO SUBSCRIPTIONS.
            </p>
          </div>

          {/* Main Heading with Word Carousel */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-6 leading-tight">
            <span className="text-white">Your AI is</span>
            <br />
            <span className="min-h-[1.2em] inline-block">
              <span className="text-blue-400 transition-all duration-500 inline-block">
                {words[currentWord]}
              </span>
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed">
            The fastest voice dictation for Windows. Local AI means no cloud, no lag, and complete privacy.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button href="#" variant="secondary" size="lg">
              Download for Windows
            </Button>
            <Button href="/login" variant="outline" size="lg">
              Try Online Dashboard
            </Button>
          </div>

          {/* Platform Badges */}
          <div className="flex flex-wrap justify-center gap-3 text-sm">
            <div className="px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700/50 text-gray-300">
              💻 macOS Coming Soon
            </div>
            <div className="px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700/50 text-gray-300">
              📱 iOS Coming Soon
            </div>
            <div className="px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700/50 text-gray-300">
              🤖 Android Coming Soon
            </div>
          </div>

          {/* Scroll Indicator */}
          <div className="mt-20 animate-bounce">
            <svg
              className="w-6 h-6 mx-auto text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </div>
        </div>
      </Container>
    </section>
  );
}

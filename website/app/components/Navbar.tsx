'use client';

import React, { useState } from 'react';
import { Button } from './Button';
import { Container } from './Container';

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 w-full bg-black/40 backdrop-blur-lg border-b border-white/10 z-50">
      <Container className="py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="text-2xl font-bold text-blue-400">dIKtate</div>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-gray-300 hover:text-white transition">
              Features
            </a>
            <a href="#comparison" className="text-gray-300 hover:text-white transition">
              vs Others
            </a>
            <a href="#pricing" className="text-gray-300 hover:text-white transition">
              Pricing
            </a>
            <a href="/docs" className="text-gray-300 hover:text-white transition">
              Docs
            </a>
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-4">
            <Button href="/login" variant="outline" size="sm">
              Sign In
            </Button>
            <Button href="#download" variant="secondary" size="sm">
              Download
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-gray-300 hover:text-white"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-4 pt-4 border-t border-white/10 space-y-4">
            <a href="#features" className="block text-gray-300 hover:text-white transition">
              Features
            </a>
            <a href="#comparison" className="block text-gray-300 hover:text-white transition">
              vs Others
            </a>
            <a href="#pricing" className="block text-gray-300 hover:text-white transition">
              Pricing
            </a>
            <a href="/docs" className="block text-gray-300 hover:text-white transition">
              Docs
            </a>
            <div className="flex gap-3 pt-4">
              <Button href="/login" variant="outline" size="sm" className="flex-1 text-center">
                Sign In
              </Button>
              <Button href="#download" variant="secondary" size="sm" className="flex-1 text-center">
                Download
              </Button>
            </div>
          </div>
        )}
      </Container>
    </nav>
  );
}

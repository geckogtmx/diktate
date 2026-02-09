import React from 'react';
import { Container } from './Container';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-black/60 border-t border-white/10 py-12">
      <Container>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div>
            <h3 className="text-xl font-bold text-blue-400 mb-4">dIKtate</h3>
            <p className="text-gray-400 text-sm">
              Private, fast, intelligent voice-to-text powered by local AI.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold text-white mb-4">Product</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#download" className="text-gray-400 hover:text-white transition">
                  Download
                </a>
              </li>
              <li>
                <a href="#features" className="text-gray-400 hover:text-white transition">
                  Features
                </a>
              </li>
              <li>
                <a href="#pricing" className="text-gray-400 hover:text-white transition">
                  Pricing
                </a>
              </li>
              <li>
                <a href="/docs" className="text-gray-400 hover:text-white transition">
                  Documentation
                </a>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold text-white mb-4">Company</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#about" className="text-gray-400 hover:text-white transition">
                  About
                </a>
              </li>
              <li>
                <a href="https://github.com/geckogtmx/diktate" className="text-gray-400 hover:text-white transition">
                  GitHub
                </a>
              </li>
              <li>
                <a href="#contact" className="text-gray-400 hover:text-white transition">
                  Contact
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold text-white mb-4">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="/privacy" className="text-gray-400 hover:text-white transition">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="/terms" className="text-gray-400 hover:text-white transition">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="/license" className="text-gray-400 hover:text-white transition">
                  License
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-white/10 pt-8">
          <div className="flex flex-col md:flex-row items-center justify-between text-sm text-gray-400">
            <p>&copy; {currentYear} dIKtate. All rights reserved.</p>
            <div className="flex gap-4 mt-4 md:mt-0">
              <a href="https://twitter.com/diktate_app" className="hover:text-white transition">
                Twitter
              </a>
              <a href="https://github.com/geckogtmx/diktate" className="hover:text-white transition">
                GitHub
              </a>
              <a href="https://discord.gg/diktate" className="hover:text-white transition">
                Discord
              </a>
            </div>
          </div>
        </div>
      </Container>
    </footer>
  );
}

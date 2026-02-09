import React from 'react';
import { Container } from './Container';

const logos = [
  { name: 'Terminal', icon: '💻' },
  { name: 'Cursor', icon: '✏️' },
  { name: 'VS Code', icon: '📝' },
  { name: 'Google Docs', icon: '📄' },
  { name: 'Discord', icon: '💬' },
  { name: 'Slack', icon: '🗨️' },
  { name: 'Email', icon: '✉️' },
  { name: 'Excel', icon: '📊' },
];

export function LogoScroll() {
  return (
    <section className="py-16 sm:py-24 relative overflow-hidden bg-black/40">
      <Container>
        <p className="text-center text-gray-400 mb-12 text-sm uppercase tracking-wider">
          Works everywhere you type
        </p>

        {/* Scroll Container */}
        <div className="relative h-20">
          <div className="absolute inset-0 bg-gradient-to-r from-black via-transparent to-black z-10 pointer-events-none" />

          <div className="flex items-center h-full gap-12 animate-scroll">
            {[...logos, ...logos].map((logo, index) => (
              <div
                key={index}
                className="flex flex-col items-center gap-2 flex-shrink-0"
              >
                <div className="text-4xl">{logo.icon}</div>
                <div className="text-xs text-gray-400">{logo.name}</div>
              </div>
            ))}
          </div>
        </div>
      </Container>

      <style jsx>{`
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        .animate-scroll {
          animation: scroll 20s linear infinite;
        }
      `}</style>
    </section>
  );
}

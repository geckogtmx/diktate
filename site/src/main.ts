import './style.css'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

// Register ScrollTrigger
gsap.registerPlugin(ScrollTrigger)

// 1. Initialize Lenis (Smooth Scroll)
const lenis = new Lenis({
  lerp: 0.1, // Smoothness (lower = smoother)
  smoothWheel: true,
})

// Hook Lenis to GSAP
lenis.on('scroll', ScrollTrigger.update)
gsap.ticker.add((time) => {
  lenis.raf(time * 1000)
})
gsap.ticker.lagSmoothing(0)

// 2. Animations

// Hero Scroll-Roll (THINKING -> TALKING -> WORKING)
// We pin the hero section for a specific scroll distance (e.g., 1000px)
// and map that scroll to the Y movement of the words.

const heroSection = document.querySelector('section') // The first section is Hero
const verbContainer = document.getElementById('hero-verb-container')

if (heroSection && verbContainer) {
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: heroSection,
      start: "top top",
      end: "+=1000", // Shorter scroll distance
      scrub: 1,      // Smooth scrubbing
      pin: true,     // Pin the hero section
    }
  })

  // There are 3 words. We want to show:
  // 0% -> Word 1 (Y: 0)
  // 50% -> Word 2 (Y: -1em)
  // 100% -> Word 3 (Y: -2em)

  tl.to(verbContainer, {
    yPercent: -66.666, // Move to the 3rd item (2/3rds of the way up)
    ease: "none" // Linear movement tracks scroll 1:1 (most fluid)
  })
}

// Hero Parallax (Title moves slower)
// Removed per user request - keep fixed
/*
gsap.to('h1', {
  scrollTrigger: {
    trigger: 'h1',
    start: 'top 20%',
    end: 'bottom top',
    scrub: true
  },
  y: 50,
  opacity: 0.5
}) 
*/

// Architecture/Feature Cards (Staggered Entry - works for both sections if they share ID? No, IDs unique)
// Let's target the detailed feature grid explicitly
// Feature Specs Grid - Batch for reliability
gsap.set('#specs-grid > div', { y: 50, opacity: 0 }); // Hide initially
ScrollTrigger.batch('#specs-grid > div', {
  start: "top 85%",
  onEnter: batch => gsap.to(batch, {
    opacity: 1,
    y: 0,
    stagger: 0.1,
    duration: 0.6,
    ease: "power2.out"
  })
});

// Technical Data Grid - Batch
gsap.set('#tech-grid > div', { y: 50, opacity: 0 }); // Hide initially
ScrollTrigger.batch('#tech-grid > div', {
  start: "top 90%",
  onEnter: batch => gsap.to(batch, {
    opacity: 1,
    y: 0,
    stagger: 0.05,
    duration: 0.5,
    ease: "power2.out"
  })
});

// Comparison Table Rows
gsap.from('tbody tr', {
  scrollTrigger: {
    trigger: 'table',
    start: 'top 80%'
  },
  x: -20,
  opacity: 0,
  stagger: 0.1,
  duration: 0.5
})

// Typing Effect for Bilingual Section
const textToType = '"Hi, I need to send the financial report before noon, can you review it?"'
const typingElement = document.querySelector('.typing-effect')
if (typingElement) {
  typingElement.textContent = '' // Clear initial
  gsap.to(typingElement, {
    scrollTrigger: {
      trigger: typingElement,
      start: 'top 80%',
    },
    // Removed failed TextPlugin tween
    onStart: () => {
      // Just let the custom typer handle it
    }
  })

  // Custom typing effect
  const typeText = () => {
    let i = 0;
    typingElement.textContent = '"';
    const interval = setInterval(() => {
      if (i < textToType.length - 2) {
        typingElement.textContent += textToType.charAt(i + 1);
        i++;
      } else {
        typingElement.textContent += '"';
        clearInterval(interval);
      }
    }, 40);
  }

  ScrollTrigger.create({
    trigger: typingElement,
    start: 'top 70%',
    onEnter: typeText,
    once: true
  })
}

// Pricing Cards (Pop in)
gsap.from('#pricing > div > div', {
  scrollTrigger: {
    trigger: '#pricing',
    start: 'top 75%'
  },
  scale: 0.9,
  opacity: 0,
  stagger: 0.1,
  duration: 0.8,
  ease: 'back.out(1.7)'
})

console.log('dIKtate site loaded. Department of One.')

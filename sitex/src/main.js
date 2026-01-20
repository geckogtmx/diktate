import './style.css'

// Scroll Observer for Reveal Animations
const revealElements = document.querySelectorAll('.reveal');

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('active');
    }
  });
}, {
  threshold: 0.1,
  rootMargin: "0px 0px -50px 0px"
});

revealElements.forEach(element => {
  revealObserver.observe(element);
});

// Mobile Menu Toggle
const menuBtn = document.getElementById('menu-btn');
const mobileMenu = document.getElementById('mobile-menu');

if (menuBtn && mobileMenu) {
  menuBtn.addEventListener('click', () => {
    mobileMenu.classList.toggle('hidden');
  });
}

// Navbar scroll effect
const navbar = document.querySelector('nav');
window.addEventListener('scroll', () => {
  if (window.scrollY > 20) {
    navbar.classList.add('bg-background/90', 'backdrop-blur-xl', 'shadow-lg', 'border-white/5');
    navbar.classList.remove('bg-transparent', 'border-transparent');
  } else {
    navbar.classList.remove('bg-background/90', 'backdrop-blur-xl', 'shadow-lg', 'border-white/5');
    navbar.classList.add('bg-transparent', 'border-transparent');
  }
});

// ---------------------------------------------------------
// Scrollytelling Logic (Manifesto)
// ---------------------------------------------------------
const track = document.getElementById('manifesto-track');
const slides = [
  document.getElementById('slide-1'),
  document.getElementById('slide-2'),
  document.getElementById('slide-3')
];
const dots = [
  document.getElementById('dot-1'),
  document.getElementById('dot-2'),
  document.getElementById('dot-3')
];

function updateManifestoScroll() {
  if (!track) return;

  const rect = track.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const totalDistance = rect.height - viewportHeight;
  const scrolled = -rect.top;

  if (scrolled < 0) {
    activateSlide(0);
    return;
  }

  if (scrolled > totalDistance) {
    activateSlide(2);
    return;
  }

  const progress = scrolled / totalDistance;

  if (progress < 0.33) {
    activateSlide(0);
  } else if (progress < 0.66) {
    activateSlide(1);
  } else {
    activateSlide(2);
  }
}

function activateSlide(index) {
  if (!slides[0]) return;

  slides.forEach((slide, i) => {
    if (i === index) {
      if (slide) {
        slide.classList.remove('opacity-0', 'translate-y-10', 'scale-95');
        slide.classList.add('opacity-100', 'translate-y-0', 'scale-100');
      }
      if (dots[i]) {
        dots[i].classList.remove('bg-white/20');
        dots[i].classList.add('bg-primary');
      }
    } else {
      if (slide) {
        slide.classList.add('opacity-0', 'translate-y-10', 'scale-95');
        slide.classList.remove('opacity-100', 'translate-y-0', 'scale-100');
      }
      if (dots[i]) {
        dots[i].classList.add('bg-white/20');
        dots[i].classList.remove('bg-primary');
      }
    }
  });
}

// ---------------------------------------------------------
// Hero Scroll Logic (Word Cycler)
// ---------------------------------------------------------
const heroTrack = document.getElementById('hero-track');
const heroWords = document.getElementById('hero-words');

function updateHeroScroll() {
  if (!heroTrack || !heroWords) return;

  const rect = heroTrack.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const totalDistance = rect.height - viewportHeight;
  const scrolled = -rect.top;

  let progress = 0;
  if (scrolled > 0) {
    progress = Math.min(scrolled / totalDistance, 1);
  }

  // Smooth continuous scroll
  // We have 4 words. 
  // Each word has height 0.9em AND margin-bottom 1em (significantly reduced).
  // Total stride (height + margin) = 1.9em.

  // We want to scroll from 1st word to 4th word.
  // That's 3 full strides.

  const stride = 1.9;
  const maxTranslate = stride * 3;

  const translateY = progress * -maxTranslate;
  heroWords.style.transform = `translateY(${translateY}em)`;
}

// ---------------------------------------------------------
// Specs Scrollytelling Logic
// ---------------------------------------------------------
const specsTrack = document.getElementById('specs-track');
const specsGroups = [
  document.getElementById('specs-group-1'),
  document.getElementById('specs-group-2')
];
const specsDots = [
  document.getElementById('specs-dot-1'),
  document.getElementById('specs-dot-2')
];

function updateSpecsScroll() {
  if (!specsTrack) return;

  const rect = specsTrack.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const totalDistance = rect.height - viewportHeight;
  const scrolled = -rect.top;

  if (scrolled < 0) {
    activateSpecsGroup(0);
    return;
  }

  if (scrolled > totalDistance) {
    activateSpecsGroup(1);
    return;
  }

  const progress = scrolled / totalDistance;

  if (progress < 0.5) {
    activateSpecsGroup(0);
  } else {
    activateSpecsGroup(1);
  }
}

function activateSpecsGroup(index) {
  if (!specsGroups[0]) return;

  specsGroups.forEach((group, i) => {
    if (i === index) {
      if (group) {
        group.classList.remove('opacity-0', 'translate-y-10', 'scale-95', 'pointer-events-none');
        group.classList.add('opacity-100', 'translate-y-0', 'scale-100');
      }
      if (specsDots[i]) {
        specsDots[i].classList.remove('bg-white/20');
        specsDots[i].classList.add('bg-primary', 'w-16');
      }
    } else {
      if (group) {
        group.classList.add('opacity-0', 'translate-y-10', 'scale-95', 'pointer-events-none');
        group.classList.remove('opacity-100', 'translate-y-0', 'scale-100');
      }
      if (specsDots[i]) {
        specsDots[i].classList.add('bg-white/20');
        specsDots[i].classList.remove('bg-primary', 'w-16');
      }
    }
  });
}

// ---------------------------------------------------------
// Versus Scrollytelling Logic
// ---------------------------------------------------------
const versusTrack = document.getElementById('versus-track');
const vsRows = [
  document.getElementById('vs-row-1'),
  document.getElementById('vs-row-2'),
  document.getElementById('vs-row-3'),
  document.getElementById('vs-row-4')
];

function updateVersusScroll() {
  if (!versusTrack) return;

  const rect = versusTrack.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const totalDistance = rect.height - viewportHeight;
  const scrolled = -rect.top;

  if (scrolled < 0) {
    activateVsRows(0);
    return;
  }

  if (scrolled > totalDistance) {
    activateVsRows(4);
    return;
  }

  const progress = scrolled / totalDistance;

  // 4 rows, reveal them one by one. 
  // 0-0.25 -> 1st row
  // 0.25-0.5 -> 2nd row
  // 0.5-0.75 -> 3rd row
  // 0.75-1.0 -> 4th row
  let count = Math.min(Math.floor(progress * 4) + 1, 4);
  activateVsRows(count);
}

function activateVsRows(count) {
  if (!vsRows[0]) return;
  vsRows.forEach((row, i) => {
    if (i < count) {
      row.classList.remove('opacity-20');
      row.classList.add('opacity-100', 'bg-white/5');
    } else {
      row.classList.add('opacity-20');
      row.classList.remove('opacity-100', 'bg-white/5');
    }
  });
}

// ---------------------------------------------------------
// Independent Scrollytelling (Bilingual & Ask)
// ---------------------------------------------------------
const bilingTrack = document.getElementById('biling-track');
const bilingInput = document.getElementById('biling-input');
const bilingOutput = document.getElementById('biling-output');
const askTrack = document.getElementById('ask-track');
const askInput = document.getElementById('ask-input');
const askOutput = document.getElementById('ask-output');

function updateBilingScroll() {
  if (!bilingTrack || !bilingInput || !bilingOutput) return;
  const rect = bilingTrack.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const totalDistance = rect.height - viewportHeight;
  const scrolled = -rect.top;

  let progress = 0;
  if (scrolled > 0) {
    progress = Math.min(scrolled / totalDistance, 1);
  }

  // Phase 1: Input (0 to 0.45)
  let inputProgress = Math.min(progress / 0.45, 1);
  bilingInput.style.width = `${inputProgress * 100}%`;
  bilingInput.style.borderRightColor = progress < 0.45 ? 'var(--color-secondary)' : 'transparent';

  // Phase 2: Output (0.55 to 1.0)
  let outputProgress = progress < 0.55 ? 0 : (progress - 0.55) / 0.45;
  bilingOutput.style.width = `${outputProgress * 100}%`;
  bilingOutput.style.borderRightColor = (progress > 0.55 && progress < 1.0) ? 'var(--color-primary)' : 'transparent';
}

function updateAskScroll() {
  if (!askTrack || !askInput || !askOutput) return;
  const rect = askTrack.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const totalDistance = rect.height - viewportHeight;
  const scrolled = -rect.top;

  let progress = 0;
  if (scrolled > 0) {
    progress = Math.min(scrolled / totalDistance, 1);
  }

  // Phase 1: Input (0 to 0.45)
  let inputProgress = Math.min(progress / 0.45, 1);
  askInput.style.width = `${inputProgress * 100}%`;
  askInput.style.borderRightColor = progress < 0.45 ? 'var(--color-secondary)' : 'transparent';

  // Phase 2: Output (0.55 to 1.0)
  let outputProgress = progress < 0.55 ? 0 : (progress - 0.55) / 0.45;
  askOutput.style.width = `${outputProgress * 100}%`;
  askOutput.style.borderRightColor = (progress > 0.55 && progress < 1.0) ? 'var(--color-primary)' : 'transparent';
}

// Master Scroll Listener
window.addEventListener('scroll', () => {
  updateManifestoScroll();
  updateHeroScroll();
  updateSpecsScroll();
  updateVersusScroll();
  updateBilingScroll();
  updateAskScroll();
});

// Initial Init
updateManifestoScroll();
updateHeroScroll();
updateSpecsScroll();
updateVersusScroll();
updateBilingScroll();
updateAskScroll();

// ---------------------------------------------------------
// Feature Modal Logic
// ---------------------------------------------------------
const fbModal = document.getElementById('features-modal');
const openModalBtn = document.getElementById('open-features-modal');
const closeModalBtn = document.getElementById('close-features-modal');
const modalOverlay = document.getElementById('modal-overlay');
const modalContent = document.getElementById('modal-content');

if (openModalBtn) {
  openModalBtn.addEventListener('click', () => {
    fbModal.classList.remove('opacity-0', 'pointer-events-none');
    modalContent.classList.remove('scale-95');
    modalContent.classList.add('scale-100');
    document.body.style.overflow = 'hidden';
  });
}

const doCloseModal = () => {
  if (!fbModal) return;
  fbModal.classList.add('opacity-0', 'pointer-events-none');
  modalContent.classList.remove('scale-100');
  modalContent.classList.add('scale-95');
  document.body.style.overflow = '';
};

if (closeModalBtn) closeModalBtn.addEventListener('click', doCloseModal);
if (modalOverlay) modalOverlay.addEventListener('click', doCloseModal);

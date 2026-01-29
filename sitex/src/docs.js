import './style.css'

// Mobile Menu Toggle (if we add one later to docs header)
document.addEventListener('DOMContentLoaded', () => {
    // Scroll active link highlight logic
    const sections = document.querySelectorAll('article, section[id]');
    const navLinks = document.querySelectorAll('aside nav a');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute('id');
                navLinks.forEach(link => {
                    link.classList.remove('text-primary');
                    link.classList.add('text-muted');
                    if (link.getAttribute('href') === `#${id}`) {
                        link.classList.add('text-primary');
                        link.classList.remove('text-muted');
                    }
                });
            }
        });
    }, {
        threshold: 0.5
    });

    sections.forEach(section => {
        observer.observe(section);
    });
});

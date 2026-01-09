// Copy code to clipboard
function copyCode(button) {
    const codeBlock = button.previousElementSibling;
    const code = codeBlock.textContent;

    navigator.clipboard.writeText(code).then(() => {
        // Change button icon to checkmark
        button.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        `;

        // Reset after 2 seconds
        setTimeout(() => {
            button.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
            `;
        }, 2000);
    });
}

// Smooth scroll for navigation
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Navbar scroll effect
let lastScroll = 0;
const navbar = document.querySelector('.navbar');

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;

    if (currentScroll > 100) {
        navbar.style.background = 'rgba(15, 15, 26, 0.95)';
        navbar.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)';
    } else {
        navbar.style.background = 'rgba(15, 15, 26, 0.8)';
        navbar.style.boxShadow = 'none';
    }

    lastScroll = currentScroll;
});

// Animate elements on scroll
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe all cards and sections
document.addEventListener('DOMContentLoaded', () => {
    const animatedElements = document.querySelectorAll(
        '.feature-card, .install-card, .usage-card, .step'
    );

    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
});

// Terminal typing effect
function typeTerminal() {
    const terminalBody = document.querySelector('.terminal-body');
    const lines = terminalBody.querySelectorAll('.terminal-line');

    lines.forEach((line, index) => {
        line.style.opacity = '0';
        setTimeout(() => {
            line.style.transition = 'opacity 0.3s ease';
            line.style.opacity = '1';
        }, index * 300);
    });
}

// Run terminal animation when in viewport
const terminalObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            typeTerminal();
            terminalObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

const terminal = document.querySelector('.terminal-window');
if (terminal) {
    terminalObserver.observe(terminal);
}

// Add particle effect on hero section
function createParticle() {
    const particle = document.createElement('div');
    particle.style.position = 'absolute';
    particle.style.width = '2px';
    particle.style.height = '2px';
    particle.style.background = 'rgba(34, 197, 94, 0.5)';
    particle.style.borderRadius = '50%';
    particle.style.pointerEvents = 'none';

    const startX = Math.random() * window.innerWidth;
    const startY = Math.random() * window.innerHeight;

    particle.style.left = startX + 'px';
    particle.style.top = startY + 'px';

    document.querySelector('.hero-bg').appendChild(particle);

    const duration = 3000 + Math.random() * 2000;
    const distance = 200 + Math.random() * 300;
    const angle = Math.random() * Math.PI * 2;

    particle.animate([
        {
            transform: 'translate(0, 0)',
            opacity: 0
        },
        {
            transform: `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px)`,
            opacity: 1
        },
        {
            transform: `translate(${Math.cos(angle) * distance * 2}px, ${Math.sin(angle) * distance * 2}px)`,
            opacity: 0
        }
    ], {
        duration: duration,
        easing: 'ease-out'
    }).onfinish = () => particle.remove();
}

// Create particles periodically
setInterval(createParticle, 500);

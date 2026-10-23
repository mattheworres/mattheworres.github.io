// Small, dependency-free enhancements. The page is fully usable without any of this.

/** Footer year. */
function setYear() {
  document.getElementById('currentYear').textContent = new Date().getFullYear();
}

/**
 * Browsers without scroll-driven animations: publish scroll progress as --scroll-p (0..1)
 * and let the CSS scrub its animation with it. See "Scroll-linked motion" in css/styles.css.
 */
function initScrollFallback() {
  if (CSS.supports('animation-timeline: scroll()')) return;

  const root = document.documentElement;
  let queued = false;

  const update = () => {
    queued = false;
    const progress = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 0.6)));
    root.style.setProperty('--scroll-p', progress.toFixed(4));
  };

  window.addEventListener('scroll', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  }, { passive: true });

  update();
}

/** Mark the nav link for the section nearest the middle of the viewport. */
function initActiveNav() {
  const links = new Map(
    [...document.querySelectorAll('.band__links a')].map((a) => [a.hash.slice(1), a])
  );

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      links.forEach((link) => link.removeAttribute('aria-current'));
      links.get(entry.target.id)?.setAttribute('aria-current', 'true');
    }
  }, { rootMargin: '-45% 0px -50% 0px' }); // a thin strip across the middle of the viewport

  for (const id of links.keys()) {
    const section = document.getElementById(id);
    if (section) observer.observe(section);
  }
}

setYear();
initScrollFallback();
initActiveNav();

const skillsCarousel = document.querySelector('.carousel');
if (skillsCarousel) {
  // Dynamic so a failure to load the carousel can't take the rest of this script down with it.
  import('./carousel.js')
    .then(({ initCarousel }) => initCarousel(skillsCarousel, document.getElementById('skills')))
    .catch((error) => console.error('Carousel unavailable', error));
}

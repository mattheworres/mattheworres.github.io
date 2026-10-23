// Small, dependency-free enhancements. The page is fully usable without any of this.

/** Footer year. */
function setYear() {
  const year = document.getElementById('currentYear');
  if (year) year.textContent = new Date().getFullYear();
}

/** Wrap `fn` so it runs at most once per frame, however often the event fires. */
function perFrame(fn) {
  let queued = false;
  return () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn();
    });
  };
}

/**
 * Browsers without scroll-driven animations: publish scroll progress as --scroll-p (0..1)
 * and let the CSS scrub its animation with it. See "Scroll-linked motion" in css/styles.css.
 */
function initScrollFallback() {
  if (CSS.supports('animation-timeline: scroll()')) return;

  const root = document.documentElement;
  const update = () => {
    const progress = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 0.6)));
    root.style.setProperty('--scroll-p', progress.toFixed(4));
  };

  // Tells the CSS that something is driving the animations (without JS they stay off).
  root.classList.add('scroll-fallback');
  window.addEventListener('scroll', perFrame(update), { passive: true });
  update();
}

/**
 * Mark the nav link for the section across the upper-middle of the viewport. Nothing is marked
 * over the title slide or the blocks between sections, and the last link wins at the page bottom.
 */
function initActiveNav() {
  const links = [...document.querySelectorAll('.band__links a')]
    .map((link) => ({ link, section: document.getElementById(link.hash.slice(1)) }))
    .filter(({ section }) => section);
  if (!links.length) return;

  const update = () => {
    const probe = window.innerHeight * 0.4;
    const pageEnd = document.documentElement.scrollHeight - 2;
    // A page that fits the viewport is never "at the bottom": it would mark the last link
    // while the title is showing.
    const scrollable = pageEnd > window.innerHeight;
    const atBottom = scrollable && window.scrollY + window.innerHeight >= pageEnd;
    const current = atBottom
      ? links[links.length - 1]
      : links.find(({ section }) => {
          const { top, bottom } = section.getBoundingClientRect();
          return top <= probe && bottom > probe;
        });

    for (const entry of links) {
      if (entry === current) entry.link.setAttribute('aria-current', 'true');
      else entry.link.removeAttribute('aria-current');
    }
  };

  const onScroll = perFrame(update);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  // Layout shifts without scrolling (carousel sizing itself, web fonts arriving, a restored
  // scroll position) move the sections too.
  new ResizeObserver(onScroll).observe(document.body);
  document.fonts?.ready.then(onScroll);
  update();
}

/** Space activates the "back to top" link like it would a button (links only take Enter). */
function initToTop() {
  const toTop = document.querySelector('.to-top');
  if (!toTop) return;

  // Like a native button: keydown only stops the page scrolling, the press happens on keyup.
  toTop.addEventListener('keydown', (e) => {
    if (e.key === ' ') e.preventDefault();
  });
  toTop.addEventListener('keyup', (e) => {
    if (e.key === ' ') toTop.click();
  });
}

// Each piece is set up independently: a failure in one (or in the dynamically loaded carousel)
// can't stop the others.
const skillsCarousel = document.querySelector('.carousel');
if (skillsCarousel) {
  import('./carousel.js')
    .then(({ initCarousel }) => initCarousel(skillsCarousel, document.getElementById('skills')))
    .catch((error) => console.error('Carousel unavailable', error));
}

for (const init of [setYear, initScrollFallback, initActiveNav, initToTop]) {
  try {
    init();
  } catch (error) {
    console.error(`${init.name} failed`, error);
  }
}

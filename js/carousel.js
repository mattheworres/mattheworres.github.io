// Endless carousel with optional auto-rotation. Slides are rotated in the DOM (first goes to the
// end, or last to the front) so there is no "rewind", and every slide gets the same animation.

const AUTO_ROTATE_MS = 10_000;
const SLIDE_MS = 450;

// Auto-rotation and the play/pause button only exist at this width and up. This is the same
// breakpoint the CSS uses for the desktop carousel layout (keep the two in sync).
const desktop = matchMedia('(min-width: 60rem)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

/**
 * @param {HTMLElement} root  the .carousel element
 * @param {HTMLElement} hoverZone  auto-rotation pauses while a mouse is inside this element
 */
export function initCarousel(root, hoverZone) {
  const viewport = root.querySelector('.carousel__viewport');
  const track = root.querySelector('.carousel__track');
  const prev = root.querySelector('.carousel__prev');
  const next = root.querySelector('.carousel__next');
  const status = root.querySelector('.carousel__status');
  const toggle = root.querySelector('.carousel__toggle');
  const count = root.querySelector('.carousel__count');
  const progressFill = root.querySelector('.carousel__progress span');

  const countPosition = document.createTextNode('');
  const countName = document.createElement('span');
  countName.className = 'visually-hidden';
  count.replaceChildren(countPosition, countName);

  const slides = [...track.children];
  const total = slides.length;
  slides.forEach((slide, i) => {
    slide.dataset.index = i + 1;
    slide.setAttribute('aria-label', `${i + 1} of ${total}`);
  });

  // Auto-rotation runs unless one of these says otherwise. Someone who asked their OS for
  // reduced motion starts paused and can still opt in with the play button.
  let userPaused = reducedMotion.matches;
  let hovering = false;
  let keyboardFocus = false;
  let busy = false;
  let timer;
  let progress; // the filling bar, an Animation

  /** Move one slide: +1 forward, -1 back. */
  async function go(direction) {
    if (busy) return;
    busy = true;
    stopCountdown();

    // Slides are a fraction of the viewport's (possibly fractional) width.
    const width = viewport.getBoundingClientRect().width;
    // The viewport is as tall as the card on screen, so each card keeps its own height.
    const incoming = direction > 0 ? track.children[1] : track.lastElementChild;
    const heights = [`${viewport.offsetHeight}px`, `${incoming.offsetHeight}px`];
    const options = {
      duration: reducedMotion.matches ? 0 : SLIDE_MS,
      easing: 'ease',
      fill: 'both',
    };
    const animations = [];

    try {
      if (direction > 0) {
        const slideLeft = { transform: ['translateX(0)', `translateX(${-width}px)`] };
        animations.push(track.animate(slideLeft, options));
        animations.push(viewport.animate({ height: heights }, options));
        await Promise.all(animations.map((a) => a.finished));
        track.append(track.firstElementChild);
      } else {
        track.prepend(track.lastElementChild);
        const slideRight = { transform: [`translateX(${-width}px)`, 'translateX(0)'] };
        animations.push(track.animate(slideRight, options));
        animations.push(viewport.animate({ height: heights }, options));
        await Promise.all(animations.map((a) => a.finished));
      }
    } catch {
      // An animation was cancelled from outside; fall through and settle on the current DOM.
    } finally {
      // Re-measure rather than trusting `heights`: a resize may have landed mid-animation.
      // Same task as the DOM move above, so there is no flash.
      fitHeight();
      animations.forEach((a) => a.cancel());
      busy = false;
      render();
      schedule();
    }
  }

  function fitHeight() {
    viewport.style.height = `${track.firstElementChild.offsetHeight}px`;
    // Reserve room for the tallest card so the controls underneath never move.
    const tallest = Math.max(...slides.map((slide) => slide.offsetHeight));
    root.style.setProperty('--stage-height', `${tallest}px`);
  }

  function render() {
    [...track.children].forEach((slide, i) => {
      slide.inert = i !== 0;
    });

    // The count is the live region, so it also carries the skill's name for screen readers.
    const current = track.firstElementChild;
    const position = `${current.dataset.index} / ${total}`;
    const name = `, ${current.querySelector('h3')?.textContent ?? ''}`;
    // Only touch the live region when the slide actually changed, so nothing is re-announced.
    if (countPosition.data !== position) countPosition.data = position;
    if (countName.textContent !== name) countName.textContent = name;
  }

  function canAutoRotate() {
    return desktop.matches && !userPaused && !hovering && !keyboardFocus && !document.hidden;
  }

  function stopCountdown() {
    clearTimeout(timer);
    progress?.cancel(); // back to an empty bar
  }

  /** (Re)start the countdown to the next automatic rotation, if allowed right now. */
  function schedule() {
    stopCountdown();
    const auto = canAutoRotate();
    // Don't announce slides on their own while they are changing on their own. The count is the
    // live region (not the track, where the rotated slide would be announced as the new node).
    count.setAttribute('aria-live', auto ? 'off' : 'polite');
    if (!auto || busy) return;
    timer = setTimeout(() => go(1), AUTO_ROTATE_MS);
    if (!reducedMotion.matches) {
      progress = progressFill.animate(
        { transform: ['scaleX(0)', 'scaleX(1)'] },
        { duration: AUTO_ROTATE_MS, easing: 'linear', fill: 'forwards' },
      );
    }
  }

  function renderToggle() {
    toggle.setAttribute('aria-label', `${userPaused ? 'Play' : 'Pause'} automatic rotation`);
    toggle.querySelector('use').setAttribute('href', userPaused ? '#i-play' : '#i-pause');
  }

  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  toggle.addEventListener('click', () => {
    userPaused = !userPaused;
    // Pressing Play is explicit: it overrides the hover/focus pauses that were in effect when
    // the button was pressed (they only re-apply on the next pointerenter / focusin).
    if (!userPaused) hovering = keyboardFocus = false;
    renderToggle();
    schedule();
  });
  reducedMotion.addEventListener('change', () => {
    // Changing the OS setting is the newer signal, so it wins over an earlier button press.
    userPaused = reducedMotion.matches;
    renderToggle();
    schedule();
  });

  // Touch swipe. (Mouse users have the buttons.)
  let startX = null;
  viewport.addEventListener('pointerdown', (e) => {
    startX = e.pointerType === 'mouse' ? null : e.clientX;
  });
  viewport.addEventListener('pointercancel', () => {
    startX = null;
  });
  viewport.addEventListener('pointerup', (e) => {
    if (startX === null) return;
    const delta = e.clientX - startX;
    startX = null;
    if (Math.abs(delta) > 50) go(delta < 0 ? 1 : -1);
  });

  // Pause while a mouse is over the section or keyboard focus is inside the carousel.
  hoverZone.addEventListener('pointerenter', (e) => {
    if (e.pointerType !== 'mouse') return;
    hovering = true;
    schedule();
  });
  hoverZone.addEventListener('pointerleave', () => {
    hovering = false;
    schedule();
  });
  root.addEventListener('focusin', (e) => {
    keyboardFocus = e.target.matches(':focus-visible');
    schedule();
  });
  root.addEventListener('focusout', () => {
    keyboardFocus = false;
    schedule();
  });
  document.addEventListener('visibilitychange', schedule);
  desktop.addEventListener('change', schedule);

  // Text re-wrapping (window resize, web font arriving) changes card heights.
  // (Resizes during a slide are picked up by the fitHeight() at the end of go().)
  const resizeObserver = new ResizeObserver(() => {
    if (!busy) fitHeight();
  });
  slides.forEach((slide) => resizeObserver.observe(slide));

  root.classList.add('is-enhanced');
  prev.hidden = next.hidden = status.hidden = false;
  renderToggle();
  render();
  fitHeight();
  schedule();
}

// Viewport sizes in CSS pixels, accounting for the zoom the "Desktop site"
// fix applies to the page (see head-scripts.ts). Browser only.

/** The page zoom: 1 normally, more when the page was zoomed to fit a phone. */
export function pageZoom() {
  const z = parseFloat(getComputedStyle(document.documentElement).zoom);
  return z > 0 ? z : 1;
}

/** Visible height of the page. */
export function viewHeight() {
  return window.innerHeight / pageZoom();
}

/** True on a phone-sized screen, even when Chrome is in "Desktop site" mode. */
export function isPhoneWidth() {
  return window.innerWidth / pageZoom() < 768;
}

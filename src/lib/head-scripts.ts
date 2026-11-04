// Tiny scripts that run in <head> before the first paint. Kept in a plain
// module (not a client component) so the server can inline them.

export const SPLASH_SEEN_KEY = "masqq.splash";

/**
 * Chrome's "Desktop site" setting (which installed apps inherit, with no menu
 * to turn it off) lays pages out 980px wide and ignores the phone viewport.
 * On a touch screen narrower than that, zoom masqq back to the phone's width
 * before the first paint, and again if the phone is rotated.
 */
const FIT_PHONE_SCRIPT = `(function(){function f(){var s=screen.width,w=window.innerWidth,e=document.getElementById("fit-phone");if(navigator.maxTouchPoints>0&&s>0&&s<700&&w>s*1.3){if(!e){e=document.createElement("style");e.id="fit-phone";document.head.appendChild(e)}e.textContent="html{zoom:"+(w/s)+"}"}else if(e)e.remove()}f();document.addEventListener("DOMContentLoaded",f);addEventListener("load",f);addEventListener("resize",f)})();`;

/** Skip the launch screen if it already showed this launch. */
const SPLASH_SCRIPT = `try{if(sessionStorage.getItem("${SPLASH_SEEN_KEY}"))document.documentElement.classList.add("no-splash")}catch(e){}`;

export const HEAD_SCRIPT = FIT_PHONE_SCRIPT + SPLASH_SCRIPT;

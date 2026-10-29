// Plain module (no 'use client') so the server layout can import it.

/**
 * Inline script for <head>: marks the document as JS-enabled. (Older builds also played a full-screen
 * preloader here; it is gone, but `data-preloaded` stays set because tests and styles read it.)
 */
export const bootScript = `try{var d=document.documentElement;d.classList.add('js');d.dataset.preloaded='1'}catch(e){}`;

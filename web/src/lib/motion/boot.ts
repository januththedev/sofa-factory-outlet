// Plain module (no 'use client') so both the server layout and the preloader can import it.

export const PRELOADER_KEY = 'sfo-pre';
export const PRELOADER_DONE_EVENT = 'sfo:preloader-done';

/**
 * Inline script for <head>: marks the document as JS-enabled and, for visitors
 * who already saw the preloader this session, hides it before first paint.
 */
export const preloaderBootScript = `try{var d=document.documentElement;d.classList.add('js');if(sessionStorage.getItem('${PRELOADER_KEY}'))d.dataset.preloaded='1'}catch(e){}`;

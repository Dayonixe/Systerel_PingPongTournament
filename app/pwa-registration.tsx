'use client';

import { useEffect } from 'react';

export function PwaRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    const manifestLink = document.querySelector<HTMLLinkElement>(
      'link[rel="manifest"]',
    );
    const manifestUrl = new URL(
      manifestLink?.href ?? './manifest.webmanifest',
      window.location.href,
    );
    const scopeUrl = new URL('./', manifestUrl);
    const serviceWorkerUrl = new URL('sw.js', scopeUrl);

    navigator.serviceWorker
      .register(serviceWorkerUrl, { scope: scopeUrl.pathname })
      .catch((error: unknown) => {
        console.error("Impossible d'enregistrer le service worker PWA.", error);
      });
  }, []);

  return null;
}

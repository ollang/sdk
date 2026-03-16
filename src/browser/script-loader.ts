import { OllangBrowser, OllangBrowserConfig } from './index';

(function () {
  if (typeof window === 'undefined') return;

  const scriptTag = document.currentScript as HTMLScriptElement;

  let config: OllangBrowserConfig;

  if ((window as any).ollangConfig) {
    config = (window as any).ollangConfig;
  } else if (scriptTag) {
    config = {
      apiKey: scriptTag.dataset.apiKey || '',
      projectId: scriptTag.dataset.projectId,
      baseUrl: scriptTag.dataset.baseUrl,
      strapiUrl: scriptTag.dataset.strapiUrl || '',
      autoDetectCMS: scriptTag.dataset.autoDetectCms !== 'false',
      cmsType: scriptTag.dataset.cmsType as any,
      debounceMs: parseInt(scriptTag.dataset.debounceMs || '1000'),
      debug: scriptTag.dataset.debug === 'true',
    };
  } else {
    console.warn(
      'Ollang: No configuration found. Provide window.ollangConfig or use data attributes.'
    );
    return;
  }

  function initOllang() {
    (window as any).Ollang = OllangBrowser;
    const instance = new OllangBrowser(config);
    (window as any).ollangInstance = instance;
    (window as any).ollang = instance;

    const urlParams = new URLSearchParams(window.location.search);
    const hasLocalizeParam = urlParams.get('ollang-localize') === 'true';

    if (hasLocalizeParam) {
      setTimeout(() => {
        instance.showDebugPanel().catch(() => {});
      }, 1000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOllang);
  } else {
    initOllang();
  }
})();

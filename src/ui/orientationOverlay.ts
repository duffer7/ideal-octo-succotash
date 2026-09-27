/**
 * Оверлей с подсказкой «поверните устройство».
 * Показывается только в web-режиме, когда экран в портретной ориентации.
 * В нативном приложении ориентация заблокирована в ландшафт, поэтому оверлей не нужен.
 */
export function registerOrientationOverlay(): void {
  const overlay = document.createElement('div');
  overlay.id = 'orientation-overlay';
  overlay.innerHTML = '<div class="rotate-icon">📱</div><p>Поверните устройство горизонтально</p>';
  overlay.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:9999',
    'display:none',
    'flex-direction:column',
    'align-items:center',
    'justify-content:center',
    'gap:24px',
    'background:#4a90d9',
    'color:#fff',
    'font-family:system-ui,-apple-system,sans-serif',
    'font-size:32px',
    'text-align:center',
    'padding:32px',
  ].join(';');
  document.body.appendChild(overlay);

  const icon = overlay.querySelector('.rotate-icon') as HTMLElement;
  if (icon) {
    icon.style.fontSize = '120px';
    icon.style.transition = 'transform 0.3s';
  }

  const update = (): void => {
    const isPortrait = window.innerHeight > window.innerWidth;
    overlay.style.display = isPortrait ? 'flex' : 'none';
    if (icon) {
      icon.style.transform = isPortrait ? 'rotate(90deg)' : 'rotate(0deg)';
    }
  };

  update();
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', update);
}

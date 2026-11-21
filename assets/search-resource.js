import { createSearchFullscreen } from './search-fullscreen.js';
import { isGamePortalAddress } from './game-play-policy.js';

const assetVersion = new URL(import.meta.url).search;
const { gameSearchSources } = await import(`./search-game-sources.js${assetVersion}`);
const gamePreviews = new Set(Object.values(gameSearchSources).map(({ site }) => site?.preview).filter(Boolean));

export function openSearchResource(target, { title, description, url, provider, preview, kind, playRoute }) {
  const previewUrl = gamePreviews.has(preview) && !isGamePortalAddress(preview) ? preview : null;
  const portal = isGamePortalAddress(url);
  const dialog = document.createElement('dialog');
  dialog.className = 'media-dialog search-resource-dialog';
  dialog.setAttribute('aria-label', title);
  const body = document.createElement('div');
  body.className = 'search-resource-body';
  dialog.append(body);
  const header = document.createElement('header');
  header.className = 'media-dialog-header';
  const heading = document.createElement('h2');
  heading.textContent = title;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'button';
  close.textContent = 'Close';
  close.autofocus = true;
  close.addEventListener('click', () => dialog.close());
  const actions = document.createElement('div');
  actions.className = 'search-resource-actions';
  const fullscreen = previewUrl ? createSearchFullscreen(body, { label: title }) : null;
  if (fullscreen) actions.append(fullscreen.controls);
  actions.append(close);
  header.append(heading, actions);
  body.append(header);
  if (description) {
    const text = document.createElement('p');
    text.className = 'media-dialog-description';
    text.textContent = description;
    body.append(text);
  }
  if (previewUrl) {
    const stage = document.createElement('div');
    stage.className = 'media-player';
    const frame = document.createElement('iframe');
    frame.title = title + ' in-page preview';
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-pointer-lock allow-presentation');
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.src = previewUrl;
    stage.append(frame);
    const status = document.createElement('p');
    status.className = 'media-player-status';
    status.textContent = 'The official game loads here if the publisher and your network allow it.';
    const recovery = document.createElement('div');
    recovery.className = 'interaction-row';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'button';
    retry.textContent = 'Retry player';
    retry.addEventListener('click', () => { frame.src = previewUrl; });
    recovery.append(retry);
    if (playRoute) appendGameLink(recovery, playRoute, 'Open game page');
    appendGameLink(recovery, '#games?option=in-page', 'Browse in-page games');
    body.append(stage, status, recovery);
  } else if (kind === 'game' || portal) {
    appendGameLink(body, '#games?option=in-page', 'Browse in-page games');
  }
  function appendGameLink(parent, href, text) {
    const alternative = document.createElement('a');
    alternative.className = 'button';
    alternative.href = href;
    alternative.textContent = text;
    alternative.addEventListener('click', () => dialog.close());
    parent.append(alternative);
  }
  if (url) {
    const credit = document.createElement('p');
    credit.className = 'search-resource-source';
    credit.textContent = [provider, url].filter(Boolean).join(' · ');
    body.append(credit);
    if (kind === 'reference' && !portal && url.startsWith('https://')) {
      const openSource = document.createElement('a');
      openSource.className = 'button';
      openSource.href = url;
      openSource.target = '_blank';
      openSource.rel = 'noopener noreferrer';
      openSource.textContent = 'Open original source';
      body.append(openSource);
    }
  }
  const dispose = () => {
    fullscreen?.dispose();
    dialog.remove();
  };
  dialog.addEventListener('close', dispose, { once: true });
  target.append(dialog);
  dialog.showModal();
  return () => {
    if (dialog.open) dialog.close();
    dispose();
  };
}

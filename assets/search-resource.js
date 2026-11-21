export function openSearchResource(target, { title, description, url, provider, preview }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'media-dialog search-resource-dialog';
  dialog.setAttribute('aria-label', title);
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
  header.append(heading, close);
  dialog.append(header);
  if (description) {
    const text = document.createElement('p');
    text.className = 'media-dialog-description';
    text.textContent = description;
    dialog.append(text);
  }
  if (preview) {
    const stage = document.createElement('div');
    stage.className = 'media-player';
    const frame = document.createElement('iframe');
    frame.title = title + ' in-page preview';
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-pointer-lock allow-presentation');
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.src = preview;
    stage.append(frame);
    const status = document.createElement('p');
    status.className = 'media-player-status';
    status.textContent = 'The official game loads here if the publisher and your network allow it.';
    dialog.append(stage, status);
  }
  if (url) {
    const credit = document.createElement('p');
    credit.className = 'search-resource-source';
    credit.textContent = [provider, url].filter(Boolean).join(' · ');
    dialog.append(credit);
  }
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  target.append(dialog);
  dialog.showModal();
  return () => {
    if (dialog.open) dialog.close();
    dialog.remove();
  };
}

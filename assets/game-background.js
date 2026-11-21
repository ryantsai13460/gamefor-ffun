const storageKey = 'ffun-game-background-v1';
const maximumFileBytes = 8 * 1024 * 1024;
const maximumImageLength = 460_000;
const plain = { preset: 'clean', image: '' };

export const gameBackgroundOptions = [
  ['clean', 'Clean'],
  ['grid', 'Arcade grid'],
  ['race', 'Pocket Circuit gameplay'],
  ['custom', 'My image']
];

export function readGameBackground() {
  try {
    const { preset, image } = JSON.parse(localStorage.getItem(storageKey));
    const savedImage = typeof image === 'string' && image.length <= maximumImageLength &&
      /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(image) ? image : '';
    if (gameBackgroundOptions.some(([id]) => id === preset) && (preset !== 'custom' || savedImage)) {
      return { preset, image: savedImage };
    }
  } catch {}
  return { ...plain };
}

export function saveGameBackground(background) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(background));
    return true;
  } catch {
    return false;
  }
}

export function showGameBackground(target, background) {
  target.dataset.gameBackground = background.preset;
  if (background.preset === 'custom' && background.image) {
    target.style.setProperty('--game-background-image', 'url("' + background.image + '")');
  } else {
    target.style.removeProperty('--game-background-image');
  }
}

export async function prepareGameBackground(file) {
  if (file.size > maximumFileBytes) throw new Error('Choose an image under 8 MB.');
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const header = String.fromCharCode(...bytes);
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = header.startsWith('\x89PNG\r\n\x1a\n');
  const webp = header.startsWith('RIFF') && header.slice(8) === 'WEBP';
  if (!jpeg && !png && !webp) throw new Error('Choose a JPEG, PNG, or WebP image.');
  let image;
  try { image = await createImageBitmap(file); }
  catch { throw new Error('This image could not be opened.'); }
  try {
    const ratio = Math.min(1, 1200 / image.width, 720 / image.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * ratio));
    canvas.height = Math.max(1, Math.round(image.height * ratio));
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Image editing is unavailable in this browser.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL('image/jpeg', .8);
    if (!result.startsWith('data:image/jpeg;base64,') || result.length > maximumImageLength) {
      throw new Error('Choose a smaller or less detailed image.');
    }
    return result;
  } finally {
    image.close();
  }
}

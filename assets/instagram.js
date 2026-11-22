const assetVersion = new URL(import.meta.url).search;
const { instagramPosts, parseInstagramPost } = await import(`./instagram-catalog.js${assetVersion}`);

const postsById = new Map(instagramPosts.map(post => [post.id, post]));
const topics = [...new Set(instagramPosts.flatMap(post => post.tags))].sort();

function node(tag, className, content) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content) element.textContent = content;
  return element;
}

function button(label, click, className = 'button') {
  const result = node('button', className, label);
  result.type = 'button';
  if (click) result.addEventListener('click', click);
  return result;
}

function formField(label, type, placeholder) {
  const container = node('label', 'instagram-field', label);
  const input = node('input', 'field');
  input.type = type;
  input.placeholder = placeholder;
  container.append(input);
  return [container, input];
}

function searchable(text) {
  return text.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '');
}

export function renderInstagram(target, params = new URLSearchParams()) {
  const root = node('section', 'instagram-page');
  const header = node('header', 'instagram-heading');
  header.append(node('h1', '', 'Instagram'), node('p', '', 'Browse selected public Posts and Reels, or load a link you already have.'));

  const paste = node('form', 'instagram-paste');
  paste.setAttribute('aria-label', 'Open Instagram link');
  paste.noValidate = true;
  const [pasteLabel, pasteInput] = formField('Public Instagram URL', 'url', 'https://www.instagram.com/reel/…');
  pasteInput.maxLength = 1500;
  pasteInput.required = true;
  pasteInput.setAttribute('aria-describedby', 'instagram-url-message');
  const pasteButton = button('Load link', null, 'button primary');
  pasteButton.type = 'submit';
  const pasteMessage = node('p', 'instagram-url-message');
  pasteMessage.id = 'instagram-url-message';
  pasteMessage.setAttribute('role', 'status');
  paste.append(pasteLabel, pasteButton, pasteMessage);

  const layout = node('div', 'instagram-layout');
  const viewer = node('article', 'instagram-viewer');
  viewer.setAttribute('aria-labelledby', 'instagram-selected-title');
  const selectedMeta = node('p', 'instagram-selected-meta');
  const selectedTitle = node('h2');
  selectedTitle.id = 'instagram-selected-title';
  selectedTitle.tabIndex = -1;
  const description = node('p', 'instagram-description');
  const selected = node('div', 'instagram-selected');
  const actions = node('div', 'instagram-actions');
  const load = button('Load Instagram player', loadPlayer, 'button primary');
  const stop = button('Close player', () => {
    clearPlayer();
    load.focus({ preventScroll: true });
  });
  const source = node('a', 'button', 'Open on Instagram');
  source.target = '_blank';
  source.rel = 'noopener noreferrer';
  actions.append(load, stop, source);
  selected.append(selectedMeta, selectedTitle, description, actions);
  const stage = node('div', 'instagram-stage');
  const playerStatus = node('p', 'instagram-player-status');
  playerStatus.setAttribute('role', 'status');
  viewer.append(selected, playerStatus, stage);

  const catalog = node('section', 'instagram-catalog');
  catalog.setAttribute('aria-labelledby', 'instagram-catalog-title');
  const catalogHeading = node('h2', '', 'Browse posts');
  catalogHeading.id = 'instagram-catalog-title';
  const filters = node('div', 'instagram-filters');
  const [searchLabel, search] = formField('Search Instagram posts', 'search', 'Title, creator, or topic');
  search.maxLength = 150;
  search.value = (params.get('q') || '').slice(0, search.maxLength);
  const topicLabel = node('label', 'instagram-field', 'Topic');
  const topic = node('select', 'field');
  topic.append(new Option('All topics', ''), ...topics.map(value => new Option(value)));
  if (topics.includes(params.get('topic'))) topic.value = params.get('topic');
  topicLabel.append(topic);
  filters.append(searchLabel, topicLabel);
  const resultCount = node('p', 'instagram-result-count');
  resultCount.setAttribute('role', 'status');
  const cards = node('ul', 'instagram-posts');
  catalog.append(catalogHeading, filters, resultCount, cards);
  layout.append(catalog, viewer);
  root.append(header, paste, layout);

  let current;
  let frame;
  let timeout;

  function clearPlayer() {
    clearTimeout(timeout);
    frame?.remove();
    frame = undefined;
    stage.hidden = true;
    stop.hidden = true;
    load.hidden = false;
    playerStatus.textContent = '';
  }

  function loadPlayer() {
    if (!current || frame) return;
    const next = node('iframe');
    next.src = current.embedUrl;
    next.title = `${current.title} on Instagram`;
    next.allow = 'fullscreen';
    next.allowFullscreen = true;
    next.referrerPolicy = 'strict-origin-when-cross-origin';
    const fallback = 'If the post is unavailable here, open it on Instagram.';
    timeout = setTimeout(() => {
      if (frame === next) playerStatus.textContent = fallback;
    }, 8000);
    next.addEventListener('load', () => {
      if (frame !== next) return;
      clearTimeout(timeout);
      // A provider error page can also fire load.
      playerStatus.textContent = fallback;
    }, { once: true });
    next.addEventListener('error', () => {
      if (frame !== next) return;
      clearTimeout(timeout);
      playerStatus.textContent = 'Instagram could not be reached. Try opening the original post.';
    }, { once: true });
    const restoreFocus = document.activeElement === load;
    frame = next;
    stage.append(next);
    stage.hidden = false;
    load.hidden = true;
    stop.hidden = false;
    playerStatus.textContent = 'Loading the Instagram player…';
    if (restoreFocus) stop.focus({ preventScroll: true });
  }

  function selectPost(post, focus = false) {
    if (current?.href !== post.href) clearPlayer();
    current = post;
    selectedTitle.textContent = post.title;
    selectedMeta.textContent = [post.kind === 'reel' ? 'Reel' : 'Post', post.creator].filter(Boolean).join(' · ');
    description.textContent = post.description || '';
    description.hidden = !post.description;
    source.href = post.href;
    for (const entry of cards.querySelectorAll('button')) {
      entry.setAttribute('aria-pressed', String(entry.dataset.post === current.id));
    }
    if (focus) {
      viewer.scrollIntoView({ block: 'nearest' });
      selectedTitle.focus({ preventScroll: true });
    }
  }

  function drawCatalog() {
    const terms = searchable(search.value).trim().split(/\s+/).filter(Boolean);
    const matches = instagramPosts.filter(post => {
      const words = searchable([post.title, post.creator, post.description, ...post.tags].join(' '));
      return (!topic.value || post.tags.includes(topic.value)) && terms.every(term => words.includes(term));
    });
    const entries = matches.map(post => {
      const item = node('li');
      const pick = button('', () => selectPost(post, true), 'instagram-card');
      pick.dataset.post = post.id;
      pick.setAttribute('aria-pressed', String(post.id === current?.id));
      pick.append(node('span', 'instagram-card-kind', post.kind === 'reel' ? 'Reel' : 'Post'),
        node('strong', 'instagram-card-title', post.title), node('span', 'instagram-card-creator', post.creator));
      item.append(pick);
      return item;
    });
    cards.replaceChildren(...entries);
    resultCount.textContent = matches.length ? `${matches.length} public ${matches.length === 1 ? 'post' : 'posts'}` : 'No posts match these filters.';
  }

  search.addEventListener('input', drawCatalog);
  topic.addEventListener('change', drawCatalog);
  pasteInput.addEventListener('input', () => {
    pasteInput.removeAttribute('aria-invalid');
    pasteMessage.textContent = '';
  });
  paste.addEventListener('submit', event => {
    event.preventDefault();
    const post = parseInstagramPost(pasteInput.value);
    if (!post) {
      pasteInput.setAttribute('aria-invalid', 'true');
      pasteMessage.textContent = 'Enter a public Instagram URL with /p/ or /reel/ followed by the post ID.';
      pasteInput.focus();
      return;
    }
    pasteInput.removeAttribute('aria-invalid');
    pasteMessage.textContent = '';
    const curated = postsById.get(post.id);
    selectPost(curated || { ...post, title: post.kind === 'reel' ? 'Instagram Reel' : 'Instagram post' }, true);
    loadPlayer();
  });

  selectPost(postsById.get(params.get('post')) || instagramPosts[0]);
  drawCatalog();
  target.replaceChildren(root);
  return () => {
    clearPlayer();
    root.remove();
  };
}

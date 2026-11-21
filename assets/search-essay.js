const assetVersion = new URL(import.meta.url).search;
const [{ generateSearchAnswer, searchModelAvailability }, { cpuBlipAvailability, prepareCpuBlipModel, runCpuBlipPrompt }] =
  await Promise.all([import(`./search-answer.js${assetVersion}`), import(`./blip-cpu.js${assetVersion}`)]);

const writingVideos = [
  { id: 'UuOWNNvupik', title: 'How to Write an Essay: 4 Minute Step-by-step Guide | Scribbr 🎓', creator: 'Scribbr' },
  { id: 'hwzfnDbZCRQ', title: 'How to Create a Clearly Structured Essay Outline | Scribbr 🎓', creator: 'Scribbr' },
  { id: 'msaynBwwxkA', title: 'How to Write an Eye-Catching Essay Introduction | Scribbr 🎓', creator: 'Scribbr' }
];

const tools = [
  { name: 'Google Docs', description: 'Draft, organize, and revise your essay.', url: 'https://docs.google.com/document/u/0/' },
  { name: 'ZoteroBib', description: 'Build a bibliography from the sources you used.', url: 'https://zbib.org/' },
  {
    name: 'Purdue OWL', description: 'Read guidance on academic essays and argument.',
    url: 'https://owl.purdue.edu/owl/general_writing/academic_writing/essay_writing/index.html'
  },
  { name: 'blip.ai', description: 'Ask for help shaping a thesis, outline, or revision.', url: '#blip' }
];

const approach = [
  ['Read the prompt.', 'Identify the task and audience. Turn the prompt into a question your essay can answer.'],
  ['Plan your argument.', 'Draft a one-sentence thesis, outline your main points, and find evidence for each one.'],
  ['Draft the essay.', 'Give readers context and your thesis in the introduction. In each body paragraph, make a point, support it with evidence, and explain how it answers the prompt. Use the conclusion to bring your argument together.'],
  ['Revise and cite.', 'Check that each paragraph supports your thesis. Credit the sources you used and proofread after making larger revisions.']
];

export function essayGuideQuery(value) {
  if (typeof value !== 'string') return null;
  const query = value.trim().replace(/\s+/g, ' ')
    .replace(/\b(?:wrie|wrtie|wriet)\b/gi, 'write')
    .replace(/\b(?:eassay|esssay|esay)\b/gi, 'essay');
  if (!/\bessays?\b/i.test(query)) return null;
  return /^(?:(?:academic|school|college|research) )?essays?[.?!]?$/i.test(query) ||
    /\b(?:write|writing|draft|plan|outline|structure|thesis|introduction|conclusion|revise|proofread|argumentative|persuasive|narrative)\b/i.test(query)
    ? query : null;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function button(text, press) {
  const control = element('button', 'button', text);
  control.type = 'button';
  control.addEventListener('click', press);
  return control;
}

function link(text, url) {
  const anchor = element('a', 'text-action', text);
  anchor.href = url;
  if (url.startsWith('https:')) {
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  }
  return anchor;
}

export function renderEssayGuide(target, query) {
  const lifetime = new AbortController();
  const root = element('section', 'google-essay-guide');
  const heading = element('h3', '', 'Essay writing guide');
  const answer = element('article', 'google-essay-answer');
  const title = element('h4', '', 'Built-in essay guide');
  const status = element('p', 'muted google-essay-status');
  status.setAttribute('role', 'status');
  const guidance = element('ol', 'google-essay-steps');
  for (const [label, detail] of approach) {
    const step = element('li');
    step.append(element('strong', '', label), document.createTextNode(` ${detail}`));
    guidance.append(step);
  }

  let releasePlayer;
  let playerRequest = 0;
  const videos = element('section', 'google-essay-section');
  const videoList = element('ul', 'google-essay-grid');
  for (const video of writingVideos) {
    const row = element('li', 'google-essay-card');
    const thumbnail = element('img');
    thumbnail.src = `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`;
    thumbnail.alt = '';
    thumbnail.loading = 'lazy';
    thumbnail.decoding = 'async';
    thumbnail.addEventListener('error', () => thumbnail.remove(), { once: true });
    const url = `https://www.youtube.com/watch?v=${video.id}`;
    const watch = button(video.title, async () => {
      const request = ++playerRequest;
      try {
        const { watchDialog } = await import(`./media.js${assetVersion}`);
        if (lifetime.signal.aborted || request !== playerRequest) return;
        releasePlayer?.();
        releasePlayer = watchDialog(root, {
          title: video.title, subtitle: video.creator,
          video, external: url, directLabel: 'Watch on YouTube'
        });
      } catch {
        if (!lifetime.signal.aborted && request === playerRequest) status.textContent = 'The video player could not open.';
      }
    });
    watch.classList.add('google-essay-video');
    watch.setAttribute('aria-haspopup', 'dialog');
    row.append(thumbnail, watch, element('p', 'muted', video.creator), link('Watch on YouTube', url));
    videoList.append(row);
  }
  videos.append(element('h4', '', 'Writing videos'), videoList);

  const apps = element('section', 'google-essay-section');
  const appList = element('ul', 'google-essay-grid');
  for (const tool of tools) {
    const card = element('li', 'google-essay-card');
    card.append(link(tool.name, tool.url), element('p', 'muted', tool.description));
    appList.append(card);
  }
  apps.append(element('h4', '', 'Writing tools and references'), appList);

  let localJob;
  const local = element('div', 'google-essay-local');
  local.hidden = true;
  const size = element('p', 'muted', 'First-time setup downloads about 106 MB. The model runs in this browser.');
  const start = button('Start local AI', () => void useLocal(true));
  const stop = button('Stop local AI', () => {
    localJob?.abort();
    status.textContent = 'Local AI stopped.';
  });
  stop.hidden = true;
  local.append(size, start, stop);
  answer.append(title, guidance, status, local);
  root.append(heading, answer, videos, apps);
  target.append(root);

  function showGenerated(text) {
    title.textContent = 'On-device AI answer';
    const copy = element('p', 'google-essay-generated', text);
    guidance.replaceWith(copy);
    local.hidden = true;
    status.textContent = '';
  }

  async function useLocal(prepare) {
    if (localJob) return;
    const job = new AbortController();
    localJob = job;
    const signal = AbortSignal.any([job.signal, lifetime.signal]);
    start.disabled = true;
    stop.hidden = false;
    try {
      if (prepare) {
        status.textContent = 'Preparing local AI…';
        await prepareCpuBlipModel(signal, (fraction, label) => {
          if (!signal.aborted) status.textContent = `${label || 'Preparing local AI'} · ${Math.round(fraction * 100)}%`;
        });
      }
      signal.throwIfAborted();
      status.textContent = 'Generating an on-device answer…';
      const text = await runCpuBlipPrompt([
        { role: 'system', content: 'Help the student learn to write their own essay. Give concise practical guidance that addresses the request. Explain the thesis, evidence, and revision when relevant. Do not invent research or citations.' },
        { role: 'user', content: query }
      ], 'think', AbortSignal.any([signal, AbortSignal.timeout(45000)]));
      if (signal.aborted) return;
      if (text) showGenerated(text);
      else status.textContent = 'Local AI did not return an answer.';
    } catch {
      if (!signal.aborted) status.textContent = 'Local AI could not finish. You can try again.';
    } finally {
      localJob = undefined;
      start.disabled = false;
      stop.hidden = true;
    }
  }

  async function readyAnswer() {
    try {
      if (await searchModelAvailability() === 'available' && !lifetime.signal.aborted) {
        status.textContent = 'Generating an on-device answer…';
        const source = { title: 'Gamefor Ffun essay checklist', text: approach.map((step) => step.join(' ')).join('\n') };
        const signal = AbortSignal.any([lifetime.signal, AbortSignal.timeout(15000)]);
        const text = await generateSearchAnswer(query, source, writingVideos, signal);
        if (lifetime.signal.aborted) return;
        if (text) {
          showGenerated(text);
          return;
        }
        status.textContent = 'The browser model did not return an answer.';
      }
    } catch {
      if (!lifetime.signal.aborted) status.textContent = 'The browser model could not finish.';
    }
    const available = await cpuBlipAvailability().catch(() => 'unavailable');
    if (lifetime.signal.aborted) return;
    local.hidden = available === 'unavailable';
    if (available === 'available') {
      size.hidden = true;
      await useLocal(false);
    }
  }

  void readyAnswer();
  return () => {
    lifetime.abort();
    releasePlayer?.();
    root.remove();
  };
}

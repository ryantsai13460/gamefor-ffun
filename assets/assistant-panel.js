import {
  generateSearchAnswer,
  localAssistantAnswer,
  prepareSearchModel,
  searchModelAvailability,
  searchWikipedia,
} from './search-answer.js';

const examples = [
  ['Explain a topic', 'How does a rainbow form?'],
  ['Plan a task', 'Make a 20-minute study plan for a history quiz.'],
  ['Calculate', 'Calculate (24 × 3) + 18'],
  ['Convert units', 'Convert 5 miles to km'],
];

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function link(url, text) {
  const item = element('a', 'text-action', text);
  item.href = url;
  item.target = '_blank';
  item.rel = 'noopener noreferrer';
  return item;
}

function button(className, text) {
  const item = element('button', className, text);
  item.type = 'button';
  return item;
}

export function renderAssistantPanel(target, { onQuery, findVideos = () => [] } = {}) {
  const root = element('section', 'assistant-panel');
  const title = element('h2', 'assistant-title', 'AI Help');
  const description = element('p', 'muted assistant-intro', 'Ask for an explanation, writing help, or a plan. Calculations and unit conversions work locally.');
  const form = element('form', 'assistant-form');
  form.setAttribute('role', 'search');
  form.setAttribute('aria-label', 'Ask AI');
  const promptLabel = element('label', 'assistant-field');
  promptLabel.append(element('span', 'sr-only', 'Ask AI'));
  const input = element('input', 'field');
  input.type = 'search';
  input.required = true;
  input.maxLength = 800;
  input.autocomplete = 'off';
  input.placeholder = 'Ask a question, calculate, or convert units';
  promptLabel.append(input);
  const submit = button('button primary', 'Ask AI');
  submit.type = 'submit';
  form.append(promptLabel, submit);

  const suggestions = element('div', 'assistant-examples');
  suggestions.setAttribute('role', 'group');
  suggestions.setAttribute('aria-label', 'Example questions');
  for (const [label, example] of examples) {
    const item = button('chip', label);
    item.title = example;
    item.addEventListener('click', () => {
      input.value = example;
      input.focus();
    });
    suggestions.append(item);
  }

  const details = element('details', 'assistant-options');
  details.append(element('summary', '', 'Sources and on-device AI'));
  const settings = element('div', 'assistant-settings');
  const sourceOption = element('label', 'settings-option assistant-source-option');
  const useWikipedia = element('input');
  useWikipedia.type = 'checkbox';
  useWikipedia.checked = true;
  sourceOption.append(useWikipedia, element('span', '', 'Look up topics on Wikipedia'));
  const sourceDetail = element('p', 'muted', 'When enabled, short questions are sent to Wikipedia for reference.');
  const modelStatus = element('p', 'muted assistant-model-status', 'Checking for a browser model…');
  modelStatus.setAttribute('role', 'status');
  const enable = button('button', 'Enable on-device AI');
  enable.hidden = true;
  settings.append(sourceOption, sourceDetail, modelStatus, enable);
  details.append(settings);

  const status = element('p', 'muted assistant-status');
  status.setAttribute('role', 'status');
  const result = element('article', 'assistant-result');
  result.hidden = true;
  result.setAttribute('aria-live', 'polite');
  const resultTitle = element('h3', 'assistant-result-title');
  const reply = element('p', 'assistant-result-text');
  const credits = element('div', 'assistant-credits');
  const copy = button('button assistant-copy', 'Copy answer');
  result.append(resultTitle, reply, credits, copy);

  const lifetime = new window.AbortController();
  let pending;

  function showModelStatus(availability) {
    const canEnable = availability === 'downloadable' || availability === 'downloading';
    enable.hidden = !canEnable;
    if (canEnable) details.open = true;
    modelStatus.textContent = availability === 'available'
      ? 'On-device AI is ready. Ask a question to use it.'
      : canEnable
        ? 'Enable on-device AI to prepare the model in this browser.'
        : 'On-device AI is unavailable in this browser. Wikipedia, calculations, and conversions are still available.';
  }

  enable.addEventListener('click', async () => {
    enable.disabled = true;
    modelStatus.textContent = 'Preparing the browser model…';
    try {
      await prepareSearchModel(lifetime.signal, fraction => {
        if (!lifetime.signal.aborted) modelStatus.textContent = `Downloading the browser model · ${Math.round(fraction * 100)}%`;
      });
      if (!lifetime.signal.aborted) showModelStatus('available');
    } catch {
      if (!lifetime.signal.aborted) modelStatus.textContent = 'The browser could not prepare its model. You can try again.';
    } finally {
      enable.disabled = false;
    }
  });

  function showAnswer(label, text, source) {
    status.textContent = '';
    result.hidden = false;
    resultTitle.textContent = label;
    reply.textContent = text;
    copy.hidden = label === 'AI unavailable';
    credits.replaceChildren();
    if (source) {
      credits.append(link(source.url, `Wikipedia · ${source.title}`),
        link('https://creativecommons.org/licenses/by-sa/4.0/', 'CC BY-SA 4.0'));
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    pending?.abort();
    const question = input.value.trim();
    if (!question) {
      status.textContent = 'Enter a question or calculation.';
      return;
    }
    onQuery?.(question);
    const computed = localAssistantAnswer(question);
    if (computed) {
      showAnswer(computed.title, computed.text);
      return;
    }

    pending = new window.AbortController();
    const { signal } = pending;
    const withTimeout = duration => window.AbortSignal.any([signal, window.AbortSignal.timeout(duration)]);
    const shouldLookUp = useWikipedia.checked && question.length <= 200;
    result.hidden = true;
    status.textContent = shouldLookUp ? 'Looking up context and checking the browser model…' : 'Checking the browser model…';

    const articles = shouldLookUp ? await searchWikipedia(question, withTimeout(5000), 1).catch(() => []) : [];
    if (signal.aborted) return;
    const [source] = articles;
    const videos = findVideos(question);
    const answer = await generateSearchAnswer(question, source, videos, withTimeout(12000)).catch(() => '');
    if (signal.aborted) return;
    if (answer) {
      showAnswer('On-device AI answer', answer, source);
    } else if (source) {
      showAnswer('Wikipedia excerpt', source.text, source);
    } else {
      const message = shouldLookUp
        ? 'A ready browser model and a Wikipedia excerpt are unavailable for this question.'
        : 'A ready browser model is unavailable. For a short topic question, you can enable Wikipedia lookup under Sources and on-device AI.';
      showAnswer('AI unavailable', message);
    }
  });

  copy.addEventListener('click', async () => {
    try {
      await window.navigator.clipboard.writeText(reply.textContent);
      status.textContent = 'Answer copied.';
    } catch {
      status.textContent = 'Select the answer text to copy it.';
    }
  });

  root.append(title, description, form, suggestions, details, status, result);
  target.append(root);
  searchModelAvailability().catch(() => 'unavailable').then(availability => {
    if (!lifetime.signal.aborted) showModelStatus(availability);
  });

  return () => {
    lifetime.abort();
    pending?.abort();
    root.remove();
  };
}

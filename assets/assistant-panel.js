const assetVersion = new URL(import.meta.url).search;
const {
  generateSearchAnswer,
  localAssistantAnswer,
  prepareSearchModel,
  searchModelAvailability,
  searchWikipedia,
} = await import(`./search-answer.js${assetVersion}`);

const examples = [
  ['Explain a topic', 'How does a rainbow form?'],
  ['Plan a task', 'Make a 20-minute study plan for a history quiz.'],
  ['Calculate', 'Calculate (24 × 3) + 18'],
  ['Convert units', 'Convert 5 miles to km'],
];
let panelCount = 0;

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

export function renderAssistantPanel(target, { onQuery, findVideos = () => [], onSearchTopic } = {}) {
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
  const stop = button('button', 'Stop answering');
  stop.hidden = true;
  const formActions = element('div', 'assistant-actions');
  formActions.append(submit, stop);
  form.append(promptLabel, formActions);

  const contextNote = element('div', 'assistant-context');
  contextNote.id = `assistant-context-${++panelCount}`;
  contextNote.hidden = true;
  const contextTopic = element('strong');
  const newQuestion = button('button', 'Start a new question');
  contextNote.append(contextTopic, newQuestion);

  const suggestions = element('div', 'assistant-examples');
  suggestions.setAttribute('role', 'group');
  suggestions.setAttribute('aria-label', 'Example questions');
  for (const [label, example] of examples) {
    const item = button('chip', label);
    item.title = example;
    item.addEventListener('click', () => {
      setFollowUp(false);
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
  const followUp = button('button', 'Ask a follow-up');
  const searchTopic = element('a', 'button', 'Search web and YouTube');
  const resultActions = element('div', 'assistant-actions');
  resultActions.append(copy, followUp, searchTopic);
  result.append(resultTitle, reply, credits, resultActions);

  const lifetime = new window.AbortController();
  let pending;
  let lastAnswer;
  let followingUp = false;
  let modelReady = false;

  function showModelStatus(availability) {
    modelReady = availability === 'available';
    const canEnable = availability === 'downloadable' || availability === 'downloading';
    enable.hidden = !canEnable;
    if (canEnable) details.open = true;
    modelStatus.textContent = modelReady
      ? 'On-device AI is ready. Ask a question to use it.'
      : canEnable
        ? 'Enable on-device AI to prepare the model in this browser.'
        : 'On-device AI is unavailable in this browser. Wikipedia, calculations, and conversions are still available.';
    followUp.hidden = !modelReady || !lastAnswer?.canContinue;
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

  function showAnswer({ label, text, source, question, topic, canContinue = false }) {
    lastAnswer = { question, topic, text, source, canContinue };
    status.textContent = '';
    result.hidden = false;
    resultTitle.textContent = label;
    reply.textContent = text;
    copy.hidden = label === 'AI unavailable';
    followUp.hidden = !modelReady || !canContinue;
    searchTopic.hidden = !topic;
    if (topic) searchTopic.href = `#web-search?${new URLSearchParams({ q: topic })}`;
    resultActions.hidden = copy.hidden && followUp.hidden && searchTopic.hidden;
    credits.replaceChildren();
    if (source) {
      credits.append(link(source.url, `Wikipedia · ${source.title}`),
        link('https://creativecommons.org/licenses/by-sa/4.0/', 'CC BY-SA 4.0'));
    }
  }

  function setFollowUp(enabled) {
    followingUp = enabled;
    contextNote.hidden = !enabled;
    contextTopic.textContent = enabled ? `Following up on “${lastAnswer.topic}”` : '';
    if (enabled) input.setAttribute('aria-describedby', contextNote.id);
    else input.removeAttribute('aria-describedby');
    input.placeholder = enabled ? 'Ask about this answer' : 'Ask a question, calculate, or convert units';
    submit.textContent = enabled ? 'Send follow-up' : 'Ask AI';
  }

  function startQuestion(enabled) {
    pending?.abort();
    pending = undefined;
    stop.hidden = true;
    result.hidden = !lastAnswer;
    status.textContent = '';
    setFollowUp(enabled);
    input.value = '';
    input.focus();
  }

  followUp.addEventListener('click', () => startQuestion(true));
  newQuestion.addEventListener('click', () => startQuestion(false));
  searchTopic.addEventListener('click', event => {
    if (!lastAnswer?.topic || !onSearchTopic || event.button !== 0 ||
        event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onSearchTopic(lastAnswer.topic);
  });

  stop.addEventListener('click', () => {
    pending?.abort();
    pending = undefined;
    stop.hidden = true;
    result.hidden = !lastAnswer;
    status.textContent = 'Answer stopped.';
    input.focus();
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) {
      status.textContent = 'Enter a question or calculation.';
      return;
    }
    pending?.abort();
    pending = undefined;
    stop.hidden = true;
    const context = followingUp ? lastAnswer : undefined;
    const topic = context?.topic ?? question.slice(0, 200);
    if (!context) onQuery?.(question);
    const computed = !context && localAssistantAnswer(question);
    if (computed) {
      showAnswer({ label: computed.title, text: computed.text, question });
      return;
    }

    const request = new window.AbortController();
    pending = request;
    const { signal } = request;
    const withTimeout = duration => window.AbortSignal.any([signal, window.AbortSignal.timeout(duration)]);
    const shouldLookUp = !context && useWikipedia.checked && question.length <= 200;
    stop.hidden = false;
    result.hidden = !context;
    status.textContent = context ? 'Working on your follow-up…'
      : shouldLookUp ? 'Looking up context and checking the browser model…' : 'Checking the browser model…';

    try {
      const articles = shouldLookUp ? await searchWikipedia(question, withTimeout(5000), 1).catch(() => []) : [];
      if (signal.aborted) return;
      const source = context?.source ?? articles[0];
      const videos = findVideos(topic);
      const answer = await generateSearchAnswer(question, source, videos, withTimeout(12000), context).catch(() => '');
      if (signal.aborted) return;
      if (answer) {
        showModelStatus('available');
        showAnswer({ label: 'On-device AI answer', text: answer, source, question, topic: source?.title || topic, canContinue: true });
        if (context) {
          input.value = '';
          setFollowUp(true);
        }
      } else if (context) {
        status.textContent = 'The on-device model could not answer the follow-up. You can try again or start a new question.';
      } else if (source) {
        showAnswer({ label: 'Wikipedia excerpt', text: source.text, source, question, topic: source.title, canContinue: true });
      } else {
        const message = shouldLookUp
          ? 'A ready browser model and a Wikipedia excerpt are unavailable for this question.'
          : 'A ready browser model is unavailable. For a short topic question, you can enable Wikipedia lookup under Sources and on-device AI.';
        showAnswer({ label: 'AI unavailable', text: message, question, topic });
      }
    } catch {
      if (!signal.aborted) {
        result.hidden = !lastAnswer;
        status.textContent = 'The answer could not be completed. Try again.';
      }
    } finally {
      if (pending === request) {
        pending = undefined;
        stop.hidden = true;
      }
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

  root.append(title, description, contextNote, form, suggestions, details, status, result);
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

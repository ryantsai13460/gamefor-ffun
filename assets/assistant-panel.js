const assetVersion = new URL(import.meta.url).search;
const [{
  assistantReferences,
  builtInSearchGuide,
  generateSearchAnswer,
  localAssistantAnswer,
  prepareSearchModel,
  searchAnswerInstructions,
  searchAnswerPrompt,
  searchModelAvailability,
}, { cpuBlipAvailability, cpuBlipReady, prepareCpuBlipModel, runCpuBlipPrompt }, { formatBlipReply },
{ gatewayConnected, hostedBlipReply, renderGatewaySettings }] = await Promise.all([
  import(`./search-answer.js${assetVersion}`), import(`./blip-cpu.js${assetVersion}`),
  import(`./blip-format.js${assetVersion}`), import(`./service-gateway.js${assetVersion}`)
]);

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
  const panelId = ++panelCount;
  const root = element('section', 'assistant-panel');
  const title = element('h2', 'assistant-title', 'AI Help');
  const description = element('p', 'muted assistant-intro', 'Ask for an explanation, writing help, or a plan. Calculations and unit conversions work locally.');
  const form = element('form', 'assistant-form');
  form.id = `assistant-form-${panelId}`;
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
  contextNote.id = `assistant-context-${panelId}`;
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
  const cpuStatus = element('p', 'muted assistant-model-status');
  cpuStatus.setAttribute('role', 'status');
  const enableCpu = button('button', 'Download CPU model (271 MB)');
  enableCpu.hidden = true;
  const stopCpu = button('button', 'Cancel model download');
  stopCpu.hidden = true;
  const cpuActions = element('div', 'assistant-actions');
  cpuActions.append(enableCpu, stopCpu);
  settings.append(sourceOption, sourceDetail, modelStatus, enable, cpuStatus, cpuActions);
  details.append(settings);

  const connected = element('details', 'assistant-options assistant-connected');
  connected.append(element('summary', '', 'Connected AI'));
  const connectedSettings = element('div', 'assistant-settings');
  const connectedStatus = element('p', 'muted');
  connectedStatus.setAttribute('role', 'status');
  const connectedPrivacy = element('p', 'muted', 'Asking the connected model shares your question and, for a follow-up, the previous question and answer with your provider. These requests use the owner’s quota.');
  const researchOption = element('label', 'settings-option assistant-source-option');
  const research = element('input');
  research.type = 'checkbox';
  const researchHelp = element('p', 'muted', 'Web research sends questions of up to 200 characters to Brave Search and adds citations when the connected gateway provides sources.');
  researchHelp.id = `assistant-research-${panelId}`;
  research.setAttribute('aria-describedby', researchHelp.id);
  researchOption.append(research, element('span', '', 'Use web research for sources'));
  const hostedSubmit = button('button', 'Ask connected AI');
  hostedSubmit.type = 'submit';
  hostedSubmit.setAttribute('form', form.id);
  connectedSettings.append(connectedStatus, connectedPrivacy);
  renderGatewaySettings(connectedSettings, 'Connect an AI provider', () => {
    research.checked = false;
    syncConnected();
  });
  connectedSettings.append(researchOption, researchHelp, hostedSubmit);
  connected.append(connectedSettings);
  connected.addEventListener('toggle', syncConnected);

  const status = element('p', 'muted assistant-status');
  status.setAttribute('role', 'status');
  const announcement = element('p', 'sr-only');
  announcement.setAttribute('role', 'status');
  const result = element('article', 'assistant-result');
  result.hidden = true;
  const resultTitle = element('h3', 'assistant-result-title');
  resultTitle.id = `assistant-answer-${panelId}`;
  result.setAttribute('aria-labelledby', resultTitle.id);
  const reply = element('div', 'assistant-result-text');
  const credits = element('div', 'assistant-credits');
  const related = element('div', 'assistant-related');
  const copy = button('button assistant-copy', 'Copy answer');
  const followUp = button('button', 'Ask a follow-up');
  const searchTopic = element('a', 'button', 'Search web and YouTube');
  const resultActions = element('div', 'assistant-actions');
  resultActions.append(copy, followUp, searchTopic);
  result.append(resultTitle, reply, credits, related, resultActions);

  const lifetime = new window.AbortController();
  let pending;
  let lastAnswer;
  let followingUp = false;
  let modelReady = false;
  let cpuSetup;

  function syncConnected() {
    const ready = gatewayConnected();
    hostedSubmit.disabled = research.disabled = !ready;
    if (!ready) research.checked = false;
    connectedStatus.textContent = ready ? 'A gateway is configured in this tab. Check the backend to verify its features.'
      : 'Connect your authorized gateway to use hosted answers.';
  }
  syncConnected();

  function syncFollowUp() {
    followUp.hidden = !lastAnswer?.canContinue || (!modelReady && !cpuBlipReady() && !lastAnswer.connected);
  }

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
    syncFollowUp();
  }

  function showCpuStatus(availability) {
    enableCpu.hidden = availability !== 'downloadable';
    cpuStatus.textContent = availability === 'available' ? 'The CPU model is ready to answer locally.'
      : availability === 'downloading' ? 'The CPU model is being prepared.'
      : availability === 'downloadable' ? 'The optional CPU model runs on this device after its download.' : '';
    syncFollowUp();
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

  enableCpu.addEventListener('click', async () => {
    const setup = new AbortController();
    cpuSetup = setup;
    const signal = AbortSignal.any([setup.signal, lifetime.signal]);
    enableCpu.disabled = true;
    stopCpu.hidden = false;
    try {
      await prepareCpuBlipModel(signal, (fraction, stage) => {
        if (!signal.aborted) cpuStatus.textContent = `${stage} · ${Math.round(fraction * 100)}%`;
      });
      if (!signal.aborted) showCpuStatus('available');
    } catch {
      if (!lifetime.signal.aborted) cpuStatus.textContent = setup.signal.aborted
        ? 'Model download canceled.' : 'The CPU model could not be prepared. You can try again.';
    } finally {
      cpuSetup = undefined;
      enableCpu.disabled = false;
      stopCpu.hidden = true;
    }
  });
  stopCpu.addEventListener('click', () => cpuSetup?.abort());

  function drawAnswer(answer) {
    result.hidden = !answer;
    if (!answer) return;
    const { label, text, topic, sources = [], videos = [], formatted } = answer;
    resultTitle.textContent = label;
    reply.replaceChildren();
    if (formatted) {
      // Only reference numbers may turn into links. Model-written URLs are unverified.
      formatBlipReply(reply, text.replace(/\[([^\]\n]+)\]\([^\s)]+\)/gu, '$1'), sources);
    } else {
      reply.textContent = text;
    }
    copy.hidden = label === 'AI unavailable';
    syncFollowUp();
    searchTopic.hidden = !topic;
    if (topic) searchTopic.href = `#web-search?${new URLSearchParams({ q: topic })}`;
    resultActions.hidden = copy.hidden && followUp.hidden && searchTopic.hidden;
    credits.replaceChildren();
    if (sources.length) {
      const list = element('ol');
      for (const source of sources) {
        const item = element('li');
        item.append(link(source.url, source.title));
        list.append(item);
      }
      credits.append(element('h4', '', 'Sources'), list);
      if (sources.some(source => source.text)) {
        credits.append(link('https://creativecommons.org/licenses/by-sa/4.0/', 'Wikipedia excerpts · CC BY-SA 4.0'));
      }
    }
    related.replaceChildren();
    if (videos.length) {
      const list = element('ul');
      for (const video of videos) {
        const item = element('li');
        const url = video.short ? `https://www.youtube.com/shorts/${video.id}` : `https://www.youtube.com/watch?v=${video.id}`;
        item.append(link(url, [video.title, video.creator].filter(Boolean).join(' · ')));
        list.append(item);
      }
      related.append(element('h4', '', 'Related videos'), list);
    }
  }

  function showAnswer(answer, message = '') {
    lastAnswer = answer;
    drawAnswer(answer);
    status.textContent = message;
    announcement.textContent = answer.label === 'AI unavailable' ? 'Answer unavailable.' : `${answer.label} ready.`;
  }

  function showPartial(label, text) {
    result.hidden = false;
    resultTitle.textContent = label;
    reply.textContent = text;
    credits.replaceChildren();
    related.replaceChildren();
    resultActions.hidden = true;
  }

  function relatedVideos(topic) {
    const matches = new Map();
    for (const video of findVideos(topic)) {
      if (/^[A-Za-z0-9_-]{11}$/.test(video.id) && video.title && !matches.has(video.id)) matches.set(video.id, video);
      if (matches.size >= 3) break;
    }
    return [...matches.values()];
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
    drawAnswer(lastAnswer);
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
    drawAnswer(lastAnswer);
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
    drawAnswer(lastAnswer);
    const online = event.submitter === hostedSubmit;
    const withResearch = online && research.checked;
    const context = followingUp ? lastAnswer : undefined;
    const topic = context?.topic ?? question.slice(0, 200);
    if (!context) onQuery?.(question);
    const computed = !context && localAssistantAnswer(question);
    if (computed) {
      showAnswer({ label: computed.title, text: computed.text, question });
      return;
    }
    if (online && !gatewayConnected()) {
      syncConnected();
      status.textContent = 'Connect your authorized gateway before asking the connected model.';
      return;
    }
    if (withResearch && question.length > 200) {
      status.textContent = 'Shorten the question to 200 characters or turn off web research.';
      return;
    }

    const request = new window.AbortController();
    pending = request;
    const { signal } = request;
    const withTimeout = duration => window.AbortSignal.any([signal, window.AbortSignal.timeout(duration)]);
    const guide = !context && builtInSearchGuide(question);
    const shouldLookUp = !online && !context && !guide && useWikipedia.checked && question.length <= 200;
    stop.hidden = false;
    announcement.textContent = '';
    drawAnswer(context);
    status.textContent = context ? 'Working on your follow-up…'
      : shouldLookUp ? 'Looking up context and checking the browser model…' : 'Checking the browser model…';

    try {
      const videos = relatedVideos(topic);
      let connectedFailure = '';
      if (online) {
        const label = withResearch ? 'Connected research answer' : 'Connected AI answer';
        status.textContent = withResearch ? 'Looking up live sources and waiting for the model…' : 'Waiting for the connected model…';
        let sources = [];
        try {
          const text = await hostedBlipReply({
            text: question,
            history: context ? [{ role: 'user', text: context.question }, { role: 'assistant', text: context.text }] : [],
            mode: 'think', research: withResearch, signal: withTimeout(65000),
            onSources(value) { sources = value; },
            onUpdate(value) { if (!signal.aborted) showPartial(label, value); }
          });
          if (signal.aborted) return;
          showAnswer({ label, text, sources, videos, question, topic, formatted: true, canContinue: true, connected: true });
          if (context) {
            input.value = '';
            setFollowUp(true);
          }
          return;
        } catch (error) {
          if (signal.aborted) return;
          connectedFailure = error.message || 'The connected model could not answer.';
          status.textContent = 'The connected model could not finish. Checking local options…';
          drawAnswer(context);
        }
      }

      const sources = context?.sources || (shouldLookUp ? await assistantReferences(question, withTimeout(5000)).catch(() => []) : []);
      if (signal.aborted) return;
      let label = 'On-device AI answer';
      let answer = await generateSearchAnswer(question, sources, videos, withTimeout(30000), context,
        value => { if (!signal.aborted) showPartial(label, value); }).catch(() => '');
      if (!answer && !signal.aborted && cpuBlipReady()) {
        label = 'CPU on-device AI answer';
        status.textContent = 'The CPU model is answering on this device…';
        answer = await runCpuBlipPrompt([
          { role: 'system', content: searchAnswerInstructions },
          { role: 'user', content: searchAnswerPrompt(question, sources, videos, context) }
        ], 'think', withTimeout(90000), value => { if (!signal.aborted) showPartial(label, value); }).catch(() => '');
      }
      if (signal.aborted) return;
      if (answer) {
        if (label === 'On-device AI answer') showModelStatus('available');
        showAnswer({ label, text: answer, sources, videos, question, topic, canContinue: true, formatted: true },
          connectedFailure ? 'The connected model could not finish. This answer was generated on this device.' : '');
        if (context) {
          input.value = '';
          setFollowUp(true);
        }
      } else if (context) {
        drawAnswer(context);
        status.textContent = connectedFailure || 'A ready local model could not answer this follow-up. Try again or start a new question.';
      } else if (guide) {
        showAnswer({ ...guide, question, topic, videos, formatted: true },
          connectedFailure ? 'The connected model could not finish. A built-in guide is available.' : '');
      } else if (sources.length) {
        showAnswer({ label: 'Wikipedia excerpt', text: sources[0].text, sources, videos, question, topic: sources[0].title, canContinue: true });
      } else {
        const message = connectedFailure || (shouldLookUp
          ? 'A ready local model and a related Wikipedia excerpt are unavailable for this question.'
          : 'A ready local model is unavailable. You can enable a model or look up a short topic under Sources and on-device AI.');
        showAnswer({ label: 'AI unavailable', text: message, question, topic, videos });
      }
    } catch {
      if (!signal.aborted) {
        drawAnswer(lastAnswer);
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
      await window.navigator.clipboard.writeText(lastAnswer.text);
      status.textContent = 'Answer copied.';
    } catch {
      status.textContent = 'Select the answer text to copy it.';
    }
  });

  root.append(title, description, contextNote, form, suggestions, details, connected, status, announcement, result);
  target.append(root);
  searchModelAvailability().catch(() => 'unavailable').then(availability => {
    if (!lifetime.signal.aborted) showModelStatus(availability);
  });
  cpuBlipAvailability().catch(() => 'unavailable').then(availability => {
    if (!lifetime.signal.aborted) showCpuStatus(availability);
  });

  return () => {
    lifetime.abort();
    pending?.abort();
    root.remove();
  };
}

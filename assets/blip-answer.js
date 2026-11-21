import { localAssistantAnswer, searchModelAvailability, searchWikipedia } from './search-answer.js';

export { prepareSearchModel as prepareBlipModel, searchModelAvailability as blipModelAvailability } from './search-answer.js';

export const blipModes = Object.freeze({
  quick: Object.freeze({
    id: 'quick',
    label: 'Quick',
    description: 'Get a direct answer with the key details.',
    example: 'Why do leaves change color in autumn?'
  }),
  think: Object.freeze({
    id: 'think',
    label: 'Think it through',
    description: 'Work through a decision or a problem.',
    example: 'Help me choose a first project for learning JavaScript.'
  }),
  brainstorm: Object.freeze({
    id: 'brainstorm',
    label: 'Brainstorm',
    description: 'Get several ideas you can build on.',
    example: 'Suggest three game ideas I could build in a weekend.'
  }),
  study: Object.freeze({
    id: 'study',
    label: 'Study buddy',
    description: 'Learn with examples and a practice question.',
    example: 'Teach me how to compare two fractions.'
  })
});

const modeInstructions = {
  quick: 'Give the direct answer first. Keep it brief unless the user asks for detail.',
  think: 'Give a clear conclusion. Explain the key factors or steps the user can verify. Compare realistic options when helpful and point out assumptions that affect the conclusion.',
  brainstorm: 'Offer several distinct ideas and a concrete starting point for each. Adapt to the user’s constraints and skip repetitive suggestions.',
  study: 'Explain the idea in plain language, give an example, and end with one short practice question. If the user is already answering one, respond with helpful feedback before continuing.'
};

const maxMessageLength = 3_000;
const maxHistoryMessages = 8;
const maxHistoryLength = 4_400;
const maxHistoryMessageLength = 900;
const maxWikipediaQueryLength = 200;

function readHistory(history, currentText) {
  if (!Array.isArray(history)) return [];
  const context = [];
  let remaining = maxHistoryLength;
  for (const message of history.slice(-maxHistoryMessages).reverse()) {
    if (message?.kind === 'unavailable') continue;
    const role = message?.role;
    if (role !== 'user' && role !== 'assistant') continue;
    const value = typeof message.text === 'string' ? message.text : message.content;
    const content = typeof value === 'string' ? value.trim() : '';
    if (!content || context[0]?.role === role) continue;
    if (!context.length && role === 'user' && content === currentText) continue;
    const excerpt = content.slice(0, Math.min(remaining, maxHistoryMessageLength));
    context.unshift({ role, content: excerpt });
    remaining -= excerpt.length;
    if (!remaining) break;
  }
  if (context[0]?.role === 'assistant') context.shift();
  return context;
}

async function promptModel(text, history, mode, signal) {
  const modeInstruction = Object.hasOwn(modeInstructions, mode) ? modeInstructions[mode] : modeInstructions.quick;
  const instruction = [
    'You are Blip, an assistant for questions, writing, planning, and learning.',
    'Follow the user’s latest request and use the conversation when relevant. State important uncertainty and avoid making up facts, sources, or actions. Write in plain text.',
    modeInstruction
  ].join(' ');
  const model = await globalThis.LanguageModel.create({
    signal,
    initialPrompts: [{ role: 'system', content: instruction }, ...readHistory(history, text)]
  });
  try {
    signal?.throwIfAborted();
    const answer = await model.prompt(text, { signal });
    signal?.throwIfAborted();
    return typeof answer === 'string' ? answer.trim() : '';
  } finally {
    model.destroy();
  }
}

export async function answerBlip({ text, history = [], mode = 'quick', wikipedia = false, signal, onStage }) {
  signal?.throwIfAborted();
  const message = typeof text === 'string' ? text.trim() : '';
  if (!message) return { kind: 'unavailable', title: 'Enter a message', text: 'Type a question or describe what you need help with.' };
  if (message.length > maxMessageLength) {
    return { kind: 'unavailable', title: 'Message too long', text: `Send up to ${maxMessageLength.toLocaleString('en-US')} characters in one message.` };
  }

  const local = localAssistantAnswer(message.replace(/(?<=[a-z])\.$/i, ''));
  if (local) return { kind: local.title === 'Calculator' ? 'calculator' : 'conversion', ...local };

  onStage?.('checking');
  const availability = await searchModelAvailability().catch(() => 'unavailable');
  signal?.throwIfAborted();
  if (availability === 'available' && typeof globalThis.LanguageModel?.create === 'function') {
    onStage?.('generating');
    const answer = await promptModel(message, history, mode, signal).catch(() => '');
    signal?.throwIfAborted();
    if (answer) return { kind: 'model', title: 'On-device AI', text: answer };
  }

  if (wikipedia === true && message.length <= maxWikipediaQueryLength) {
    onStage?.('searching');
    const timeout = AbortSignal.timeout(6_000);
    const lookupSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    const [source] = await searchWikipedia(message, lookupSignal, 1).catch(() => []);
    signal?.throwIfAborted();
    if (source) return { kind: 'wikipedia', title: 'Wikipedia excerpt', text: source.text, source };
    return { kind: 'unavailable', title: 'Answer unavailable', text: 'The on-device model did not return an answer, and no Wikipedia excerpt was available. Try a shorter topic or check your connection.' };
  }

  return {
    kind: 'unavailable',
    title: 'On-device AI unavailable',
    text: 'An on-device answer is unavailable right now. You can still calculate, convert units, or enable Wikipedia lookup for a short topic.'
  };
}

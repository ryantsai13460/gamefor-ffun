export const blipGenerationModes = Object.freeze({
  quick: {
    local: 'Answer in one short paragraph unless the user asks for more.',
    hosted: 'Lead with the answer. Keep simple questions brief and expand only as needed.',
    cpuTokens: 96, webGpuTokens: 144, workersAiTokens: 512, temperature: .22,
  },
  think: {
    local: 'For a decision, give one reason and a next step. Follow the requested length and format.',
    hosted: 'Give a conclusion and the key reasons the user can check. For a decision, compare realistic options against the user’s constraints and recommend one. If an assumption changes the result, state it.',
    cpuTokens: 224, webGpuTokens: 368, workersAiTokens: 768, temperature: .28,
  },
  brainstorm: {
    local: 'Give distinct ideas that fit the request. Include one practical detail for each.',
    hosted: 'Give distinct ideas grounded in the user’s constraints. Add a practical starting point for each and identify which option is easiest to try when that helps.',
    cpuTokens: 184, webGpuTokens: 288, workersAiTokens: 640, temperature: .68,
  },
  study: {
    local: 'Explain simply, give a short example or practice question, and respond to the learner’s answer when present.',
    hosted: 'Explain the key idea in plain language, give a short example or practice question, and offer specific feedback on a learner’s answer. For calculations, show units and a quick check.',
    cpuTokens: 204, webGpuTokens: 320, workersAiTokens: 640, temperature: .26,
  },
  code: {
    local: 'Give a minimal runnable example in the requested language. Use a fenced code block and show an expected result.',
    hosted: 'Use the requested language and environment. Give a minimal runnable example in a fenced code block with an expected result or a targeted test. For debugging, identify the cause and propose a focused fix. Only report tests that were actually run.',
    cpuTokens: 272, webGpuTokens: 416, workersAiTokens: 768, temperature: .2,
  },
  creative: {
    local: 'Write the requested piece in the specified style and length. Keep the user’s names and ideas consistent.',
    hosted: 'Write the requested piece, scene, dialogue, or ideas directly. Use the specified voice, length, and form. Keep names, settings, and continuity consistent across revisions. Prefer specific details.',
    cpuTokens: 240, webGpuTokens: 400, workersAiTokens: 768, temperature: .7,
  },
  games: {
    local: 'Give steps for the game the user named. Say when advice depends on a version you cannot verify.',
    hosted: 'Give actionable steps for the named game and version. Separate general strategies from version-specific facts. Say when a current detail needs verification.',
    cpuTokens: 152, webGpuTokens: 256, workersAiTokens: 576, temperature: .3,
  },
});

export function blipGenerationMode(mode) {
  return Object.hasOwn(blipGenerationModes, mode) ? blipGenerationModes[mode] : blipGenerationModes.quick;
}

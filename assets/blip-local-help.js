const assetVersion = new URL(import.meta.url).search;
const { builtInSearchGuide } = await import(`./search-answer.js${assetVersion}`);

const greetings = new Set(['hi', 'hello', 'hey', 'yo', 'sup', 'wsp', 'wassup', 'whats up', 'what is up', 'how are you', 'good morning', 'good afternoon', 'good evening']);
const checkIns = new Set(['are you good', 'are u good', 'you good', 'are you okay', 'how are you doing', 'how are u', 'how r u', 'hows it going', 'how is it going']);
const onboarding = new Set(['who are you', 'what are you', 'what can you do', 'what can you help me with', 'how can you help', 'how can you help me', 'can you help', 'can you help me', 'help', 'help me', 'how do i get started', 'where do i start', 'what do i do', 'how do i use', 'how do i use this']);
const schoolHelp = new Set(['help me with school', 'help me with homework', 'help me with my homework', 'help me study', 'i need help with homework']);
const localReply = (title, text) => ({ kind: 'local', title, text });

function plainPhrase(text) {
  return text.toLowerCase().replace(/[’']/g, '').replace(/[.!?]+$/, '').replace(/[,\s]+blip(?:\.ai)?$/, '').replace(/\s+/g, ' ');
}

export function blipOnboardingReply(text) {
  const phrase = plainPhrase(text);
  if (greetings.has(phrase)) {
    return localReply('Built-in greeting', 'Hey! Want to plan something, practice a topic, or try a quick calculation?');
  }
  if (checkIns.has(phrase)) return localReply('Built-in reply', 'I’m here and ready to help. What are you working on?');
  if (onboarding.has(phrase)) {
    return localReply('About Blip', 'I’m Blip, the arcade’s assistant. Try a built-in study plan, a calculation, or a beginner coding example.\n\n- Make a 20-minute algebra study plan.\n- Which is greater, 3/5 or 5/8?\n- Show me how to filter a list in JavaScript.\n\nSet up an AI model for open-ended questions, writing help, and follow-up answers.');
  }
  return ['thanks', 'thank you', 'thx'].includes(phrase) ? localReply('Built-in reply', 'You’re welcome!') : null;
}

function compareFractions(text) {
  if (!/\b(?:compare|greater|larger|bigger|smaller|less|higher|lower)\b/i.test(text)) return null;
  const fractions = [...text.replaceAll('−', '-')
    .matchAll(/(?<![\p{L}\p{N}./-])(?:(-?\d{1,6})\s+)?(-?\d{1,6})\s*\/\s*(-?\d{1,6})(?![\p{L}\p{N}/]|\.\d)/gu)];
  if (fractions.length === 2) {
    const [[a, b], [c, d]] = fractions.map(([, whole, numerator, denominator]) => {
      const sign = denominator.startsWith('-') ? -1n : 1n;
      const bottom = BigInt(denominator) * sign;
      const top = BigInt(numerator) * sign;
      const wholeDirection = whole?.startsWith('-') ? -1n : 1n;
      return [whole ? BigInt(whole) * bottom + wholeDirection * top : top, bottom];
    });
    if (b === 0n || d === 0n) return localReply('Built-in fractions comparison', 'A fraction with a zero denominator is undefined. Check the denominators and try the comparison again.');
    const left = a * d;
    const right = c * b;
    const relation = left === right ? 'equals' : left > right ? 'is greater than' : 'is less than';
    const shared = b * d;
    return localReply('Built-in fractions comparison', `${fractions[0][0]} ${relation} ${fractions[1][0]}.\n\nUse the shared denominator ${shared}. The first number becomes ${left}/${shared}, and the second becomes ${right}/${shared}. With the same positive denominator, compare ${left} and ${right}.`);
  }
  if (/\bfractions?\b/i.test(text)) {
    return localReply('Built-in fractions lesson', 'Give both fractions the same denominator, then compare the numerators. For example, 2/3 is 8/12 and 3/4 is 9/12, so 3/4 is larger.\n\nTry it. Which is larger, 3/5 or 5/8?');
  }
  return null;
}

function studyPlan(text) {
  const requested = Number(/\b(\d{1,3})\s*[- ]?\s*min(?:ute)?s?\b/i.exec(text)?.[1]);
  const duration = requested >= 5 && requested <= 240 ? requested : 20;
  const recall = Math.max(1, Math.round(duration * .2));
  const practice = Math.max(1, Math.round(duration * .45));
  const check = Math.min(duration - recall - practice - 1, Math.max(1, Math.round(duration * .25)));
  const review = duration - recall - practice - check;
  const plan = /\b(?:study|revision|review|learning)\s+(?:plan|schedule|routine)\b/i.exec(text);
  const beforePlan = plan ? text.slice(0, plan.index).trim()
    .replace(/^(?:please\s+)?(?:help me\s+)?(?:make|create|build|give me|write|draft|i need)\s+/i, '')
    .replace(/^(?:a|an|the|my)\s+/i, '')
    .replace(/^\d{1,3}\s*[- ]?\s*min(?:ute)?s?\b\s*/i, '') : '';
  const afterPlan = /\b(?:plan|schedule|routine|study|prepare)\s+(?:for|about|on)\s+([\p{L}][\p{L}\p{N} ’'-]{0,48})(?:[.!?]|$)/iu.exec(text)?.[1];
  const subject = (afterPlan || beforePlan || '').trim().replace(/^(?:a|an|the|my)\s+/i, '');
  const topic = /^[\p{L}][\p{L}\p{N} ’'-]{0,48}$/u.test(subject) && !/^(?:a|an|the|my)$/i.test(subject) ? ` for ${subject}` : '';
  return localReply('Built-in study plan', `${duration}-minute study plan${topic}\n\n${recall} min · Write down what you remember without notes.\n${practice} min · Do practice problems or recall the main ideas aloud.\n${check} min · Check the answers and revisit any gaps.\n${review} min · Pick one thing to review tomorrow.`);
}

function codeExample(title, explanation, language, code) {
  const fence = '```';
  return localReply(title, explanation + '\n\n' + fence + language + '\n' + code + '\n' + fence);
}

function codingHelp(text, mode) {
  const python = /\bpython\b/i.test(text);
  const javascript = /\b(?:javascript|js)\b/i.test(text);
  const coding = python || javascript || mode === 'code';
  if (/\b(?:first|beginner)\b.*\bproject\b/i.test(text) && javascript) {
    return localReply('Built-in JavaScript project guide', 'Build a one-page book list. Start with two book titles in an array and display them on screen.\n\n1. Add a text input and an Add button.\n2. When clicked, trim the input and append the title when it has text.\n3. Draw the updated list and test an empty input.\n4. Add a search box once adding books works.');
  }
  if (!coding) return null;
  if (/\bfilter\b/i.test(text) && /\b(?:list|array|titles|items|filter\s+method)\b/i.test(text) &&
      /\b(?:how|show|explain|example|learn)\b/i.test(text)) {
    if (python) {
      return codeExample('Built-in Python filtering example', 'A list comprehension keeps each title that passes the condition. This one keeps titles that contain “ch”, ignoring capitalization.',
        'python', 'games = ["Chess", "Checkers", "Sudoku"]\nmatches = [title for title in games if "ch" in title.lower()]\nprint(matches)  # ["Chess", "Checkers"]');
    }
    if (javascript || !/\b(?:java|ruby|swift|kotlin|rust|php|go|typescript)\b|c\+\+|c#/i.test(text)) {
      return codeExample('Built-in JavaScript filtering example', 'The filter method keeps an item when the callback returns true. This example keeps titles that contain “ch”, ignoring capitalization.',
        'js', 'const games = ["Chess", "Checkers", "Sudoku"];\nconst matches = games.filter(title => title.toLowerCase().includes("ch"));\nconsole.log(matches); // ["Chess", "Checkers"]');
    }
  }
  if (/\bhello[\s,]+world\b/i.test(text) && (python || javascript)) {
    return python
      ? codeExample('Built-in Python example', 'Run this line in Python to print a greeting.', 'python', 'print("Hello, world!")')
      : codeExample('Built-in JavaScript example', 'Run this line in a browser console or Node.js to print a greeting.', 'js', 'console.log("Hello, world!");');
  }
  if (/\b(?:explain|example|what is|how (?:do|does))\b.*\bfor loop\b/i.test(text) && (python || javascript)) {
    return python
      ? codeExample('Built-in Python loop example', 'The loop runs once for each value from 1 through 3. Python leaves out the end value of range.', 'python', 'for number in range(1, 4):\n    print(number)')
      : codeExample('Built-in JavaScript loop example', 'The loop starts at 1, adds one each time, and stops after printing 3.', 'js', 'for (let number = 1; number <= 3; number++) {\n  console.log(number);\n}');
  }
  if (/\b(?:how (?:do|should|can) i debug|debugging (?:steps|tips)|help me debug)\b/i.test(text)) {
    return localReply('Built-in debugging checklist', '1. Copy the exact error and the line it points to.\n2. Reproduce the problem with the smallest input you can.\n3. Print or inspect values just before that line. Compare them to what you expected.\n4. Change one thing and rerun the same input.\n\nShare the error, the relevant code, and what you expected to happen for more specific help.');
  }
  return null;
}

export function blipOfflineReply(text, mode) {
  if (schoolHelp.has(plainPhrase(text))) {
    return localReply('Built-in school help', 'Tell me the subject and where you’re stuck. If you have a practice problem, paste it with any work you’ve tried. For a quiz or test, tell me the topic and how much time you have.\n\nTry “Make a 15-minute chemistry study plan” or “Compare 7/8 and 5/6.”');
  }
  const fractions = compareFractions(text);
  if (fractions) return fractions;
  if (/\b(?:study|revision|review|learning)\s+(?:plan|schedule|routine)\b|\b(?:plan|schedule)\s+(?:a\s+)?(?:study|review|revision)\b|\b(?:help me|how (?:can|should|do) i)\s+(?:study|prepare)\s+for\b/i.test(text)) {
    return studyPlan(text);
  }
  const code = codingHelp(text, mode);
  if (code) return code;
  if (/\b(?:essay|report)\b/i.test(text)) {
    const guide = builtInSearchGuide(text);
    if (guide?.label === 'Built-in writing guide') return localReply(guide.label, guide.text);
  }
  if (/\b(?:make|create|build|draft|outline|plan)\b.*\b(?:plan|schedule|routine|my week|my day|this project)\b/i.test(text)) {
    return localReply('Built-in planning checklist', '1. Write the outcome and when you want it done.\n2. Split it into three small steps with a clear finish for each.\n3. Put the first step on your calendar and gather what you need.\n4. Check what worked before scheduling the next step.');
  }
  if (mode === 'study' && /^(?:please\s+)?(?:help me\s+|how (?:do|should|can) i\s+)?(?:study|revise|review|quiz myself|practice)\b/i.test(text)) {
    return localReply('Built-in study routine', 'Choose one concept and explain it in your own words without opening your notes. Then check the explanation and fix the biggest gap. Make one question you can answer tomorrow without rereading.');
  }
  return null;
}

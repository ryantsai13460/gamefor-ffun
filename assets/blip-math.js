const mathNamespace = 'http://www.w3.org/1998/Math/MathML';
const symbols = new Map([
  ['\\pi', 'π'], ['\\theta', 'θ'], ['\\alpha', 'α'], ['\\beta', 'β'], ['\\gamma', 'γ'],
  ['\\Delta', 'Δ'], ['\\delta', 'δ'], ['\\lambda', 'λ'], ['\\mu', 'μ'], ['\\sigma', 'σ'],
  ['\\omega', 'ω'], ['\\phi', 'φ'], ['\\epsilon', 'ε'], ['\\infty', '∞'], ['\\times', '×'],
  ['\\cdot', '⋅'], ['\\div', '÷'], ['\\pm', '±'], ['\\mp', '∓'], ['\\ge', '≥'], ['\\geq', '≥'],
  ['\\le', '≤'], ['\\leq', '≤'], ['\\ne', '≠'], ['\\neq', '≠'], ['\\approx', '≈'], ['\\equiv', '≡'],
  ['\\sum', '∑'], ['\\prod', '∏'], ['\\int', '∫'], ['\\partial', '∂'], ['\\to', '→'], ['\\in', '∈'],
  ['\\sin', 'sin'], ['\\cos', 'cos'], ['\\tan', 'tan'], ['\\log', 'log'], ['\\ln', 'ln'], ['\\lim', 'lim'],
]);

function mathNode(tag, ...children) {
  const node = document.createElementNS(mathNamespace, tag);
  node.append(...children);
  return node;
}

export function renderBlipMath(expression, display = false) {
  if (typeof MathMLElement !== 'function' || !expression.trim() || expression.length > 900) return null;
  const tokens = expression.match(/\\[a-zA-Z]+|\\[{}%_$|,;! ]|\d+(?:\.\d+)?|[^\s]/gu) || [];
  let position = 0;

  function atom(depth) {
    if (depth > 12 || position >= tokens.length) throw new Error('Incomplete equation');
    const token = tokens[position++];
    if (token === '{') {
      const contents = row(depth + 1);
      if (tokens[position++] !== '}') throw new Error('Unclosed group');
      return contents;
    }
    if (['\\frac', '\\dfrac', '\\tfrac'].includes(token)) return mathNode('mfrac', atom(depth + 1), atom(depth + 1));
    if (token === '\\sqrt') return mathNode('msqrt', atom(depth + 1));
    if (token === '\\left' || token === '\\right') return atom(depth + 1);
    if (token === '^' || token === '_' || token === '}') throw new Error('Unexpected equation token');
    if (/^\d/.test(token)) return mathNode('mn', token);
    if (/^\\[,;! ]$/.test(token)) return mathNode('mspace');
    const character = symbols.get(token) || (/^\\[{}%_$|]$/.test(token) ? token.slice(1) : token);
    if (character.startsWith('\\')) throw new Error('Unsupported equation command');
    return mathNode(/^\p{L}+$/u.test(character) ? 'mi' : 'mo', character === '-' ? '−' : character);
  }

  function row(depth) {
    const group = mathNode('mrow');
    while (position < tokens.length && tokens[position] !== '}') {
      const base = atom(depth);
      let subscript;
      let exponent;
      for (let scriptCount = 0; scriptCount < 2; scriptCount++) {
        if (tokens[position] === '_' && !subscript) {
          position++;
          subscript = atom(depth + 1);
        } else if (tokens[position] === '^' && !exponent) {
          position++;
          exponent = atom(depth + 1);
        } else break;
      }
      const item = subscript && exponent ? mathNode('msubsup', base, subscript, exponent)
        : subscript ? mathNode('msub', base, subscript)
        : exponent ? mathNode('msup', base, exponent) : base;
      group.append(item);
    }
    return group;
  }

  try {
    const result = mathNode('math', row(0));
    if (position !== tokens.length) return null;
    if (display) result.setAttribute('display', 'block');
    return result;
  } catch {
    return null;
  }
}

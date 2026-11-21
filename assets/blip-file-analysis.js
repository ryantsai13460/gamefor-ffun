const WORD = /[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*/gu;
const SUMMARY = /\b(?:summari[sz](?:e|ing|ation)|summary|overview|key points|main (?:points|ideas)|describe the contents|what(?:'s| is) (?:this|the file|the document|the attachment) about)\b/i;
const TABLE = /\b(?:profil(?:e|ing)|overview|statistics|stats|columns?|rows?|headers?|missing values?|empty (?:cells|values)|numeric|mean|median|average|minimum|maximum|min|max|analy[sz]e|inspect|sum|total)\b/i;
const LOOKUP = /^(?:please\s+)?(?:find|locate|search|look for|show (?:me )?(?:the|any|where)|quote|point (?:me )?to|what|which|who|where|when|why|how|does|did|is there|are there|can you (?:find|locate|search|show|quote))\b/i;
const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
const STOP_WORDS = new Set(`a about after all also am an and any are as at attached attachment before both but by can could did do document does down each file files find for from had has have how i if in into is it its just like line locate look me mention mentions more most my no not of on one or our out part passage please quote related said say search see she show some than that the their them then there these they this those through to up use used very was we were what whats when where which who why will with would you your`.split(' '));
const SENTENCES = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, {granularity: 'sentence'}) : null;
const formatCount = new Intl.NumberFormat('en-US');
const formatValue = new Intl.NumberFormat('en-US', {maximumSignificantDigits: 8});

function words(text) {
  return text.match(WORD) || [];
}

function key(word) {
  return word.toLowerCase().normalize('NFKD').replace(/\p{M}|[’']/gu, '');
}

function terms(text) {
  return [...new Set(words(text).map(key).filter(word => word.length > 1 && !STOP_WORDS.has(word)))];
}

function lines(text) {
  return text.split(/\r\n?|\n/);
}

function excerpt(text, length = 280) {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (clean.length <= length) return clean;
  const prefix = clean.slice(0, length).replace(/[\ud800-\udbff]$/, '');
  const boundary = prefix.lastIndexOf(' ');
  return `${boundary > length * .7 ? prefix.slice(0, boundary) : prefix}…`;
}

function counted(amount, noun) {
  return `${formatCount.format(amount)} ${noun}${amount === 1 ? '' : 's'}`;
}

function fileHeading(file) {
  return `${file.name}\n${counted(lines(file.text).length, 'line')} · ${counted(words(file.text).length, 'word')} in the loaded text`;
}

function fromLoadedText(file, text) {
  return `${fileHeading(file)}\n${text}${file.truncated ? '\nThe attachment was clipped. This covers only the loaded excerpt.' : ''}`;
}

function passages(text) {
  return lines(text).flatMap((line, index) => {
    const chunks = SENTENCES ? [...SENTENCES.segment(line)].map(item => item.segment) : line.split(/(?<=[.!?])\s+/);
    return chunks.filter(chunk => chunk.trim()).map(chunk => ({line: index + 1, text: chunk.trim(), terms: terms(chunk)}));
  });
}

function selectedPassages(items, score, count) {
  const used = new Set();
  return items.map((item, index) => ({item, index, score: score(item, index)}))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .filter(({item, score}) => {
      const text = item.text.toLowerCase().replace(/\s+/g, ' ');
      if (score <= 0 || used.has(text)) return false;
      used.add(text);
      return true;
    }).slice(0, count);
}

function summary(file) {
  const items = passages(file.text);
  const frequency = new Map();
  for (const item of items) {
    for (const term of item.terms) frequency.set(term, (frequency.get(term) || 0) + 1);
  }
  const selected = selectedPassages(items, (item, index) => {
    const repeated = item.terms.reduce((score, term) => score + Math.log(frequency.get(term)), 0);
    return 1 + repeated / Math.max(1, Math.sqrt(item.terms.length)) + Math.min(item.terms.length, 12) / 12 + 1 / (index + 1);
  }, 4).sort((a, b) => a.index - b.index);
  return fromLoadedText(file, ['Key excerpts', ...selected.map(({item}) => `- Line ${item.line} · ${excerpt(item.text)}`)].join('\n'));
}

function matchingExcerpt(item, query) {
  const tokens = [...item.text.matchAll(WORD)];
  const token = tokens.find(match => query.includes(key(match[0])));
  if (!token || token.index < 110) return excerpt(item.text);
  const start = item.text.lastIndexOf(' ', token.index - 60) + 1;
  return `${start > 0 ? '…' : ''}${excerpt(item.text.slice(start))}`;
}

function lookup(file, query) {
  const selected = selectedPassages(passages(file.text), item => query.reduce((score, word) => score + Number(item.terms.includes(word)), 0), 3);
  return fromLoadedText(file, selected.length
    ? ['Matching excerpts', ...selected.map(({item}) => `- Line ${item.line} · ${matchingExcerpt(item, query)}`)].join('\n')
    : 'No excerpts matched the question’s terms in the loaded text.');
}

function tableDelimiter({name, type}) {
  if (type === 'text/tab-separated-values' || /\.tsv$/i.test(name)) return '\t';
  if (type === 'text/csv' || /\.csv$/i.test(name)) return ',';
  return '';
}

function tableRows({text, truncated}, delimiter) {
  const source = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const rows = [];
  let cells = [];
  let field = '';
  let quoted = false;
  const endRow = () => {
    cells.push(field);
    if (cells.length > 1 || field.trim()) rows.push(cells);
    cells = [];
    field = '';
  };
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (char !== '"') field += char;
      else if (source[index + 1] === '"') {
        field += '"';
        index++;
      } else quoted = false;
    } else if (char === delimiter) {
      cells.push(field);
      field = '';
    } else if (char === '\n') endRow();
    else if (char === '"' && !field) quoted = true;
    else field += char;
  }
  // A clipped last record may end inside any kind of field.
  if (truncated) return rows;
  if (quoted) return null;
  endRow();
  return rows;
}

function columnProfile(rows, column) {
  const values = rows.map(row => row[column]?.trim() || '').filter(Boolean);
  const distinct = new Set(values);
  const numbers = values.filter(value => NUMBER.test(value)).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  const blanks = rows.length - values.length;
  let result = `${formatCount.format(values.length)} filled, ${formatCount.format(blanks)} blank, ${formatCount.format(distinct.size)} distinct`;
  if (numbers.length) {
    const average = numbers.reduce((mean, number, index) => mean * (index / (index + 1)) + number / (index + 1), 0);
    const middle = Math.floor(numbers.length / 2);
    const median = numbers.length % 2 ? numbers[middle] : numbers[middle - 1] / 2 + numbers[middle] / 2;
    const format = value => Math.abs(value) >= 1e10 ? Number(value.toPrecision(8)).toExponential() : formatValue.format(value);
    const stats = [numbers[0], numbers.at(-1), average, median].map(format);
    result += ` · ${numbers.length} numeric, min ${stats[0]}, max ${stats[1]}, mean ${stats[2]}, median ${stats[3]}`;
    const total = numbers.reduce((sum, value) => sum + value, 0);
    if (Number.isFinite(total)) result += `, sum ${format(total)}`;
  } else if (distinct.size) {
    result += ` · examples ${[...distinct].slice(0, 3).map(value => excerpt(value, 40)).join(' / ')}`;
  }
  return result;
}

function profile(file, delimiter) {
  const parsed = tableRows(file, delimiter);
  if (!parsed) return fromLoadedText(file, 'A quoted field was left open. Close that field to calculate a table profile.');
  if (!parsed.length) return fromLoadedText(file, 'No complete table records were available to profile.');
  const [header, ...rows] = parsed;
  const width = rows.reduce((size, row) => Math.max(size, row.length), header.length);
  const details = [`${counted(rows.length, 'data row')} · ${counted(width, 'column')} · First record used as headers`];
  const irregular = rows.filter(row => row.length !== header.length).length;
  if (irregular) details.push(`${counted(irregular, 'data row')} with a different number of fields than the header.`);
  const limit = Math.min(width, 12);
  for (let column = 0; column < limit; column++) {
    const title = header[column]?.trim();
    const label = title ? `Column ${column + 1}, ${excerpt(title, 65)}` : `Column ${column + 1}`;
    details.push(`- ${label} · ${columnProfile(rows, column)}`);
  }
  if (width > limit) details.push(`Showing the first ${limit} columns.`);
  if (file.truncated) details.push('Only complete records before the clipping boundary were counted.');
  return fromLoadedText(file, details.join('\n'));
}

export function analyzeBlipFiles(text, files) {
  if (typeof text !== 'string' || !Array.isArray(files) || !files.length) return null;
  const request = text.trim().replace(/’/g, "'");
  const wantsSummary = SUMMARY.test(request);
  const wantsTable = (wantsSummary || TABLE.test(request)) && files.some(tableDelimiter);
  if (wantsTable) {
    const tables = files.filter(tableDelimiter);
    const eligible = wantsSummary ? files : tables;
    return {kind: 'local', title: 'Local table profile', text: eligible.map(file => {
      const delimiter = tableDelimiter(file);
      return delimiter ? profile(file, delimiter) : summary(file);
    }).join('\n\n')};
  }
  if (wantsSummary) return {kind: 'local', title: 'Extractive file summary', text: files.map(summary).join('\n\n')};
  const query = terms(request);
  if (!LOOKUP.test(request) || !query.length) return null;
  return {kind: 'local', title: 'Local file excerpts', text: files.map(file => lookup(file, query)).join('\n\n')};
}

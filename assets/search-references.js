const topics = [
  {
    topic: 'Blue sky', aliases: ['blue sky', 'sky blue', 'sky look blue', 'sky appear blue', 'rayleigh scattering'],
    title: 'Why Is the Sky Blue?', provider: 'NASA Space Place', url: 'https://spaceplace.nasa.gov/blue-sky/en/',
    description: 'How air molecules scatter sunlight and change the sky’s color.',
    explanation: 'Air molecules scatter the shorter blue wavelengths in sunlight more strongly than the longer red wavelengths. Some of that scattered blue light reaches your eyes from across the sky. Near sunset, sunlight travels through more air before it reaches you, so the direct light often looks redder.'
  },
  {
    topic: 'Seasons', aliases: ['seasons', 'earth seasons', 'we have seasons', 'seasons change', 'why the seasons change'],
    title: 'What Causes the Seasons?', provider: 'NASA Space Place', url: 'https://spaceplace.nasa.gov/seasons/en/',
    description: 'Earth’s tilt changes the angle and duration of sunlight during the year.',
    explanation: 'As Earth orbits the Sun, its tilted axis makes each hemisphere receive more direct sunlight during part of the year and less direct sunlight during the other part. Days are generally longer when a hemisphere tilts toward the Sun. This is why the Northern and Southern hemispheres have opposite seasons.'
  },
  {
    topic: 'Moon phases', aliases: ['moon phases', 'phases of the moon', 'lunar phases'],
    title: 'Moon Phases', provider: 'NASA Science', url: 'https://science.nasa.gov/moon/moon-phases/',
    description: 'A guide to the Moon’s changing appearance and the eight familiar phases.',
    explanation: 'The Sun lights half the Moon at a time. As the Moon travels around Earth, we see different amounts of that lit half. A new moon shows almost none of it from Earth, while a full moon shows nearly all of it. Waxing means the illuminated part we see is growing.'
  },
  {
    topic: 'Solar eclipses', aliases: ['solar eclipse', 'solar eclipses', 'total solar eclipse'],
    title: 'Types of Solar Eclipses', provider: 'NASA Science', url: 'https://science.nasa.gov/eclipses/types/',
    description: 'What causes a solar eclipse and how total, partial, and annular eclipses differ.',
    explanation: 'A solar eclipse occurs when the Moon passes between Earth and the Sun. From part of Earth, the Moon appears to cover the Sun. A total eclipse covers the entire bright disk, a partial eclipse covers only part of it, and an annular eclipse leaves a bright ring around the Moon.'
  },
  {
    topic: 'Water cycle', aliases: ['water cycle', 'hydrologic cycle', 'hydrological cycle'],
    title: 'Water cycle', provider: 'U.S. Geological Survey', url: 'https://www.usgs.gov/water-science-school/water-cycle',
    description: 'Illustrated explanations of how water moves through air, land, and oceans.',
    explanation: 'Solar energy helps move water into the atmosphere through evaporation. Water vapor can condense into clouds and later fall as rain or snow. Gravity then helps move water into streams, back to oceans, or underground. The cycle has many routes through those stores of water.'
  },
  {
    topic: 'Tides', aliases: ['tide', 'tides', 'ocean tides', 'high and low tides', 'why do tides happen'],
    title: 'What are tides?', provider: 'NOAA Ocean Service', url: 'https://oceanservice.noaa.gov/facts/tides.html',
    description: 'Why ocean water regularly rises and falls along the coast.',
    explanation: 'The Moon’s gravity and the Sun’s gravity drive tides. As Earth rotates, different shores pass through areas of higher and lower water. The timing and height also depend on local features such as the shape of a bay or coastline.'
  },
  {
    topic: 'HTML', aliases: ['html', 'basic html syntax', 'html syntax', 'html basics', 'html tutorial'],
    title: 'Basic HTML syntax', provider: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content/Basic_HTML_syntax',
    description: 'An introduction to elements, tags, attributes, and document structure.',
    explanation: 'HTML marks up the content and structure of a web page. Use `<h1>` for the main heading, `<p>` for a paragraph, and `<a href="…">` for a link. Start with a heading and a paragraph, then open the file in a browser to see how those elements are interpreted.'
  },
  {
    topic: 'CSS', aliases: ['css', 'css basics', 'css styles', 'css syntax', 'css tutorial'],
    title: 'What is CSS?', provider: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics/What_is_CSS',
    description: 'How style rules change the presentation of a web page.',
    explanation: 'CSS controls the presentation of a web page. A rule starts with a selector that identifies the elements to style, followed by declarations. For example, `p { color: navy; }` sets the text color of paragraphs.'
  },
  {
    topic: 'JavaScript arrays', aliases: ['javascript array', 'javascript arrays', 'js array', 'js arrays', 'array in javascript', 'arrays in javascript'],
    title: 'Array', provider: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array',
    description: 'Official reference and examples for JavaScript’s Array object.',
    explanation: 'A JavaScript array holds an ordered collection of values. An array such as `["red", "blue"]` has two entries, with `array[0]` selecting the first. Use `push()` to add an item at the end or `map()` to build a new array by applying a function to each item.'
  },
  {
    topic: 'Python basics', aliases: ['python', 'python basics', 'python tutorial', 'python programming', 'introduction to python'],
    title: 'An Informal Introduction to Python', provider: 'Python documentation', url: 'https://docs.python.org/3/tutorial/introduction.html',
    description: 'Examples of numbers, strings, lists, and simple Python statements.',
    explanation: 'Start in the Python interpreter and try `2 + 3`, then `print("Hello!")`. A list such as `[1, 2, 3]` keeps values in order. Use `numbers[0]` after assigning that list to a variable called `numbers` to read its first element.'
  },
  {
    topic: 'Starting Minecraft Survival', aliases: ['minecraft survival', 'minecraft first day', 'minecraft first night', 'survive first day in minecraft', 'survive your first day in minecraft', 'start minecraft survival'],
    title: 'How to Survive your First Day', provider: 'Minecraft', url: 'https://www.minecraft.net/en-us/article/how-survive-your-first-day',
    description: 'Mojang’s guide to early tools, food, and shelter in Survival mode.',
    explanation: 'Gather wood, turn it into planks, and use some planks to make a crafting table. Craft basic tools so you can collect materials faster. Before night, find food and make a simple shelter with a way to close the entrance.'
  }
];

export function comparisonTopics(question) {
  const text = question.trim().replace(/[.!?]+$/u, '');
  const explicit = text.match(/^(?:(?:what (?:is|are) (?:the )?)?difference(?:s)? between|compare)\s+(.+?)\s+(?:and|with|to|versus|vs\.?)\s+(.+)$/i);
  const versus = text.match(/^(.+?)\s+(?:versus|vs\.?)\s+(.+)$/i);
  const pair = explicit || versus;
  if (!pair) return [];
  const names = pair.slice(1).map(value => value.trim());
  return names.every(value => value.length >= 2 && value.length <= 80) && names[0].toLowerCase() !== names[1].toLowerCase() ? names : [];
}

function matchTopic(question) {
  const name = question.toLowerCase().normalize('NFKD').replace(/\p{Mark}/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
    .replace(/^(?:please )?(?:what (?:is|are|causes)|why (?:is|are|do|does)(?: there)?|how (?:to|do|does|can i)|tell me about|explain|define|describe|learn(?:ing)?|help (?:with|me understand))\s+(?:(?:a|an|the) )?/u, '')
    .replace(/\s+(?:works?|happen|happens|form|forms|for beginners)$/, '');
  return topics.find(record => record.aliases.includes(name));
}

function requestedTopics(question) {
  const pair = comparisonTopics(question);
  return (pair.length ? pair : [question]).map(matchTopic);
}

function source({ title, provider, url, description }) {
  return { kind: 'reference', title, provider, url, description };
}

export function findSearchReferences(question) {
  if (typeof question !== 'string' || !question.trim()) return [];
  return [...new Set(requestedTopics(question).filter(Boolean))].map(source);
}

export function builtInReferenceAnswer(question) {
  const found = requestedTopics(question);
  if (found.some(item => !item) || new Set(found).size !== found.length) return null;
  return {
    label: found.length === 1 ? 'Reference explanation' : 'Reference comparison',
    text: found.length === 1 ? found[0].explanation : found.map(item => `### ${item.topic}\n${item.explanation}`).join('\n\n'),
    sources: found.map(source)
  };
}

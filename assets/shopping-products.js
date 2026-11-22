// Listing IDs come from the linked maker's Amazon U.S. purchase links.
// The Python book's exact print listing is corroborated by Scottsdale Community College's CSC 101 syllabus.
// https://directory.scottsdalecc.edu/sites/default/files/syllabi/4262/4262-csc101-31550-chr2138577.pdf
export const amazonProducts = [
  {
    asin: 'B0DM1WH5BV', brand: '8BitDo', title: 'Ultimate 2C Bluetooth Controller', category: 'gaming',
    description: 'A Switch-layout controller with Hall effect sticks and a wired option.',
    specs: [['Compatibility', 'Nintendo Switch and Switch 2'], ['Connection', 'Bluetooth or wired USB'], ['Sticks', 'Hall effect']],
    terms: 'game controllers gamepad nintendo',
    source: 'https://www.8bitdo.com/ultimate-2c-bluetooth-controller/'
  },
  {
    asin: 'B0D736BCNM', brand: '8BitDo', title: 'Ultimate 2C Wireless Controller', category: 'gaming',
    description: 'A controller for PC and Android with Hall effect sticks and triggers.',
    specs: [['Compatibility', 'Windows 10+ and Android 9+'], ['Connection', '2.4 GHz or wired on Windows, Bluetooth on Android'], ['Sticks and triggers', 'Hall effect']],
    terms: 'game controllers gamepad pc',
    source: 'https://www.8bitdo.com/ultimate-2c-wireless-controller/'
  },
  {
    asin: 'B0D9R5SNG1', brand: 'Plugable', title: '9-in-1 USB-C Hub', category: 'computers',
    description: 'A travel-friendly laptop hub with HDMI, Ethernet, USB and memory card slots.',
    specs: [['Model', 'USBC-9IN1E'], ['Display output', 'HDMI up to 4K at 60Hz'], ['Ports', 'USB-C, USB-A, Ethernet and SD/microSD'], ['Power passthrough', 'Up to 140W input with a compatible charger']],
    terms: 'laptop dongle monitor hubs accessories',
    source: 'https://plugable.com/products/usbc-9in1e'
  },
  {
    asin: 'B0D8PPMHX2', brand: 'Anker', title: 'MagGo Wireless Charger Stand', category: 'technology',
    description: 'A magnetic Qi2 charging stand that lets you switch between portrait and landscape.',
    specs: [['Charging', 'Up to 15W on compatible devices'], ['Standard', 'Qi2 magnetic wireless charging'], ['Mount', 'Adjustable stand']],
    terms: 'phone iphone charging desktop accessory',
    source: 'https://www.anker.com/maggo-magsafe-compatible-wireless-charger-boa'
  },
  {
    asin: '1718502702', brand: 'No Starch Press', title: 'Python Crash Course, 3rd Edition', category: 'books',
    description: 'Eric Matthes introduces Python through programming exercises and larger projects, including a game and a web app.',
    specs: [['Author', 'Eric Matthes'], ['Format', 'Paperback'], ['ISBN-13', '9781718502703']],
    terms: 'programming books coding game design beginner learn',
    source: 'https://nostarch.com/python-crash-course-3rd-edition'
  },
  {
    asin: 'B0D72WYT8Z', brand: '8BitDo', title: 'Ultimate 2C Wired Controller', category: 'gaming',
    description: 'A wired USB gamepad for Windows and Android with Hall effect sticks and triggers.',
    specs: [['Compatibility', 'Windows 10+ and Android 9+'], ['Connection', 'Wired USB'], ['Sticks and triggers', 'Hall effect']],
    terms: 'game controllers gamepad pc',
    source: 'https://www.8bitdo.com/ultimate-2c-wired-controller/'
  },
  {
    asin: 'B0CB95R3VM', brand: 'Plugable', title: '4-in-1 USB-C Hub', category: 'computers',
    description: 'A compact hub for adding a display and two USB-A accessories to a compatible laptop.',
    specs: [['Model', 'USBC-4IN1'], ['Display output', 'HDMI up to 4K'], ['Ports', 'Two USB-A and one USB-C'], ['Power passthrough', 'Up to 100W input with a compatible charger']],
    terms: 'laptop dongle monitor hubs accessories',
    source: 'https://plugable.com/products/usbc-4in1'
  },
  {
    asin: 'B0D7HZ4G5G', brand: 'Anker', title: 'MagGo Power Bank 10K Slim', category: 'technology',
    description: 'A slim magnetic power bank for charging a compatible phone while traveling.',
    specs: [['Capacity', '10,000mAh'], ['Wireless charging', 'Up to 15W on compatible devices'], ['Wired connection', 'USB-C']],
    terms: 'phone iphone battery charger portable pack charging',
    source: 'https://www.anker.com/maggo-magsafe-compatible-wireless-charger-boa'
  },
  {
    asin: 'B0779K9DG2', brand: 'Plugable', title: 'Triple 4K USB-C Docking Station', category: 'computers',
    description: 'A desktop dock for a compatible laptop, multiple displays, and wired peripherals.',
    specs: [['Model', 'UD-ULTC4K'], ['Display output', 'Up to three 4K 60Hz displays with a compatible setup'], ['Ports', 'HDMI, DisplayPort, USB, Ethernet and SD card'], ['Power delivery', 'Up to 100W']],
    terms: 'laptop dock monitor hdmi accessories',
    source: 'https://plugable.com/products/ud-ultc4k/'
  }
];

const byAsin = new Map(amazonProducts.map(product => [product.asin, product]));
export const amazonSortOptions = [
  { id: 'name', title: 'Product name A–Z' },
  { id: 'brand', title: 'Brand A–Z' },
];

const alphabetic = new Intl.Collator('en-US', { numeric: true, sensitivity: 'base' });
const searchableWords = text => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
const productSearch = amazonProducts.map(product => ({
  product,
  words: searchableWords([product.asin, product.brand, product.title, product.description, product.terms, ...product.specs.flat()].join(' '))
}));

export function amazonProduct(asin) {
  return typeof asin === 'string' ? byAsin.get(asin.toUpperCase()) : undefined;
}

export function amazonProductUrl(asin) {
  const product = amazonProduct(asin);
  return product ? 'https://www.amazon.com/dp/' + product.asin : '';
}

export function amazonSort(value) {
  return amazonSortOptions.some(option => option.id === value) ? value : '';
}

export function findAmazonProducts({ query = '', category = '', sort = '' } = {}) {
  const terms = searchableWords(query);
  if (query && !terms.length) return [];
  const matches = productSearch.filter(({ product, words }) => {
    if (category && product.category !== category) return false;
    return terms.every(term => words.includes(term) ||
      (term.length >= 4 && words.some(word => word.startsWith(term) || term === word + 's')));
  }).map(({ product }) => product);
  const compareName = (first, second) => alphabetic.compare(first.title, second.title);
  const compareBrand = (first, second) => alphabetic.compare(first.brand, second.brand);
  if (sort === 'name') matches.sort((first, second) => compareName(first, second) || compareBrand(first, second));
  if (sort === 'brand') matches.sort((first, second) => compareBrand(first, second) || compareName(first, second));
  return matches;
}

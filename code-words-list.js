// Word list for student/teacher access codes (see design_docs/PROJECT_STORAGE_V2.md §3.1).
//
// Exactly 256 short, lowercase, kid-friendly words (a-z only). The list length MUST be
// 256 so every byte value 0..255 maps to a word: code-words.js uses it as a base-256
// alphabet plus a mod-256 checksum word for single-error detection.
//
// v1 list: chosen to be simple to read and type for upper-primary students. It has NOT
// been hand-audited for one-character look-alikes (e.g. cat/bat/rat). That is fine for
// security: any single-word slip is caught by the checksum in code-words.js and fails
// closed (invalid code), never landing on someone else's code. Near-look-alikes only
// affect how often a student has to re-type, so the list can be refined later without
// any code change.

const CODE_WORDS = [
  'ant',    'bat',    'bear',   'bee',    'bird',   'cat',    'cow',    'crab',
  'deer',   'dog',    'duck',   'eel',    'fish',   'fox',    'frog',   'goat',
  'hen',    'horse',  'koala',  'lion',   'mouse',  'owl',    'panda',  'pig',
  'pony',   'rat',    'seal',   'shark',  'sheep',  'snail',  'swan',   'tiger',
  'whale',  'wolf',   'zebra',  'moth',   'mole',   'lamb',   'calf',   'chick',
  'dove',   'hawk',   'joey',   'kiwi',   'newt',   'quail',  'raven',  'robin',
  'apple',  'bean',   'berry',  'bread',  'cake',   'candy',  'carrot', 'cherry',
  'corn',   'egg',    'grape',  'honey',  'jam',    'lemon',  'mango',  'melon',
  'mint',   'nut',    'oat',    'olive',  'onion',  'pea',    'peach',  'pear',
  'pizza',  'plum',   'rice',   'soup',   'taco',   'toast',  'waffle', 'yam',
  'beach',  'cave',   'cliff',  'cloud',  'creek',  'desert', 'dune',   'field',
  'forest', 'hill',   'island', 'lake',   'leaf',   'marsh',  'meadow', 'moon',
  'mud',    'ocean',  'petal',  'plant',  'pond',   'rain',   'reef',   'river',
  'rock',   'root',   'sand',   'seed',   'sky',    'snow',   'star',   'stone',
  'storm',  'stream', 'sun',    'swamp',  'tree',   'valley', 'vine',   'wave',
  'wind',   'wood',   'fern',   'moss',   'twig',   'bark',   'bloom',  'branch',
  'amber',  'black',  'blue',   'brave',  'bright', 'brown',  'calm',   'clever',
  'cozy',   'cute',   'fancy',  'fast',   'gentle', 'giant',  'glad',   'gold',
  'green',  'happy',  'jolly',  'kind',   'large',  'lucky',  'merry',  'mighty',
  'neat',   'pink',   'proud',  'purple', 'quick',  'quiet',  'red',    'royal',
  'shiny',  'silly',  'silver', 'small',  'soft',   'sunny',  'swift',  'tall',
  'tiny',   'warm',   'white',  'wise',   'witty',  'yellow', 'young',  'zany',
  'anchor', 'arrow',  'basket', 'bell',   'boat',   'book',   'boot',   'box',
  'broom',  'brush',  'button', 'candle', 'cap',    'cart',   'chair',  'clock',
  'coin',   'cup',    'drum',   'flag',   'flute',  'fork',   'gate',   'glove',
  'hat',    'helmet', 'jar',    'kite',   'ladder', 'lamp',   'lantern','key',
  'map',    'mug',    'nail',   'net',    'pan',    'pencil', 'pillow', 'plate',
  'ring',   'rope',   'ruler',  'sail',   'scarf',  'shell',  'shield', 'shoe',
  'spoon',  'stamp',  'sword',  'tent',   'torch',  'train',  'truck',  'trumpet',
  'violin', 'wagon',  'wand',   'watch',  'wheel',  'whistle','window', 'yoyo',
  'bridge', 'castle', 'cabin',  'city',   'dock',   'farm',   'garden', 'harbor',
  'market', 'palace', 'park',   'path',   'road',   'tower',  'tunnel', 'village'
];

// Export for Node.js (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CODE_WORDS;
}

// Export for browser
if (typeof window !== 'undefined') {
    window.CodeWordsList = CODE_WORDS;
}

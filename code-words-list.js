(function () {
// Word lists for access codes (design_docs/PROJECT_STORAGE_V2.md §3.1).
// Three categories of exactly 256 words each, so each is a base-256 alphabet.
// Student codes read adjective-animal-plant; the plant word is the mod-256
// check word (see code-words.js).
// Words are biased SHORT (mostly 3-8 letters) to keep codes quick to type:
// the phrase-level checksum tolerates word-level look-alikes, so short, similar
// words are fine (any slip fails the checksum and is rejected). Categories are
// disjoint. Safe to hand-edit, but keep each array at exactly 256 unique
// lowercase a-z words.

const ADJECTIVES = [
  'fun', 'icy', 'airy', 'bold', 'busy', 'calm', 'cozy', 'cute',
  'deep', 'dewy', 'easy', 'epic', 'fair', 'fast', 'fine', 'flat',
  'fond', 'glad', 'hazy', 'huge', 'keen', 'kind', 'loud', 'lush',
  'mild', 'neat', 'nice', 'posh', 'rosy', 'snug', 'soft', 'spry',
  'tall', 'tame', 'tidy', 'tiny', 'trim', 'warm', 'wavy', 'wild',
  'wise', 'zany', 'agile', 'ample', 'antsy', 'balmy', 'bonny', 'brave',
  'brisk', 'burly', 'clean', 'clear', 'comfy', 'crisp', 'curly', 'dandy',
  'dense', 'dizzy', 'downy', 'dusty', 'eager', 'early', 'elder', 'faint',
  'fancy', 'fiery', 'fleet', 'fresh', 'funny', 'giant', 'grand', 'great',
  'handy', 'happy', 'hardy', 'homey', 'ideal', 'jazzy', 'jolly', 'jumbo',
  'jumpy', 'lanky', 'large', 'leafy', 'level', 'light', 'lofty', 'loyal',
  'lucky', 'magic', 'merry', 'mossy', 'mucky', 'nifty', 'noble', 'novel',
  'nutty', 'oaken', 'peppy', 'perky', 'plain', 'plump', 'plush', 'prime',
  'proud', 'quick', 'quiet', 'rainy', 'rapid', 'ready', 'regal', 'roomy',
  'rowdy', 'royal', 'ruddy', 'salty', 'sandy', 'shady', 'sharp', 'sheer',
  'shiny', 'short', 'silly', 'sleek', 'small', 'smart', 'snowy', 'solid',
  'spicy', 'stark', 'stout', 'sunny', 'super', 'sweet', 'swift', 'tangy',
  'teeny', 'tough', 'vivid', 'vocal', 'windy', 'witty', 'young', 'zesty',
  'zippy', 'arctic', 'bouncy', 'breezy', 'bright', 'bubbly', 'candid', 'cheery',
  'chilly', 'chirpy', 'chubby', 'classy', 'clever', 'cosmic', 'crafty', 'creamy',
  'crispy', 'decent', 'dreamy', 'famous', 'feisty', 'flashy', 'fleecy', 'floral',
  'fluffy', 'frosty', 'gentle', 'glassy', 'glossy', 'golden', 'grassy', 'groovy',
  'hearty', 'hollow', 'honest', 'humble', 'jaunty', 'jovial', 'joyful', 'kindly',
  'limber', 'little', 'lively', 'loving', 'mellow', 'mighty', 'modest', 'nimble',
  'peachy', 'pearly', 'plucky', 'polite', 'prized', 'punchy', 'quaint', 'quirky',
  'rugged', 'rustic', 'savory', 'scenic', 'secret', 'serene', 'shaggy', 'shrewd',
  'silken', 'silver', 'simple', 'sleepy', 'smiley', 'smooth', 'snappy', 'snazzy',
  'spotty', 'spruce', 'starry', 'steady', 'stormy', 'sturdy', 'sugary', 'tender',
  'timely', 'tingly', 'toasty', 'tropic', 'trusty', 'twirly', 'upbeat', 'velvet',
  'wiggly', 'wintry', 'woolly', 'worthy', 'beaming', 'careful', 'dashing', 'earnest',
  'elegant', 'festive', 'gallant', 'glowing', 'helpful', 'hopeful', 'prickly', 'radiant',
  'scarlet', 'sparkly', 'springy', 'stately', 'stellar', 'thrifty', 'valiant', 'vibrant'
];

const ANIMALS = [
  'ox', 'ant', 'asp', 'bat', 'bee', 'boa', 'bug', 'cat',
  'cod', 'cow', 'cub', 'dab', 'doe', 'dog', 'eel', 'elk',
  'emu', 'ewe', 'fly', 'fox', 'gnu', 'hen', 'hog', 'ide',
  'jay', 'kid', 'koi', 'owl', 'pig', 'pup', 'ram', 'rat',
  'ray', 'sow', 'tom', 'yak', 'bear', 'bird', 'boar', 'buck',
  'bull', 'calf', 'carp', 'clam', 'colt', 'crab', 'crow', 'deer',
  'dove', 'duck', 'fawn', 'fish', 'flea', 'foal', 'frog', 'goat',
  'grub', 'gull', 'hare', 'hawk', 'ibex', 'joey', 'kiwi', 'kudu',
  'lamb', 'lark', 'lion', 'lynx', 'mako', 'mare', 'mink', 'mole',
  'moth', 'mule', 'newt', 'orca', 'oryx', 'pike', 'pony', 'puma',
  'seal', 'shad', 'slug', 'sole', 'stag', 'swan', 'teal', 'tern',
  'toad', 'tuna', 'vole', 'wasp', 'wolf', 'worm', 'wren', 'zebu',
  'bison', 'bream', 'bunny', 'camel', 'chick', 'chimp', 'crane', 'dingo',
  'eagle', 'egret', 'eland', 'finch', 'gecko', 'goose', 'guppy', 'heron',
  'horse', 'hound', 'husky', 'hyena', 'koala', 'lemur', 'llama', 'macaw',
  'moose', 'mouse', 'otter', 'panda', 'perch', 'prawn', 'quail', 'raven',
  'rhino', 'robin', 'shark', 'sheep', 'shrew', 'skate', 'skunk', 'sloth',
  'smelt', 'snail', 'snake', 'sprat', 'squid', 'stoat', 'stork', 'tapir',
  'tiger', 'trout', 'viper', 'whale', 'zebra', 'alpaca', 'baboon', 'badger',
  'beagle', 'beaver', 'beetle', 'canary', 'cougar', 'coyote', 'cuckoo', 'donkey',
  'earwig', 'ermine', 'falcon', 'ferret', 'gander', 'gerbil', 'gibbon', 'gopher',
  'grouse', 'hornet', 'impala', 'jackal', 'jaguar', 'kitten', 'lizard', 'locust',
  'magpie', 'mantis', 'marmot', 'marten', 'mayfly', 'minnow', 'monkey', 'mussel',
  'ocelot', 'oriole', 'osprey', 'oyster', 'parrot', 'pigeon', 'piglet', 'possum',
  'puffin', 'python', 'quagga', 'quokka', 'rabbit', 'salmon', 'serval', 'shrimp',
  'spider', 'tomcat', 'toucan', 'turkey', 'turtle', 'urchin', 'walrus', 'weasel',
  'weevil', 'wombat', 'anchovy', 'buffalo', 'caribou', 'catfish', 'cheetah', 'cricket',
  'dolphin', 'firefly', 'gazelle', 'giraffe', 'haddock', 'hamster', 'herring', 'lemming',
  'leopard', 'lobster', 'mallard', 'manatee', 'meerkat', 'moorhen', 'muskrat', 'narwhal',
  'octopus', 'opossum', 'ostrich', 'panther', 'peacock', 'pelican', 'penguin', 'piranha',
  'polecat', 'raccoon', 'rooster', 'sandfly', 'sardine', 'seagull', 'snapper', 'sunfish',
  'swallow', 'tadpole', 'termite', 'terrier', 'vulture', 'wagtail', 'wallaby', 'warthog'
];

const PLANTS = [
  'ash', 'bay', 'cob', 'elm', 'fig', 'fir', 'gum', 'haw',
  'hay', 'hop', 'ivy', 'oak', 'oat', 'pea', 'pod', 'rue',
  'rye', 'yam', 'yew', 'acai', 'aloe', 'arum', 'bark', 'bean',
  'beet', 'bulb', 'cane', 'corn', 'date', 'dill', 'dock', 'fern',
  'flag', 'flax', 'husk', 'iris', 'jute', 'kale', 'kelp', 'leaf',
  'leek', 'lily', 'lime', 'ling', 'mint', 'nori', 'okra', 'palm',
  'pear', 'pine', 'pink', 'plum', 'reed', 'root', 'rose', 'rush',
  'seed', 'sloe', 'stem', 'taro', 'teak', 'twig', 'vine', 'woad',
  'acorn', 'agave', 'alder', 'anise', 'apple', 'aspen', 'aster', 'balsa',
  'basil', 'beech', 'berry', 'birch', 'bract', 'broom', 'cacao', 'cedar',
  'chard', 'chive', 'clove', 'cocoa', 'cress', 'cumin', 'daisy', 'dulse',
  'ebony', 'ferny', 'frond', 'furze', 'gorse', 'gourd', 'grape', 'guava',
  'hazel', 'holly', 'karri', 'larch', 'lemon', 'lilac', 'lotus', 'lupin',
  'maize', 'mango', 'maple', 'marri', 'melon', 'olive', 'onion', 'pansy',
  'peach', 'pecan', 'peony', 'phlox', 'poppy', 'rowan', 'sedge', 'stock',
  'straw', 'sumac', 'tansy', 'thyme', 'tuart', 'tulip', 'vetch', 'viola',
  'wheat', 'wrack', 'almond', 'azalea', 'bamboo', 'banana', 'banyan', 'baobab',
  'barley', 'borage', 'cactus', 'carrot', 'cashew', 'catkin', 'celery', 'cherry',
  'clover', 'cosmos', 'crocus', 'dahlia', 'daphne', 'endive', 'fennel', 'fescue',
  'garlic', 'ginger', 'ginkgo', 'jarrah', 'jicama', 'laurel', 'lentil', 'lichen',
  'linden', 'lovage', 'lupine', 'mallee', 'mallow', 'marrow', 'millet', 'mimosa',
  'myrtle', 'nettle', 'nutmeg', 'orchid', 'pampas', 'papaya', 'pawpaw', 'peanut',
  'pepper', 'poplar', 'potato', 'protea', 'quince', 'quinoa', 'radish', 'sorrel',
  'sprout', 'squash', 'teasel', 'tomato', 'turnip', 'violet', 'walnut', 'wasabi',
  'wattle', 'willow', 'yarrow', 'zinnia', 'alfalfa', 'apricot', 'arugula', 'banksia',
  'begonia', 'boronia', 'bracken', 'bramble', 'bulrush', 'burdock', 'cabbage', 'cassava',
  'cattail', 'chicory', 'coconut', 'cowslip', 'cypress', 'dogwood', 'edamame', 'filbert',
  'foxtail', 'fuchsia', 'heather', 'hemlock', 'hickory', 'jasmine', 'juniper', 'lettuce',
  'melissa', 'paprika', 'papyrus', 'parsley', 'petunia', 'pumpkin', 'ragweed', 'redwood',
  'rhubarb', 'saffron', 'sequoia', 'shallot', 'sorghum', 'soybean', 'spinach', 'tapioca',
  'thistle', 'timothy', 'truffle', 'tussock', 'vanilla', 'verbena', 'waratah', 'amaranth',
  'bindweed', 'bluebell', 'camellia', 'chestnut', 'chickpea', 'clematis', 'daffodil', 'duckweed'
];

const LISTS = { ADJECTIVES, ANIMALS, PLANTS };

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LISTS;
}
if (typeof window !== 'undefined') {
    window.CodeWordsList = LISTS;
}
})();

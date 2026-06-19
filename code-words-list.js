// Word lists for access codes (design_docs/PROJECT_STORAGE_V2.md §3.1).
// Three categories of exactly 256 words each (a-z, <=10 chars), so each is a
// base-256 alphabet. Student codes read adjective-animal-plant; the plant word
// is the mod-256 check word (see code-words.js).
// v1 lists: chosen to be simple to read/type, and kept disjoint across
// categories. Not finally audited for look-alikes; that is only a typing-ease
// concern, since the checksum in code-words.js makes any slip fail closed.
// Safe to hand-edit, but keep each array at exactly 256 unique lowercase words.

const ADJECTIVES = [
  'brave', 'bright', 'calm', 'clever', 'cozy', 'cute', 'eager', 'early',
  'easy', 'fair', 'fancy', 'fast', 'fine', 'fluffy', 'fond', 'fresh',
  'fun', 'funny', 'gentle', 'giant', 'glad', 'golden', 'grand', 'great',
  'happy', 'hardy', 'jolly', 'keen', 'kind', 'large', 'light', 'little',
  'lively', 'loyal', 'lucky', 'magic', 'mellow', 'merry', 'mighty', 'mild',
  'neat', 'nice', 'nifty', 'noble', 'plump', 'polite', 'proud', 'quick',
  'quiet', 'rapid', 'ready', 'regal', 'royal', 'shiny', 'short', 'silly',
  'simple', 'sleek', 'small', 'smart', 'smooth', 'snappy', 'snug', 'soft',
  'solid', 'spry', 'steady', 'stout', 'sturdy', 'sunny', 'super', 'swift',
  'tall', 'tame', 'tidy', 'tiny', 'tough', 'trusty', 'warm', 'wise',
  'witty', 'young', 'zany', 'agile', 'ample', 'balmy', 'bold', 'breezy',
  'bubbly', 'busy', 'cheery', 'chilly', 'chubby', 'clean', 'clear', 'crisp',
  'curly', 'dandy', 'deep', 'dewy', 'dizzy', 'dreamy', 'dusty', 'elder',
  'epic', 'faint', 'famous', 'festive', 'fiery', 'flat', 'fleet', 'floral',
  'frosty', 'gallant', 'glassy', 'glossy', 'grassy', 'hazy', 'hearty', 'honest',
  'humble', 'icy', 'ideal', 'jazzy', 'joyful', 'jumbo', 'leafy', 'level',
  'loud', 'lush', 'mossy', 'nimble', 'novel', 'peppy', 'perky', 'plain',
  'plucky', 'posh', 'prime', 'prized', 'quirky', 'rosy', 'ruddy', 'rugged',
  'rustic', 'sandy', 'scarlet', 'secret', 'serene', 'shady', 'sharp', 'sheer',
  'shrewd', 'silken', 'silver', 'sleepy', 'snowy', 'sparkly', 'spicy', 'spotty',
  'stark', 'starry', 'stellar', 'stormy', 'sugary', 'sweet', 'tender', 'thrifty',
  'timely', 'toasty', 'trim', 'tropic', 'upbeat', 'valiant', 'velvet', 'vivid',
  'vocal', 'wavy', 'wealthy', 'wild', 'windy', 'wintry', 'woolly', 'worthy',
  'zesty', 'airy', 'antsy', 'arctic', 'beaming', 'bonny', 'brisk', 'burly',
  'candid', 'careful', 'classy', 'comfy', 'cosmic', 'crafty', 'creamy', 'crispy',
  'dashing', 'dazzling', 'decent', 'dense', 'downy', 'earnest', 'elegant', 'feisty',
  'flashy', 'fleecy', 'glowing', 'graceful', 'groovy', 'handy', 'helpful', 'hollow',
  'homey', 'hopeful', 'huge', 'jaunty', 'jovial', 'kindly', 'lanky', 'limber',
  'lofty', 'loving', 'modest', 'mucky', 'nutty', 'oaken', 'peachy', 'pearly',
  'plush', 'polished', 'prickly', 'punchy', 'quaint', 'radiant', 'rainy', 'roomy',
  'rowdy', 'salty', 'savory', 'scenic', 'shaggy', 'smiley', 'snazzy', 'spirited',
  'splendid', 'springy', 'spruce', 'stately', 'tangy', 'teeny', 'thankful', 'thorough'
];

const ANIMALS = [
  'ant', 'bat', 'bear', 'bee', 'bird', 'boar', 'buck', 'bug',
  'bull', 'calf', 'cat', 'chick', 'clam', 'colt', 'cow', 'crab',
  'crane', 'crow', 'cub', 'deer', 'dingo', 'dog', 'dove', 'duck',
  'eagle', 'eel', 'elk', 'emu', 'ewe', 'falcon', 'fawn', 'ferret',
  'finch', 'fish', 'flea', 'fly', 'foal', 'fox', 'frog', 'gecko',
  'goat', 'goose', 'grub', 'gull', 'hare', 'hawk', 'hen', 'heron',
  'hog', 'horse', 'hound', 'husky', 'ibex', 'jay', 'joey', 'koala',
  'lamb', 'lark', 'lion', 'llama', 'lynx', 'mako', 'mare', 'mink',
  'mole', 'moose', 'moth', 'mouse', 'mule', 'newt', 'otter', 'owl',
  'ox', 'panda', 'pig', 'pony', 'puma', 'quail', 'rabbit', 'ram',
  'rat', 'raven', 'robin', 'seal', 'shark', 'sheep', 'shrew', 'skunk',
  'slug', 'snail', 'snake', 'sole', 'spider', 'squid', 'stag', 'stork',
  'swan', 'tiger', 'toad', 'trout', 'tuna', 'turkey', 'viper', 'vole',
  'walrus', 'wasp', 'weasel', 'whale', 'wolf', 'wombat', 'worm', 'wren',
  'yak', 'zebra', 'alpaca', 'badger', 'beagle', 'beaver', 'beetle', 'bison',
  'camel', 'cheetah', 'chimp', 'cougar', 'coyote', 'cricket', 'dolphin', 'donkey',
  'egret', 'ermine', 'gander', 'gazelle', 'gibbon', 'giraffe', 'gnu', 'gopher',
  'grouse', 'guppy', 'hamster', 'hedgehog', 'hornet', 'impala', 'jackal', 'jaguar',
  'kitten', 'kiwi', 'kudu', 'lemur', 'leopard', 'lizard', 'lobster', 'locust',
  'macaw', 'magpie', 'marmot', 'meerkat', 'minnow', 'monkey', 'mongoose', 'mussel',
  'narwhal', 'ocelot', 'octopus', 'opossum', 'orca', 'osprey', 'ostrich', 'oyster',
  'panther', 'parrot', 'peacock', 'pelican', 'penguin', 'pheasant', 'pigeon', 'piglet',
  'platypus', 'possum', 'prawn', 'puffin', 'python', 'quokka', 'raccoon', 'reindeer',
  'rhino', 'rooster', 'salmon', 'sardine', 'scorpion', 'seahorse', 'shrimp', 'sloth',
  'snapper', 'squirrel', 'starfish', 'stingray', 'swallow', 'tadpole', 'termite', 'terrier',
  'tortoise', 'toucan', 'turtle', 'urchin', 'vulture', 'wallaby', 'warthog', 'weevil',
  'wildcat', 'zebu', 'antelope', 'armadillo', 'baboon', 'buffalo', 'bunny', 'canary',
  'cardinal', 'caribou', 'catfish', 'chipmunk', 'cuckoo', 'earwig', 'gerbil', 'hyena',
  'kangaroo', 'lemming', 'manatee', 'mantis', 'mallard', 'moorhen', 'oriole', 'partridge',
  'quagga', 'sandpiper', 'seagull', 'stallion', 'sunfish', 'swordfish', 'tomcat', 'wagtail',
  'waterbug', 'woodlouse', 'boa', 'flamingo', 'dragonfly', 'jellyfish', 'salamander', 'tarantula',
  'chameleon', 'mosquito', 'butterfly', 'barnacle', 'clownfish', 'anchovy', 'mackerel', 'herring'
];

const PLANTS = [
  'maple', 'oak', 'pine', 'elm', 'ash', 'birch', 'beech', 'cedar',
  'fir', 'willow', 'poplar', 'aspen', 'alder', 'hazel', 'holly', 'ivy',
  'fern', 'reed', 'rose', 'tulip', 'daisy', 'lily', 'iris', 'poppy',
  'violet', 'orchid', 'lotus', 'pansy', 'peony', 'aster', 'dahlia', 'marigold',
  'petunia', 'jasmine', 'lavender', 'lilac', 'magnolia', 'clover', 'heather', 'thistle',
  'nettle', 'bracken', 'bramble', 'bamboo', 'cactus', 'palm', 'apple', 'pear',
  'plum', 'peach', 'cherry', 'grape', 'lemon', 'lime', 'mango', 'melon',
  'berry', 'olive', 'fig', 'date', 'banana', 'apricot', 'quince', 'guava',
  'papaya', 'coconut', 'acorn', 'walnut', 'almond', 'pecan', 'chestnut', 'basil',
  'mint', 'thyme', 'rosemary', 'parsley', 'dill', 'chive', 'fennel', 'ginger',
  'garlic', 'onion', 'leek', 'pea', 'bean', 'corn', 'carrot', 'turnip',
  'radish', 'beet', 'potato', 'tomato', 'pepper', 'squash', 'pumpkin', 'cabbage',
  'lettuce', 'spinach', 'kale', 'celery', 'cress', 'sprout', 'marrow', 'gourd',
  'yam', 'cassava', 'sycamore', 'hawthorn', 'rowan', 'juniper', 'cypress', 'redwood',
  'teak', 'ebony', 'sugarcane', 'wheat', 'barley', 'rye', 'millet', 'sunflower',
  'bluebell', 'foxglove', 'buttercup', 'snowdrop', 'primrose', 'crocus', 'hyacinth', 'gardenia',
  'camellia', 'azalea', 'begonia', 'carnation', 'cornflower', 'cosmos', 'dandelion', 'geranium',
  'hibiscus', 'larkspur', 'lupin', 'nasturtium', 'periwinkle', 'verbena', 'zinnia', 'mushroom',
  'truffle', 'clematis', 'daphne', 'fuchsia', 'gladioli', 'mallow', 'myrtle', 'oleander',
  'protea', 'snapdragon', 'sorrel', 'tansy', 'yarrow', 'agave', 'aloe', 'banyan',
  'baobab', 'catkin', 'cattail', 'cowslip', 'daffodil', 'dogwood', 'ferny', 'gorse',
  'hemlock', 'laurel', 'mangrove', 'mimosa', 'mulberry', 'oat', 'papyrus', 'pawpaw',
  'plantain', 'ragweed', 'sedge', 'sequoia', 'sumac', 'tamarind', 'tarragon', 'turmeric',
  'vanilla', 'wisteria', 'yew', 'acai', 'amaranth', 'anise', 'arugula', 'borage',
  'burdock', 'chamomile', 'chickpea', 'chicory', 'clove', 'coriander', 'cumin', 'endive',
  'hop', 'jicama', 'jute', 'kelp', 'kohlrabi', 'lentil', 'lovage', 'maize',
  'melissa', 'nutmeg', 'okra', 'paprika', 'quinoa', 'rhubarb', 'saffron', 'scallion',
  'shallot', 'sorghum', 'soybean', 'tapioca', 'taro', 'vetch', 'wasabi', 'wormwood',
  'ginkgo', 'larch', 'linden', 'hickory', 'butternut', 'filbert', 'pistachio', 'cashew',
  'peanut', 'edamame', 'foxtail', 'fescue', 'timothy', 'alfalfa', 'lupine', 'columbine',
  'hollyhock', 'bindweed', 'horsetail', 'duckweed', 'pondweed', 'seagrass', 'eelgrass', 'samphire',
  'saltbush', 'spinifex', 'tussock', 'pampas', 'reedmace', 'bulrush', 'rush', 'ryegrass'
];

const LISTS = { ADJECTIVES, ANIMALS, PLANTS };

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LISTS;
}
if (typeof window !== 'undefined') {
    window.CodeWordsList = LISTS;
}

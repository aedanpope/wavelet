// ESLint flat config for Wavelet project
// See: https://eslint.org/docs/latest/use/configure/configuration-files-new

const js = require('@eslint/js');

module.exports = [
  // Apply to all JavaScript files in root directory
  {
    files: ['*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'script',
      globals: {
        // Browser globals
        console: 'readonly',
        document: 'readonly',
        window: 'readonly',
        localStorage: 'readonly',
        location: 'readonly',
        fetch: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        Blob: 'readonly',
        FileReader: 'readonly',

        // Node.js globals (for scripts)
        process: 'readonly',
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',

        // External library globals
        pyodide: 'readonly',
        loadPyodide: 'readonly',
        CodeMirror: 'readonly',
        MathJax: 'readonly',

        // Application globals
        APP_VERSION: 'readonly',

        // Application modules (loaded via script tags)
        // Note: These are defined in their respective files, marked writable
        ErrorHandler: 'writable',
        InputSystem: 'writable',
        Validation: 'writable',
        CodeExecutor: 'writable',
        ProgressStore: 'writable',
        ProblemRenderer: 'writable',
        TracePlayer: 'writable',
        setupCanvasFunctions: 'writable',
        autoFlushCanvas: 'writable',
        resetCanvasState: 'writable',
        escHtml: 'writable'
      }
    },
    rules: {
      ...js.configs.recommended.rules,

      // Variable declarations
      'no-unused-vars': ['warn', {
        vars: 'all',
        args: 'after-used',
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      'no-undef': 'error',
      'prefer-const': 'warn',
      'no-var': 'warn',

      // Comparisons
      'eqeqeq': ['warn', 'always', {
        null: 'ignore'
      }],

      // Code style
      'curly': ['warn', 'all'],

      // Security
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',

      // Error handling
      'no-throw-literal': 'error',

      // Scope
      // builtinGlobals:false so files can declare the modules they own
      // (e.g. `class CodeExecutor` in code-executor.js) without conflicting
      // with the globals list that other files use to reference them.
      'no-redeclare': ['error', { builtinGlobals: false }],

      // Off: the validation.js rule switch uses bare `let`/`const` in each
      // case (every case returns, so no leakage). Wrapping every arm in
      // braces would be 24 sites of pure visual noise.
      'no-case-declarations': 'off',
      'no-shadow': ['warn', {
        builtinGlobals: false,
        hoist: 'functions'
      }],
      'no-use-before-define': ['error', {
        functions: false,
        classes: true,
        variables: true
      }],

      // Console (allow for this project)
      'no-console': 'off'
    }
  },

  // Ignore patterns
  {
    ignores: [
      'node_modules/**',
      'version.js',
      '*-test.js',
      'scripts/**'
    ]
  }
];

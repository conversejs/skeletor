import babel from '@rollup/plugin-babel';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import commonjs from '@rollup/plugin-commonjs';
import summary from 'rollup-plugin-summary';

const plugins = [
  resolve(), // Resolve bare module specifiers to relative paths
  commonjs({
    requireReturnsDefault: 'auto' // Handle mixed ES/CJS modules
  }),
  summary(), // Print bundle summary
  babel({
    'plugins': ['@babel/plugin-proposal-optional-chaining', '@babel/plugin-proposal-nullish-coalescing-operator'],
    'presets': [
      [
        '@babel/preset-env',
        {
          'targets': {
            'browsers': ['>1%', 'not ie 11', 'not op_mini all'],
          },
        },
      ],
    ],
  }),
];

export default [
  {
    input: 'src/index.js',
    output: {
      name: 'skeletor',
      sourcemap: true,
      file: 'dist/skeletor.js',
      format: 'umd',
    },
    plugins,
    preserveEntrySignatures: 'strict',
  },
  {
    input: 'src/index.js',
    output: {
      name: 'skeletor',
      sourcemap: true,
      file: 'dist/skeletor.min.js',
      format: 'umd',
    },
    plugins: [
      terser({
        ecma: 2021,
        module: true,
        warnings: true,
      }),
      ...plugins,
    ],
  },
];

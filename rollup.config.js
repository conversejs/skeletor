import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import commonjs from '@rollup/plugin-commonjs';
import summary from 'rollup-plugin-summary';

const plugins = [
  resolve(), // Resolve bare module specifiers to relative paths
  commonjs({
    requireReturnsDefault: 'auto', // Handle mixed ES/CJS modules
  }),
  typescript({
    tsconfig: './tsconfig.json',
    declaration: false,
    declarationMap: false,
  }),
  summary(), // Print bundle summary
];

export default [
  {
    input: 'src/index.ts',
    output: {
      name: 'skeletor',
      sourcemap: true,
      file: 'dist/skeletor.js',
      format: 'umd',
      exports: 'named',
    },
    plugins,
    preserveEntrySignatures: 'strict',
  },
  {
    input: 'src/index.ts',
    output: {
      name: 'skeletor',
      sourcemap: true,
      file: 'dist/skeletor.min.js',
      format: 'umd',
      exports: 'named',
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

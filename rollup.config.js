import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import commonjs from '@rollup/plugin-commonjs';
import summary from 'rollup-plugin-summary';

const plugins = [
  resolve(),
  commonjs({
    requireReturnsDefault: 'auto',
  }),
  typescript({
    tsconfig: './tsconfig.json',
    declaration: false,
    declarationMap: false,
  }),
  summary(),
];

export default [
  {
    input: 'src/index.ts',
    output: {
      name: 'skeletor',
      sourcemap: true,
      file: 'dist/skeletor.esm.js',
      format: 'es',
    },
    plugins,
    preserveEntrySignatures: 'strict',
  },
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
  {
    input: 'src/index.node.ts',
    output: {
      name: 'skeletor',
      sourcemap: true,
      file: 'dist/skeletor.node.js',
      format: 'cjs',
      exports: 'named',
    },
    plugins,
    external: ['node:module', 'node:fs', 'node:path', 'node:sqlite'],
    preserveEntrySignatures: 'strict',
  },
  {
    input: 'src/index.node.ts',
    output: {
      sourcemap: true,
      file: 'dist/skeletor.node.mjs',
      format: 'es',
      exports: 'named',
    },
    plugins,
    external: ['node:module', 'node:fs', 'node:path', 'node:sqlite'],
    preserveEntrySignatures: 'strict',
  },
];

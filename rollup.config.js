import { terser } from 'rollup-plugin-terser';

export default [
  {
    input: 'src/main.js',
    output: {
      name: 'skeletor',
      sourcemap: true,
      file: 'dist/skeletor.js',
      format: 'umd'
    }
  },
  {
    input: 'src/main.js',
    output: {
      name: 'skeletor',
      sourcemap: true,
      file: 'dist/skeletor.min.js',
      format: 'umd'
    },
    plugins: [terser()]
  }
];

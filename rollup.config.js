import { terser } from 'rollup-plugin-terser';
import babel from '@rollup/plugin-babel';
import resolve from '@rollup/plugin-node-resolve';


const plugins = [
  resolve(),
  babel({
    "plugins": ["lodash"],
    "presets": [
      [
        "@babel/preset-env",
        {
          "targets": {
              "browsers": [">1%", "not ie 11", "not op_mini all"]
          }
        }
      ]
    ]
  })
];

export default [
  {
    input: 'src/main.js',
    output: {
      name: 'skeletor',
      sourcemap: true,
      file: 'dist/skeletor.js',
      format: 'umd'
    },
    plugins
  },
  {
    input: 'src/main.js',
    output: {
      name: 'skeletor',
      sourcemap: true,
      file: 'dist/skeletor.min.js',
      format: 'umd'
    },
    plugins: [terser(), ...plugins]
  }
];

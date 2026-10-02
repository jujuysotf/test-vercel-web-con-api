import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['server/vercelEntry.js'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  packages: 'external',
  outfile: 'api/[...path].cjs',
  footer: {
    js: 'module.exports = (module.exports && module.exports.default) || module.exports;',
  },
});

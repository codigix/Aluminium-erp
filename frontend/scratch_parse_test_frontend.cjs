const esbuild = require('./node_modules/esbuild/lib/main.js');

esbuild.build({
    entryPoints: ['src/pages/ProductionPlan.jsx'],
    write: false,
    bundle: false,
}).then(() => {
    console.log('esbuild parsed it successfully!');
}).catch(err => {
    console.error('esbuild failed to parse:');
    console.error(err);
});

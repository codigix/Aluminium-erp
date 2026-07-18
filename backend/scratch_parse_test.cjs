const esbuild = require('esbuild');

esbuild.build({
    entryPoints: ['e:/codigix-project/Aluminium-erp/frontend/src/pages/ProductionPlan.jsx'],
    write: false,
    bundle: false,
}).then(() => {
    console.log('esbuild parsed it successfully!');
}).catch(err => {
    console.error('esbuild failed to parse:');
    console.error(err);
});

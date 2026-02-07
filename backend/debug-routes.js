const app = require('./src/app');

function scan(path, stack) {
    if (!stack) return;
    stack.forEach(layer => {
        const name = layer.name || 'anonymous';
        let layerPath = '';
        if (layer.regexp && layer.regexp.source) {
            layerPath = layer.regexp.source
                .replace(/\\\//g, '/')
                .replace(/\^/g, '')
                .replace(/\(\?:\(\[\^\\\/\]\+\?\)\)/g, ':id') // handle params
                .replace(/\/\?\$|(?=\/)\?\$|(?=\/)\$/g, '');
        }

        if (layer.route) {
            const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
            console.log(`${methods} ${path}${layer.route.path}`);
        } else if (name === 'router') {
            console.log(`ROUTER MOUNTED AT: ${path}${layerPath}`);
            scan(path + layerPath, layer.handle.stack);
        } else {
            console.log(`MIDDLEWARE ${name} ${path}${layerPath}`);
        }
    });
}

const router = app._router || app.router || (app.lazyrouter && app.lazyrouter());
if (router && router.stack) {
    scan('', router.stack);
} else {
    console.log('No router found');
}
process.exit(0);

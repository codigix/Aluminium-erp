const app = require('./src/app');
const router = app._router || app.router || (app.lazyrouter && app.lazyrouter());
if (router && router.stack) {
    const layer = router.stack.find(l => l.name === 'router');
    if (layer) {
        console.log('Raw Layer:', layer);
    }
}
process.exit(0);

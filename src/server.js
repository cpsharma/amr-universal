// AMR Universal — single Node.js + Express app serving the website,
// the JSON API, the admin exports and the WhatsApp webhook.

const app = require('./app');
const config = require('./config');
const { seedIfEmpty } = require('./seed');
const notify = require('./services/notify');
const scheduler = require('./services/scheduler');

seedIfEmpty();
notify.startRetryLoop();
scheduler.start();

app.listen(config.PORT, () => {
  console.log(`[server] AMR Universal listening on port ${config.PORT}`);
  console.log(`[server] base URL: ${config.BASE_URL}`);
  console.log(`[server] data dir: ${config.DATA_DIR}`);
  console.log(`[server] WhatsApp desk: ${config.whatsappEnabled ? 'configured' : 'NOT configured (degraded mode)'}`);
});

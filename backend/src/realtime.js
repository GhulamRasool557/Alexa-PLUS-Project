// Live link to every open dashboard (website, TV, phone browser).
// Commands that need a screen are pushed here as "action" events.
const { Server } = require('socket.io');
const config = require('./config');

let io = null;

function initRealtime(httpServer) {
  io = new Server(httpServer, { cors: { origin: '*' } });
  io.use((socket, next) => {
    if (config.apiKey && socket.handshake.auth.apiKey !== config.apiKey) {
      return next(new Error('Invalid API key'));
    }
    next();
  });
  io.on('connection', (socket) => {
    socket.join('screens');
    console.log(`Screen connected (${screenCount()} online)`);
    socket.on('disconnect', () => console.log(`Screen disconnected (${screenCount()} online)`));
  });
  return io;
}

function screenCount() {
  return io ? io.sockets.adapter.rooms.get('screens')?.size || 0 : 0;
}

function sendToScreens(action) {
  if (io) io.to('screens').emit('action', action);
}

function sendResultToScreens(result) {
  if (io) io.to('screens').emit('result', result);
}

module.exports = { initRealtime, screenCount, sendToScreens, sendResultToScreens };

// Tell dashboards to refresh a list (e.g. "todos", "reminders").
module.exports.notifyChanged = (what) => {
  if (io) io.to('screens').emit('changed', what);
};

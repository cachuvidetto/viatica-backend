process.on('uncaughtException', err => {
  console.error('UNCAUGHT EXCEPTION 💥 Shutting down...', err);
  process.exit(1);
});

require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
require('./config/firebase'); // Initialize Firebase Admin SDK

const port = process.env.PORT || 5000;

(async () => {
  await connectDB();
  const server = app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
    console.log(`🔗 http://localhost:${port}`);
  });

  process.on('unhandledRejection', err => {
    console.error('UNHANDLED REJECTION! 💥 Shutting down...', err);
    server.close(() => process.exit(1));
  });
})();

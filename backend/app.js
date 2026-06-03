const path = require('path');
// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Global Middlewares
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static public upload folders safely if needed
app.use('/public', express.static(path.join(__dirname, 'public')));

// API Routes Hook
const authRouter = require('./domains/auth/auth.router');
const periodsRouter = require('./domains/periods/periods.router');
const groupsRouter = require('./domains/groups/groups.router');
const topicsRouter = require('./domains/topics/topics.router');
const projectsRouter = require('./domains/projects/projects.router');
const submissionsRouter = require('./domains/submissions/submissions.router');
const extensionsRouter = require('./domains/extensions/extensions.router');
const committeesRouter = require('./domains/committees/committees.router');
const defensesRouter = require('./domains/defenses/defenses.router');
const scoresRouter = require('./domains/scores/scores.router');
const notificationsRouter = require('./domains/notifications/notifications.router');
const auditRouter = require('./domains/audit/audit.router');
const filesRouter = require('./domains/files/files.router');
const aiRouter = require('./domains/ai/ai.router');
const usersRouter = require('./domains/users/users.router');

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/periods', periodsRouter);
app.use('/api/v1/groups', groupsRouter);
app.use('/api/v1/topics', topicsRouter);
app.use('/api/v1/projects', projectsRouter);
app.use('/api/v1/submissions', submissionsRouter);
app.use('/api/v1/extensions', extensionsRouter);
app.use('/api/v1/committees', committeesRouter);
app.use('/api/v1/defense-sessions', defensesRouter);
app.use('/api/v1/scores', scoresRouter);
app.use('/api/v1/notifications', notificationsRouter);
app.use('/api/v1/audit', auditRouter);
app.use('/api/v1/files', filesRouter);
app.use('/api/v1/ai', aiRouter);
app.use('/api/v1/users', usersRouter);

// Basic Health Check Route
app.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Server is healthy!' });
});

// Capture 404 Not Found
app.use((req, res, next) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Exception:', err);
  
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    // Only output full stack trace in non-production environments
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

// Boot listening server
const server = app.listen(PORT, () => {
  console.log(`Server compiled successfully in [${process.env.NODE_ENV}] mode.`);
  console.log(`Episteme API Server listening on: http://localhost:${PORT}`);
});

module.exports = { app, server };

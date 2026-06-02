const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Error: MONGODB_URI environment variable is not defined in .env file.');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(uri, {
      maxPoolSize: 10, // Up to 10 parallel connections in the pool
      serverSelectionTimeoutMS: 5000, // Timeout selection after 5s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
    });

    console.log(`MongoDB Connected successfully to host: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`MongoDB Connection Failed: ${error.message}`);
    process.exit(1);
  }
};

// Monitor connection events
mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB connection lost! Retrying...');
});

mongoose.connection.on('error', (err) => {
  console.error(`MongoDB Error occurred: ${err.message}`);
});

module.exports = connectDB;

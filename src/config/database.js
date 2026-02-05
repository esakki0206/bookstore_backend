const mongoose = require('mongoose');

const connectDB = async () => {
  let retries = 3;
  
  const connect = async () => {
    try {
      const conn = await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      console.log('✓ MongoDB connected successfully');
      return conn;
    } catch (error) {
      retries--;
      if (retries > 0) {
        console.log(`Retrying MongoDB connection... (${retries} attempts left)`);
        return setTimeout(connect, 5000);
      }
      console.error('✗ MongoDB connection failed:', error.message);
      process.exit(1);
    }
  };
  
  return connect();
};

module.exports = connectDB;

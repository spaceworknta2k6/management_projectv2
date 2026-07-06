const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const loadEnv = () => {
  const envPath = path.join(__dirname, '..', '.env');

  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    return envPath;
  }

  dotenv.config();
  return envPath;
};

module.exports = {
  loadEnv,
};

const crypto = require('crypto');

const getCloudinaryConfig = () => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw {
      status: 500,
      message: ' Cloudinary chưa được cấu hình đầy đủ. ',
    };
  }

  return { cloudName, apiKey, apiSecret };
};

const signParams = (params, apiSecret) => {
  const payload = Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '')
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  return crypto
    .createHash('sha1')
    .update(`${payload}${apiSecret}`)
    .digest('hex');
};

const uploadImageBuffer = async (buffer, { folder, publicId, filename }) => {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const params = {
    folder,
    overwrite: 'true',
    public_id: publicId,
    timestamp: Math.floor(Date.now() / 1000),
  };

  const formData = new FormData();
  formData.append('file', new Blob([buffer]), filename);
  formData.append('api_key', apiKey);
  Object.entries(params).forEach(([key, value]) => {
    formData.append(key, String(value));
  });
  formData.append('signature', signParams(params, apiSecret));

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw {
      status: 502,
      message: data.error?.message || 'Không thể upload ảnh lên Cloudinary.',
    };
  }

  return data;
};

const uploadFileBuffer = async (buffer, { folder, publicId, filename, resourceType = 'auto' }) => {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const params = {
    folder,
    overwrite: 'true',
    public_id: publicId,
    timestamp: Math.floor(Date.now() / 1000),
  };

  const formData = new FormData();
  formData.append('file', new Blob([buffer]), filename);
  formData.append('api_key', apiKey);
  Object.entries(params).forEach(([key, value]) => {
    formData.append(key, String(value));
  });
  formData.append('signature', signParams(params, apiSecret));

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw {
      status: 502,
      message: data.error?.message || 'Không thể upload file lên Cloudinary.',
    };
  }

  return data;
};

module.exports = {
  uploadImageBuffer,
  uploadFileBuffer,
};

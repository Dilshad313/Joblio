const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Verify configuration on startup
const verifyCloudinaryConfig = () => {
  if (!process.env.CLOUDINARY_CLOUD_NAME || 
      !process.env.CLOUDINARY_API_KEY || 
      !process.env.CLOUDINARY_API_SECRET) {
    console.warn('⚠️ Cloudinary credentials missing. File upload will not work.');
    return false;
  }
  console.log('✅ Cloudinary configured successfully');
  return true;
};

verifyCloudinaryConfig();

// Upload file to Cloudinary
const uploadFile = async (fileBuffer, options = {}) => {
  try {
    const defaultOptions = {
      folder: 'jobboard',
      resource_type: 'auto',
      timeout: 60000
    };
    
    const uploadOptions = { ...defaultOptions, ...options };
    
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      
      streamifier.createReadStream(fileBuffer).pipe(uploadStream);
    });
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
};

// Upload resume (PDF, DOC, DOCX)
const uploadResume = async (fileBuffer, userId, originalName) => {
  const options = {
    folder: 'jobboard/resumes',
    resource_type: 'raw',
    public_id: `${userId}_${Date.now()}_${originalName.split('.')[0]}`,
    use_filename: false,
    unique_filename: true
  };
  
  return await uploadFile(fileBuffer, options);
};

// Upload company logo
const uploadCompanyLogo = async (fileBuffer, companyId) => {
  const options = {
    folder: 'jobboard/company-logos',
    resource_type: 'image',
    public_id: `${companyId}_logo`,
    transformation: [
      { width: 200, height: 200, crop: 'limit' },
      { quality: 'auto' }
    ]
  };
  
  return await uploadFile(fileBuffer, options);
};

// Upload candidate photo
const uploadCandidatePhoto = async (fileBuffer, userId) => {
  const options = {
    folder: 'jobboard/candidate-photos',
    resource_type: 'image',
    public_id: `${userId}_photo`,
    transformation: [
      { width: 400, height: 400, crop: 'thumb', gravity: 'face' },
      { quality: 'auto' }
    ]
  };
  
  return await uploadFile(fileBuffer, options);
};

// Upload job attachment
const uploadJobAttachment = async (fileBuffer, jobId, fileName) => {
  const options = {
    folder: `jobboard/job-attachments/${jobId}`,
    resource_type: 'raw',
    public_id: `${Date.now()}_${fileName}`,
    use_filename: false
  };
  
  return await uploadFile(fileBuffer, options);
};

// Delete file from Cloudinary
const deleteFile = async (publicId, options = {}) => {
  try {
    const defaultOptions = {
      resource_type: 'image',
      invalidate: true
    };
    
    const deleteOptions = { ...defaultOptions, ...options };
    const result = await cloudinary.uploader.destroy(publicId, deleteOptions);
    
    if (result.result === 'ok') {
      console.log(`✅ Deleted file: ${publicId}`);
      return { success: true };
    } else {
      console.warn(`⚠️ Failed to delete: ${publicId}`, result);
      return { success: false, result };
    }
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw error;
  }
};

// Delete resume by URL
const deleteResume = async (resumeUrl) => {
  try {
    // Extract public ID from URL
    // URL format: https://res.cloudinary.com/cloud_name/raw/upload/v1234567890/folder/file.pdf
    const urlParts = resumeUrl.split('/');
    const uploadIndex = urlParts.indexOf('upload');
    if (uploadIndex === -1) throw new Error('Invalid Cloudinary URL');
    
    // Get the part after 'upload' excluding version
    const publicIdWithVersion = urlParts.slice(uploadIndex + 2).join('/');
    const publicId = publicIdWithVersion.split('/').slice(1).join('/').split('.')[0];
    
    return await deleteFile(publicId, { resource_type: 'raw' });
  } catch (error) {
    console.error('Delete resume error:', error);
    throw error;
  }
};

// Get optimized URL for images
const getOptimizedUrl = (publicId, options = {}) => {
  const defaultOptions = {
    quality: 'auto',
    fetch_format: 'auto'
  };
  
  const transformOptions = { ...defaultOptions, ...options };
  return cloudinary.url(publicId, transformOptions);
};

// Get thumbnail URL
const getThumbnailUrl = (publicId, width = 150, height = 150) => {
  return cloudinary.url(publicId, {
    width,
    height,
    crop: 'thumb',
    gravity: 'face',
    quality: 'auto'
  });
};

// Transform image with custom settings
const transformImage = (publicId, transformations) => {
  return cloudinary.url(publicId, transformations);
};

// Generate signed URL for secure upload (for client-side uploads)
const generateSignedUploadUrl = (options = {}) => {
  const timestamp = Math.round(Date.now() / 1000);
  const defaultOptions = {
    timestamp,
    folder: 'jobboard/uploads',
    upload_preset: process.env.CLOUDINARY_UPLOAD_PRESET
  };
  
  const uploadOptions = { ...defaultOptions, ...options };
  const signature = cloudinary.utils.api_sign_request(
    uploadOptions,
    process.env.CLOUDINARY_API_SECRET
  );
  
  return {
    signature,
    timestamp,
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    ...uploadOptions
  };
};

// Get file info from public ID
const getFileInfo = async (publicId) => {
  try {
    const result = await cloudinary.api.resource(publicId);
    return result;
  } catch (error) {
    console.error('Get file info error:', error);
    return null;
  }
};

// List files in folder
const listFiles = async (folder, maxResults = 50) => {
  try {
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: folder,
      max_results: maxResults
    });
    return result.resources;
  } catch (error) {
    console.error('List files error:', error);
    return [];
  }
};

// Create upload preset (for admin use)
const createUploadPreset = async (name, options = {}) => {
  try {
    const result = await cloudinary.api.create_upload_preset({
      name,
      folder: `jobboard/${name}`,
      unsigned: true,
      ...options
    });
    return result;
  } catch (error) {
    console.error('Create upload preset error:', error);
    throw error;
  }
};

module.exports = {
  cloudinary,
  uploadFile,
  uploadResume,
  uploadCompanyLogo,
  uploadCandidatePhoto,
  uploadJobAttachment,
  deleteFile,
  deleteResume,
  getOptimizedUrl,
  getThumbnailUrl,
  transformImage,
  generateSignedUploadUrl,
  getFileInfo,
  listFiles,
  createUploadPreset,
  verifyCloudinaryConfig
};
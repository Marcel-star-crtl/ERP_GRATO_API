const { cloudinary, getSecureFileUrl, generateDownloadUrl } = require('../config/cloudinary');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

// Secure file download endpoint
exports.downloadFile = async (req, res) => {
  try {
    const { publicId } = req.params;
    const { type, filename } = req.query;
    
    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: 'Public ID is required'
      });
    }
    
    console.log('Download request for publicId:', publicId);
    
    // Check if this is a local file (has file extension and looks like a local filename)
    const isLocalFile = publicId.includes('-') && /\.(pdf|doc|docx|txt|jpg|jpeg|png|gif)$/i.test(publicId);
    
    if (isLocalFile) {
      console.log('Handling local file download for:', publicId);
      
      // Handle local file download
      const localFilePath = path.join(__dirname, '../uploads/attachments', publicId);
      
      // Check if file exists
      if (!fs.existsSync(localFilePath)) {
        console.error('Local file not found:', localFilePath);
        return res.status(404).json({
          success: false,
          message: 'File not found'
        });
      }
      
      // Get file stats
      const stats = fs.statSync(localFilePath);
      const originalName = publicId.substring(publicId.indexOf('-') + 1); // Remove timestamp prefix
      
      // Set headers for download
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`);
      res.setHeader('Content-Length', stats.size);
      res.setHeader('Cache-Control', 'no-cache');
      
      // Stream the file
      const fileStream = fs.createReadStream(localFilePath);
      fileStream.pipe(res);
      
      fileStream.on('error', (error) => {
        console.error('Error streaming local file:', error);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Error streaming file'
          });
        }
      });
      
      return;
    }
    
    // Handle Cloudinary file download (existing logic)
    console.log('Handling Cloudinary file download for:', publicId);
    
    // Try to get a signed URL first
    let fileUrl;
    try {
      // Generate a signed URL for secure access
      fileUrl = getSecureFileUrl(publicId, 'auto');
      
      // If signed URL generation fails, try regular URL with authentication
      if (!fileUrl) {
        fileUrl = cloudinary.url(publicId, {
          secure: true,
          resource_type: 'auto',
          flags: 'attachment',
          sign_url: true,
          expires_at: Math.round(Date.now() / 1000) + 3600 // 1 hour
        });
      }
    } catch (error) {
      console.log('Signed URL generation failed, trying regular URL:', error.message);
      // Fallback to regular URL
      fileUrl = cloudinary.url(publicId, {
        secure: true,
        resource_type: 'auto',
        flags: 'attachment'
      });
    }
    
    console.log('Generated file URL:', fileUrl);
    
    // Fetch the file from Cloudinary with authentication headers
    const response = await axios({
      method: 'GET',
      url: fileUrl,
      responseType: 'stream',
      headers: {
        'User-Agent': 'ERP-GRATO-Server'
      },
      timeout: 30000 // 30 second timeout
    });
    
    // Set appropriate headers
    const contentType = response.headers['content-type'] || 'application/octet-stream';
    const downloadFilename = filename || `file_${Date.now()}.pdf`;
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    
    // Pipe the file stream to response
    response.data.pipe(res);
    
  } catch (error) {
    console.error('File download error:', error);
    
    // If it's a 401 error, the file might be public but have access restrictions
    if (error.response?.status === 401) {
      return res.status(401).json({
        success: false,
        message: 'File access denied. The file may be private or the access token has expired.',
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to download file',
      error: error.message
    });
  }
};

// Alternative: Get signed URL for direct access
exports.getSignedUrl = async (req, res) => {
  try {
    const { publicId } = req.params;
    const { resourceType = 'auto' } = req.query;
    
    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: 'Public ID is required'
      });
    }
    
    // Generate a signed URL that expires in 1 hour
    let signedUrl;
    try {
      signedUrl = getSecureFileUrl(publicId, resourceType);
      
      if (!signedUrl) {
        // Fallback to regular signed URL
        signedUrl = cloudinary.url(publicId, {
          resource_type: resourceType,
          secure: true,
          sign_url: true,
          expires_at: Math.round(Date.now() / 1000) + 3600 
        });
      }
    } catch (error) {
      console.log('Secure URL generation failed, using fallback:', error.message);
      signedUrl = cloudinary.url(publicId, {
        resource_type: resourceType,
        secure: true,
        sign_url: true,
        expires_at: Math.round(Date.now() / 1000) + 3600 
      });
    }
    
    res.json({
      success: true,
      data: {
        url: signedUrl,
        expires: 3600
      }
    });
    
  } catch (error) {
    console.error('Signed URL generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate signed URL',
      error: error.message
    });
  }
};

// View file inline endpoint
exports.viewFile = async (req, res) => {
  try {
    const { publicId } = req.params;
    
    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: 'Public ID is required'
      });
    }
    
    console.log('View request for publicId:', publicId);
    
    // Check if this is a local file (has file extension and looks like a local filename)
    const isLocalFile = publicId.includes('-') && /\.(pdf|doc|docx|txt|jpg|jpeg|png|gif)$/i.test(publicId);
    
    if (isLocalFile) {
      console.log('Handling local file view for:', publicId);
      
      // Handle local file viewing
      const localFilePath = path.join(__dirname, '../uploads/attachments', publicId);
      
      // Check if file exists
      if (!fs.existsSync(localFilePath)) {
        console.error('Local file not found:', localFilePath);
        return res.status(404).json({
          success: false,
          message: 'File not found'
        });
      }
      
      // Get file stats
      const stats = fs.statSync(localFilePath);
      const originalName = publicId.substring(publicId.indexOf('-') + 1); // Remove timestamp prefix
      
      // Determine content type based on file extension
      const ext = path.extname(publicId).toLowerCase();
      let contentType = 'application/octet-stream';
      
      switch (ext) {
        case '.pdf':
          contentType = 'application/pdf';
          break;
        case '.jpg':
        case '.jpeg':
          contentType = 'image/jpeg';
          break;
        case '.png':
          contentType = 'image/png';
          break;
        case '.gif':
          contentType = 'image/gif';
          break;
        case '.txt':
          contentType = 'text/plain';
          break;
        case '.doc':
          contentType = 'application/msword';
          break;
        case '.docx':
          contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          break;
      }
      
      // Set headers for inline viewing
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="${originalName}"`);
      res.setHeader('Content-Length', stats.size);
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      
      // Stream the file
      const fileStream = fs.createReadStream(localFilePath);
      fileStream.pipe(res);
      
    } else {
      // Handle Cloudinary files
      try {
        const downloadUrl = await generateDownloadUrl(publicId);
        
        if (!downloadUrl) {
          throw new Error('Failed to generate download URL');
        }
        
        // Fetch the file from Cloudinary
        const response = await axios({
          method: 'GET',
          url: downloadUrl,
          responseType: 'stream'
        });
        
        // Set headers for inline viewing
        res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${publicId}"`);
        res.setHeader('Content-Length', response.headers['content-length']);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        
        // Pipe the response directly to client
        response.data.pipe(res);
        
      } catch (cloudinaryError) {
        console.error('Cloudinary view error:', cloudinaryError);
        return res.status(404).json({
          success: false,
          message: 'File not found in Cloudinary'
        });
      }
    }
    
  } catch (error) {
    console.error('File view error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to view file',
      error: error.message
    });
  }
};
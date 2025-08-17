const multer = require('multer');
const sharp = require('sharp');

// Configure multer for file uploads (memory storage for serverless)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1 // Single file
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Use multer to handle the file upload
    upload.single('image')(req, res, async (err) => {
      if (err) {
        console.error('Multer error:', err);
        return res.status(400).json({ error: err.message });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
      }

      const {
        quality = 80,
        effort = 4,
        cropLeft,
        cropTop,
        cropWidth,
        cropHeight,
        resizeWidth,
        resizeHeight,
        fit = 'inside',
        withoutEnlargement = 'true'
      } = req.body;

      console.log(`Converting ${req.file.originalname} to WebP...`);

      // Build Sharp pipeline
      let pipeline = sharp(req.file.buffer);

      // Apply cropping if specified
      if (cropLeft !== undefined && cropTop !== undefined && cropWidth !== undefined && cropHeight !== undefined) {
        pipeline = pipeline.extract({
          left: parseInt(cropLeft),
          top: parseInt(cropTop),
          width: parseInt(cropWidth),
          height: parseInt(cropHeight)
        });
      }

      // Apply resizing if specified
      if (resizeWidth !== undefined || resizeHeight !== undefined) {
        const resizeOptions = {};
        if (resizeWidth) resizeOptions.width = parseInt(resizeWidth);
        if (resizeHeight) resizeOptions.height = parseInt(resizeHeight);
        resizeOptions.fit = fit;
        resizeOptions.withoutEnlargement = withoutEnlargement === 'true';
        
        pipeline = pipeline.resize(resizeOptions);
      }

      // Convert to WebP
      const webpBuffer = await pipeline
        .webp({
          quality: parseInt(quality),
          effort: parseInt(effort)
        })
        .toBuffer();

      // Set response headers
      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Content-Disposition', `attachment; filename="${req.file.originalname.replace(/\.[^/.]+$/, '')}.webp"`);
      
      res.send(webpBuffer);

    });

  } catch (error) {
    console.error('Conversion error:', error);
    res.status(500).json({ error: 'Failed to convert image', details: error.message });
  }
};

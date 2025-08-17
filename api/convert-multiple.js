const multer = require('multer');
const sharp = require('sharp');
const JSZip = require('jszip');

// Configure multer for file uploads (memory storage for serverless)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 10 // Max 10 files
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
    // Use multer to handle the file uploads
    upload.array('images', 10)(req, res, async (err) => {
      if (err) {
        console.error('Multer error:', err);
        return res.status(400).json({ error: err.message });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No image files provided' });
      }

      const {
        quality = 80,
        effort = 4,
        resizeWidth,
        resizeHeight,
        fit = 'inside',
        withoutEnlargement = 'true'
      } = req.body;

      console.log(`Converting ${req.files.length} images to WebP...`);

      const results = [];
      const zip = new JSZip();

      for (const file of req.files) {
        try {
          let pipeline = sharp(file.buffer);

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

          const filename = file.originalname.replace(/\.[^/.]+$/, '') + '.webp';
          zip.file(filename, webpBuffer);
          
          results.push({
            originalName: file.originalname,
            convertedName: filename,
            size: webpBuffer.length,
            success: true
          });

        } catch (error) {
          console.error(`Error converting ${file.originalname}:`, error);
          results.push({
            originalName: file.originalname,
            error: error.message,
            success: false
          });
        }
      }

      if (results.length === 1) {
        // Single file - return the WebP directly
        const singleResult = results[0];
        if (singleResult.success) {
          res.setHeader('Content-Type', 'image/webp');
          res.setHeader('Content-Disposition', `attachment; filename="${singleResult.convertedName}"`);
          const fileBuffer = await zip.file(singleResult.convertedName).async('nodebuffer');
          res.send(fileBuffer);
          return;
        } else {
          res.status(500).json({ error: singleResult.error });
          return;
        }
      }

      // Multiple files - return ZIP
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="converted-images.zip"');
      res.send(zipBuffer);

    });

  } catch (error) {
    console.error('Batch conversion error:', error);
    res.status(500).json({ error: 'Failed to convert images', details: error.message });
  }
};

const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'WebP Converter API is running' });
});

// Convert single image to WebP
app.post('/api/convert', upload.single('image'), async (req, res) => {
  try {
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

  } catch (error) {
    console.error('Conversion error:', error);
    res.status(500).json({ error: 'Failed to convert image', details: error.message });
  }
});

// Convert multiple images to WebP
app.post('/api/convert-multiple', upload.array('images', 10), async (req, res) => {
  try {
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
    const JSZip = require('jszip');
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

  } catch (error) {
    console.error('Batch conversion error:', error);
    res.status(500).json({ error: 'Failed to convert images', details: error.message });
  }
});

// Handle all other routes
app.all('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Export for Vercel
module.exports = app;

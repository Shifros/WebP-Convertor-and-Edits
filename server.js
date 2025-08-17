const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
const processedDir = path.join(__dirname, 'processed');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(processedDir)) {
  fs.mkdirSync(processedDir, { recursive: true });
}

// Safe delete helper to avoid EBUSY/EPERM crashes on Windows
const safeUnlink = async (targetPath, attempt = 1) => {
  try {
    await fs.promises.unlink(targetPath);
  } catch (error) {
    if ((error.code === 'EBUSY' || error.code === 'EPERM') && attempt < 5) {
      // Backoff and retry with exponential delay
      await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
      return safeUnlink(targetPath, attempt + 1);
    }
    // Log error but don't crash the server
    console.warn(`Failed to delete file ${targetPath} after ${attempt} attempts:`, error.message);
  }
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
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
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'WebP Converter Server is running' });
});

// Convert single image to WebP
app.post('/convert', upload.single('image'), async (req, res) => {
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
    const inputPath = req.file.path;
    const originalName = req.file.originalname.replace(/\.[^/.]+$/, '');
    const outputFilename = `${originalName}-${Date.now()}.webp`;
    const outputPath = path.join(processedDir, outputFilename);

    console.log(`Converting ${req.file.originalname} to WebP...`);

    // Build Sharp pipeline
    let pipeline = sharp(inputPath);

    // Optional crop
    if (
      cropLeft !== undefined ||
      cropTop !== undefined ||
      cropWidth !== undefined ||
      cropHeight !== undefined
    ) {
      const meta = await pipeline.metadata();
      const left = Math.max(0, parseInt(cropLeft ?? 0));
      const top = Math.max(0, parseInt(cropTop ?? 0));
      const width = Math.max(1, parseInt(cropWidth ?? (meta.width - left)));
      const height = Math.max(1, parseInt(cropHeight ?? (meta.height - top)));
      const safeWidth = Math.min(width, Math.max(1, (meta.width ?? width) - left));
      const safeHeight = Math.min(height, Math.max(1, (meta.height ?? height) - top));
      pipeline = pipeline.extract({ left, top, width: safeWidth, height: safeHeight });
    }

    // Optional resize
    if (resizeWidth !== undefined || resizeHeight !== undefined) {
      const rw = resizeWidth !== undefined && resizeWidth !== '' ? parseInt(resizeWidth) : null;
      const rh = resizeHeight !== undefined && resizeHeight !== '' ? parseInt(resizeHeight) : null;
      pipeline = pipeline.resize(rw || null, rh || null, {
        fit: (fit || 'inside'),
        withoutEnlargement: String(withoutEnlargement).toLowerCase() !== 'false'
      });
    }

    // Final encode to WebP
    await pipeline
      .webp({
        quality: parseInt(quality),
        effort: parseInt(effort),
        lossless: false,
        nearLossless: false
      })
      .toFile(outputPath);

    // Get file stats
    const originalStats = fs.statSync(inputPath);
    const processedStats = fs.statSync(outputPath);
    const compressionRatio = ((originalStats.size - processedStats.size) / originalStats.size * 100).toFixed(1);

    // Read the processed file
    const processedBuffer = fs.readFileSync(outputPath);

    // Clean up uploaded file (resilient)
    try {
      await safeUnlink(inputPath);
    } catch (_) {}

    console.log(`Successfully converted ${req.file.originalname} to WebP`);

    res.json({
      success: true,
      filename: outputFilename,
      originalSize: originalStats.size,
      processedSize: processedStats.size,
      compressionRatio: compressionRatio,
      data: processedBuffer.toString('base64')
    });

  } catch (error) {
    console.error('Conversion error:', error);
    
    // Clean up uploaded file if it exists (resilient)
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        await safeUnlink(req.file.path);
      } catch (_) {}
    }
    
    res.status(500).json({ 
      error: 'Image conversion failed', 
      details: error.message 
    });
  }
});

// Convert multiple images to WebP
app.post('/convert-batch', upload.array('images', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No image files provided' });
    }

    const { quality = 80, effort = 4 } = req.body;
    const results = [];

    console.log(`Converting ${req.files.length} images to WebP...`);

    for (const file of req.files) {
      try {
        const inputPath = file.path;
        const originalName = file.originalname.replace(/\.[^/.]+$/, '');
        const outputFilename = `${originalName}-${Date.now()}.webp`;
        const outputPath = path.join(processedDir, outputFilename);

        // Process image with Sharp
        await sharp(inputPath)
          .webp({
            quality: parseInt(quality),
            effort: parseInt(effort),
            lossless: false,
            nearLossless: false
          })
          .toFile(outputPath);

        // Get file stats
        const originalStats = fs.statSync(inputPath);
        const processedStats = fs.statSync(outputPath);
        const compressionRatio = ((originalStats.size - processedStats.size) / originalStats.size * 100).toFixed(1);

        // Read the processed file
        const processedBuffer = fs.readFileSync(outputPath);

        // Clean up uploaded file (resilient)
        try {
          await safeUnlink(inputPath);
        } catch (_) {}

        results.push({
          originalName: file.originalname,
          filename: outputFilename,
          originalSize: originalStats.size,
          processedSize: processedStats.size,
          compressionRatio: compressionRatio,
          data: processedBuffer.toString('base64')
        });

        console.log(`Successfully converted ${file.originalname} to WebP`);

      } catch (error) {
        console.error(`Error converting ${file.originalname}:`, error);
        
        // Clean up uploaded file if it exists (resilient)
        if (fs.existsSync(file.path)) {
          try {
            await safeUnlink(file.path);
          } catch (_) {}
        }
        
        results.push({
          originalName: file.originalname,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      results: results
    });

  } catch (error) {
    console.error('Batch conversion error:', error);
    
    // Clean up uploaded files (resilient)
    if (req.files) {
      for (const file of req.files) {
        if (fs.existsSync(file.path)) {
          try {
            await safeUnlink(file.path);
          } catch (_) {}
        }
      }
    }
    
    res.status(500).json({ 
      error: 'Batch conversion failed', 
      details: error.message 
    });
  }
});

// Get conversion options
app.get('/options', (req, res) => {
  res.json({
    quality: {
      min: 1,
      max: 100,
      default: 80,
      description: 'WebP quality (1-100)'
    },
    effort: {
      min: 0,
      max: 6,
      default: 4,
      description: 'Compression effort (0-6, higher = slower but better compression)'
    },
    maxFileSize: '50MB',
    maxFiles: 10,
    supportedFormats: ['JPEG', 'PNG', 'GIF', 'WebP', 'TIFF', 'BMP']
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 50MB.' });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files. Maximum is 10 files.' });
    }
  }
  
  res.status(500).json({ error: 'Internal server error' });
});

// Cleanup old processed files (older than 1 hour)
const cleanupOldFiles = async () => {
  try {
    const files = await fs.promises.readdir(processedDir);
    const now = Date.now();
    const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds
    
    for (const file of files) {
      const filePath = path.join(processedDir, file);
      const stats = await fs.promises.stat(filePath);
      
      if (now - stats.mtime.getTime() > oneHour) {
        await safeUnlink(filePath);
        console.log(`Cleaned up old file: ${file}`);
      }
    }
  } catch (error) {
    console.warn('Cleanup error:', error.message);
  }
};

// Run cleanup every 30 minutes
setInterval(cleanupOldFiles, 30 * 60 * 1000);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 WebP Converter Server running on http://localhost:${PORT}`);
  console.log(`📁 Uploads directory: ${uploadsDir}`);
  console.log(`📁 Processed directory: ${processedDir}`);
  console.log(`🔧 Sharp version: ${sharp.versions.sharp}`);
  console.log(`📊 Supported formats: JPEG, PNG, GIF, WebP, TIFF, BMP`);
  console.log(`🧹 Auto-cleanup: Every 30 minutes (files older than 1 hour)`);
});

module.exports = app;

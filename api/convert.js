const { readFile } = require('fs/promises');
const path = require('path');
const sharp = require('sharp');
const formidable = require('formidable');

module.exports = async (req, res) => {
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
		const form = formidable({
			maxFileSize: 50 * 1024 * 1024, // 50MB
			allowEmptyFiles: false,
			multiples: false,
		});

		form.parse(req, async (err, fields, files) => {
			if (err) {
				console.error('Form parse error:', err);
				return res.status(400).json({ error: err.message });
			}

			const file = files.image;
			if (!file) {
				return res.status(400).json({ error: 'No image file provided' });
			}

			const filepath = Array.isArray(file) ? file[0].filepath : file.filepath;
			const originalFilename = Array.isArray(file) ? file[0].originalFilename : file.originalFilename;
			const buffer = await readFile(filepath);

			const quality = parseInt(fields.quality ?? '80', 10);
			const effort = parseInt(fields.effort ?? '4', 10);
			const cropLeft = fields.cropLeft, cropTop = fields.cropTop, cropWidth = fields.cropWidth, cropHeight = fields.cropHeight;
			const resizeWidth = fields.resizeWidth, resizeHeight = fields.resizeHeight;
			const fit = (fields.fit ?? 'inside');
			const withoutEnlargement = String(fields.withoutEnlargement ?? 'true') === 'true';

			let pipeline = sharp(buffer);

			if (cropLeft !== undefined && cropTop !== undefined && cropWidth !== undefined && cropHeight !== undefined) {
				pipeline = pipeline.extract({
					left: parseInt(cropLeft, 10),
					top: parseInt(cropTop, 10),
					width: parseInt(cropWidth, 10),
					height: parseInt(cropHeight, 10),
				});
			}

			if (resizeWidth !== undefined || resizeHeight !== undefined) {
				const resizeOptions = {};
				if (resizeWidth) resizeOptions.width = parseInt(resizeWidth, 10);
				if (resizeHeight) resizeOptions.height = parseInt(resizeHeight, 10);
				resizeOptions.fit = fit;
				resizeOptions.withoutEnlargement = withoutEnlargement;
				pipeline = pipeline.resize(resizeOptions);
			}

			const webpBuffer = await pipeline.webp({ quality, effort }).toBuffer();

			const originalSize = buffer.length;
			const processedSize = webpBuffer.length;
			const compressionRatio = originalSize > 0 ? Math.round(((originalSize - processedSize) / originalSize) * 100) : 0;
			const filename = (originalFilename || 'image').replace(/\.[^/.]+$/, '') + '.webp';
			const data = Buffer.from(webpBuffer).toString('base64');

			res.setHeader('Content-Type', 'application/json');
			return res.status(200).json({
				success: true,
				filename,
				data,
				originalSize,
				processedSize,
				compressionRatio,
			});
		});
	} catch (error) {
		console.error('Conversion error:', error);
		res.status(500).json({ error: 'Failed to convert image', details: error.message });
	}
};

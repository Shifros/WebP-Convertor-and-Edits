const { readFile } = require('fs/promises');
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
			maxFileSize: 50 * 1024 * 1024,
			allowEmptyFiles: false,
			multiples: true,
		});

		form.parse(req, async (err, fields, files) => {
			if (err) {
				console.error('Form parse error:', err);
				return res.status(400).json({ error: err.message });
			}

			let inputFiles = files.images;
			if (!inputFiles) {
				return res.status(400).json({ error: 'No image files provided' });
			}

			if (!Array.isArray(inputFiles)) {
				inputFiles = [inputFiles];
			}

			const quality = parseInt(fields.quality ?? '80', 10);
			const effort = parseInt(fields.effort ?? '4', 10);
			const resizeWidth = fields.resizeWidth, resizeHeight = fields.resizeHeight;
			const fit = (fields.fit ?? 'inside');
			const withoutEnlargement = String(fields.withoutEnlargement ?? 'true') === 'true';

			const results = [];

			for (const file of inputFiles) {
				try {
					const buffer = await readFile(file.filepath);
					let pipeline = sharp(buffer);

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
					const filename = (file.originalFilename || 'image').replace(/\.[^/.]+$/, '') + '.webp';
					const data = Buffer.from(webpBuffer).toString('base64');

					results.push({
						success: true,
						filename,
						data,
						originalName: file.originalFilename,
						originalSize,
						processedSize,
						compressionRatio,
					});
				} catch (e) {
					results.push({ success: false, error: e.message, originalName: file?.originalFilename });
				}
			}

			return res.status(200).json({ success: true, results });
		});
	} catch (error) {
		console.error('Batch conversion error:', error);
		res.status(500).json({ error: 'Failed to convert images', details: error.message });
	}
};

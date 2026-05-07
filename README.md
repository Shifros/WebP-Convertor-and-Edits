<<<<<<< HEAD
# Playground - WebP Converter

A modern WebP converter built with React Native Web and Sharp backend, featuring advanced image cropping and resizing capabilities.

## Features

- 🖼️ **Image Upload & Conversion**: Convert images to WebP format
- ✂️ **Advanced Cropping**: Interactive crop tool with aspect ratio controls
- 📏 **Custom Sizing**: Resize images to exact dimensions
- 🎨 **Multiple Formats**: Support for JPEG, PNG, GIF, WebP, TIFF, BMP
- 🌙 **Dark/Light Mode**: Beautiful UI with theme switching
- 📱 **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

- **Frontend**: React Native Web, React Image Crop
- **Backend**: Node.js, Express, Sharp
- **Build Tool**: Webpack
- **Styling**: React Native StyleSheet

## Local Development

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd webp-converter
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev:full
   ```

4. **Open in browser**
   - Frontend: http://localhost:3000
   - Backend: http://localhost:3001

## Production Deployment

### Deploy to Vercel

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Production ready"
   git push origin main
   ```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Vercel will automatically detect the configuration

3. **Environment Variables** (if needed)
   - Add any environment variables in Vercel dashboard
   - Default PORT will be set automatically

### Manual Deployment

1. **Build the project**
   ```bash
   npm run build
   ```

2. **Start production server**
   ```bash
   npm run server
   ```

## API Endpoints

- `POST /convert` - Convert image to WebP
- `POST /convert-batch` - Convert multiple images
- `GET /health` - Health check
- `GET /download/:filename` - Download converted file

## File Structure

```
webp-converter/
├── src/
│   ├── App.js              # Main React component
│   ├── ImageCropper.js     # Image cropping modal
│   └── index.js            # Entry point
├── public/
│   └── index.html          # HTML template
├── server.js               # Express backend
├── webpack.config.js       # Webpack configuration
├── vercel.json            # Vercel deployment config
└── package.json           # Dependencies and scripts
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Support

For issues and questions, please open an issue on GitHub.
=======
# WebP-Convertor-and-Edits
React + Node.js app to convert images to WebP and perform edits (resize, crop, dimension changes) using Sharp.
>>>>>>> dc7b2a3bedba7ec9d431e4a0e759df4f68061218

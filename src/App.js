import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  Dimensions,
  Animated
} from 'react-native';
import ImageCropper from './ImageCropper';

const { width } = Dimensions.get('window');

const API_BASE_URL = 'http://localhost:3001';

const App = () => {
  const [images, setImages] = useState([]);
  const [compressionLevel, setCompressionLevel] = useState(80);
  const [isConverting, setIsConverting] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [convertedImages, setConvertedImages] = useState([]);
  const [serverStatus, setServerStatus] = useState('checking');
  const [convertingImages, setConvertingImages] = useState(new Set());
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Cropping state
  const [showCropper, setShowCropper] = useState(false);
  const [croppingImage, setCroppingImage] = useState(null);



  // Check server status on component mount
  React.useEffect(() => {
    checkServerStatus();
    const interval = setInterval(checkServerStatus, 5000);
    
    return () => {
      clearInterval(interval);
    };
  }, []);

  // Pulse animation for server status
  useEffect(() => {
    if (serverStatus === 'connected') {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
      return () => pulseAnimation.stop();
    }
  }, [serverStatus, pulseAnim]);

  const checkServerStatus = async () => {
    try {
      console.log('Checking server status...');
      const response = await fetch(`${API_BASE_URL}/health`);
      console.log('Server response:', response.status, response.ok);
      if (response.ok) {
        console.log('Server connected!');
        setServerStatus('connected');
      } else {
        console.log('Server error status:', response.status);
        setServerStatus('error');
      }
    } catch (error) {
      console.error('Server connection error:', error);
      setServerStatus('error');
    }
  };



  // Handle file selection
  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    handleFiles(files);
  };

  // Open cropper for an image
  const openCropper = (image) => {
    setCroppingImage(image);
    setShowCropper(true);
  };

  // Handle crop completion
  const handleCropComplete = async (cropData) => {
    if (!cropData || !cropData.blob) {
      Alert.alert('Error', 'Failed to crop image');
      return;
    }

    try {
      // Convert blob to file
      const croppedFile = new File([cropData.blob], croppingImage.name, {
        type: 'image/jpeg',
        lastModified: Date.now(),
      });

      // Create new image object with cropped file
      const croppedImage = {
        ...croppingImage,
        file: croppedFile,
        url: URL.createObjectURL(cropData.blob),
        cropInfo: cropData
      };

      // Replace the original image with cropped version
      setImages(prev => prev.map(img => 
        img.id === croppingImage.id ? croppedImage : img
      ));

      setShowCropper(false);
      setCroppingImage(null);

      Alert.alert(
        'Crop Applied',
        `Image cropped and resized to ${cropData.resize.width}×${cropData.resize.height}`
      );

    } catch (error) {
      console.error('Crop completion error:', error);
      Alert.alert('Error', 'Failed to apply crop');
    }
  };

  // Cancel cropping
  const cancelCropping = () => {
    setShowCropper(false);
    setCroppingImage(null);
  };



  const handleFiles = (files) => {
    console.log('handleFiles called with:', files.length, 'files');
    console.log('File types:', files.map(f => f.type));
    
    const imageFiles = files.filter(file => 
      file.type.startsWith('image/') && 
      ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/tiff', 'image/bmp'].includes(file.type)
    );

    console.log('Filtered image files:', imageFiles.length);
    console.log('Image file names:', imageFiles.map(f => f.name));

    const newImages = imageFiles.map(file => ({
      file,
      url: URL.createObjectURL(file),
      name: file.name,
      size: file.size,
      type: file.type,
      id: Date.now() + Math.random() // Unique ID for each image
    }));

    console.log('Created new images:', newImages.length);
    setImages(prev => {
      const updated = [...prev, ...newImages];
      console.log('Total images after update:', updated.length);
      return updated;
    });
  };

  // Remove single image
  const removeImage = (imageId) => {
    setImages(prev => {
      const newImages = prev.filter(img => img.id !== imageId);
      const removedImage = prev.find(img => img.id === imageId);
      if (removedImage) {
        URL.revokeObjectURL(removedImage.url);
      }
      return newImages;
    });
  };



  // Convert single image
  const convertSingleImage = async (image) => {
    if (serverStatus !== 'connected') {
      Alert.alert('Server Error', 'Cannot connect to the conversion server. Please make sure the server is running.');
      return;
    }

    setConvertingImages(prev => new Set(prev).add(image.id));

    try {
      const formData = new FormData();
      formData.append('image', image.file);
      formData.append('quality', compressionLevel);
      formData.append('effort', 4);

      const response = await fetch(`${API_BASE_URL}/convert`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Conversion failed');
      }

      const result = await response.json();
      
      if (result.success) {
        const webPBlob = new Blob([Uint8Array.from(atob(result.data), c => c.charCodeAt(0))], {
          type: 'image/webp'
        });
        const webPUrl = URL.createObjectURL(webPBlob);
        
        const convertedImage = {
          url: webPUrl,
          name: result.filename,
          size: result.processedSize,
          originalName: image.name,
          originalSize: result.originalSize,
          compressionRatio: result.compressionRatio
        };

        setConvertedImages(prev => [...prev, convertedImage]);
        
        // Show success popup instead of removing the image
        Alert.alert(
          'Conversion Successful!',
          `${image.name} has been converted to WebP format.\n\nOriginal: ${formatFileSize(result.originalSize)}\nConverted: ${formatFileSize(result.processedSize)}\nCompression: ${result.compressionRatio}% smaller`,
          [
            {
              text: 'OK',
              style: 'default'
            }
          ]
        );
      }
    } catch (error) {
      console.error(`Error converting ${image.name}:`, error);
      Alert.alert('Error', `Failed to convert ${image.name}: ${error.message}`);
    } finally {
      setConvertingImages(prev => {
        const newSet = new Set(prev);
        newSet.delete(image.id);
        return newSet;
      });
    }
  };

  // Convert all images
  const convertAllImages = async () => {
    if (images.length === 0) return;
    
    if (serverStatus !== 'connected') {
      Alert.alert('Server Error', 'Cannot connect to the conversion server. Please make sure the server is running.');
      return;
    }
    
    setIsConverting(true);
    const results = [];

    try {
      // Batch conversion
      const batchResults = await convertBatchImages(images);
      results.push(...batchResults);
      
      // Clear all images after successful batch conversion
      clearAllImages();
    } catch (error) {
      console.error('Conversion error:', error);
      Alert.alert('Error', 'Failed to convert images. Please try again.');
    }

    setConvertedImages(results);
    setIsConverting(false);
  };

  // Convert batch images
  const convertBatchImages = async (images) => {
    try {
      const formData = new FormData();
      images.forEach(image => {
        formData.append('images', image.file);
      });
      formData.append('quality', compressionLevel);
      formData.append('effort', 4);

      const response = await fetch(`${API_BASE_URL}/convert-batch`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Batch conversion failed');
      }

      const result = await response.json();
      
      if (result.success) {
        return result.results
          .filter(item => !item.error)
          .map(item => {
            const webPBlob = new Blob([Uint8Array.from(atob(item.data), c => c.charCodeAt(0))], {
              type: 'image/webp'
            });
            const webPUrl = URL.createObjectURL(webPBlob);
            
            return {
              url: webPUrl,
              name: item.filename,
              size: item.processedSize,
              originalName: item.originalName,
              originalSize: item.originalSize,
              compressionRatio: item.compressionRatio
            };
          });
      }
    } catch (error) {
      console.error('Batch conversion error:', error);
      Alert.alert('Error', `Batch conversion failed: ${error.message}`);
    }
    return [];
  };

  // Clear all images
  const clearAllImages = () => {
    images.forEach(image => URL.revokeObjectURL(image.url));
    setImages([]);
  };

  // Clear all converted images
  const clearAllConverted = () => {
    convertedImages.forEach(image => URL.revokeObjectURL(image.url));
    setConvertedImages([]);
  };

  // Download individual image
  const downloadImage = (url, name) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Download all converted images as ZIP
  const downloadAll = async () => {
    if (convertedImages.length === 0) return;
    
    try {
      // For single file, just download it
      if (convertedImages.length === 1) {
        downloadImage(convertedImages[0].url, convertedImages[0].name);
        return;
      }
      
      // For multiple files, create a ZIP
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      
      for (const image of convertedImages) {
        const response = await fetch(image.url);
        const blob = await response.blob();
        zip.file(image.name, blob);
      }
      
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipUrl = URL.createObjectURL(zipBlob);
      
      const a = document.createElement('a');
      a.href = zipUrl;
      a.download = 'webp-converted-images.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      URL.revokeObjectURL(zipUrl);
    } catch (error) {
      console.error('Error creating ZIP:', error);
      Alert.alert('Error', 'Failed to create ZIP file. Downloading files individually.');
      
      // Fallback to individual downloads
      convertedImages.forEach(image => {
        setTimeout(() => downloadImage(image.url, image.name), 100);
      });
    }
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: darkMode ? '#000000' : '#ffffff',
      padding: 60,
      paddingTop: 0,
      paddingBottom: 90,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 40,
      paddingHorizontal: 10,
      marginTop: 60,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 15,
    },
    title: {
      fontSize: 32,
      fontWeight: 'bold',
      color: darkMode ? '#ffffff' : '#000000',
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 15,
    },
    serverStatusInline: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    themeButton: {
      padding: 12,
      paddingHorizontal: 20,
      borderRadius: 8,
      backgroundColor: darkMode ? '#333333' : '#e0e0e0',
      borderWidth: 1,
      borderColor: darkMode ? '#ffffff' : '#000000',
    },
    themeButtonText: {
      color: darkMode ? '#ffffff' : '#000000',
      fontSize: 14,
      fontWeight: '600',
    },

    statusIndicator: {
      width: 12,
      height: 12,
      borderRadius: 6,
      marginRight: 8,
    },
    statusIndicatorConnected: {
      width: 12,
      height: 12,
      borderRadius: 6,
      marginRight: 8,
      backgroundColor: '#34C759',
      shadowColor: '#34C759',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 4,
      elevation: 4,
    },
    statusText: {
      fontSize: 14,
      color: darkMode ? '#ffffff' : '#000000',
      fontWeight: '500',
    },
    content: {
      flex: 1,
    },
    section: {
      backgroundColor: darkMode ? '#1a1a1a' : '#ffffff',
      borderRadius: 15,
      padding: 25,
      marginBottom: 25,
      marginHorizontal: 5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: darkMode ? 0.3 : 0.1,
      shadowRadius: 8,
      elevation: 5,
      borderWidth: 1,
      borderColor: darkMode ? '#333333' : '#e0e0e0',
    },
    sectionTitle: {
      fontSize: 22,
      fontWeight: '700',
      marginBottom: 20,
      color: darkMode ? '#ffffff' : '#000000',
    },
    uploadZone: {
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: darkMode ? '#ffffff' : '#000000',
      borderRadius: 10,
      padding: 30,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: darkMode ? '#0a0a0a' : '#f8f8f8',
      minHeight: 140,
      marginBottom: 25,
    },
    uploadText: {
      fontSize: 18,
      marginBottom: 5,
      color: darkMode ? '#ffffff' : '#000000',
      fontWeight: '600',
      textAlign: 'center',
    },
    uploadSubtext: {
      fontSize: 12,
      marginTop: 10,
      color: darkMode ? '#cccccc' : '#666666',
      fontWeight: '400',
      textAlign: 'center',
    },
    selectButton: {
      backgroundColor: '#007AFF',
      paddingHorizontal: 25,
      paddingVertical: 12,
      borderRadius: 8,
      marginTop: 15,
    },
    selectButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
    },
    sliderContainer: {
      marginBottom: 25,
      marginTop: 10,
    },
    sliderLabel: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 15,
      color: darkMode ? '#ffffff' : '#000000',
    },
    slider: {
      width: '100%',
      height: 40,
    },
    sliderText: {
      fontSize: 12,
      color: darkMode ? '#ffffff' : '#000000',
      textAlign: 'center',
      marginTop: 0,
      marginBottom: 10,
      fontWeight: '500',
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 15,
      marginBottom: 25,
      marginTop: 10,
    },
    convertAllButton: {
      flex: 1,
      backgroundColor: '#34C759',
      paddingVertical: 15,
      borderRadius: 8,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#34C759',
    },
    convertAllButtonDisabled: {
      backgroundColor: darkMode ? '#333333' : '#cccccc',
      borderColor: darkMode ? '#555555' : '#999999',
    },
    clearAllButton: {
      backgroundColor: '#FF3B30',
      paddingVertical: 15,
      paddingHorizontal: 20,
      borderRadius: 8,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#FF3B30',
    },
    buttonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
    },
    buttonTextDisabled: {
      color: darkMode ? '#666666' : '#999999',
    },
    imageGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 10,
    },
    imageItem: {
      width: (width - 100) / 6, // 6 images per row for even smaller previews
      borderRadius: 8,
      backgroundColor: darkMode ? '#333333' : '#f0f0f0',
      borderWidth: 1,
      borderColor: darkMode ? '#555555' : '#e0e0e0',
      padding: 2,
    },
          image: {
        width: 'auto',
        height: 'auto',
        maxWidth: '100%',
        maxHeight: '200px',
        borderRadius: 6,
        objectFit: 'contain',
      },
    imageOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.3)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    imageButtons: {
      flexDirection: 'row',
      gap: 1,
      marginTop: 5,
    },
    imageButton: {
      flex: 1,
      paddingVertical: 3,
      alignItems: 'center',
      justifyContent: 'center',
    },
    convertButton: {
      backgroundColor: '#34C759',
    },
    cropButton: {
      backgroundColor: '#007AFF',
    },
    removeButton: {
      backgroundColor: '#FF3B30',
    },
    imageButtonText: {
      color: '#ffffff',
      fontSize: 15, // Adjusted to 15px for balanced readability
      fontWeight: '500',
    },
    imageInfo: {
      padding: 3,
    },
    imageName: {
      fontSize: 7,
      color: darkMode ? '#ffffff' : '#000000',
      marginBottom: 2,
      textAlign: 'center',
      fontWeight: '500',
    },
    imageSize: {
      fontSize: 6,
      color: darkMode ? '#ffffff' : '#000000',
      textAlign: 'center',
      fontWeight: '500',
    },
    convertedItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 20,
      backgroundColor: darkMode ? '#1a1a1a' : '#f8f8f8',
      borderRadius: 10,
      marginBottom: 15,
      borderWidth: 1,
      borderColor: darkMode ? '#333333' : '#e0e0e0',
    },
    convertedImage: {
      width: 'auto',
      height: 'auto',
      maxWidth: '60px',
      maxHeight: '60px',
      borderRadius: 8,
      marginRight: 15,
      objectFit: 'contain',
    },
    convertedInfo: {
      flex: 1,
    },
    convertedName: {
      fontSize: 14,
      fontWeight: '600',
      color: darkMode ? '#ffffff' : '#000000',
      marginBottom: 5,
    },
    convertedSize: {
      fontSize: 12,
      color: darkMode ? '#ffffff' : '#000000',
      fontWeight: '500',
    },
    compressionInfo: {
      fontSize: 10,
      color: '#34C759',
      marginTop: 3,
      fontWeight: '600',
    },
    downloadButton: {
      backgroundColor: '#007AFF',
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#007AFF',
    },
    downloadButtonText: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '600',
    },
    downloadAllButton: {
      backgroundColor: '#007AFF',
      paddingHorizontal: 25,
      paddingVertical: 12,
      borderRadius: 8,
      marginTop: 15,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#007AFF',
    },
    downloadAllButtonText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '600',
    },
    cropperOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.9)',
      zIndex: 9999,
    },
    emptyState: {
      alignItems: 'center',
      padding: 50,
      marginTop: 20,
    },
    emptyStateText: {
      fontSize: 16,
      color: darkMode ? '#ffffff' : '#000000',
      textAlign: 'center',
      fontWeight: '500',
    },
    loadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingSpinner: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: '#ffffff',
      borderTopColor: 'transparent',
      marginRight: 10,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 15,
    },
    sectionTitleWithCount: {
      fontSize: 18,
      fontWeight: '600',
      color: darkMode ? '#ffffff' : '#333333',
    },
    clearConvertedButton: {
      backgroundColor: '#FF3B30',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    clearConvertedButtonText: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '500',
    },


  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Navyas playground</Text>
        <View style={styles.headerRight}>
          <View style={styles.serverStatusInline}>
            <Animated.View style={[
              serverStatus === 'connected' ? styles.statusIndicatorConnected : styles.statusIndicator,
              {
                backgroundColor: serverStatus === 'connected' ? '#34C759' : 
                               serverStatus === 'checking' ? '#FF9500' : '#FF3B30',
                transform: [{ scale: pulseAnim }],
              }
            ]} />
            <Text style={styles.statusText}>
              {serverStatus === 'connected' ? 'Server Connected' :
               serverStatus === 'checking' ? 'Checking Server...' : 'Server Disconnected'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.themeButton}
            onPress={() => setDarkMode(!darkMode)}
          >
            <Text style={styles.themeButtonText}>
              {darkMode ? 'Light Mode' : 'Dark Mode'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upload Images</Text>
          
          <TouchableOpacity
            style={styles.uploadZone}
            onPress={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.multiple = true;
              input.accept = 'image/jpeg,image/jpg,image/png,image/gif,image/webp,image/tiff,image/bmp';
              input.onchange = handleFileSelect;
              input.click();
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const files = Array.from(e.dataTransfer.files);
              handleFiles(files);
            }}
          >
            <Text style={styles.uploadText}>📁 Select Images from your device</Text>
            <Text style={styles.uploadSubtext}>Supports: JPEG, PNG, GIF, WebP, TIFF, BMP</Text>
            <View style={styles.selectButton}>
              <Text style={styles.selectButtonText}>Browse Files</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.sliderContainer}>
            <Text style={styles.sliderLabel}>
              Compression Level: {compressionLevel}%
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={styles.sliderText}>Smaller File</Text>
              <Text style={styles.sliderText}>Better Quality</Text>
            </View>
            <View style={styles.slider}>
              <input
                type="range"
                min="1"
                max="100"
                value={compressionLevel}
                onChange={(e) => setCompressionLevel(parseInt(e.target.value))}
                style={{
                  width: '100%',
                  height: 6,
                  borderRadius: 3,
                  background: darkMode ? '#555555' : '#e0e0e0',
                  outline: 'none',
                  WebkitAppearance: 'none',
                }}
              />
            </View>
          </View>

          {images.length > 0 && (
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[
                  styles.convertAllButton,
                  (isConverting || serverStatus !== 'connected') && styles.convertAllButtonDisabled
                ]}
                onPress={convertAllImages}
                disabled={isConverting || serverStatus !== 'connected'}
              >
                {isConverting ? (
                  <View style={styles.loadingContainer}>
                    <View style={styles.loadingSpinner} />
                    <Text style={styles.buttonText}>Converting All...</Text>
                  </View>
                ) : (
                  <Text style={styles.buttonText}>Convert All ({images.length})</Text>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.clearAllButton}
                onPress={clearAllImages}
              >
                <Text style={styles.buttonText}>Clear All</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {images.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Uploaded Images ({images.length})</Text>
            <View style={styles.imageGrid}>
              {images.map((image, index) => (
                <View key={image.id} style={styles.imageItem}>
                  <img src={image.url} style={styles.image} alt={image.name} />
                  
                  {/* Loading overlay */}
                  {convertingImages.has(image.id) && (
                    <View style={styles.imageOverlay}>
                      <View style={styles.loadingSpinner} />
                    </View>
                  )}
                  
                  {/* Action buttons */}
                  <View style={styles.imageButtons}>
                                        <TouchableOpacity
                      style={[styles.imageButton, styles.convertButton]}
                      onPress={() => convertSingleImage(image)}
                      disabled={convertingImages.has(image.id)}
                    >
                      <Text style={styles.imageButtonText}>
                        {convertingImages.has(image.id) ? '⏳' : 'Convert'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.imageButton, styles.cropButton]}
                      onPress={() => openCropper(image)}
                      disabled={convertingImages.has(image.id)}
                    >
                      <Text style={styles.imageButtonText}>Crop</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.imageButton, styles.removeButton]}
                      onPress={() => removeImage(image.id)}
                      disabled={convertingImages.has(image.id)}
                    >
                      <Text style={styles.imageButtonText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                  
                  
                </View>
              ))}
            </View>
          </View>
        )}

        {convertedImages.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitleWithCount}>
                Converted Images ({convertedImages.length})
              </Text>
              <TouchableOpacity
                style={styles.clearConvertedButton}
                onPress={clearAllConverted}
              >
                <Text style={styles.clearConvertedButtonText}>Clear All</Text>
              </TouchableOpacity>
            </View>
            
            {convertedImages.map((image, index) => (
              <View key={index} style={styles.convertedItem}>
                <img src={image.url} style={styles.convertedImage} alt={image.name} />
                                  <View style={styles.convertedInfo}>
                   <Text style={styles.convertedSize}>
                     {formatFileSize(image.size)} (was {formatFileSize(image.originalSize)})
                   </Text>
                   <Text style={styles.compressionInfo}>
                     {image.compressionRatio}% smaller
                   </Text>
                 </View>
                <TouchableOpacity
                  style={styles.downloadButton}
                  onPress={() => downloadImage(image.url, image.name)}
                >
                  <Text style={styles.downloadButtonText}>Download</Text>
                </TouchableOpacity>
              </View>
            ))}
            
            {convertedImages.length > 1 && (
              <TouchableOpacity
                style={styles.downloadAllButton}
                onPress={downloadAll}
              >
                <Text style={styles.downloadAllButtonText}>
                  Download All as ZIP
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {images.length === 0 && convertedImages.length === 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Results</Text>
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                Upload images to get started
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Image Cropper Modal */}
      {showCropper && croppingImage && (
        <View style={styles.cropperOverlay}>
          <ImageCropper
            image={croppingImage}
            onCropComplete={handleCropComplete}
            onCancel={cancelCropping}
            darkMode={darkMode}
          />
        </View>
      )}
    </View>
  );
};

export default App;


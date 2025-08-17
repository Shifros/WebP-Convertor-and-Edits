import React, { useState, useRef, useCallback } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop, convertToPercentCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  TextInput
} from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

// Format file size helper function
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const ASPECT_RATIOS = [
  { label: 'Custom', value: null },
  { label: '1:1 (Square)', value: 1 },
  { label: '16:9 (Widescreen)', value: 16/9 },
  { label: '4:3 (Standard)', value: 4/3 },
  { label: '3:2 (Photo)', value: 3/2 },
  { label: '21:9 (Ultrawide)', value: 21/9 },
];



const ImageCropper = ({ image, onCropComplete, onCancel, darkMode }) => {
  const [crop, setCrop] = useState({
    unit: '%',
    width: 90,
    height: 90,
    x: 5,
    y: 5
  });
  
  const [imageSrc, setImageSrc] = useState(null);
  const [originalDimensions, setOriginalDimensions] = useState({ width: 0, height: 0 });
  const [selectedRatio, setSelectedRatio] = useState(null); // null = custom
  const [isLocked, setIsLocked] = useState(false);
  const [customWidth, setCustomWidth] = useState('');
  const [customHeight, setCustomHeight] = useState('');
  const [customRatio, setCustomRatio] = useState(null);
  const imgRef = useRef(null);

  // Load image when component mounts
  React.useEffect(() => {
    if (image && image.url) {
      setImageSrc(image.url);
    }
  }, [image]);

  // Handle image load to get original dimensions
  const onImageLoad = useCallback((e) => {
    const { naturalWidth, naturalHeight } = e.target;
    setOriginalDimensions({ width: naturalWidth, height: naturalHeight });
  }, []);

  // Handle crop change (always keep percentage values)
  const onCropChange = useCallback((newCrop, percentCrop) => {
    const updatedCrop = percentCrop || newCrop;
    console.log('Crop changed:', updatedCrop);
    setCrop(updatedCrop);
  }, []);

  // Handle aspect ratio selection using helpers for precise sizing
  const handleRatioSelect = (ratio) => {
    setSelectedRatio(ratio);
    setIsLocked(ratio !== null);

    if (ratio == null) return; // custom/free
    if (!imgRef.current) return; // wait until image is loaded

    const img = imgRef.current;
    const naturalWidth = img.naturalWidth || originalDimensions.width || 1;
    const naturalHeight = img.naturalHeight || originalDimensions.height || 1;

    // Start with a crop that is 80% of the smaller dimension, with the target aspect ratio
    const base = 0.8;
    const pixelCrop = makeAspectCrop(
      {
        unit: 'px',
        width: Math.round(naturalWidth * base),
      },
      ratio,
      naturalWidth,
      naturalHeight
    );

    // Center the crop on the image
    const centeredPixelCrop = centerCrop(pixelCrop, naturalWidth, naturalHeight);

    // Convert to percent crop for ReactCrop state
    const percentCrop = convertToPercentCrop(centeredPixelCrop, naturalWidth, naturalHeight);

    setCrop({ ...percentCrop, unit: '%'});
  };

  // Get cropped image data
  const getCroppedImg = useCallback(async () => {
    if (!imgRef.current) return null;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Convert percentage crop to pixel coordinates in the original image
    const pixelCrop = {
      x: Math.round((crop.x / 100) * originalDimensions.width),
      y: Math.round((crop.y / 100) * originalDimensions.height),
      width: Math.round((crop.width / 100) * originalDimensions.width),
      height: Math.round((crop.height / 100) * originalDimensions.height),
    };

    // Guard against invalid sizes
    if (pixelCrop.width <= 0 || pixelCrop.height <= 0) {
      return null;
    }

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    // Draw the cropped portion from the original image (natural size)
    ctx.drawImage(
      imgRef.current,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/jpeg', 0.95);
    });
  }, [crop, originalDimensions]);

  // Handle custom size input
  const handleCustomSizeChange = (width, height) => {
    setCustomWidth(width);
    setCustomHeight(height);
    
    const numWidth = parseInt(width) || 0;
    const numHeight = parseInt(height) || 0;
    
    if (numWidth > 0 && numHeight > 0) {
      const ratio = numWidth / numHeight;
      setCustomRatio(ratio);
      setSelectedRatio(ratio);
      setIsLocked(true);
      
      // Calculate crop percentage based on target dimensions
      if (imgRef.current && originalDimensions.width > 0 && originalDimensions.height > 0) {
        const naturalWidth = originalDimensions.width;
        const naturalHeight = originalDimensions.height;
        
        // Calculate what percentage of the original image the target dimensions represent
        const widthPercent = Math.min(100, (numWidth / naturalWidth) * 100);
        const heightPercent = Math.min(100, (numHeight / naturalHeight) * 100);
        
        // Center the crop
        const x = Math.max(0, (100 - widthPercent) / 2);
        const y = Math.max(0, (100 - heightPercent) / 2);
        
        setCrop({
          unit: '%',
          width: widthPercent,
          height: heightPercent,
          x: x,
          y: y
        });
      }
    }
  };

  // Get resized image data
  const getResizedImg = useCallback(async (targetWidth, targetHeight) => {
    if (!imgRef.current) return null;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Convert percentage crop to pixel coordinates in the original image
    const pixelCrop = {
      x: Math.round((crop.x / 100) * originalDimensions.width),
      y: Math.round((crop.y / 100) * originalDimensions.height),
      width: Math.round((crop.width / 100) * originalDimensions.width),
      height: Math.round((crop.height / 100) * originalDimensions.height),
    };

    // Guard against invalid sizes
    if (pixelCrop.width <= 0 || pixelCrop.height <= 0) {
      return null;
    }

    // Set canvas to target dimensions
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    // Draw the cropped portion and resize to target dimensions
    ctx.drawImage(
      imgRef.current,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      targetWidth,
      targetHeight
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/jpeg', 0.95);
    });
  }, [crop, originalDimensions]);

  // Handle apply crop
  const handleApplyCrop = async () => {
    try {
      const croppedBlob = await getCroppedImg();
      if (!croppedBlob) {
        Alert.alert('Error', 'Failed to crop image');
        return;
      }

      const cropData = {
        blob: croppedBlob,
        crop: {
          x: Math.round(crop.x * originalDimensions.width / 100),
          y: Math.round(crop.y * originalDimensions.height / 100),
          width: Math.round(crop.width * originalDimensions.width / 100),
          height: Math.round(crop.height * originalDimensions.height / 100),
        },
        originalDimensions
      };

      onCropComplete(cropData);
    } catch (error) {
      console.error('Crop error:', error);
      Alert.alert('Error', 'Failed to process image');
    }
  };

  // Handle resize to custom dimensions
  const handleResize = async () => {
    const targetWidth = parseInt(customWidth);
    const targetHeight = parseInt(customHeight);
    
    if (!targetWidth || !targetHeight) {
      Alert.alert('Error', 'Please enter valid width and height values');
      return;
    }
    
    if (targetWidth > originalDimensions.width || targetHeight > originalDimensions.height) {
      Alert.alert('Error', 'Target dimensions cannot exceed original image size');
      return;
    }
    
    try {
      const resizedBlob = await getResizedImg(targetWidth, targetHeight);
      if (!resizedBlob) {
        Alert.alert('Error', 'Failed to resize image');
        return;
      }

      const resizeData = {
        blob: resizedBlob,
        crop: {
          x: Math.round(crop.x * originalDimensions.width / 100),
          y: Math.round(crop.y * originalDimensions.height / 100),
          width: Math.round(crop.width * originalDimensions.width / 100),
          height: Math.round(crop.height * originalDimensions.height / 100),
        },
        originalDimensions,
        targetDimensions: { width: targetWidth, height: targetHeight }
      };

      onCropComplete(resizeData);
    } catch (error) {
      console.error('Resize error:', error);
      Alert.alert('Error', 'Failed to process image');
    }
  };

  if (!imageSrc) {
    return (
      <View style={[styles.container, { backgroundColor: darkMode ? '#000000' : '#ffffff' }]}>
        <Text style={[styles.loadingText, { color: darkMode ? '#ffffff' : '#000000' }]}>
          Loading image...
        </Text>
      </View>
    );
  }

  // Safe expected size estimate (clamped to original size)
  const areaRatio = Math.max(0, Math.min(1, ((crop?.width || 0) / 100) * ((crop?.height || 0) / 100)));
  const expectedSizeBytes = image?.size ? Math.max(1, Math.round(image.size * areaRatio)) : null;



  return (
    <View style={[styles.container, { backgroundColor: darkMode ? '#000000' : '#ffffff' }]}>
      <View style={styles.content}>
        {/* Left Column - Image Cropper */}
        <View style={styles.leftColumn}>
          <View style={styles.cropContainer}>
            <ReactCrop
              crop={crop}
              onChange={onCropChange}
              minWidth={20}
              minHeight={20}
              aspect={selectedRatio}
            >
              <img
                ref={imgRef}
                src={imageSrc}
                onLoad={onImageLoad}
                                 style={{
                   width: 'auto',
                   height: 'auto',
                   maxWidth: '100%',
                   maxHeight: '90vh',
                   display: 'block',
                   objectFit: 'contain'
                 }}
                alt="Crop preview"
              />
            </ReactCrop>
          </View>
        </View>

        {/* Right Column - Controls */}
        <View style={styles.rightColumn}>
          {/* Title */}
          <Text style={[styles.title, { color: darkMode ? '#ffffff' : '#000000', marginBottom: 20 }]}>
            Crop Image
          </Text>
          
                     {/* Aspect Ratio Controls */}
           <View style={[styles.ratioControls, { borderColor: darkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)' }]}>
             <Text style={[styles.ratioTitle, { color: darkMode ? '#ffffff' : '#000000' }]}>
               Aspect Ratio
             </Text>
            <View style={styles.ratioButtons}>
              {ASPECT_RATIOS.map((ratio) => (
                <TouchableOpacity
                  key={ratio.label}
                  onPress={() => handleRatioSelect(ratio.value)}
                  style={[
                    styles.ratioButton,
                    selectedRatio === ratio.value && styles.ratioButtonSelected,
                    { 
                      backgroundColor: selectedRatio === ratio.value 
                        ? '#34C759' 
                        : darkMode ? '#333333' : '#f0f0f0',
                      borderColor: darkMode ? '#555555' : '#cccccc'
                    }
                  ]}
                >
                  <Text style={[
                    styles.ratioButtonText,
                    { 
                      color: selectedRatio === ratio.value 
                        ? '#ffffff' 
                        : darkMode ? '#ffffff' : '#000000'
                    }
                  ]}>
                    {ratio.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {isLocked && (
              <View style={styles.lockInfo}>
                <Text style={[styles.lockText, { color: '#FF9500' }]}>
                  🔒 Aspect ratio locked - resize while maintaining ratio
                </Text>
              </View>
            )}
          </View>

                                {/* Custom Size Controls */}
           <View style={[styles.customSizeControls, { borderColor: darkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)' }]}>
             <Text style={[styles.ratioTitle, { color: darkMode ? '#ffffff' : '#000000' }]}>
               Custom Size
             </Text>
             <View style={styles.sizeInputContainer}>
               <View style={styles.sizeInputRow}>
                 <Text style={[styles.sizeLabel, { color: darkMode ? '#ffffff' : '#000000' }]}>Width:</Text>
                 <TextInput
                   style={[
                     styles.sizeInput,
                     { 
                       backgroundColor: darkMode ? '#333333' : '#ffffff',
                       color: darkMode ? '#ffffff' : '#000000',
                       borderColor: (parseInt(customWidth) || 0) > originalDimensions.width ? '#ff4444' : darkMode ? '#555555' : '#cccccc'
                     }
                   ]}
                   value={customWidth}
                   onChangeText={(text) => handleCustomSizeChange(text, customHeight)}
                   placeholder="px"
                   placeholderTextColor={darkMode ? '#888888' : '#999999'}
                   keyboardType="numeric"
                 />
                                   <Text style={[styles.currentDimensions, { color: darkMode ? '#cccccc' : '#666666' }]}>
                    (max: {originalDimensions.width}px)
                  </Text>
               </View>
               <View style={styles.sizeInputRow}>
                 <Text style={[styles.sizeLabel, { color: darkMode ? '#ffffff' : '#000000' }]}>Height:</Text>
                 <TextInput
                   style={[
                     styles.sizeInput,
                     { 
                       backgroundColor: darkMode ? '#333333' : '#ffffff',
                       color: darkMode ? '#ffffff' : '#000000',
                       borderColor: (parseInt(customHeight) || 0) > originalDimensions.height ? '#ff4444' : darkMode ? '#555555' : '#cccccc'
                     }
                   ]}
                   value={customHeight}
                   onChangeText={(text) => handleCustomSizeChange(customWidth, text)}
                   placeholder="px"
                   placeholderTextColor={darkMode ? '#888888' : '#999999'}
                   keyboardType="numeric"
                 />
                                   <Text style={[styles.currentDimensions, { color: darkMode ? '#cccccc' : '#666666' }]}>
                    (max: {originalDimensions.height}px)
                  </Text>
               </View>
             </View>
             
             {/* Warning for exceeding original dimensions */}
             {((parseInt(customWidth) || 0) > originalDimensions.width || (parseInt(customHeight) || 0) > originalDimensions.height) && (
               <View style={styles.warningInfo}>
                 <Text style={[styles.warningText, { color: '#ff4444' }]}>
                   ⚠️ Dimensions cannot exceed original image size
                 </Text>
               </View>
             )}
             
             {customRatio && (
               <View style={styles.lockInfo}>
                 <Text style={[styles.lockText, { color: '#FF9500' }]}>
                   🔒 Custom ratio {customRatio.toFixed(2)}:1 applied
                 </Text>
               </View>
             )}
           </View>

                     {/* Actions */}
           <View style={styles.actions}>
             <TouchableOpacity onPress={onCancel} style={[styles.button, styles.cancelButton]}>
               <Text style={styles.cancelButtonText}>Cancel</Text>
             </TouchableOpacity>
             <TouchableOpacity onPress={handleApplyCrop} style={[styles.button, styles.applyButton]}>
               <Text style={styles.applyButtonText}>Apply Crop</Text>
             </TouchableOpacity>
             {customWidth && customHeight && (
               <TouchableOpacity onPress={handleResize} style={[styles.button, styles.resizeButton]}>
                 <Text style={styles.resizeButtonText}>Resize</Text>
               </TouchableOpacity>
             )}
           </View>

           {/* Info Section */}
           <View style={[styles.info, { marginTop: 20 }]}>
             <Text style={[styles.infoText, { color: darkMode ? '#cccccc' : '#666666' }]}>
               Original Size: {image.size ? formatFileSize(image.size) : 'Unknown'}
             </Text>
             <Text style={[styles.infoText, { color: darkMode ? '#007AFF' : '#007AFF', fontWeight: 'bold' }]}>
               Expected Size: {expectedSizeBytes ? formatFileSize(expectedSizeBytes) : 'Unknown'}
             </Text>
             <Text style={[styles.infoText, { color: darkMode ? '#34C759' : '#34C759', fontWeight: 'bold' }]}>
               {isLocked ? 'Drag to resize while maintaining aspect ratio' : 'Drag to select and resize freely'}
             </Text>
           </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    height: '100vh',
    padding: 20,
    overflow: 'auto',
    zIndex: 1000,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ff4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    height: '100vh',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: 20,
  },
  leftColumn: {
    width: '60%',
    paddingRight: 20,
  },
  rightColumn: {
    width: '40%',
    paddingLeft: 20,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    height: 'auto',
    paddingTop: 0,
  },
  ratioControls: {
    marginBottom: 20,
    padding: 15,
    borderWidth: 1,
    borderRadius: 8,
  },
  ratioTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  ratioButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  ratioButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    minWidth: 80,
    alignItems: 'center',
  },
  ratioButtonSelected: {
    borderColor: '#34C759',
  },
  ratioButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },

  lockInfo: {
    padding: 8,
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.3)',
  },
  lockText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  cropContainer: {
    height: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  info: {
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 6,
    marginBottom: 20,
  },
  infoText: {
    fontSize: 12,
    marginBottom: 2,
  },
  customSizeControls: {
    marginBottom: 20,
    padding: 15,
    borderWidth: 1,
    borderRadius: 8,
  },
  sizeInputContainer: {
    marginBottom: 10,
  },
  sizeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sizeLabel: {
    fontSize: 14,
    fontWeight: '500',
    width: 60,
    marginRight: 10,
  },
  sizeInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    fontSize: 14,
  },
  currentDimensions: {
    fontSize: 12,
    marginLeft: 8,
    fontStyle: 'italic',
  },
  warningInfo: {
    padding: 8,
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.3)',
    marginBottom: 10,
  },
  warningText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 10,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#666666',
  },
  cancelButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  applyButton: {
    backgroundColor: '#34C759',
  },
  applyButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  resizeButton: {
    backgroundColor: '#007AFF',
  },
  resizeButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  loadingText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 50,
  },
});

export default ImageCropper;

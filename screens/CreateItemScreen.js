import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, Alert, ScrollView, Platform, Modal, Switch, FlatList } from 'react-native';
import { Dimensions } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import colors from '../constants/colors';
import { Ionicons } from '@expo/vector-icons';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import Toast from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';

const API_URL = Platform.OS === 'web' 
  ? (typeof window !== 'undefined' && window.location.origin.includes('boxbuddy.walther.haus') 
      ? 'https://boxbuddy.walther.haus/api' 
      : 'http://localhost:5000')
  : 'http://localhost:5000';
const { height } = Dimensions.get('window');

export default function CreateItemScreen({ route, navigation }) {
  const item = route.params?.item || {};
  const [name, setName] = useState(item.name || '');
  const [type, setType] = useState(item.type || 'ITEM');
  const [visibility, setVisibility] = useState(item.visibility || 'PRIVATE');
  const [description, setDescription] = useState(item.description || '');
  const [quantity, setQuantity] = useState(item.quantity?.toString() || '1');
  const [nestable, setNestable] = useState(item.nestable || false);
  const [images, setImages] = useState([]);
  const [imagesToDelete, setImagesToDelete] = useState([]); // Track images to delete on update
  const [selectedContainer, setSelectedContainer] = useState(null);
  const [containerSearchQuery, setContainerSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showContainerSearch, setShowContainerSearch] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const videoRef = useRef(null);
  const [itemUuid, setItemUuid] = useState(item.uuid || null);
  const [cropModalVisible, setCropModalVisible] = useState(false);

  useEffect(() => {
    // Only fetch item details when editing an existing item (coming from route params)
    // Don't fetch after creating a new item (when itemUuid is set programmatically)
    if (route.params?.item?.uuid) {
      setItemUuid(route.params.item.uuid);
      fetchItemDetails();
      // Clear any pending deletions when loading a new item
      setImagesToDelete([]);
    }
  }, [route.params?.item?.uuid]);

  const fetchItemDetails = async () => {
    try {
      const response = await axios.get(`${API_URL}/items/${itemUuid}`);
      // Parse enum values to strip class prefix (e.g., "Type.ITEM" -> "ITEM")
      const parseEnum = (value, defaultVal) => {
        if (!value) return defaultVal;
        if (typeof value === 'string' && value.includes('.')) {
          return value.split('.').pop();
        }
        return value;
      };
      
      setName(response.data.name || '');
      setType(parseEnum(response.data.type, 'ITEM'));
      setVisibility(parseEnum(response.data.visibility, 'PRIVATE'));
      setDescription(response.data.description || '');
      setQuantity(response.data.quantity?.toString() || '1');
      setNestable(response.data.nestable || false);
      // Store the full image object so we have the uuid for deletion
      setImages(response.data.images || []);
      // Load container info if item is nested
      if (response.data.locationEntityUUID) {
        loadContainerInfo(response.data.locationEntityUUID);
      }
    } catch (error) {
      showToast('Failed to load item details: ' + error.message, 'error');
    }
  };
  const [imageToCrop, setImageToCrop] = useState(null);
  const [crop, setCrop] = useState({ unit: '%', x: 0, y: 0, width: 100, height: 100 });
  // Note: ReactCrop may convert to px on interaction, handle both in getCroppedImg
  const [imageRef, setImageRef] = useState(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [hoveredImageIndex, setHoveredImageIndex] = useState(null);
  const [confirmDialogVisible, setConfirmDialogVisible] = useState(false);
  const [confirmDialogData, setConfirmDialogData] = useState(null);

  const showToast = (message, type = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  const loadContainerInfo = async (containerUuid) => {
    try {
      const response = await axios.get(`${API_URL}/items/${containerUuid}`);
      setSelectedContainer(response.data);
    } catch (error) {
      console.error('Failed to load container info:', error);
    }
  };

  const searchContainers = async (query) => {
    setContainerSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    try {
      const response = await axios.get(`${API_URL}/items`);
      // Filter for nestable items that match the search query
      const results = response.data.filter(item => 
        item.nestable && 
        item.uuid !== itemUuid && // Don't allow nesting in itself
        item.name.toLowerCase().includes(query.toLowerCase())
      );
      setSearchResults(results);
    } catch (error) {
      showToast('Failed to search containers: ' + error.message, 'error');
    }
  };

  const selectContainer = (container) => {
    setSelectedContainer(container);
    setContainerSearchQuery('');
    setSearchResults([]);
    setShowContainerSearch(false);
  };

  const clearContainer = () => {
    setSelectedContainer(null);
  };

  const deleteImage = (index, imageObj) => {
    // Check if it's a server image (has uuid property) or local image (dataURL/blob)
    const isServerImage = imageObj && typeof imageObj === 'object' && imageObj.uuid;
    
    setConfirmDialogData({
      index,
      imageObj,
      isServerImage,
      title: 'Delete Photo',
      message: isServerImage 
        ? 'Delete this photo from the server? This cannot be undone.'
        : 'Remove this photo from the list?'
    });
    setConfirmDialogVisible(true);
  };

  const handleConfirmDelete = async () => {
    const { index, imageObj, isServerImage } = confirmDialogData;
    setConfirmDialogVisible(false);

    if (isServerImage) {
      // Mark for deletion (will be deleted when user clicks "Update Item")
      setImagesToDelete([...imagesToDelete, imageObj.uuid]);
      // Remove from local state immediately for UI feedback
      setImages(images.filter((_, i) => i !== index));
      showToast('Photo will be removed when you update the item', 'success');
    } else {
      // Just remove from local state (not yet uploaded)
      setImages(images.filter((_, i) => i !== index));
      showToast('Photo removed', 'success');
    }
    
    setConfirmDialogData(null);
  };

  const handleCancelDelete = () => {
    setConfirmDialogVisible(false);
    setConfirmDialogData(null);
  };

  const createItem = async () => {
    if (!name.trim()) {
      showToast('Name is required', 'error');
      return;
    }
    try {
      const data = { name: name.trim(), type, visibility, nestable };
      if (description.trim()) data.description = description.trim();
      if (quantity) data.quantity = parseInt(quantity);
      const response = await axios.post(`${API_URL}/items`, data);
      const newUuid = response.data.uuid;
      
      // Put item in container if selected
      if (selectedContainer) {
        try {
          await axios.post(`${API_URL}/items/${newUuid}/store/${selectedContainer.uuid}`);
        } catch (error) {
          showToast('Item created but failed to add to container: ' + error.message, 'error');
        }
      }
      
      // Upload images if any
      if (images.length > 0) {
        try {
          await uploadImages(newUuid);
          showToast('Item created and photos uploaded successfully!', 'success');
        } catch (error) {
          // Upload failed after retries, keep form unchanged so user can retry
          setItemUuid(newUuid);
          showToast('Item created but photos upload failed. Please try updating.', 'error');
          return;
        }
      } else {
        showToast('Item created successfully!', 'success');
      }
      
      // Reset form only after successful upload
      setItemUuid(null);
      setName('');
      setType('ITEM');
      setVisibility('PRIVATE');
      setDescription('');
      setQuantity('1');
      setNestable(false);
      setSelectedContainer(null);
      setImages([]);
    } catch (error) {
      showToast('Failed to create item: ' + error.message, 'error');
    }
  };

  const updateItem = async () => {
    if (!itemUuid) return;
    try {
      const data = { name: name.trim(), type, visibility, nestable };
      if (description.trim()) data.description = description.trim();
      if (quantity) data.quantity = parseInt(quantity);
      await axios.put(`${API_URL}/items/${itemUuid}`, data);
      
      // Update container if changed
      if (selectedContainer) {
        try {
          await axios.post(`${API_URL}/items/${itemUuid}/store/${selectedContainer.uuid}`);
        } catch (error) {
          showToast('Item updated but failed to change container: ' + error.message, 'error');
        }
      }
      
      // Delete marked images from server
      if (imagesToDelete.length > 0) {
        try {
          for (const imageUuid of imagesToDelete) {
            await axios.delete(`${API_URL}/items/${itemUuid}/image/${imageUuid}`);
          }
          // Clear the deletion list after successful deletion
          setImagesToDelete([]);
        } catch (error) {
          showToast('Item updated but failed to delete some photos: ' + error.message, 'error');
        }
      }
      
      // Check if there are new local images to upload
      const hasNewImages = images.some(img => typeof img === 'string');
      
      if (hasNewImages) {
        try {
          await uploadImages(itemUuid);
          showToast('Item updated and photos uploaded successfully!', 'success');
          // Refetch to get all images including newly uploaded ones
          await fetchItemDetails();
        } catch (error) {
          // Upload failed after retries, keep form unchanged
          showToast('Item updated but photos upload failed. Try again.', 'error');
          return;
        }
      } else {
        showToast('Item updated successfully!', 'success');
        // Refetch to ensure UI is in sync
        await fetchItemDetails();
      }
    } catch (error) {
      showToast('Failed to update item: ' + error.message, 'error');
    }
  };

  const addFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Error', 'Media library permission denied');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled) {
        const uri = result.assets[0].uri;
        if (Platform.OS === 'web') {
          setCrop({ unit: '%', x: 0, y: 0, width: 100, height: 100 });
          setImageLoaded(false);
          setImageRef(null);
          setImageToCrop(uri);
          setCropModalVisible(true);
        } else {
          setImages([...images, uri]);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Gallery picker not available on this platform: ' + error.message);
    }
  };

  useEffect(() => {
    if (cameraOpen && Platform.OS === 'web') {
      // Try to use rear camera on mobile, otherwise use default
      const constraints = {
        video: {
          facingMode: isMobile() ? { ideal: 'environment' } : 'user',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };
      
      navigator.mediaDevices.getUserMedia(constraints).then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }).catch(error => {
        // Fallback to basic constraints if ideal fails
        navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        }).catch(err => {
          showToast('Webcam access denied', 'error');
          setCameraOpen(false);
        });
      });
    }
    return () => {
      if (Platform.OS === 'web' && videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraOpen]);

  const isMobile = () => {
    if (Platform.OS !== 'web') return true;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  const addFromCamera = async () => {
    if (Platform.OS === 'web') {
      if (isMobile()) {
        // Use native camera on mobile browsers
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment'; // Request rear camera
        input.onchange = async (e) => {
          const file = e.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const dataURL = event.target.result;
              setCrop({ unit: '%', x: 0, y: 0, width: 100, height: 100 });
              setImageLoaded(false);
              setImageRef(null);
              setImageToCrop(dataURL);
              setCropModalVisible(true);
            };
            reader.readAsDataURL(file);
          }
        };
        input.click();
      } else {
        // Use web camera on desktop
        setCameraOpen(true);
      }
    } else {
      console.log('Requesting camera permissions');
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      console.log('Camera permission status:', status);
      if (status !== 'granted') {
        console.log('Camera permission denied');
        Alert.alert('Error', 'Camera permission denied');
        return;
      }

      console.log('Launching camera');
      try {
        const result = await ImagePicker.launchCameraAsync({
          allowsEditing: false,
          quality: 1,
        });
        console.log('Camera result:', result);
        if (!result.canceled) {
          setImages([...images, result.assets[0].uri]);
        }
      } catch (error) {
        console.log('Camera error:', error);
        Alert.alert('Error', 'Camera not available on this platform: ' + error.message);
      }
    }
  };

  const captureImage = () => {
    if (Platform.OS === 'web' && videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0);
      const imageUri = canvas.toDataURL('image/jpeg', 0.8);
      setCrop({ unit: '%', x: 0, y: 0, width: 100, height: 100 });
      setImageLoaded(false);
      setImageRef(null);
      setImageToCrop(imageUri);
      setCameraOpen(false);
      setCropModalVisible(true);
    }
  };

  const blobToDataURL = (blob) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  };

  const uploadImages = async (uuid) => {
    if (!uuid || images.length === 0) return;

    // Filter out server images (objects with uuid) - only upload new local images
    const localImages = images.filter(img => typeof img === 'string');
    
    if (localImages.length === 0) return;

    for (const imageUri of localImages) {
      let data;
      if (Platform.OS === 'web' && imageUri.startsWith('data:')) {
        data = { image: imageUri };
      } else if (Platform.OS === 'web' && imageUri.startsWith('blob:')) {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        const dataURL = await blobToDataURL(blob);
        data = { image: dataURL };
      } else {
        // For native, could convert to base64, but skipping for now
        continue;
      }

      // Retry logic: 3 attempts
      let uploaded = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await axios.post(`${API_URL}/items/${uuid}/image`, data, {
            timeout: 60000, // 60 second timeout for large images
            maxContentLength: 200 * 1024 * 1024, // 200 MB
            maxBodyLength: 200 * 1024 * 1024, // 200 MB
          });
          uploaded = true;
          break;
        } catch (error) {
          console.error(`Upload attempt ${attempt} failed:`, error);
          if (attempt === 3) {
            throw new Error(`Failed to upload image after 3 attempts: ${error.message}`);
          }
          // Wait before retry (exponential backoff: 500ms, 1s, 2s)
          await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt - 1)));
        }
      }
    }
  };

  const getCroppedImg = (imageRef, crop) => {
    if (!imageRef || !imageLoaded) return Promise.reject('Image not loaded');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const scaleX = imageSize.naturalWidth / imageSize.width;
    const scaleY = imageSize.naturalHeight / imageSize.height;

    let pixelCrop = crop;
    if (crop.unit === '%') {
      pixelCrop = {
        x: (crop.x / 100) * imageSize.width,
        y: (crop.y / 100) * imageSize.height,
        width: (crop.width / 100) * imageSize.width,
        height: (crop.height / 100) * imageSize.height,
      };
    }

    canvas.width = pixelCrop.width * scaleX;
    canvas.height = pixelCrop.height * scaleY;
    ctx.drawImage(
      imageRef,
      pixelCrop.x * scaleX,
      pixelCrop.y * scaleY,
      pixelCrop.width * scaleX,
      pixelCrop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );
    return canvas.toDataURL('image/jpeg');
  };

  if (cameraOpen && Platform.OS === 'web') {
    return (
      <View style={styles.cameraFullScreen}>
        <video ref={videoRef} autoPlay style={{ width: '100%', height: height * 0.7 }} />
        <View style={styles.cameraControls}>
          <TouchableOpacity style={styles.cameraButton} onPress={() => setCameraOpen(false)}>
            <Ionicons name="close" size={30} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.cameraButton} onPress={captureImage}>
            <Ionicons name="camera" size={30} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (cropModalVisible && Platform.OS === 'web') {
    return (
      <Modal visible={cropModalVisible} animationType="slide">
        <View style={styles.cameraFullScreen}>
          <View style={{ height: height * 0.7 }}>
            <ReactCrop
              crop={crop}
              onChange={(newCrop) => setCrop(newCrop)}
              ruleOfThirds={false}
            >
              <img src={imageToCrop} onLoad={(e) => {
                console.log('Image loaded', e.target);
                setImageRef(e.target);
                setImageSize({ width: e.target.offsetWidth, height: e.target.offsetHeight, naturalWidth: e.target.naturalWidth, naturalHeight: e.target.naturalHeight });
                setImageLoaded(true);
              }} style={{ width: '100%', height: 'auto' }} />
            </ReactCrop>
          </View>
          <View style={styles.cameraControls}>
            <TouchableOpacity style={styles.cameraButton} onPress={() => setCropModalVisible(false)}>
              <Ionicons name="close" size={30} color="white" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.cameraButton, !imageLoaded && { opacity: 0.5 }]} disabled={!imageLoaded} onPress={async () => {
              console.log('Crop button pressed', imageRef, crop);
              try {
                const croppedUri = await getCroppedImg(imageRef, crop);
                console.log('Cropped URI:', croppedUri);
                setImages([...images, croppedUri]);
                setCropModalVisible(false);
              } catch (error) {
                console.error('Crop Error:', error);
                Alert.alert('Crop Error', error.message);
              }
            }}>
              <Ionicons name="checkmark" size={30} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onHide={() => setToastVisible(false)}
      />
      <ConfirmDialog
        visible={confirmDialogVisible}
        title={confirmDialogData?.title || 'Confirm'}
        message={confirmDialogData?.message || ''}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
      <Text style={styles.header}>{itemUuid ? 'Edit Item' : 'Create New Item'}</Text>
      <TextInput
        style={styles.input}
        placeholder="Name"
        value={name}
        onChangeText={setName}
        placeholderTextColor={colors.text}
      />
      <TextInput
        style={styles.input}
        placeholder="Type (ITEM, CONTAINER, LOCATION)"
        value={type}
        onChangeText={setType}
        placeholderTextColor={colors.text}
      />
      <TextInput
        style={styles.input}
        placeholder="Visibility (PRIVATE, SAME_INSTANCE, PUBLIC)"
        value={visibility}
        onChangeText={setVisibility}
        placeholderTextColor={colors.text}
      />
      <TextInput
        style={styles.input}
        placeholder="Description (optional)"
        value={description}
        onChangeText={setDescription}
        multiline
        placeholderTextColor={colors.text}
      />
      <View style={styles.quantityRow}>
        <TouchableOpacity style={styles.quantityButton} onPress={() => setQuantity(Math.max(0, parseInt(quantity || 0) - 1).toString())}>
          <Text style={styles.quantityButtonText}>-</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.quantityInput}
          value={quantity}
          onChangeText={(text) => {
            const num = parseInt(text);
            if (isNaN(num) || num < 0) setQuantity('0');
            else setQuantity(num.toString());
          }}
          keyboardType="numeric"
          placeholderTextColor={colors.text}
        />
        <TouchableOpacity style={styles.quantityButton} onPress={() => setQuantity((parseInt(quantity || 0) + 1).toString())}>
          <Text style={styles.quantityButtonText}>+</Text>
        </TouchableOpacity>
       </View>
       
       <View style={styles.nestableRow}>
         <Text style={styles.nestableLabel}>Is this a storage container?</Text>
         <Switch
           value={nestable}
           onValueChange={setNestable}
           trackColor={{ false: '#767577', true: colors.primary }}
           thumbColor={nestable ? '#fff' : '#f4f3f4'}
         />
       </View>
       
       <View style={styles.containerSection}>
         <Text style={styles.sectionHeader}>Store in Container</Text>
         {selectedContainer ? (
           <View style={styles.selectedContainer}>
             <Text style={styles.containerName}>{selectedContainer.name}</Text>
             <TouchableOpacity onPress={clearContainer} style={styles.clearButton}>
               <Ionicons name="close-circle" size={24} color={colors.error} />
             </TouchableOpacity>
           </View>
         ) : (
           <TouchableOpacity style={styles.searchButton} onPress={() => setShowContainerSearch(!showContainerSearch)}>
             <Ionicons name="search" size={20} color={colors.primary} />
             <Text style={styles.searchButtonText}>Search for container</Text>
           </TouchableOpacity>
         )}
         
         {showContainerSearch && (
           <View style={styles.searchContainer}>
             <TextInput
               style={styles.searchInput}
               placeholder="Type to search containers..."
               value={containerSearchQuery}
               onChangeText={searchContainers}
               placeholderTextColor={colors.text}
             />
             {searchResults.length > 0 && (
               <View style={styles.searchResults}>
                 {searchResults.map((container) => (
                   <TouchableOpacity
                     key={container.uuid}
                     style={styles.searchResultItem}
                     onPress={() => selectContainer(container)}
                   >
                     <Text style={styles.searchResultText}>{container.name}</Text>
                     <Text style={styles.searchResultType}>{container.type}</Text>
                   </TouchableOpacity>
                 ))}
               </View>
             )}
             {containerSearchQuery.trim() && searchResults.length === 0 && (
               <Text style={styles.noResults}>No nestable containers found</Text>
             )}
           </View>
         )}
       </View>
       
       <TouchableOpacity style={styles.button} onPress={itemUuid ? updateItem : createItem}>
         <Text style={styles.buttonText}>{itemUuid ? 'Update Item' : 'Create Item'}</Text>
       </TouchableOpacity>
       <TouchableOpacity style={styles.button} onPress={addFromCamera}>
         <Text style={styles.buttonText}>Take Photo</Text>
       </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={addFromGallery}>
        <Text style={styles.buttonText}>Add from Gallery</Text>
      </TouchableOpacity>
      {images.length > 0 && (
        <ScrollView horizontal style={styles.imageScroll}>
          {images.map((imageData, index) => {
            const uri = typeof imageData === 'string' ? imageData : `${API_URL}/images/${imageData.uuid}`;
            const isHovered = hoveredImageIndex === index;
            
            return (
              <View 
                key={index} 
                style={styles.thumbnailContainer}
                onMouseEnter={() => Platform.OS === 'web' && setHoveredImageIndex(index)}
                onMouseLeave={() => Platform.OS === 'web' && setHoveredImageIndex(null)}
              >
                <Image source={{ uri }} style={styles.thumbnail} />
                {(isHovered || Platform.OS !== 'web') && (
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => deleteImage(index, imageData)}
                  >
                    <View style={styles.deleteCircle}>
                      <Ionicons name="close" size={16} color="white" />
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
     </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 8,
    marginBottom: 15,
    padding: 12,
    fontSize: 16,
    color: colors.text,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 8,
    marginBottom: 15,
    height: 50,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  picker: {
    color: colors.text,
    fontSize: 16,
    backgroundColor: '#fff',
    borderWidth: 0,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonText: {
    color: colors.card,
    fontSize: 16,
    fontWeight: 'bold',
  },
  imageScroll: {
    marginVertical: 10,
  },
  thumbnailContainer: {
    position: 'relative',
    marginRight: 10,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  deleteButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    zIndex: 10,
  },
  deleteCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  quantityButton: {
    backgroundColor: '#14d91d',
    borderRadius: 8,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityInput: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderColor: '#ccc',
    borderWidth: 1,
    padding: 0,
    textAlign: 'center',
    fontSize: 20,
    color: '#000',
    fontWeight: 'bold',
    minWidth: 60,
    marginLeft: 4,
    marginRight: 4,
  },
  quantityButtonText: {
    fontSize: 30,
    fontWeight: 'bold',
    color: colors.card,
  },
  cameraFullScreen: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '60%',
    marginTop: 20,
  },
  cameraButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#14d91d',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
  },
  nestableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
    padding: 12,
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nestableLabel: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  containerSection: {
    marginBottom: 15,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 10,
  },
  selectedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  containerName: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  clearButton: {
    padding: 4,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchButtonText: {
    fontSize: 16,
    color: colors.primary,
    marginLeft: 8,
  },
  searchContainer: {
    marginTop: 10,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
  },
  searchResults: {
    marginTop: 8,
    maxHeight: 200,
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchResultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchResultText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  searchResultType: {
    fontSize: 14,
    color: colors.text,
    opacity: 0.6,
    marginTop: 2,
  },
  noResults: {
    padding: 12,
    textAlign: 'center',
    color: colors.text,
    opacity: 0.6,
  },
});

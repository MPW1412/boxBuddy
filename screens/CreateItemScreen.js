import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, Alert, ScrollView, Platform, Modal, Switch, FlatList, Animated } from 'react-native';
import { Dimensions } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import axios from 'axios';
import colors from '../constants/colors';
import { Ionicons } from '@expo/vector-icons';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import Toast from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuth } from '../contexts/AuthContext';

const API_URL = Platform.OS === 'web' 
  ? (typeof window !== 'undefined' && window.location.origin.includes('boxbuddy.walther.haus') 
      ? 'https://boxbuddy.walther.haus/api' 
      : 'http://localhost:5000')
  : 'http://localhost:5000';
const { height } = Dimensions.get('window');

export default function CreateItemScreen({ route, navigation }) {
  const { user } = useAuth();
  
  // Get UUID from route params (for URL routing)
  const uuidFromRoute = route.params?.uuid;
  const item = route.params?.item || {};
  
  const [name, setName] = useState('');
  const [type, setType] = useState('ITEM');
  const [visibility, setVisibility] = useState('PRIVATE');
  const [owningEntity, setOwningEntity] = useState(user?.entities?.[0]?.uuid || '');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [nestable, setNestable] = useState(false);
  const [images, setImages] = useState([]);
  const [imagesToDelete, setImagesToDelete] = useState([]); // Track images to delete on update
  const [pendingGalleryImages, setPendingGalleryImages] = useState([]); // Gallery images waiting for item to be saved
  const [selectedContainer, setSelectedContainer] = useState(null);
  const [containerSearchQuery, setContainerSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showContainerSearch, setShowContainerSearch] = useState(false);
  
  // Track original values to detect changes
  const [originalData, setOriginalData] = useState({
    name: '',
    type: 'ITEM',
    visibility: 'PRIVATE',
    owningEntity: user?.entities?.[0]?.uuid || '',
    description: '',
    quantity: '1',
    nestable: false,
    imageCount: 0,
    containerUuid: null
  });
  const [cameraOpen, setCameraOpen] = useState(false);
  const videoRef = useRef(null);
  const dropZoneRef = useRef(null);
  const [itemUuid, setItemUuid] = useState(uuidFromRoute || null);
  const [itemExists, setItemExists] = useState(false); // Track if item actually exists in DB
  const [cropModalVisible, setCropModalVisible] = useState(false);
  
  // Power Mode state
  const [powerModeActive, setPowerModeActive] = useState(false);
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [waveformBars, setWaveformBars] = useState(Array(20).fill(0.1));
  const recordingStartTime = useRef(null);
  const waveformInterval = useRef(null);
  const uploadQueue = useRef([]);
  const retryTimerRef = useRef(null);
  const MAX_RECORDING_DURATION = 300000; // 300 seconds = 5 minutes

  useEffect(() => {
    // Fetch item details when editing an existing item
    // UUID can come from route params (URL routing) or from legacy item object
    const uuid = route.params?.uuid || route.params?.item?.uuid;
    if (uuid) {
      setItemUuid(uuid);
      fetchItemDetails(uuid);
      // Clear any pending deletions when loading a new item
      setImagesToDelete([]);
    }
  }, [route.params?.uuid, route.params?.item?.uuid]);

  // Setup touch drop event listener for gallery images
  useEffect(() => {
    if (Platform.OS === 'web' && dropZoneRef.current) {
      const handleGalleryImageDropEvent = async (e) => {
        const imageUuid = e.detail.imageUuid;
        
        if (imageUuid && itemUuid && itemExists) {
          // Item already exists and saved - assign immediately
          try {
            await axios.post(
              `${API_URL}/gallery/image/${imageUuid}/assign/${itemUuid}`,
              {},
              { withCredentials: true }
            );
            await fetchItemDetails();
            // Refresh gallery to remove assigned image
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('refreshGallery'));
            }
            showToast('Photo added from gallery', 'success');
          } catch (error) {
            showToast('Failed to add photo: ' + error.message, 'error');
          }
        } else {
          // Item not saved yet - just add to pending in UI
          setPendingGalleryImages(prev => {
            const newPending = [...prev, imageUuid];
            // Notify gallery to hide this image
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('galleryPendingChanged', { 
                detail: { pendingImages: newPending }
              }));
            }
            return newPending;
          });
          // Show preview by adding to images list
          setImages(prev => [...prev, { uuid: imageUuid, isPending: true }]);
          showToast('Photo added to draft', 'success');
        }
      };

      const dropZone = dropZoneRef.current;
      dropZone.addEventListener('galleryImageDrop', handleGalleryImageDropEvent);
      
      return () => {
        dropZone.removeEventListener('galleryImageDrop', handleGalleryImageDropEvent);
      };
    }
  }, [itemUuid, itemExists]);

  // Power Mode: Auto-attach new gallery images
  useEffect(() => {
    if (!powerModeActive || Platform.OS !== 'web') {
      console.log('⏭️ Skipping Power Mode gallery listener setup - powerModeActive:', powerModeActive, 'Platform:', Platform.OS);
      return;
    }
    
    console.log('✅ Setting up Power Mode gallery listener');
    
    const handleGalleryUpdate = async (e) => {
      console.log('🎯 refreshGallery event caught in Power Mode!');
      // Fetch latest gallery images
      try {
        const response = await axios.get(`${API_URL}/gallery`, {
          withCredentials: true
        });
        
        if (response.data && response.data.length > 0) {
          // Get the latest image (first in array since they're ordered desc by creation_time)
          const latestImage = response.data[0];
          
          // Check if this image is already in our list
          const alreadyAdded = images.some(img => img.uuid === latestImage.uuid);
          if (!alreadyAdded) {
            console.log('Auto-attaching gallery image to Power Mode item:', latestImage.uuid);
            // Add to pending gallery images
            setPendingGalleryImages(prev => {
              if (prev.includes(latestImage.uuid)) return prev;
              const newPending = [...prev, latestImage.uuid];
              // Notify gallery to hide this image
              window.dispatchEvent(new CustomEvent('galleryPendingChanged', { 
                detail: { pendingImages: newPending }
              }));
              return newPending;
            });
            // Show preview by adding to images list
            setImages(prev => [...prev, { uuid: latestImage.uuid, isPending: true }]);
            showToast('Photo attached from QR scanner', 'success');
          }
        }
      } catch (error) {
        console.error('Failed to fetch gallery images:', error);
      }
    };
    
    window.addEventListener('refreshGallery', handleGalleryUpdate);
    
    return () => {
      window.removeEventListener('refreshGallery', handleGalleryUpdate);
    };
  }, [powerModeActive, images, pendingGalleryImages]);

  // Cleanup retry timer on unmount
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  const hasChanges = () => {
    if (!itemUuid) return false; // No changes tracking for new items
    
    return (
      name !== originalData.name ||
      type !== originalData.type ||
      visibility !== originalData.visibility ||
      owningEntity !== originalData.owningEntity ||
      description !== originalData.description ||
      quantity !== originalData.quantity ||
      nestable !== originalData.nestable ||
      images.length !== originalData.imageCount ||
      imagesToDelete.length > 0 ||
      (selectedContainer?.uuid || null) !== originalData.containerUuid
    );
  };

  const handleBackPress = () => {
    if (hasChanges()) {
      setConfirmDialogData({
        action: 'discard'
      });
      setConfirmDialogVisible(true);
    } else {
      navigation.goBack();
    }
  };
  
  const handleDiscardChanges = async () => {
    setConfirmDialogVisible(false);
    setConfirmDialogData(null);
    
    // Just clear pending state - images stay in gallery (never removed in the first place)
    if (pendingGalleryImages.length > 0) {
      setPendingGalleryImages([]);
      // Notify gallery to show images again
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('galleryPendingChanged', { 
          detail: { pendingImages: [] }
        }));
      }
      showToast('Changes discarded, photos remain in gallery', 'success');
    } else {
      showToast('Changes discarded', 'success');
    }
    
    // Small delay to show toast before navigating away
    setTimeout(() => navigation.goBack(), 500);
  };

  const fetchItemDetails = async (uuid) => {
    const targetUuid = uuid || itemUuid;
    if (!targetUuid) return;
    
    try {
      const response = await axios.get(`${API_URL}/items/${targetUuid}`);
      // Parse enum values to strip class prefix (e.g., "Type.ITEM" -> "ITEM")
      const parseEnum = (value, defaultVal) => {
        if (!value) return defaultVal;
        if (typeof value === 'string' && value.includes('.')) {
          return value.split('.').pop();
        }
        return value;
      };
      
      setItemExists(true); // Item exists in database
      
      setName(response.data.name || '');
      setType(parseEnum(response.data.type, 'ITEM'));
      setVisibility(parseEnum(response.data.visibility, 'PRIVATE'));
      setOwningEntity(response.data.owningEntity || user?.entities?.[0]?.uuid || '');
      setDescription(response.data.description || '');
      setQuantity(response.data.quantity?.toString() || '1');
      setNestable(response.data.nestable || false);
      // Store the full image object so we have the uuid for deletion
      setImages(response.data.images || []);
      
      // Store original values for change detection
      setOriginalData({
        name: response.data.name || '',
        type: parseEnum(response.data.type, 'ITEM'),
        visibility: parseEnum(response.data.visibility, 'PRIVATE'),
        owningEntity: response.data.owningEntity || user?.entities?.[0]?.uuid || '',
        description: response.data.description || '',
        quantity: response.data.quantity?.toString() || '1',
        nestable: response.data.nestable || false,
        imageCount: response.data.images?.length || 0,
        containerUuid: response.data.locationEntityUUID || null
      });
      
      // Load container info if item is nested
      if (response.data.locationEntityUUID) {
        loadContainerInfo(response.data.locationEntityUUID);
      }
    } catch (error) {
      // If item doesn't exist (404), we're creating a new item with this UUID
      // Don't clear itemUuid - we need it for creating with specific UUID
      if (error.response && error.response.status === 404) {
        console.log('Item not found (404) - will create new item with UUID:', targetUuid);
        setItemExists(false); // Item doesn't exist - we'll create it
        // Keep itemUuid set so createItem can use it for the UUID
      } else {
        showToast('Failed to load item details: ' + error.message, 'error');
      }
    }
  };
  const [imageToCrop, setImageToCrop] = useState(null);
  const [crop, setCrop] = useState({ unit: '%', x: 0, y: 0, width: 100, height: 100 });
  // Note: ReactCrop may convert to px on interaction, handle both in getCroppedImg
  const [imageRef, setImageRef] = useState(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [rotation, setRotation] = useState(0);
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

  // ============================================================================
  // POWER MODE FUNCTIONS
  // ============================================================================

  const togglePowerMode = async () => {
    if (!powerModeActive) {
      // Start Power Mode
      const started = await startRecording();
      if (started) {
        setPowerModeActive(true);
        showToast('Power Mode activated - speak naturally', 'success');
      }
    } else {
      // Stop Power Mode
      // Check if current item has images - if yes, save it first
      const hasImages = images.length > 0 || pendingGalleryImages.length > 0;
      
      if (hasImages) {
        showToast('Saving item and stopping Power Mode...', 'info');
        await handlePowerModeNext(false); // Save item but don't continue recording
      } else {
        // No images, just discard audio
        await stopRecording();
        showToast('Power Mode deactivated - audio discarded', 'info');
      }
      
      setPowerModeActive(false);
    }
  };

  const startRecording = async () => {
    try {
      console.log('Requesting microphone permissions...');
      const { status } = await Audio.requestPermissionsAsync();
      
      if (status !== 'granted') {
        showToast('Microphone permission denied', 'error');
        Alert.alert('Permission Required', 'Microphone access is needed for Power Mode');
        return false;
      }

      console.log('Setting audio mode...');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      console.log('Starting recording...');
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        (status) => {
          // Update waveform based on metering
          if (status.isRecording && status.metering !== undefined) {
            updateWaveform(status.metering);
          }
          
          // Update duration
          if (status.durationMillis) {
            setRecordingDuration(status.durationMillis);
            
            // Check max duration (300 seconds)
            if (status.durationMillis >= MAX_RECORDING_DURATION) {
              showToast('Max recording duration reached (5 min)', 'warning');
              // Don't auto-stop, let user click Next
            }
          }
        },
        100 // Update every 100ms
      );
      
      setRecording(newRecording);
      setIsRecording(true);
      recordingStartTime.current = Date.now();
      return true;
    } catch (err) {
      console.error('Failed to start recording:', err);
      showToast('Failed to start recording: ' + err.message, 'error');
      return false;
    }
  };

  const stopRecording = async () => {
    if (!recording) return null;
    
    console.log('Stopping recording...');
    setIsRecording(false);
    
    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
      
      const uri = recording.getURI();
      
      setRecording(null);
      setRecordingDuration(0);
      setWaveformBars(Array(20).fill(0.1));
      recordingStartTime.current = null;
      
      return uri;
    } catch (err) {
      console.error('Error stopping recording:', err);
      return null;
    }
  };

  const updateWaveform = (metering) => {
    // metering is in dB (typically -160 to 0)
    // Normalize to 0-1 range
    const normalized = Math.max(0, Math.min(1, (metering + 160) / 160));
    
    console.log('Waveform update - metering:', metering, 'normalized:', normalized);
    
    setWaveformBars(prev => {
      const newBars = [...prev];
      // Shift left and add new value on right
      newBars.shift();
      newBars.push(normalized);
      return newBars;
    });
  };

  const formatDuration = (millis) => {
    const seconds = Math.floor(millis / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Upload queue management
  const processUploadQueue = async () => {
    if (uploadQueue.current.length === 0) return;
    
    const item = uploadQueue.current[0];
    
    try {
      console.log('Processing upload queue item:', item.timestamp);
      const response = await axios.post(
        `${API_URL}/power-mode/items`,
        item.formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          withCredentials: true,
        }
      );
      
      console.log('Upload successful:', response.data);
      // Remove from queue on success
      uploadQueue.current.shift();
      
      // Process next item if available
      if (uploadQueue.current.length > 0) {
        processUploadQueue();
      } else {
        // Clear retry timer when queue is empty
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
      }
    } catch (error) {
      console.error('Upload failed:', error);
      const isNetworkError = !error.response || error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK';
      
      if (isNetworkError) {
        showToast(`Upload failed - retrying in 20s (${uploadQueue.current.length} items queued)`, 'error');
      } else {
        showToast('Upload failed: ' + (error.response?.data?.error || error.message), 'error');
        // Remove from queue if it's not a network error (likely a validation error)
        uploadQueue.current.shift();
      }
      
      // Schedule retry in 20 seconds
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
      retryTimerRef.current = setTimeout(() => {
        console.log('Retrying upload queue...');
        processUploadQueue();
      }, 20000);
    }
  };

  const handlePowerModeNext = async (continueRecording = true) => {
    try {
      // Stop recording and get audio URI
      const audioUri = await stopRecording();
      
      if (!audioUri) {
        showToast('No audio recorded', 'error');
        return;
      }
      
      // Prepare form data
      const formData = new FormData();
      formData.append('timestamp', new Date().toISOString());
      
      // Add audio file
      if (Platform.OS === 'web') {
        const audioBlob = await fetch(audioUri).then(r => r.blob());
        formData.append('audio', audioBlob, 'recording.m4a');
      } else {
        formData.append('audio', {
          uri: audioUri,
          type: 'audio/m4a',
          name: 'recording.m4a'
        });
      }
      
      // Add photos if any
      if (images.length > 0 || pendingGalleryImages.length > 0) {
        // Separate ItemImages and GalleryImages
        const itemImageUuids = images
          .filter(img => img.uuid && !img.isPending)
          .map(img => img.uuid);
        
        const galleryImageUuids = pendingGalleryImages.map(img => typeof img === 'string' ? img : img.uuid);
        
        if (itemImageUuids.length > 0) {
          formData.append('photos', JSON.stringify(itemImageUuids));
        }
        
        if (galleryImageUuids.length > 0) {
          formData.append('gallery_photos', JSON.stringify(galleryImageUuids));
          console.log('Sending gallery photos:', galleryImageUuids);
        }
      }
      
      // Add to upload queue
      const queueItem = {
        formData,
        timestamp: new Date().toISOString(),
      };
      
      const wasEmpty = uploadQueue.current.length === 0;
      uploadQueue.current.push(queueItem);
      
      // Start processing queue if it was empty
      if (wasEmpty) {
        processUploadQueue();
      }
      
      // Immediately show feedback and continue
      showToast('Item queued for upload', 'success');
      
      // Reset form for next item
      resetFormForPowerMode();
      
      // Only start new recording if continuing Power Mode
      if (continueRecording) {
        await startRecording();
      }
      
    } catch (error) {
      console.error('Power Mode error:', error);
      showToast('Failed to prepare item: ' + error.message, 'error');
      
      // Only restart recording if continuing Power Mode
      if (continueRecording) {
        await startRecording();
      }
    }
  };

  const resetFormForPowerMode = () => {
    setName('');
    setDescription('');
    setQuantity('1');
    setImages([]);
    setPendingGalleryImages([]);
    setSelectedContainer(null);
    // Notify gallery that pending images are cleared
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('galleryPendingChanged', { 
        detail: { pendingImages: [] }
      }));
    }
    // Keep Power Mode active
  };

  // ============================================================================
  // END POWER MODE FUNCTIONS
  // ============================================================================

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

  const handleConfirmAction = async () => {
    if (confirmDialogData.action === 'discard') {
      // User confirmed discarding changes - go back without saving
      handleDiscardChanges();
      return;
    }
    
    // Handle image deletion
    const { index, imageObj, isServerImage } = confirmDialogData;
    setConfirmDialogVisible(false);

    if (isServerImage) {
      // Check if it's a pending gallery image
      if (imageObj.isPending) {
        // Remove from pending list (image stays in gallery)
        setPendingGalleryImages(prev => {
          const newPending = prev.filter(uuid => uuid !== imageObj.uuid);
          // Notify gallery to show this image again
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('galleryPendingChanged', { 
              detail: { pendingImages: newPending }
            }));
          }
          return newPending;
        });
        setImages(images.filter((_, i) => i !== index));
        showToast('Photo returned to gallery', 'success');
      } else {
        // Mark for deletion (will be deleted when user clicks "Update Item")
        setImagesToDelete([...imagesToDelete, imageObj.uuid]);
        // Remove from local state immediately for UI feedback
        setImages(images.filter((_, i) => i !== index));
        showToast('Photo will be removed when you update the item', 'success');
      }
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
      if (owningEntity) data.owningEntity = owningEntity;
      if (description.trim()) data.description = description.trim();
      if (quantity) data.quantity = parseInt(quantity);
      
      // If itemUuid exists (from QR scanner), include it for pre-printed labels
      if (itemUuid) {
        data.uuid = itemUuid;
      }
      
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
      
      // Assign pending gallery images first
      if (pendingGalleryImages.length > 0) {
        try {
          for (const galleryImageUuid of pendingGalleryImages) {
            await axios.post(
              `${API_URL}/gallery/image/${galleryImageUuid}/assign/${newUuid}`,
              {},
              { withCredentials: true }
            );
          }
          // Refresh gallery to remove assigned images
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('refreshGallery'));
          }
        } catch (error) {
          showToast('Item created but failed to assign gallery photos: ' + error.message, 'error');
        }
      }
      
      // Upload images if any (excluding pending gallery images)
      const localImages = images.filter(img => !img.isPending);
      if (localImages.length > 0) {
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
      setOwningEntity(user?.entities?.[0]?.uuid || '');
      setDescription('');
      setQuantity('1');
      setNestable(false);
      setSelectedContainer(null);
      setImages([]);
      setPendingGalleryImages([]);
      // Clear pending in gallery (now that they're assigned, gallery refresh will handle removal)
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('galleryPendingChanged', { 
          detail: { pendingImages: [] }
        }));
      }
    } catch (error) {
      showToast('Failed to create item: ' + error.message, 'error');
    }
  };

  const updateItem = async () => {
    if (!itemUuid) return;
    try {
      const data = { name: name.trim(), type, visibility, nestable };
      if (owningEntity) data.owningEntity = owningEntity;
      if (description.trim()) data.description = description.trim();
      if (quantity) data.quantity = parseInt(quantity);
      
      // Handle container changes
      const originalContainerUuid = originalData?.containerUuid || null;
      const newContainerUuid = selectedContainer?.uuid || null;
      
      // If container changed, update it
      if (originalContainerUuid !== newContainerUuid) {
        data.locationEntityUUID = newContainerUuid;
      }
      
      await axios.put(`${API_URL}/items/${itemUuid}`, data);
      
      // Assign pending gallery images
      if (pendingGalleryImages.length > 0) {
        try {
          for (const galleryImageUuid of pendingGalleryImages) {
            await axios.post(
              `${API_URL}/gallery/image/${galleryImageUuid}/assign/${itemUuid}`,
              {},
              { withCredentials: true }
            );
          }
          setPendingGalleryImages([]);
          // Refresh gallery to remove assigned images
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('refreshGallery'));
            window.dispatchEvent(new CustomEvent('galleryPendingChanged', { 
              detail: { pendingImages: [] }
            }));
          }
        } catch (error) {
          showToast('Item updated but failed to assign gallery photos: ' + error.message, 'error');
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
      
      // Check if there are new local images to upload (excluding pending gallery images)
      const hasNewImages = images.some(img => typeof img === 'string' || (img && !img.isPending && typeof img === 'object'));
      
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
          setRotation(0);
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
              setRotation(0);
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
      setRotation(0);
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

  const handleGalleryImageDrop = async (e) => {
    e.preventDefault();
    const galleryImageUuid = e.dataTransfer.getData('galleryImageUuid');
    
    if (galleryImageUuid && itemUuid && itemExists) {
      // Item already exists and saved - assign immediately
      try {
        await axios.post(
          `${API_URL}/gallery/image/${galleryImageUuid}/assign/${itemUuid}`,
          {},
          { withCredentials: true }
        );
        
        // Refresh item images
        await fetchItemDetails();
        
        // Refresh gallery to remove assigned image
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('refreshGallery'));
        }
        
        showToast('Photo added from gallery', 'success');
      } catch (error) {
        showToast('Failed to add photo: ' + error.message, 'error');
      }
    } else {
      // Item not saved yet - just add to pending in UI
      setPendingGalleryImages(prev => {
        const newPending = [...prev, galleryImageUuid];
        // Notify gallery to hide this image
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('galleryPendingChanged', { 
            detail: { pendingImages: newPending }
          }));
        }
        return newPending;
      });
      // Show preview by adding to images list
      setImages(prev => [...prev, { uuid: galleryImageUuid, isPending: true }]);
      showToast('Photo added to draft', 'success');
    }
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

  const getCroppedImg = (imageRef, crop, rotation) => {
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

    // Handle rotation - swap dimensions if rotated 90 or 270 degrees
    const rotationInRadians = (rotation * Math.PI) / 180;
    const rotated90or270 = rotation === 90 || rotation === 270;
    
    if (rotated90or270) {
      canvas.width = pixelCrop.height * scaleY;
      canvas.height = pixelCrop.width * scaleX;
    } else {
      canvas.width = pixelCrop.width * scaleX;
      canvas.height = pixelCrop.height * scaleY;
    }
    
    // Set up rotation transform
    ctx.save();
    
    if (rotation === 90) {
      ctx.translate(canvas.width, 0);
      ctx.rotate(rotationInRadians);
    } else if (rotation === 180) {
      ctx.translate(canvas.width, canvas.height);
      ctx.rotate(rotationInRadians);
    } else if (rotation === 270) {
      ctx.translate(0, canvas.height);
      ctx.rotate(rotationInRadians);
    }
    
    ctx.drawImage(
      imageRef,
      pixelCrop.x * scaleX,
      pixelCrop.y * scaleY,
      pixelCrop.width * scaleX,
      pixelCrop.height * scaleY,
      0,
      0,
      rotated90or270 ? pixelCrop.height * scaleY : pixelCrop.width * scaleX,
      rotated90or270 ? pixelCrop.width * scaleX : pixelCrop.height * scaleY
    );
    
    ctx.restore();
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
    const rotateImage = () => {
      setRotation((rotation + 90) % 360);
      // Reset crop to full image when rotating
      setCrop({ unit: '%', x: 0, y: 0, width: 100, height: 100 });
    };
    
    return (
      <Modal visible={cropModalVisible} animationType="slide">
        <View style={styles.cameraFullScreen}>
          <div style={{ 
            height: 'calc(100vh - 120px)', 
            width: '100vw',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'flex-start',
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '30px 20px',
            boxSizing: 'border-box'
          }}>
            <div style={{ 
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '100%'
            }}>
              <ReactCrop
                crop={crop}
                onChange={(newCrop) => setCrop(newCrop)}
                ruleOfThirds={false}
                style={{ maxWidth: '100%' }}
              >
                <img src={imageToCrop} onLoad={(e) => {
                  console.log('Image loaded', e.target);
                  setImageRef(e.target);
                  setImageSize({ width: e.target.offsetWidth, height: e.target.offsetHeight, naturalWidth: e.target.naturalWidth, naturalHeight: e.target.naturalHeight });
                  setImageLoaded(true);
                }} style={{ 
                  maxWidth: 'calc(100vw - 100px)', 
                  maxHeight: '70vh', 
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain', 
                  display: 'block',
                  transform: `rotate(${rotation}deg)`,
                  transition: 'transform 0.3s ease'
                }} />
              </ReactCrop>
            </div>
          </div>
          <View style={styles.cameraControls}>
            <TouchableOpacity style={styles.cameraButton} onPress={() => setCropModalVisible(false)}>
              <Ionicons name="close" size={30} color="white" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.cameraButton} onPress={rotateImage}>
              <Ionicons name="refresh" size={30} color="white" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.cameraButton, !imageLoaded && { opacity: 0.5 }]} disabled={!imageLoaded} onPress={async () => {
              console.log('Crop button pressed', imageRef, crop, rotation);
              try {
                const croppedUri = await getCroppedImg(imageRef, crop, rotation);
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
        title={confirmDialogData?.action === 'discard' ? 'Discard Changes?' : (confirmDialogData?.title || 'Confirm')}
        message={
          confirmDialogData?.action === 'discard' 
            ? 'You have unsaved changes. Are you sure you want to discard them and go back?'
            : (confirmDialogData?.message || '')
        }
        confirmText={confirmDialogData?.action === 'discard' ? 'Discard' : 'Delete'}
        onConfirm={handleConfirmAction}
        onCancel={handleCancelDelete}
      />
      <View style={styles.headerContainer}>
        {itemUuid && (
          <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
        )}
        <Text style={styles.header}>
          {itemUuid ? 'Edit Item' : 'Create New Item'}
          {itemUuid && hasChanges() && <Text style={styles.unsavedIndicator}> *</Text>}
        </Text>
        
        {/* Power Mode Toggle Button (only for new items) */}
        {!itemUuid && (
          <TouchableOpacity 
            style={[
              styles.powerModeButton,
              powerModeActive && styles.powerModeButtonActive
            ]}
            onPress={togglePowerMode}
          >
            <Ionicons 
              name={isRecording ? "mic" : "mic-outline"} 
              size={24} 
              color={powerModeActive ? "white" : colors.error} 
            />
            {isRecording && <View style={styles.recordingPulse} />}
          </TouchableOpacity>
        )}
      </View>
      
      {/* Power Mode Panel */}
      {powerModeActive && (
        <View style={styles.powerModeRow}>
          <View style={styles.powerModePanel}>
            <Ionicons name="radio-button-on" size={16} color={colors.error} />
            <Text style={styles.recordingText}>
              {formatDuration(recordingDuration)}
              {recordingDuration >= MAX_RECORDING_DURATION && ' (MAX)'}
            </Text>
          </View>
          
          {/* Next Item Button - Outside panel */}
          <TouchableOpacity 
            style={styles.inlineNextButton} 
            onPress={handlePowerModeNext}
          >
            <Ionicons 
              name="arrow-forward" 
              size={20} 
              color="white"
            />
          </TouchableOpacity>
        </View>
      )}
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
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={visibility}
          onValueChange={(itemValue) => setVisibility(itemValue)}
          style={styles.picker}
        >
          <Picker.Item label="Private" value="PRIVATE" />
          <Picker.Item label="Same Instance" value="SAME_INSTANCE" />
          <Picker.Item label="Public" value="PUBLIC" />
        </Picker>
      </View>
      
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={owningEntity}
          onValueChange={(itemValue) => setOwningEntity(itemValue)}
          style={styles.picker}
        >
          {user?.entities?.map((entity) => (
            <Picker.Item key={entity.uuid} label={entity.name} value={entity.uuid} />
          ))}
        </Picker>
      </View>
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
        
         {!powerModeActive && (
           <TouchableOpacity 
             style={styles.button} 
             onPress={itemExists ? updateItem : createItem}
           >
             <Ionicons 
               name="save" 
               size={20} 
               color="white" 
               style={{marginRight: 8}}
             />
             <Text style={styles.buttonText}>
               {itemExists ? 'Update Item' : 'Create Item'}
             </Text>
           </TouchableOpacity>
         )}
       <TouchableOpacity style={styles.button} onPress={addFromCamera}>
         <Text style={styles.buttonText}>Take Photo</Text>
       </TouchableOpacity>
       <TouchableOpacity style={styles.button} onPress={addFromGallery}>
         <Text style={styles.buttonText}>Add from Gallery</Text>
       </TouchableOpacity>
       
         {Platform.OS === 'web' && (
           <div
             ref={dropZoneRef}
             data-gallery-drop-zone="true"
             onDrop={handleGalleryImageDrop}
             onDragOver={(e) => e.preventDefault()}
             style={{
               marginTop: 10,
               marginBottom: 100,
               padding: 30,
               borderWidth: 2,
               borderStyle: 'dashed',
               borderColor: colors.border,
               borderRadius: 8,
               backgroundColor: colors.surface,
               textAlign: 'center',
             }}
           >
             <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
               Drag photos from gallery here
             </Text>
           </div>
         )}
       
        {images.length > 0 && (
          <ScrollView horizontal style={styles.imageScroll}>
            {images.map((imageData, index) => {
              // Handle different image types: local (string), server (object), pending gallery (object with isPending)
              const uri = typeof imageData === 'string' 
                ? imageData 
                : imageData.isPending 
                  ? `${API_URL}/gallery/images/${imageData.uuid}?size=preview`
                  : `${API_URL}/images/${imageData.uuid}?size=preview`;
              const isHovered = hoveredImageIndex === index;
             
             return (
               <View 
                 key={index} 
                 style={styles.thumbnailContainer}
                 onMouseEnter={() => Platform.OS === 'web' && setHoveredImageIndex(index)}
                 onMouseLeave={() => Platform.OS === 'web' && setHoveredImageIndex(null)}
               >
                 <Image source={{ uri }} style={styles.thumbnail} resizeMode="contain" />
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
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    zIndex: 1,
    padding: 5,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
    flex: 1,
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
    padding: 20,
  },
  cropContainer: {
    height: 'calc(100vh - 200px)',
    width: '95vw',
    maxWidth: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
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
  unsavedIndicator: {
    color: colors.error,
    fontSize: 24,
  },
  // Power Mode styles
  powerModeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginLeft: 'auto',
  },
  powerModeButtonActive: {
    backgroundColor: colors.error,
  },
  recordingPulse: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ff0000',
  },
  powerModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 15,
    gap: 10,
  },
  powerModePanel: {
    backgroundColor: '#fff5f5',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.error,
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordingText: {
    marginLeft: 8,
    fontSize: 14,
    color: colors.error,
    fontWeight: '600',
  },
  inlineNextButton: {
    backgroundColor: colors.error,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, Alert, ScrollView, Platform, Modal } from 'react-native';
import { Dimensions } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import colors from '../constants/colors';
import { Ionicons } from '@expo/vector-icons';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

const API_URL = 'http://localhost:5000';
const { height } = Dimensions.get('window');

export default function CreateItemScreen({ route, navigation }) {
  const item = route.params?.item || {};
  const [name, setName] = useState(item.name || '');
  const [type, setType] = useState(item.type || 'ITEM');
  const [visibility, setVisibility] = useState(item.visibility || 'PRIVATE');
  const [description, setDescription] = useState(item.description || '');
  const [quantity, setQuantity] = useState(item.quantity?.toString() || '1');
  const [images, setImages] = useState([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const videoRef = useRef(null);
  const [itemUuid, setItemUuid] = useState(item.uuid || null);
  const [cropModalVisible, setCropModalVisible] = useState(false);

  useEffect(() => {
    if (itemUuid) {
      fetchItemDetails();
    }
  }, [itemUuid]);

  const fetchItemDetails = async () => {
    try {
      const response = await axios.get(`${API_URL}/items/${itemUuid}`);
      // Assume response.data has name, type, visibility, description, quantity, images
      setName(response.data.name || '');
      setType(response.data.type || 'ITEM');
      setVisibility(response.data.visibility || 'PRIVATE');
      setDescription(response.data.description || '');
      setQuantity(response.data.quantity?.toString() || '1');
      setImages(response.data.images ? response.data.images.map(img => `${API_URL}/images/${img.uuid}`) : []);
    } catch (error) {
      Alert.alert('Error', 'Failed to load item details: ' + error.message);
    }
  };
  const [imageToCrop, setImageToCrop] = useState(null);
  const [crop, setCrop] = useState({ unit: '%', x: 0, y: 0, width: 100, height: 100 });
  // Note: ReactCrop may convert to px on interaction, handle both in getCroppedImg
  const [imageRef, setImageRef] = useState(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);

  const createItem = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    try {
      const data = { name: name.trim(), type, visibility };
      if (description.trim()) data.description = description.trim();
      if (quantity) data.quantity = parseInt(quantity);
      const response = await axios.post(`${API_URL}/items`, data);
      setItemUuid(response.data.uuid);
      if (images.length > 0) {
        await uploadImages();
      }
      Alert.alert('Success', 'Item created and photos uploaded successfully!');
      // Reset form
      setName('');
      setDescription('');
      setQuantity('');
      setImages([]);
    } catch (error) {
      Alert.alert('Error', 'Failed to create item: ' + error.message);
    }
  };

  const updateItem = async () => {
    if (!itemUuid) return;
    try {
      const data = { name: name.trim(), type, visibility };
      if (description.trim()) data.description = description.trim();
      if (quantity) data.quantity = parseInt(quantity);
      await axios.put(`${API_URL}/items/${itemUuid}`, data);
      if (images.length > 0) {
        await uploadImages();
      }
      Alert.alert('Success', 'Item updated and photos uploaded successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to update item: ' + error.message);
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
      navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }).catch(error => {
        Alert.alert('Error', 'Webcam access denied');
        setCameraOpen(false);
      });
    }
    return () => {
      if (Platform.OS === 'web' && videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraOpen]);

  const addFromCamera = async () => {
    if (Platform.OS === 'web') {
      setCameraOpen(true);
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

  const uploadImages = async () => {
    if (!itemUuid || images.length === 0) return;

    for (const imageUri of images) {
      let data;
      if (Platform.OS === 'web' && imageUri.startsWith('data:')) {
        data = { image: imageUri };
      } else {
        // For native, could convert to base64, but skipping for now
        continue;
      }

      await axios.post(`${API_URL}/items/${itemUuid}/image`, data);
    }
    setImages([]);
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
              }} />
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
          {images.map((uri, index) => (
            <Image key={index} source={{ uri }} style={styles.thumbnail} />
          ))}
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
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 10,
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
});

import React, { useState } from 'react';
import { Modal, View, Image, TouchableOpacity, Alert } from 'react-native';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Ionicons } from '@expo/vector-icons';
import { Dimensions } from 'react-native';

const { height } = Dimensions.get('window');

const CropModal = ({ visible, imageUri, onClose, onCrop }) => {
  const [crop, setCrop] = useState({ unit: '%', x: 25, y: 25, width: 50, height: 50 });

  const getCroppedImg = (imageSrc, crop) => {
    const image = new Image();
    image.src = imageSrc;
    return new Promise((resolve) => {
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;
        canvas.width = crop.width;
        canvas.height = crop.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(
          image,
          crop.x * scaleX,
          crop.y * scaleY,
          crop.width * scaleX,
          crop.height * scaleY,
          0,
          0,
          crop.width,
          crop.height
        );
        resolve(canvas.toDataURL('image/jpeg'));
      };
    });
  };

  return (
    <Modal visible={visible} animationType="slide">
      <View style={{ flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' }}>
        <ReactCrop crop={crop} onChange={setCrop}>
          <Image source={{ uri: imageUri }} style={{ width: '100%', height: height * 0.7 }} />
        </ReactCrop>
        <View style={{ flexDirection: 'row', justifyContent: 'center', width: '60%', marginTop: 20 }}>
          <TouchableOpacity style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#14d91d', alignItems: 'center', justifyContent: 'center', marginHorizontal: 10 }} onPress={onClose}>
            <Ionicons name="close" size={30} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#14d91d', alignItems: 'center', justifyContent: 'center', marginHorizontal: 10 }} onPress={async () => {
            try {
              const croppedUri = await getCroppedImg(imageUri, crop);
              onCrop(croppedUri);
            } catch (error) {
              Alert.alert('Crop Error', error.message);
            }
          }}>
            <Ionicons name="checkmark" size={30} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default CropModal;

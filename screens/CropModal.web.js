import React, { useState } from 'react';
import { Modal, View, Image, TouchableOpacity, Alert } from 'react-native';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Ionicons } from '@expo/vector-icons';
import { Dimensions } from 'react-native';

const { height } = Dimensions.get('window');

const CropModal = ({ visible, imageUri, onClose, onCrop }) => {
  const [crop, setCrop] = useState({ unit: '%', x: 0, y: 0, width: 100, height: 100 });
  const [rotation, setRotation] = useState(0);
  const [imageRef, setImageRef] = useState(null);

  const getCroppedImg = (imageSrc, crop, rotation) => {
    return new Promise((resolve) => {
      const image = new Image();
      image.src = imageSrc;
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Convert percentage crop to pixels
        let pixelCrop = crop;
        if (crop.unit === '%') {
          pixelCrop = {
            x: (crop.x / 100) * image.width,
            y: (crop.y / 100) * image.height,
            width: (crop.width / 100) * image.width,
            height: (crop.height / 100) * image.height,
          };
        }
        
        // Handle rotation - swap dimensions if rotated 90 or 270 degrees
        const rotationInRadians = (rotation * Math.PI) / 180;
        const rotated90or270 = rotation === 90 || rotation === 270;
        
        if (rotated90or270) {
          canvas.width = pixelCrop.height;
          canvas.height = pixelCrop.width;
        } else {
          canvas.width = pixelCrop.width;
          canvas.height = pixelCrop.height;
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
          image,
          pixelCrop.x,
          pixelCrop.y,
          pixelCrop.width,
          pixelCrop.height,
          0,
          0,
          rotated90or270 ? pixelCrop.height : pixelCrop.width,
          rotated90or270 ? pixelCrop.width : pixelCrop.height
        );
        
        ctx.restore();
        resolve(canvas.toDataURL('image/jpeg'));
      };
    });
  };

  const rotateImage = () => {
    setRotation((rotation + 90) % 360);
    // Reset crop to full image when rotating
    setCrop({ unit: '%', x: 0, y: 0, width: 100, height: 100 });
  };

  return (
    <Modal visible={visible} animationType="slide">
      <View style={{ flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' }}>
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
            <ReactCrop crop={crop} onChange={setCrop} ruleOfThirds={false} style={{ maxWidth: '100%' }}>
              <img 
                ref={setImageRef}
                src={imageUri} 
                style={{ 
                  maxWidth: 'calc(100vw - 100px)', 
                  maxHeight: '70vh', 
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain', 
                  display: 'block',
                  transform: `rotate(${rotation}deg)`,
                  transition: 'transform 0.3s ease'
                }} 
              />
            </ReactCrop>
          </div>
        </div>
        <View style={{ flexDirection: 'row', justifyContent: 'center', width: '60%', marginTop: 20 }}>
          <TouchableOpacity style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#14d91d', alignItems: 'center', justifyContent: 'center', marginHorizontal: 10 }} onPress={onClose}>
            <Ionicons name="close" size={30} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#14d91d', alignItems: 'center', justifyContent: 'center', marginHorizontal: 10 }} onPress={rotateImage}>
            <Ionicons name="refresh" size={30} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#14d91d', alignItems: 'center', justifyContent: 'center', marginHorizontal: 10 }} onPress={async () => {
            try {
              const croppedUri = await getCroppedImg(imageUri, crop, rotation);
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

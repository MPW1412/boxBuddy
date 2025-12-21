import React, { useEffect } from 'react';
import { Modal, View } from 'react-native';
import { Alert } from 'react-native';

const CropModal = ({ visible, imageUri, onClose, onCrop }) => {
  useEffect(() => {
    if (visible && imageUri) {
      import(/* webpackIgnore: true */ 'react-native-image-crop-picker').then(ImageCropPicker => {
        ImageCropPicker.default.openCropper({
          path: imageUri,
          width: 300,
          height: 300,
          freeStyleCropEnabled: true,
          hideBottomControls: true,
          enableRotationGesture: false,
          showCropGuidelines: false,
        }).then(cropped => {
          onCrop(cropped.path);
          onClose();
        }).catch(error => {
          Alert.alert('Crop Error', error.message);
          onClose();
        });
      }).catch(error => {
        Alert.alert('Import Error', error.message);
        onClose();
      });
    }
  }, [visible, imageUri]);

  return <Modal visible={visible} animationType="slide"><View style={{ flex: 1 }} /></Modal>;
};

export default CropModal;

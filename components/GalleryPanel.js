import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import axios from 'axios';
import ConfirmDialog from './ConfirmDialog';

const API_URL = Platform.OS === 'web' 
  ? (typeof window !== 'undefined' && window.location.origin.includes('boxbuddy.walther.haus') 
      ? 'https://boxbuddy.walther.haus/api' 
      : 'http://localhost:5000')
  : 'http://localhost:5000';

const GalleryPanel = forwardRef(({ visible, onClose, scannerEnabled }, ref) => {
  const [galleryImages, setGalleryImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [confirmDialogVisible, setConfirmDialogVisible] = useState(false);
  const [imageToDelete, setImageToDelete] = useState(null);

  useEffect(() => {
    if (visible) {
      fetchGalleryImages();
    }
  }, [visible]);

  const fetchGalleryImages = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_URL}/gallery`, {
        withCredentials: true
      });
      setGalleryImages(response.data);
    } catch (err) {
      console.error('Failed to fetch gallery images:', err);
      setError('Failed to load gallery images');
    } finally {
      setLoading(false);
    }
  };

  // Expose fetchGalleryImages to parent via ref
  useImperativeHandle(ref, () => ({
    fetchGalleryImages
  }));

  const handleDragStart = (e, imageUuid) => {
    if (Platform.OS === 'web') {
      e.dataTransfer.setData('galleryImageUuid', imageUuid);
      e.dataTransfer.effectAllowed = 'move';
    }
  };

  const handleDeleteClick = (imageUuid) => {
    setImageToDelete(imageUuid);
    setConfirmDialogVisible(true);
  };

  const confirmDelete = async () => {
    try {
      await axios.delete(`${API_URL}/gallery/image/${imageToDelete}`, {
        withCredentials: true
      });
      // Remove from local state
      setGalleryImages(galleryImages.filter(img => img.uuid !== imageToDelete));
      setConfirmDialogVisible(false);
      setImageToDelete(null);
    } catch (err) {
      console.error('Failed to delete gallery image:', err);
      setError('Failed to delete image');
      setConfirmDialogVisible(false);
      setImageToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setConfirmDialogVisible(false);
    setImageToDelete(null);
  };

  if (!visible) return null;

  return (
    <>
      <View style={[
        styles.panel,
        { height: scannerEnabled ? 'calc(100vh - 33.33vh)' : '100vh' }
      ]}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {galleryImages.length === 0 && !loading && (
            <View style={styles.emptyState}>
              <Ionicons name="camera-outline" size={32} color={colors.textSecondary} />
            </View>
          )}

          {galleryImages.map((img) => (
          Platform.OS === 'web' ? (
            <div
              key={img.uuid}
              draggable
              onDragStart={(e) => handleDragStart(e, img.uuid)}
              style={{
                position: 'relative',
                width: 74,
                height: 74,
                marginBottom: 0,
                borderRadius: 8,
                overflow: 'hidden',
                cursor: 'grab',
              }}
            >
              <img
                src={`${API_URL}/gallery/images/${img.uuid}`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
              <div
                onClick={() => handleDeleteClick(img.uuid)}
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: colors.error,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  border: '2px solid white',
                }}
              >
                <span style={{ color: 'white', fontSize: 12, fontWeight: 'bold', lineHeight: '1' }}>×</span>
              </div>
            </div>
          ) : (
            <View key={img.uuid} style={styles.thumbnailContainer}>
              <Image
                source={{ uri: `${API_URL}/gallery/images/${img.uuid}` }}
                style={styles.thumbnail}
                resizeMode="cover"
              />
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteClick(img.uuid)}
              >
                <View style={styles.deleteCircle}>
                  <Ionicons name="close" size={12} color="white" />
                </View>
              </TouchableOpacity>
            </View>
          )
        ))}
        </ScrollView>
      </View>
      
      <ConfirmDialog
        visible={confirmDialogVisible}
        title="Delete Photo"
        message="Delete this photo from the gallery? This cannot be undone."
        confirmText="Delete"
        onConfirm={confirmDelete}
        onCancel={handleCancelDelete}
      />
    </>
  );
});

const styles = StyleSheet.create({
  panel: {
    position: 'fixed',
    left: 80,
    top: 0,
    width: 80,
    backgroundColor: colors.card,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    zIndex: 50,
    paddingTop: 10,
    paddingLeft: 3,
    paddingRight: 3,
    transition: 'height 0.25s ease',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  thumbnailContainer: {
    position: 'relative',
    width: 74,
    height: 74,
    marginBottom: 0,
    borderRadius: 8,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  deleteButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    zIndex: 10,
  },
  deleteCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
});

export default GalleryPanel;

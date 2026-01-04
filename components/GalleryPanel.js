import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
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
  const [pendingImages, setPendingImages] = useState([]);
  const imageCache = useRef(new Set());
  const dragState = useRef({ isDragging: false, imageUuid: null, dragImage: null });

  useEffect(() => {
    if (visible) {
      fetchGalleryImages();
    }
  }, [visible]);

  // Listen for pending images changes from CreateItemScreen
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handlePendingChanged = (e) => {
        setPendingImages(e.detail.pendingImages || []);
      };
      
      const handleRefreshGallery = () => {
        fetchGalleryImages();
      };
      
      window.addEventListener('galleryPendingChanged', handlePendingChanged);
      window.addEventListener('refreshGallery', handleRefreshGallery);
      
      return () => {
        window.removeEventListener('galleryPendingChanged', handlePendingChanged);
        window.removeEventListener('refreshGallery', handleRefreshGallery);
      };
    }
  }, []);

  // Preload images into browser cache when gallery images list changes
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      galleryImages.forEach(img => {
        if (!imageCache.current.has(img.uuid)) {
          const imageUrl = `${API_URL}/gallery/images/${img.uuid}?size=thumb`;
          const imageElement = new window.Image();
          imageElement.src = imageUrl;
          imageCache.current.add(img.uuid);
        }
      });
    }
  }, [galleryImages]);

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

  const handleTouchStart = (e, imageUuid) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const touch = e.touches[0];
      dragState.current.isDragging = true;
      dragState.current.imageUuid = imageUuid;
      
      // Create a dragging visual indicator
      const dragImage = document.createElement('div');
      dragImage.style.position = 'fixed';
      dragImage.style.width = '74px';
      dragImage.style.height = '74px';
      dragImage.style.borderRadius = '8px';
      dragImage.style.overflow = 'hidden';
      dragImage.style.pointerEvents = 'none';
      dragImage.style.zIndex = '9999';
      dragImage.style.opacity = '0.7';
      dragImage.style.left = touch.clientX - 37 + 'px';
      dragImage.style.top = touch.clientY - 37 + 'px';
      
      const img = document.createElement('img');
      img.src = `${API_URL}/gallery/images/${imageUuid}?size=thumb`;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      
      dragImage.appendChild(img);
      document.body.appendChild(dragImage);
      dragState.current.dragImage = dragImage;
    }
  };

  const handleTouchMove = (e) => {
    if (dragState.current.isDragging && dragState.current.dragImage) {
      const touch = e.touches[0];
      dragState.current.dragImage.style.left = touch.clientX - 37 + 'px';
      dragState.current.dragImage.style.top = touch.clientY - 37 + 'px';
    }
  };

  const handleTouchEnd = (e) => {
    if (dragState.current.isDragging) {
      const touch = e.changedTouches[0];
      
      // Temporarily hide drag image to check what's underneath
      if (dragState.current.dragImage) {
        dragState.current.dragImage.style.display = 'none';
      }
      
      const dropTarget = document.elementFromPoint(touch.clientX, touch.clientY);
      
      // Restore drag image
      if (dragState.current.dragImage) {
        dragState.current.dragImage.style.display = 'block';
      }
      
      // Find if we dropped on the drop zone
      let dropZone = dropTarget;
      while (dropZone && !dropZone.hasAttribute('data-gallery-drop-zone')) {
        dropZone = dropZone.parentElement;
      }
      
      if (dropZone && dragState.current.imageUuid) {
        // Trigger custom drop event
        const customEvent = new CustomEvent('galleryImageDrop', {
          detail: { imageUuid: dragState.current.imageUuid }
        });
        dropZone.dispatchEvent(customEvent);
      }
      
      // Cleanup
      if (dragState.current.dragImage) {
        document.body.removeChild(dragState.current.dragImage);
      }
      dragState.current.isDragging = false;
      dragState.current.imageUuid = null;
      dragState.current.dragImage = null;
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

  if (!visible) {
    return null;
  }

  return (
    <>
      <View style={[
        styles.panel,
        { 
          height: scannerEnabled ? 'calc(100vh - 33.33vh)' : '100vh',
        }
      ]}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {galleryImages.filter(img => !pendingImages.includes(img.uuid)).length === 0 && !loading && (
            <View style={styles.emptyState}>
              <Ionicons name="camera-outline" size={32} color={colors.textSecondary} />
            </View>
          )}

          {galleryImages.filter(img => !pendingImages.includes(img.uuid)).map((img) => (
          Platform.OS === 'web' ? (
            <div
              key={img.uuid}
              draggable
              onDragStart={(e) => handleDragStart(e, img.uuid)}
              onTouchStart={(e) => handleTouchStart(e, img.uuid)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{
                position: 'relative',
                width: 74,
                height: 74,
                marginBottom: 0,
                borderRadius: 8,
                overflow: 'hidden',
                cursor: 'grab',
                touchAction: 'none',
              }}
            >
              <img
                src={`${API_URL}/gallery/images/${img.uuid}?size=thumb`}
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
                source={{ uri: `${API_URL}/gallery/images/${img.uuid}?size=thumb` }}
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
  panel: Platform.select({
    web: {
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
      transition: 'height 0.2s ease',
    },
    default: {
      width: 80,
      backgroundColor: colors.card,
      borderRightWidth: 1,
      borderRightColor: colors.border,
      paddingTop: 10,
      paddingLeft: 3,
      paddingRight: 3,
    }
  }),
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

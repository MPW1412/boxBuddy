import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import axios from 'axios';

const API_URL = Platform.OS === 'web' 
  ? (typeof window !== 'undefined' && window.location.origin.includes('boxbuddy.walther.haus') 
      ? 'https://boxbuddy.walther.haus/api' 
      : 'http://localhost:5000')
  : 'http://localhost:5000';

const GalleryPanel = forwardRef(({ visible, onClose }, ref) => {
  const [galleryImages, setGalleryImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  const handleDeleteImage = async (imageUuid) => {
    try {
      await axios.delete(`${API_URL}/gallery/image/${imageUuid}`, {
        withCredentials: true
      });
      // Remove from local state
      setGalleryImages(galleryImages.filter(img => img.uuid !== imageUuid));
    } catch (err) {
      console.error('Failed to delete gallery image:', err);
      setError('Failed to delete image');
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="images-outline" size={24} color={colors.primary} />
          <Text style={styles.title}>Gallery</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchGalleryImages} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading && (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      )}

      <ScrollView style={styles.imageScrollView} contentContainerStyle={styles.imageGrid}>
        {galleryImages.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Ionicons name="camera-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No photos in gallery</Text>
            <Text style={styles.emptySubtext}>Use the camera mode in QR scanner to capture photos</Text>
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
                width: 100,
                height: 100,
                margin: 5,
                borderRadius: 8,
                overflow: 'hidden',
                cursor: 'grab',
                border: '2px solid #e0e0e0',
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
                onClick={() => handleDeleteImage(img.uuid)}
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: colors.error,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  border: '2px solid white',
                }}
              >
                <span style={{ color: 'white', fontSize: 14, fontWeight: 'bold' }}>×</span>
              </div>
            </div>
          ) : (
            <View key={img.uuid} style={styles.imageContainer}>
              <Image
                source={{ uri: `${API_URL}/gallery/images/${img.uuid}` }}
                style={styles.galleryImage}
                resizeMode="cover"
              />
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteImage(img.uuid)}
              >
                <View style={styles.deleteCircle}>
                  <Ionicons name="close" size={16} color="white" />
                </View>
              </TouchableOpacity>
            </View>
          )
        ))}
      </ScrollView>
    </View>
  );
});

export default GalleryPanel;

const styles = StyleSheet.create({
  panel: {
    position: 'fixed',
    left: 80,
    top: 0,
    bottom: 0,
    width: 320,
    backgroundColor: colors.surface,
    borderRightWidth: 2,
    borderRightColor: colors.border,
    zIndex: 50,
    boxShadow: '2px 0 8px rgba(0,0,0,0.15)',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
  },
  closeButton: {
    padding: 4,
  },
  errorContainer: {
    padding: 16,
    backgroundColor: '#ffebee',
    borderBottomWidth: 1,
    borderBottomColor: colors.error,
  },
  errorText: {
    color: colors.error,
    marginBottom: 8,
  },
  retryButton: {
    alignSelf: 'flex-start',
    padding: 8,
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  retryText: {
    color: 'white',
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 16,
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
  },
  imageScrollView: {
    flex: 1,
  },
  imageGrid: {
    padding: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    width: '100%',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  imageContainer: {
    position: 'relative',
    width: 100,
    height: 100,
    margin: 5,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  galleryImage: {
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
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
});

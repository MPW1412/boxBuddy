import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import axios from 'axios';

const API_URL = Platform.OS === 'web' 
  ? (typeof window !== 'undefined' && window.location.origin.includes('boxbuddy.walther.haus') 
      ? 'https://boxbuddy.walther.haus/api' 
      : 'http://localhost:5000')
  : 'http://localhost:5000';

// Helper function to break text into syllables (simple version)
const breakIntoLines = (text, maxCharsPerLine = 6) => {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';
  
  for (const word of words) {
    if ((currentLine + word).length <= maxCharsPerLine) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  
  return lines.slice(0, 3); // Max 3 lines
};

export default function Sidebar({ navigation, pinnedContainers = [], onRemovePinned, onPinContainer }) {
  const [dragOverContainer, setDragOverContainer] = useState(null);
  const [dragOverPinZone, setDragOverPinZone] = useState(false);

  const handleDrop = async (e, containerUuid) => {
    e.preventDefault();
    setDragOverContainer(null);
    
    try {
      const itemUuid = e.dataTransfer.getData('itemUuid');
      if (itemUuid && containerUuid) {
        // Store item in container
        await axios.post(`${API_URL}/items/${itemUuid}/store/${containerUuid}`);
        console.log(`Item ${itemUuid} added to container ${containerUuid}`);
      }
    } catch (error) {
      console.error('Error adding item to container:', error);
    }
  };

  const handlePinZoneDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPinZone(false);
    
    console.log('Pin zone drop - types:', e.dataTransfer.types);
    
    try {
      const isContainer = e.dataTransfer.getData('isContainer') === 'true';
      const itemUuid = e.dataTransfer.getData('itemUuid');
      
      console.log('Drop data - isContainer:', isContainer, 'itemUuid:', itemUuid);
      
      if (isContainer) {
        const containerData = JSON.parse(e.dataTransfer.getData('containerData'));
        console.log('Pinning container:', containerData);
        if (onPinContainer) {
          onPinContainer(containerData);
        }
      }
    } catch (error) {
      console.error('Error pinning container:', error);
    }
  };

  const handlePinZoneDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if any data types are present
    const types = Array.from(e.dataTransfer.types);
    console.log('Drag over pin zone - types:', types);
    
    // Always show the drop zone when dragging over
    setDragOverPinZone(true);
  };

  const handlePinZoneDragLeave = (e) => {
    // Only clear if leaving the container itself, not a child
    if (e.currentTarget === e.target) {
      console.log('Leaving pin zone');
      setDragOverPinZone(false);
    }
  };

  const handleDragOver = (e, containerUuid) => {
    e.preventDefault();
    setDragOverContainer(containerUuid);
  };

  const handleDragLeave = () => {
    setDragOverContainer(null);
  };

  const renderContainerButton = (container) => {
    const hasImage = container.images && container.images.length > 0;
    const isDropTarget = dragOverContainer === container.uuid;
    
    const buttonContent = (
      <>
        <TouchableOpacity 
          style={styles.containerButton}
          onPress={() => navigation && navigation.navigate('Item Detail', { uuid: container.uuid })}
          onLongPress={() => onRemovePinned && onRemovePinned(container.uuid)}
        >
          {hasImage ? (
            <Image
              source={{ uri: `${API_URL}/images/${container.images[0].uuid}` }}
              style={styles.containerImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.containerTextContainer}>
              {breakIntoLines(container.name).map((line, index) => (
                <Text key={index} style={styles.containerText}>{line}</Text>
              ))}
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.unpinButton}
          onPress={() => onRemovePinned && onRemovePinned(container.uuid)}
        >
          <Ionicons name="close-circle" size={16} color={colors.error} />
        </TouchableOpacity>
      </>
    );

    // For web, use a div as drop zone
    if (Platform.OS === 'web') {
      return (
        <div
          key={container.uuid}
          onDrop={(e) => handleDrop(e, container.uuid)}
          onDragOver={(e) => handleDragOver(e, container.uuid)}
          onDragLeave={handleDragLeave}
          style={{
            position: 'relative',
            marginTop: 3,
            marginBottom: 3,
            borderRadius: 8,
            border: isDropTarget ? '2px solid #14d91d' : '2px solid transparent',
            backgroundColor: isDropTarget ? 'rgba(20, 217, 29, 0.1)' : 'transparent',
            transition: 'all 0.2s ease',
          }}
        >
          {buttonContent}
        </div>
      );
    }

    return (
      <View key={container.uuid} style={styles.containerItem}>
        {buttonContent}
      </View>
    );
  };

  return (
    <View style={styles.sidebar}>
      <TouchableOpacity style={styles.createItem} onPress={() => navigation && navigation.navigate('Create Item')}>
        <Ionicons name="add-circle" size={40} color={colors.card} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.listItem} onPress={() => navigation && navigation.navigate('List Items')}>
        <Ionicons name="list" size={40} color={colors.card} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.binItem} onPress={() => navigation && navigation.navigate('Bin')}>
        <Ionicons name="trash-outline" size={40} color={colors.card} />
      </TouchableOpacity>
      
      {/* Pin Zone - Drop containers here to pin them (between bin and first container) */}
      {Platform.OS === 'web' && pinnedContainers.length === 0 && (
        <div
          onDrop={handlePinZoneDrop}
          onDragOver={handlePinZoneDragOver}
          onDragLeave={handlePinZoneDragLeave}
          style={{
            position: 'relative',
            marginTop: 3,
            marginBottom: 3,
            minHeight: 74,
            transition: 'min-height 0.2s ease',
          }}
        >
          {dragOverPinZone && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: 74,
                height: 74,
                borderRadius: 8,
                border: '2px dashed #0092cc',
                backgroundColor: 'rgba(0, 146, 204, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                pointerEvents: 'none',
              }}
            >
              <span style={{ fontSize: 10, color: '#0092cc', textAlign: 'center', fontWeight: 'bold', pointerEvents: 'none', lineHeight: '1.2' }}>
                Drop to pin
              </span>
            </div>
          )}
        </div>
      )}
      
      {/* Pinned Containers */}
      {pinnedContainers.map(renderContainerButton)}
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 80,
    backgroundColor: colors.card,
    paddingTop: 10,
    paddingHorizontal: 3,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  createItem: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    marginVertical: 3,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  listItem: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    marginVertical: 3,
    backgroundColor: '#0092cc',
    borderRadius: 8,
  },
  binItem: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    marginVertical: 3,
    backgroundColor: '#666666',
    borderRadius: 8,
  },
  containerItem: {
    position: 'relative',
    marginVertical: 3,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  containerItemDragOver: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(20, 217, 29, 0.1)',
  },
  containerButton: {
    width: 74,
    height: 74,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  containerImage: {
    width: '100%',
    height: '100%',
  },
  containerTextContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
  },
  containerText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
  },
  unpinButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: colors.card,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    marginLeft: 10,
    fontSize: 16,
    color: colors.text,
  },
});
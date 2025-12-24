import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Platform } from 'react-native';
import axios from 'axios';
import colors from '../constants/colors';
import { Ionicons } from '@expo/vector-icons';
import Toast from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';

const API_URL = Platform.OS === 'web'
  ? (typeof window !== 'undefined' && window.location.origin.includes('boxbuddy.walther.haus')
      ? 'https://boxbuddy.walther.haus/api'
      : 'http://localhost:5000')
  : 'http://localhost:5000';

export default function ItemDetailScreen({ route, navigation }) {
  const { item } = route.params;
  const [detailedItem, setDetailedItem] = useState(item);
  const [containedItems, setContainedItems] = useState([]);
  const [containerName, setContainerName] = useState(null);
  const [confirmDialogVisible, setConfirmDialogVisible] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');

  useEffect(() => {
    fetchDetailedItem();
  }, []);

  const fetchDetailedItem = async () => {
    try {
      // Fetch full item details
      const response = await axios.get(`${API_URL}/items/${item.uuid}`);
      setDetailedItem(response.data);

      // If item is nested, fetch container name
      if (response.data.locationEntityUUID) {
        const containerResponse = await axios.get(`${API_URL}/items/${response.data.locationEntityUUID}`);
        setContainerName(containerResponse.data.name);
      }

      // If item is nestable, fetch contained items
      if (response.data.nestable) {
        fetchContainedItems();
      }
    } catch (error) {
      console.error('Error fetching item details:', error);
    }
  };

  const fetchContainedItems = async () => {
    try {
      const response = await axios.get(`${API_URL}/items`);
      const contained = response.data.filter(i => i.locationEntityUUID === item.uuid);
      setContainedItems(contained);
    } catch (error) {
      console.error('Error fetching contained items:', error);
    }
  };

  const deleteItem = async () => {
    try {
      await axios.delete(`${API_URL}/items/${detailedItem.uuid}`);
      showToast('Item moved to bin', 'success');
      navigation.goBack(); // Go back to list after deleting
    } catch (error) {
      showToast('Failed to delete item: ' + error.message, 'error');
    }
    setConfirmDialogVisible(false);
  };

  const showToast = (message, type = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  const renderItem = ({ item: containedItem }) => (
    <TouchableOpacity
      style={styles.containedItemCard}
      onPress={() => navigation.navigate('Item Detail', { item: containedItem })}
    >
      <View style={styles.containedItemHeader}>
        <Text style={styles.containedItemName}>{containedItem.name}</Text>
        <Text style={styles.containedItemType}>{containedItem.type}</Text>
      </View>
      {containedItem.description && (
        <Text style={styles.containedItemDescription} numberOfLines={2}>
          {containedItem.description}
        </Text>
      )}
      {containedItem.images && containedItem.images.length > 0 && (
        <Image
          source={{ uri: `${API_URL}/images/${containedItem.images[0].uuid}` }}
          style={styles.containedItemImage}
        />
      )}
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      {/* Header with Edit and Delete Buttons */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate('Create Item', { item: detailedItem })}
          >
            <Ionicons name="pencil" size={20} color="white" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => setConfirmDialogVisible(true)}
          >
            <Ionicons name="trash" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Item Details */}
      <View style={styles.itemDetails}>
        <Text style={styles.itemName}>{detailedItem.name}</Text>

        <View style={styles.itemMeta}>
          <Text style={styles.itemType}>{detailedItem.type}</Text>
          <Text style={styles.itemVisibility}>{detailedItem.visibility}</Text>
        </View>

        {containerName && (
          <View style={styles.containerInfo}>
            <Ionicons name="folder-open" size={16} color={colors.primary} />
            <Text style={styles.containerText}>Stored in: {containerName}</Text>
          </View>
        )}

        {detailedItem.description && (
          <Text style={styles.itemDescription}>{detailedItem.description}</Text>
        )}

        <View style={styles.itemStats}>
          <Text style={styles.statText}>Quantity: {detailedItem.quantity || 1}</Text>
          <Text style={styles.statText}>
            Created: {new Date(detailedItem.creation_time).toLocaleDateString()}
          </Text>
          {detailedItem.nestable && (
            <View style={styles.nestableBadge}>
              <Ionicons name="archive" size={16} color={colors.primary} />
              <Text style={styles.nestableText}>Storage Container</Text>
            </View>
          )}
        </View>
      </View>

      {/* Photos */}
      {detailedItem.images && detailedItem.images.length > 0 && (
        <View style={styles.photosSection}>
          <Text style={styles.sectionTitle}>Photos</Text>
          <ScrollView horizontal style={styles.photosScroll}>
            {detailedItem.images.map((img, index) => (
              <Image
                key={index}
                source={{ uri: `${API_URL}/images/${img.uuid}` }}
                style={styles.photo}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Contained Items (for nestable items) */}
      {detailedItem.nestable && (
        <View style={styles.containedSection}>
          <Text style={styles.sectionTitle}>
            Items Inside ({containedItems.length})
          </Text>
          {containedItems.length > 0 ? (
            containedItems.map((containedItem) => (
              <TouchableOpacity
                key={containedItem.uuid}
                style={styles.containedItemCard}
                onPress={() => navigation.navigate('Item Detail', { item: containedItem })}
              >
                <View style={styles.containedItemHeader}>
                  <Text style={styles.containedItemName}>{containedItem.name}</Text>
                  <Text style={styles.containedItemType}>{containedItem.type}</Text>
                </View>
                {containedItem.description && (
                  <Text style={styles.containedItemDescription} numberOfLines={2}>
                    {containedItem.description}
                  </Text>
                )}
                {containedItem.images && containedItem.images.length > 0 && (
                  <Image
                    source={{ uri: `${API_URL}/images/${containedItem.images[0].uuid}` }}
                    style={styles.containedItemImage}
                  />
                )}
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.emptyText}>No items stored in this container yet</Text>
          )}
        </View>
      )}
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onHide={() => setToastVisible(false)}
      />
      <ConfirmDialog
        visible={confirmDialogVisible}
        title="Move to Bin"
        message={`Move "${detailedItem.name}" to the bin? You can restore it later from the bin.`}
        onConfirm={deleteItem}
        onCancel={() => setConfirmDialogVisible(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 40,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  editButton: {
    backgroundColor: '#14d91d',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    backgroundColor: colors.error,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemDetails: {
    padding: 20,
    backgroundColor: colors.card,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 10,
  },
  itemMeta: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  itemType: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
    marginRight: 15,
  },
  itemVisibility: {
    fontSize: 16,
    color: colors.text,
    opacity: 0.7,
  },
  containerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  containerText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '500',
    marginLeft: 8,
  },
  itemDescription: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 24,
    marginBottom: 15,
  },
  itemStats: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 15,
  },
  statText: {
    fontSize: 14,
    color: colors.text,
    opacity: 0.8,
    marginBottom: 5,
  },
  nestableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  nestableText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    marginLeft: 5,
  },
  photosSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 15,
  },
  photosScroll: {
    flexDirection: 'row',
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 8,
    marginRight: 10,
  },
  containedSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  containedItemCard: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  containedItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  containedItemName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
  },
  containedItemType: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  containedItemDescription: {
    fontSize: 14,
    color: colors.text,
    opacity: 0.8,
    marginBottom: 10,
  },
  containedItemImage: {
    width: 80,
    height: 80,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  emptyText: {
    fontSize: 16,
    color: colors.text,
    opacity: 0.6,
    textAlign: 'center',
    padding: 20,
  },
});
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, Platform, Image, ScrollView } from 'react-native';
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

export default function BinScreen({ navigation }) {
  const [binItems, setBinItems] = useState([]);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [confirmDialogVisible, setConfirmDialogVisible] = useState(false);
  const [confirmDialogData, setConfirmDialogData] = useState(null);

  useEffect(() => {
    fetchBinItems();
  }, []);

  const fetchBinItems = async () => {
    try {
      const response = await axios.get(`${API_URL}/bin`);
      setBinItems(response.data);
    } catch (error) {
      showToast('Failed to load bin items: ' + error.message, 'error');
    }
  };

  const showToast = (message, type = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  const restoreItem = async (itemUuid) => {
    try {
      await axios.post(`${API_URL}/items/${itemUuid}/restore`);
      showToast('Item restored successfully', 'success');
      fetchBinItems(); // Refresh the list
    } catch (error) {
      showToast('Failed to restore item: ' + error.message, 'error');
    }
  };

  const permanentDeleteItem = async (itemUuid) => {
    try {
      await axios.delete(`${API_URL}/items/${itemUuid}/permanent`);
      showToast('Item permanently deleted', 'success');
      fetchBinItems(); // Refresh the list
    } catch (error) {
      showToast('Failed to delete item: ' + error.message, 'error');
    }
    setConfirmDialogVisible(false);
    setConfirmDialogData(null);
  };

  const handlePermanentDelete = (item) => {
    setConfirmDialogData({
      item,
      action: 'delete'
    });
    setConfirmDialogVisible(true);
  };

  const handleEmptyBin = () => {
    setConfirmDialogData({
      action: 'empty'
    });
    setConfirmDialogVisible(true);
  };

  const emptyBin = async () => {
    try {
      const response = await axios.delete(`${API_URL}/bin/empty`);
      showToast(`Permanently deleted ${response.data.deleted_count} items`, 'success');
      fetchBinItems(); // Refresh the list
    } catch (error) {
      showToast('Failed to empty bin: ' + error.message, 'error');
    }
    setConfirmDialogVisible(false);
    setConfirmDialogData(null);
  };

  const handleConfirmAction = () => {
    if (confirmDialogData.action === 'delete') {
      permanentDeleteItem(confirmDialogData.item.uuid);
    } else if (confirmDialogData.action === 'empty') {
      emptyBin();
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemType}>{item.type}</Text>
      </View>
      {item.description && (
        <Text style={styles.itemDescription} numberOfLines={2}>
          {item.description}
        </Text>
      )}
      <Text style={styles.deletedDate}>
        Moved to bin: {new Date(item.modified_time).toLocaleDateString()}
      </Text>
      {item.images && item.images.length > 0 && (
        <ScrollView horizontal style={styles.imageScroll}>
          {item.images.map((img, index) => (
            <Image key={index} source={{ uri: `${API_URL}/images/${img.uuid}?size=thumb` }} style={styles.thumbnail} resizeMode="contain" />
          ))}
        </ScrollView>
      )}
      <View style={styles.itemActions}>
        <TouchableOpacity
          style={styles.restoreButton}
          onPress={() => restoreItem(item.uuid)}
        >
          <Ionicons name="refresh" size={16} color="white" />
          <Text style={styles.buttonText}>Restore</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handlePermanentDelete(item)}
        >
          <Ionicons name="trash" size={16} color="white" />
          <Text style={styles.buttonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onHide={() => setToastVisible(false)}
      />
      <ConfirmDialog
        visible={confirmDialogVisible}
        title={confirmDialogData?.action === 'empty' ? 'Empty Bin' : 'Permanently Delete'}
        message={
          confirmDialogData?.action === 'empty'
            ? `Permanently delete ALL ${binItems.length} items in the bin? This action cannot be undone and will delete all associated photos.`
            : `Permanently delete "${confirmDialogData?.item?.name}"? This action cannot be undone and will also delete all associated photos.`
        }
        onConfirm={handleConfirmAction}
        onCancel={() => {
          setConfirmDialogVisible(false);
          setConfirmDialogData(null);
        }}
      />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bin</Text>
        {binItems.length > 0 ? (
          <TouchableOpacity 
            style={styles.emptyBinButton}
            onPress={handleEmptyBin}
          >
            <Ionicons name="trash-bin" size={24} color="white" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {binItems.length > 0 ? (
        <FlatList
          data={binItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.uuid}
          contentContainerStyle={styles.listContainer}
          refreshing={false}
          onRefresh={fetchBinItems}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="trash-outline" size={64} color={colors.text} opacity={0.3} />
          <Text style={styles.emptyText}>Bin is empty</Text>
          <Text style={styles.emptySubtext}>Deleted items will appear here</Text>
        </View>
      )}
    </View>
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  emptyBinButton: {
    backgroundColor: colors.error,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContainer: {
    padding: 20,
  },
  itemCard: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
  },
  itemType: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  itemDescription: {
    fontSize: 14,
    color: colors.text,
    opacity: 0.8,
    marginBottom: 8,
  },
  deletedDate: {
    fontSize: 12,
    color: colors.text,
    opacity: 0.6,
    marginBottom: 8,
  },
  imageScroll: {
    flexDirection: 'row',
    marginBottom: 15,
    maxHeight: 80,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: colors.border,
  },
  itemActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  restoreButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.error,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: colors.text,
    opacity: 0.6,
    marginTop: 20,
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.text,
    opacity: 0.4,
    textAlign: 'center',
  },
});
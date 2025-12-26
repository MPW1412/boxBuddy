import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import Toast from '../components/Toast';
import axios from 'axios';

const API_URL = Platform.OS === 'web'
  ? (typeof window !== 'undefined' && window.location.origin.includes('boxbuddy.walther.haus')
      ? 'https://boxbuddy.walther.haus/api'
      : 'http://localhost:5000')
  : 'http://localhost:5000';

export default function PrintQueueScreen({ navigation }) {
  const [smallQueue, setSmallQueue] = useState({ items: [], queue_length: 0, sheet_capacity: 126 });
  const [wideQueue, setWideQueue] = useState({ items: [], queue_length: 0, sheet_capacity: 12 });
  const [loading, setLoading] = useState(true);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');

  useEffect(() => {
    loadQueues();
  }, []);

  const showToast = (message, type = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  const loadQueues = async () => {
    setLoading(true);
    try {
      const [smallResponse, wideResponse] = await Promise.all([
        axios.get(`${API_URL}/labels/queue/status?label_type=small`),
        axios.get(`${API_URL}/labels/queue/status?label_type=wide`)
      ]);

      setSmallQueue(smallResponse.data);
      setWideQueue(wideResponse.data);
    } catch (error) {
      console.error('Failed to load queues:', error);
      showToast('Failed to load print queues', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async (labelType) => {
    const queue = labelType === 'small' ? smallQueue : wideQueue;
    
    if (queue.queue_length === 0) {
      showToast('Queue is empty', 'error');
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/labels/print`, {
        label_type: labelType,
        fill_remaining: false
      });

      if (response.data.pdf_url) {
        const fullUrl = `${API_URL}${response.data.pdf_url}`;
        const printWindow = window.open(fullUrl, '_blank');

        if (printWindow) {
          printWindow.onload = function() {
            printWindow.print();
          };
        }

        showToast(`Printing ${response.data.labels_count} ${labelType} labels`, 'success');
        loadQueues(); // Reload queues after printing
      }
    } catch (error) {
      console.error('Failed to print:', error);
      showToast('Failed to print: ' + (error.response?.data?.error || error.message), 'error');
    }
  };

  const handleDeleteItem = async (queueId, labelType) => {
    try {
      await axios.delete(`${API_URL}/labels/queue/${queueId}`);
      showToast('Item removed from queue', 'success');
      loadQueues(); // Reload queues after deletion
    } catch (error) {
      console.error('Failed to delete queue item:', error);
      showToast('Failed to remove item', 'error');
    }
  };

  const handleClearQueue = async (labelType) => {
    try {
      await axios.delete(`${API_URL}/labels/queue?label_type=${labelType}`);
      showToast(`${labelType} queue cleared`, 'success');
      loadQueues(); // Reload queues after clearing
    } catch (error) {
      console.error('Failed to clear queue:', error);
      showToast('Failed to clear queue', 'error');
    }
  };

  const renderQueueSection = (title, queue, labelType, icon) => {
    const fillPercentage = (queue.queue_length / queue.sheet_capacity) * 100;
    const isEmpty = queue.queue_length === 0;
    const isFull = queue.queue_length >= queue.sheet_capacity;

    return (
      <View style={styles.queueSection}>
        <View style={styles.queueHeader}>
          <View style={styles.queueTitleRow}>
            <Ionicons name={icon} size={24} color={colors.text} />
            <Text style={styles.queueTitle}>{title}</Text>
          </View>
          <Text style={styles.queueCount}>
            {queue.queue_length} / {queue.sheet_capacity}
          </Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBarContainer}>
          <View 
            style={[
              styles.progressBar, 
              { width: `${Math.min(fillPercentage, 100)}%` },
              isFull && styles.progressBarFull
            ]} 
          />
        </View>
        <Text style={styles.progressText}>
          {isFull ? 'Sheet full - ready to print!' : `${(100 - fillPercentage).toFixed(0)}% remaining`}
        </Text>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.printButton, isEmpty && styles.buttonDisabled]}
            onPress={() => handlePrint(labelType)}
            disabled={isEmpty}
          >
            <Ionicons name="print" size={20} color={colors.card} />
            <Text style={styles.actionButtonText}>
              {isEmpty ? 'Queue Empty' : isFull ? 'Print Full Sheet' : 'Print Partial'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.clearButton, isEmpty && styles.buttonDisabled]}
            onPress={() => handleClearQueue(labelType)}
            disabled={isEmpty}
          >
            <Ionicons name="trash-outline" size={20} color={colors.error} />
            <Text style={[styles.actionButtonText, styles.clearButtonText]}>Clear All</Text>
          </TouchableOpacity>
        </View>

        {/* Queue Items List */}
        {queue.items.length > 0 ? (
          <View style={styles.itemsList}>
            <Text style={styles.itemsListTitle}>Queued Items:</Text>
            {queue.items.map((item) => (
              <View key={item.queue_id} style={styles.queueItem}>
                <View style={styles.queueItemInfo}>
                  <Text style={styles.queueItemName}>{item.item_name}</Text>
                  {item.item_description && (
                    <Text style={styles.queueItemDescription} numberOfLines={1}>
                      {item.item_description}
                    </Text>
                  )}
                  <Text style={styles.queueItemQuantity}>
                    Quantity: {item.quantity}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteItemButton}
                  onPress={() => handleDeleteItem(item.queue_id, labelType)}
                >
                  <Ionicons name="close-circle" size={24} color={colors.error} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="layers-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyStateText}>No items in queue</Text>
            <Text style={styles.emptyStateHint}>
              Click QR buttons on items to add labels to this queue
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Print Queue</Text>
        <TouchableOpacity onPress={loadQueues} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {renderQueueSection('Small Labels (20x20mm)', smallQueue, 'small', 'square-outline')}
      {renderQueueSection('Wide Labels (105x48mm)', wideQueue, 'wide', 'rectangle-outline')}

      <Toast
        message={toastMessage}
        type={toastType}
        visible={toastVisible}
        onHide={() => setToastVisible(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  backButton: {
    padding: 4,
  },
  refreshButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  queueSection: {
    backgroundColor: colors.card,
    margin: 16,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  queueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  queueTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  queueTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  queueCount: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  progressBarFull: {
    backgroundColor: '#14d91d',
  },
  progressText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
  },
  printButton: {
    backgroundColor: colors.primary,
  },
  clearButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.error,
  },
  actionButtonText: {
    color: colors.card,
    fontSize: 14,
    fontWeight: 'bold',
  },
  clearButtonText: {
    color: colors.error,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  itemsListTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  itemsList: {
    marginTop: 8,
  },
  queueItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.background,
    borderRadius: 8,
    marginBottom: 8,
  },
  queueItemInfo: {
    flex: 1,
  },
  queueItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  queueItemDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  queueItemQuantity: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  deleteItemButton: {
    padding: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 12,
  },
  emptyStateHint: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
});

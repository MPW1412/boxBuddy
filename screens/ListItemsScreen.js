import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Image, ScrollView, Platform, TextInput, ActivityIndicator } from 'react-native';
import axios from 'axios';
import colors from '../constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

const API_URL = Platform.OS === 'web' 
  ? (typeof window !== 'undefined' && window.location.origin.includes('boxbuddy.walther.haus') 
      ? 'https://boxbuddy.walther.haus/api' 
      : 'http://localhost:5000')
  : 'http://localhost:5000';

export default function ListItemsScreen({ navigation, onPinContainer }) {
  const [items, setItems] = useState([]);
  const [containers, setContainers] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const LIMIT = 15;

  useEffect(() => {
    fetchItems(true);
  }, []);

  // Refresh list when screen comes into focus (e.g., after deleting an item)
  useFocusEffect(
    useCallback(() => {
      fetchItems(true);
    }, [])
  );

  useEffect(() => {
    // Debounce search
    const timeoutId = setTimeout(() => {
      fetchItems(true);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const fetchItems = async (reset = false) => {
    if ((isLoading || isLoadingMore) && !reset) return;
    
    const currentOffset = reset ? 0 : offset;
    
    if (reset) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const params = {
        limit: LIMIT,
        offset: currentOffset,
      };
      
      if (searchQuery) {
        params.q = searchQuery;
      }

      const response = await axios.get(`${API_URL}/items`, { params });
      
      if (reset) {
        setItems(response.data);
        setOffset(LIMIT);
      } else {
        setItems([...items, ...response.data]);
        setOffset(currentOffset + LIMIT);
      }
      
      // Check if there are more items to load
      setHasMore(response.data.length === LIMIT);
      
      // Build a map of container UUIDs to full item objects for quick lookup
      const containerMap = { ...containers };
      response.data.forEach(item => {
        containerMap[item.uuid] = item;
      });
      setContainers(containerMap);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (hasMore && !isLoadingMore) {
      fetchItems(false);
    }
  };

  const handleRefresh = () => {
    setOffset(0);
    setHasMore(true);
    fetchItems(true);
  };

  const handleDragStart = (e, item) => {
    if (Platform.OS === 'web') {
      e.dataTransfer.setData('itemUuid', item.uuid);
      e.dataTransfer.effectAllowed = 'move';
    }
  };

  const handlePinContainer = (e, item) => {
    e.stopPropagation();
    if (item.nestable && onPinContainer) {
      onPinContainer(item);
    }
  };

  const renderItem = ({ item }) => (
    <View
      draggable={Platform.OS === 'web'}
      onDragStart={(e) => handleDragStart(e, item)}
      style={styles.cardWrapper}
    >
      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Item Detail', { uuid: item.uuid })}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{item.name}</Text>
          {item.nestable && (
            <View style={styles.titleRowActions}>
              <View style={styles.nestableBadge}>
                <Ionicons name="archive" size={16} color={colors.primary} />
                <Text style={styles.nestableText}>Container</Text>
              </View>
              <TouchableOpacity 
                style={styles.pinButton}
                onPress={(e) => handlePinContainer(e, item)}
              >
                <Ionicons name="push-outline" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      <Text style={styles.subtitle}>Type: {item.type}</Text>
      <Text style={styles.subtitle}>Visibility: {item.visibility}</Text>
      {item.locationEntityUUID && containers[item.locationEntityUUID] && (
        <TouchableOpacity 
          style={styles.containerInfo}
          onPress={(e) => {
            e.stopPropagation();
            navigation.navigate('Item Detail', { uuid: containers[item.locationEntityUUID].uuid });
          }}
        >
          <Ionicons name="folder-open" size={14} color={colors.primary} />
          <Text style={styles.containerText}>In: {containers[item.locationEntityUUID].name}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </TouchableOpacity>
      )}
      <Text style={styles.subtitle}>Created: {new Date(item.creation_time).toLocaleDateString()}</Text>
      {item.images && item.images.length > 0 && (
        <ScrollView horizontal style={styles.imageScroll}>
          {item.images.map((img, index) => (
            <Image key={index} source={{ uri: `${API_URL}/images/${img.uuid}` }} style={styles.thumbnail} resizeMode="contain" />
          ))}
        </ScrollView>
      )}
      </TouchableOpacity>
    </View>
  );

  const renderFooter = () => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="search-outline" size={64} color={colors.text} style={{ opacity: 0.3 }} />
        <Text style={styles.emptyText}>
          {searchQuery ? 'No items found' : 'No items yet'}
        </Text>
        {searchQuery && (
          <Text style={styles.emptySubtext}>Try a different search term</Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Your Items</Text>
      
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={colors.text} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search items..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={colors.text + '80'}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
            <Ionicons name="close-circle" size={20} color={colors.text} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.uuid}
        refreshing={isLoading}
        onRefresh={handleRefresh}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 10,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 20,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 15,
    marginVertical: 5,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
  },
  nestableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  nestableText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
    marginLeft: 4,
  },
  containerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  containerText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
    marginLeft: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.text,
    opacity: 0.7,
    marginBottom: 2,
  },
  imageScroll: {
    marginTop: 10,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 5,
    marginRight: 5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: 10,
    marginBottom: 15,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
    opacity: 0.6,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 12,
  },
  clearButton: {
    padding: 4,
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: colors.text,
    opacity: 0.6,
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.text,
    opacity: 0.4,
    marginTop: 8,
  },
  cardWrapper: {
    cursor: 'grab',
  },
  titleRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pinButton: {
    padding: 4,
  },
});

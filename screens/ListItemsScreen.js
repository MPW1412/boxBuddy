import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Image, ScrollView, Platform } from 'react-native';
import axios from 'axios';
import colors from '../constants/colors';
import { Ionicons } from '@expo/vector-icons';

const API_URL = Platform.OS === 'web' 
  ? (typeof window !== 'undefined' && window.location.origin.includes('boxbuddy.walther.haus') 
      ? 'https://boxbuddy.walther.haus/api' 
      : 'http://localhost:5000')
  : 'http://localhost:5000';

export default function ListItemsScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [containers, setContainers] = useState({});

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const response = await axios.get(`${API_URL}/items`);
      setItems(response.data);
      
      // Build a map of container UUIDs to names for quick lookup
      const containerMap = {};
      response.data.forEach(item => {
        containerMap[item.uuid] = item.name;
      });
      setContainers(containerMap);
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Create Item', { item })}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{item.name}</Text>
        {item.nestable && (
          <View style={styles.nestableBadge}>
            <Ionicons name="archive" size={16} color={colors.primary} />
            <Text style={styles.nestableText}>Container</Text>
          </View>
        )}
      </View>
      <Text style={styles.subtitle}>Type: {item.type}</Text>
      <Text style={styles.subtitle}>Visibility: {item.visibility}</Text>
      {item.locationEntityUUID && containers[item.locationEntityUUID] && (
        <View style={styles.containerInfo}>
          <Ionicons name="folder-open" size={14} color={colors.primary} />
          <Text style={styles.containerText}>In: {containers[item.locationEntityUUID]}</Text>
        </View>
      )}
      <Text style={styles.subtitle}>Created: {new Date(item.creation_time).toLocaleDateString()}</Text>
      {item.images && item.images.length > 0 && (
        <ScrollView horizontal style={styles.imageScroll}>
          {item.images.map((img, index) => (
            <Image key={index} source={{ uri: `${API_URL}/images/${img.uuid}` }} style={styles.thumbnail} />
          ))}
        </ScrollView>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Your Items</Text>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.uuid}
        refreshing={false}
        onRefresh={fetchItems}
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
});

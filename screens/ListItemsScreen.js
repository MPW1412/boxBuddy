import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import axios from 'axios';
import colors from '../constants/colors';

const API_URL = 'http://localhost:5000';

export default function ListItemsScreen({ navigation }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const response = await axios.get(`${API_URL}/items`);
      setItems(response.data);
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Create Item', { item })}>
      <Text style={styles.title}>{item.name}</Text>
      <Text style={styles.subtitle}>Type: {item.type}</Text>
      <Text style={styles.subtitle}>Visibility: {item.visibility}</Text>
      <Text style={styles.subtitle}>Created: {new Date(item.creation_time).toLocaleDateString()}</Text>
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
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: colors.text,
    opacity: 0.7,
    marginBottom: 2,
  },
});

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, Alert, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import colors from '../constants/colors';

const API_URL = 'http://localhost:5000';

export default function CreateItemScreen({ route, navigation }) {
  const item = route.params?.item || {};
  const [name, setName] = useState(item.name || '');
  const [type, setType] = useState(item.type || 'ITEM');
  const [visibility, setVisibility] = useState(item.visibility || 'PRIVATE');
  const [description, setDescription] = useState(item.description || '');
  const [quantity, setQuantity] = useState(item.quantity?.toString() || '1');
  const [image, setImage] = useState(null);
  const [itemUuid, setItemUuid] = useState(item.uuid || null);

  const createItem = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    try {
      const data = { name: name.trim(), type, visibility };
      if (description.trim()) data.description = description.trim();
      if (quantity) data.quantity = parseInt(quantity);
      const response = await axios.post(`${API_URL}/items`, data);
      setItemUuid(response.data.uuid);
      Alert.alert('Success', 'Item created successfully!');
      // Reset form
      setName('');
      setDescription('');
      setQuantity('');
      setImage(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to create item: ' + error.message);
    }
  };

  const updateItem = async () => {
    if (!itemUuid) return;
    try {
      const data = { name: name.trim(), type, visibility };
      if (description.trim()) data.description = description.trim();
      if (quantity) data.quantity = parseInt(quantity);
      await axios.put(`${API_URL}/items/${itemUuid}`, data);
      Alert.alert('Success', 'Item updated successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to update item: ' + error.message);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled) {
        setImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Image picker not available on this platform');
    }
  };

  const uploadImage = async () => {
    if (!itemUuid || !image) return;

    const formData = new FormData();
    formData.append('file', {
      uri: image,
      type: 'image/jpeg',
      name: 'upload.jpg',
    });

    try {
      await axios.post(`${API_URL}/items/${itemUuid}/image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      Alert.alert('Success', 'Image uploaded successfully!');
      setImage(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to upload image: ' + error.message);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>{itemUuid ? 'Edit Item' : 'Create New Item'}</Text>
      <TextInput
        style={styles.input}
        placeholder="Name"
        value={name}
        onChangeText={setName}
        placeholderTextColor={colors.text}
      />
      <TextInput
        style={styles.input}
        placeholder="Type (ITEM, CONTAINER, LOCATION)"
        value={type}
        onChangeText={setType}
        placeholderTextColor={colors.text}
      />
      <TextInput
        style={styles.input}
        placeholder="Visibility (PRIVATE, SAME_INSTANCE, PUBLIC)"
        value={visibility}
        onChangeText={setVisibility}
        placeholderTextColor={colors.text}
      />
      <TextInput
        style={styles.input}
        placeholder="Description (optional)"
        value={description}
        onChangeText={setDescription}
        multiline
        placeholderTextColor={colors.text}
      />
      <View style={styles.quantityRow}>
        <TouchableOpacity style={styles.quantityButton} onPress={() => setQuantity(Math.max(0, parseInt(quantity || 0) - 1).toString())}>
          <Text style={styles.quantityButtonText}>-</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.quantityInput}
          value={quantity}
          onChangeText={(text) => {
            const num = parseInt(text);
            if (isNaN(num) || num < 0) setQuantity('0');
            else setQuantity(num.toString());
          }}
          keyboardType="numeric"
          placeholderTextColor={colors.text}
        />
        <TouchableOpacity style={styles.quantityButton} onPress={() => setQuantity((parseInt(quantity || 0) + 1).toString())}>
          <Text style={styles.quantityButtonText}>+</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.button} onPress={itemUuid ? updateItem : createItem}>
        <Text style={styles.buttonText}>{itemUuid ? 'Update Item' : 'Create Item'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={pickImage}>
        <Text style={styles.buttonText}>Pick Image</Text>
      </TouchableOpacity>
      {image && <Image source={{ uri: image }} style={styles.image} />}
      {image && itemUuid && (
        <TouchableOpacity style={styles.button} onPress={uploadImage}>
          <Text style={styles.buttonText}>Upload Image</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 8,
    marginBottom: 15,
    padding: 12,
    fontSize: 16,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonText: {
    color: colors.card,
    fontSize: 16,
    fontWeight: 'bold',
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginVertical: 10,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  quantityButton: {
    backgroundColor: '#14d91d',
    borderRadius: 8,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityInput: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderColor: '#ccc',
    borderWidth: 1,
    padding: 0,
    textAlign: 'center',
    fontSize: 20,
    color: '#000',
    fontWeight: 'bold',
    minWidth: 60,
    marginLeft: 4,
    marginRight: 4,
  },
  quantityButtonText: {
    fontSize: 30,
    fontWeight: 'bold',
    color: colors.card,
  },
});

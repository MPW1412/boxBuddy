import React, { useState } from 'react';
import { View, Text, TextInput, Button, Image, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';

const API_URL = 'http://localhost:5000'; // Update with actual backend URL

export default function CreateItemScreen() {
  const [name, setName] = useState('');
  const [type, setType] = useState('ITEM');
  const [visibility, setVisibility] = useState('PRIVATE');
  const [image, setImage] = useState(null);
  const [itemUuid, setItemUuid] = useState(null);

  const createItem = async () => {
    try {
      const response = await axios.post(`${API_URL}/items`, { name, type, visibility });
      setItemUuid(response.data.uuid);
      alert('Item created successfully!');
    } catch (error) {
      alert('Error creating item: ' + error.message);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
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
      alert('Image uploaded successfully!');
    } catch (error) {
      alert('Error uploading image: ' + error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text>Create New Item</Text>
      <TextInput
        style={styles.input}
        placeholder="Name"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={styles.input}
        placeholder="Type (ITEM, CONTAINER, LOCATION)"
        value={type}
        onChangeText={setType}
      />
      <TextInput
        style={styles.input}
        placeholder="Visibility (PRIVATE, SAME_INSTANCE, PUBLIC)"
        value={visibility}
        onChangeText={setVisibility}
      />
      <Button title="Create Item" onPress={createItem} />
      <Button title="Pick Image" onPress={pickImage} />
      {image && <Image source={{ uri: image }} style={styles.image} />}
      <Button title="Upload Image" onPress={uploadImage} disabled={!itemUuid || !image} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  input: { borderWidth: 1, marginBottom: 10, padding: 8 },
  image: { width: 200, height: 200, marginVertical: 10 },
});

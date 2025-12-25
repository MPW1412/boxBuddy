import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';

export default function Sidebar({ navigation }) {
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
  text: {
    marginLeft: 10,
    fontSize: 16,
    color: colors.text,
  },
});
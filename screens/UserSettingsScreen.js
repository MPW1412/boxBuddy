import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import colors from '../constants/colors';

export default function UserSettingsScreen({ navigation }) {
  const { user, logout, updateUser, createEntity } = useAuth();
  
  const [email, setEmail] = useState(user?.email || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [language, setLanguage] = useState(user?.preferred_language || 'en');
  const [newEntityName, setNewEntityName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleUpdateProfile = async () => {
    setError('');
    
    if (newPassword && newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    setLoading(true);
    
    try {
      const updates = {
        email,
        preferred_language: language
      };
      
      if (newPassword) {
        updates.password = newPassword;
      }
      
      await updateUser(updates);
      
      Alert.alert('Success', 'Profile updated successfully!');
      
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.response?.data?.description || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEntity = async () => {
    if (!newEntityName.trim()) {
      setError('Entity name is required');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      await createEntity(newEntityName);
      
      Alert.alert('Success', 'Entity created successfully!');
      
      setNewEntityName('');
    } catch (err) {
      setError(err.response?.data?.description || 'Failed to create entity');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    const confirmLogout = () => {
      logout();
      // Navigation will happen automatically when user state changes
    };
    
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', onPress: confirmLogout, style: 'destructive' }
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>User Settings</Text>
        <View style={{ width: 24 }} />
      </View>
      
      {error ? <Text style={styles.error}>{error}</Text> : null}
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile</Text>
        
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        
        <Text style={styles.label}>New Password (leave empty to keep current)</Text>
        <TextInput
          style={styles.input}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          placeholder="Enter new password"
        />
        
        <Text style={styles.label}>Confirm New Password</Text>
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          placeholder="Confirm new password"
        />
        
        <Text style={styles.label}>Preferred Language</Text>
        <View style={styles.languageContainer}>
          <TouchableOpacity
            style={[styles.languageButton, language === 'en' && styles.languageButtonActive]}
            onPress={() => setLanguage('en')}
          >
            <Text style={[styles.languageText, language === 'en' && styles.languageTextActive]}>
              English
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.languageButton, language === 'de' && styles.languageButtonActive]}
            onPress={() => setLanguage('de')}
          >
            <Text style={[styles.languageText, language === 'de' && styles.languageTextActive]}>
              Deutsch
            </Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity
          style={styles.button}
          onPress={handleUpdateProfile}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.card} />
          ) : (
            <Text style={styles.buttonText}>Update Profile</Text>
          )}
        </TouchableOpacity>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Entities</Text>
        
        {user?.entities?.map((entity) => (
          <View key={entity.uuid} style={styles.entityItem}>
            <Ionicons name="business-outline" size={20} color={colors.text} />
            <Text style={styles.entityName}>{entity.name}</Text>
          </View>
        ))}
        
        <Text style={styles.label}>Create New Entity</Text>
        <TextInput
          style={styles.input}
          value={newEntityName}
          onChangeText={setNewEntityName}
          placeholder="Entity name"
        />
        
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleCreateEntity}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>Create Entity</Text>
          )}
        </TouchableOpacity>
      </View>
      
      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.button, styles.logoutButton]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.card} />
          <Text style={[styles.buttonText, { marginLeft: 8 }]}>Logout</Text>
        </TouchableOpacity>
      </View>
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  section: {
    backgroundColor: colors.card,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    color: colors.text,
  },
  languageContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  languageButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  languageButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  languageText: {
    fontSize: 16,
    color: colors.text,
  },
  languageTextActive: {
    color: colors.card,
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonText: {
    color: colors.card,
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  secondaryButtonText: {
    color: colors.primary,
  },
  logoutButton: {
    backgroundColor: colors.error,
  },
  entityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.background,
    borderRadius: 8,
    marginBottom: 8,
    gap: 12,
  },
  entityName: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  error: {
    color: colors.error,
    marginHorizontal: 16,
    marginTop: 8,
    textAlign: 'center',
  },
});

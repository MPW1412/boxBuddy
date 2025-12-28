import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import ConfirmDialog from '../components/ConfirmDialog';
import Toast from '../components/Toast';
import colors from '../constants/colors';
import { Html5Qrcode } from 'html5-qrcode';
import axios from 'axios';

const API_URL = Platform.OS === 'web'
  ? (typeof window !== 'undefined' && window.location.origin.includes('boxbuddy.walther.haus')
      ? 'https://boxbuddy.walther.haus/api'
      : 'http://localhost:5000')
  : 'http://localhost:5000';



export default function UserSettingsScreen({ navigation }) {
  const { user, logout, updateUser, createEntity } = useAuth();

  // Initialize cameras on web
  useEffect(() => {
    if (Platform.OS === 'web') {
      initCameras();
    }
    return () => {
      if (previewScanner) {
        previewScanner.stop().catch(() => {});
      }
    };
  }, []);
  
  const showToast = (message, type = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };
  
  const [email, setEmail] = useState(user?.email || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [language, setLanguage] = useState(user?.preferred_language || 'en');
  const [newEntityName, setNewEntityName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');

  // Camera settings
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');

  // Initialize cameras on web
  useEffect(() => {
    if (Platform.OS === 'web') {
      initCameras();
    }
  }, []);

  const initCameras = async () => {
    try {
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        setCameras(devices);
        // Load saved camera preference, preferring back-facing cameras
        const savedCameraId = localStorage.getItem('qrScannerLastCameraId');
        let selectedId = savedCameraId;
        if (!savedCameraId || !devices.find(d => d.id === savedCameraId)) {
          // Prefer back-facing camera
          const backCamera = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment'));
          selectedId = backCamera ? backCamera.id : devices[0].id;
        }
        setSelectedCameraId(selectedId);
      }
    } catch (error) {
      console.error('Failed to initialize cameras:', error);
    }
  };

  const handleCameraChange = (cameraId) => {
    setSelectedCameraId(cameraId);
    localStorage.setItem('qrScannerLastCameraId', cameraId);
    showToast('Camera preference saved!', 'success');
  };



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
      
      showToast('Profile updated successfully!', 'success');
      
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
      
      showToast('Entity created successfully!', 'success');
      
      setNewEntityName('');
    } catch (err) {
      setError(err.response?.data?.description || 'Failed to create entity');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    logout();
    // Navigation will happen automatically when user state changes
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

       {Platform.OS === 'web' && (
         <View style={styles.section}>
           <Text style={styles.sectionTitle}>QR Scanner Camera</Text>

           <Text style={styles.label}>Default Camera</Text>
           <View style={styles.dropdown}>
             {cameras.map((camera) => (
               <TouchableOpacity
                 key={camera.id}
                 style={[
                   styles.dropdownItem,
                   selectedCameraId === camera.id && styles.dropdownItemActive
                 ]}
                 onPress={() => handleCameraChange(camera.id)}
               >
                 <Text style={[
                   styles.dropdownText,
                   selectedCameraId === camera.id && styles.dropdownTextActive
                 ]}>
                   {camera.label}
                 </Text>
               </TouchableOpacity>
             ))}
           </View>


         </View>
       )}



       <View style={styles.section}>
         <TouchableOpacity
           style={[styles.button, styles.logoutButton]}
           onPress={handleLogout}
         >
           <Ionicons name="log-out-outline" size={20} color={colors.card} />
           <Text style={[styles.buttonText, { marginLeft: 8 }]}>Logout</Text>
         </TouchableOpacity>
       </View>

      <ConfirmDialog
        visible={showLogoutConfirm}
        title="Logout"
        message="Are you sure you want to logout?"
        confirmText="Logout"
        onConfirm={confirmLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
      
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
  dropdown: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    marginBottom: 16,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownItemActive: {
    backgroundColor: colors.primaryLight,
  },
  dropdownText: {
    fontSize: 16,
    color: colors.text,
  },
  dropdownTextActive: {
    color: colors.primary,
    fontWeight: 'bold',
  },


  error: {
    color: colors.error,
    marginHorizontal: 16,
    marginTop: 8,
    textAlign: 'center',
  },
});

import React, { useRef, useState, useEffect } from 'react';
import { View, ActivityIndicator, Platform, Animated } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import CreateItemScreen from './screens/CreateItemScreen';
import ListItemsScreen from './screens/ListItemsScreen';
import ItemDetailScreen from './screens/ItemDetailScreen';
import BinScreen from './screens/BinScreen';
import LoginScreen from './screens/LoginScreen';
import UserSettingsScreen from './screens/UserSettingsScreen';
import PrintQueueScreen from './screens/PrintQueueScreen';
import Sidebar from './components/Sidebar';
import QRScannerOverlay from './components/QRScannerOverlay';
import GalleryPanel from './components/GalleryPanel';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import colors from './constants/colors';
import axios from 'axios';

const API_URL = Platform.OS === 'web' 
  ? (typeof window !== 'undefined' && window.location.origin.includes('boxbuddy.walther.haus') 
      ? 'https://boxbuddy.walther.haus/api' 
      : 'http://localhost:5000')
  : 'http://localhost:5000';

const Stack = createStackNavigator();

const linking = {
  prefixes: ['https://boxbuddy.walther.haus', 'http://localhost:8081'],
  config: {
    screens: {
      'Login': 'login',
      'List Items': 'items',
      'Create Item': 'create',
      'Edit Item': {
        path: 'item/:uuid/edit',
        parse: {
          uuid: (uuid) => uuid,
        },
      },
      'Item Detail': {
        path: 'item/:uuid',
        parse: {
          uuid: (uuid) => uuid,
        },
      },
      'Bin': 'bin',
      'User Settings': 'settings',
      'Print Queue': 'print-queue',
    },
  },
};

function AppNavigator() {
  const navigationRef = useRef();
  const listItemsRef = useRef();
  const [navigation, setNavigation] = useState(null);
  const [pinnedContainers, setPinnedContainers] = useState([]);
  const [scannerEnabled, setScannerEnabled] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const galleryPanelRef = useRef();
  const { user, loading } = useAuth();

  // Load pinned containers when user logs in
  useEffect(() => {
    if (user) {
      loadPinnedContainers();
    } else {
      setPinnedContainers([]);
    }
  }, [user]);

  const loadPinnedContainers = async () => {
    try {
      const response = await axios.get(`${API_URL}/auth/pinned-containers`);
      // Extract containers from the response (which includes pin_order and container data)
      const containers = response.data.map(pin => pin.container);
      setPinnedContainers(containers);
    } catch (error) {
      console.error('Failed to load pinned containers:', error);
    }
  };

  const addPinnedContainer = async (container) => {
    if (pinnedContainers.find(c => c.uuid === container.uuid)) {
      return; // Already pinned
    }
    
    try {
      await axios.post(`${API_URL}/auth/pinned-containers`, {
        container_uuid: container.uuid
      });
      // Only update local state if API call succeeded
      setPinnedContainers([...pinnedContainers, container]);
    } catch (error) {
      console.error('Failed to pin container:', error);
      // Don't update local state on failure
      alert('Failed to pin container: ' + (error.response?.data?.message || error.message));
    }
  };

  const removePinnedContainer = async (uuid) => {
    try {
      await axios.delete(`${API_URL}/auth/pinned-containers/${uuid}`);
      setPinnedContainers(pinnedContainers.filter(c => c.uuid !== uuid));
    } catch (error) {
      console.error('Failed to unpin container:', error);
    }
  };

  const handleItemMoved = () => {
    // Trigger refresh in ListItemsScreen when an item is moved
    if (listItemsRef.current?.refresh) {
      listItemsRef.current.refresh();
    }
  };

  const toggleScanner = () => {
    setScannerEnabled(!scannerEnabled);
  };

  const toggleGallery = () => {
    setGalleryOpen(!galleryOpen);
  };

  const handleGalleryUpdate = () => {
    // Refresh gallery panel when new photo is added
    if (galleryPanelRef.current?.fetchGalleryImages) {
      galleryPanelRef.current.fetchGalleryImages();
    }
    
    // Dispatch event for Power Mode to auto-attach photo
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('refreshGallery'));
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <NavigationContainer 
        ref={(ref) => { navigationRef.current = ref; setNavigation(ref); }}
        linking={linking}
      >
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer 
      ref={(ref) => { navigationRef.current = ref; setNavigation(ref); }}
      linking={linking}
    >
      <View style={{ flex: 1 }}>
        {/* Gallery Panel - positioned fixed, outside flex layout */}
        {galleryOpen && Platform.OS === 'web' && (
          <GalleryPanel 
            visible={galleryOpen}
            onClose={toggleGallery}
            scannerEnabled={scannerEnabled}
            ref={galleryPanelRef}
          />
        )}
        
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <Sidebar 
            navigation={navigation} 
            pinnedContainers={pinnedContainers}
            onRemovePinned={removePinnedContainer}
            onPinContainer={addPinnedContainer}
            onItemMoved={handleItemMoved}
            onToggleScanner={toggleScanner}
            scannerEnabled={scannerEnabled}
            onToggleGallery={toggleGallery}
            galleryOpen={galleryOpen}
          />
          
          <View style={Platform.OS === 'web' ? {
            flex: 1,
            height: scannerEnabled ? 'calc(100vh - 33.33vh)' : '100vh',
            marginLeft: galleryOpen ? 80 : 0,
            transition: 'margin-left 0.15s ease-out, height 0.2s ease',
            overflow: 'auto',
          } : { flex: 1 }}>
            <Stack.Navigator initialRouteName="List Items" screenOptions={{ headerShown: false }}>
              <Stack.Screen name="Create Item" component={CreateItemScreen} />
              <Stack.Screen name="Edit Item" component={CreateItemScreen} />
              <Stack.Screen name="List Items">
                {(props) => <ListItemsScreen {...props} ref={listItemsRef} onPinContainer={addPinnedContainer} />}
              </Stack.Screen>
              <Stack.Screen name="Item Detail" component={ItemDetailScreen} />
              <Stack.Screen name="Bin" component={BinScreen} />
              <Stack.Screen name="User Settings" component={UserSettingsScreen} />
              <Stack.Screen name="Print Queue" component={PrintQueueScreen} />
            </Stack.Navigator>
          </View>
        </View>
        
        {/* QR Scanner - fixed at bottom, full width from sidebar */}
        {scannerEnabled && Platform.OS === 'web' && (
          <QRScannerOverlay 
            navigation={navigation} 
            onClose={toggleScanner}
            onGalleryUpdate={handleGalleryUpdate}
          />
        )}
      </View>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}
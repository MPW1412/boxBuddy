import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Html5Qrcode } from 'html5-qrcode';
import colors from '../constants/colors';
import axios from 'axios';

const API_URL = Platform.OS === 'web' 
  ? (typeof window !== 'undefined' && window.location.origin.includes('boxbuddy.walther.haus') 
      ? 'https://boxbuddy.walther.haus/api' 
      : 'http://localhost:5000')
  : 'http://localhost:5000';

export default function QRScannerOverlay({ navigation, onClose, onGalleryUpdate }) {
  const [mode, setMode] = useState('view'); // 'view', 'place-in', or 'photo'
  const [cameras, setCameras] = useState([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [lastScanTime, setLastScanTime] = useState(Date.now());
  const [scanFlash, setScanFlash] = useState(false);
  
  // Place-in mode state
  const [scannedItem, setScannedItem] = useState(null);

  const html5QrCodeRef = useRef(null);
  const scannerIdRef = useRef('qr-scanner-' + Date.now());
  const inactivityTimerRef = useRef(null);
  const audioContextRef = useRef(null);
  const cooldownCodesRef = useRef(new Map()); // Track codes with cooldown
  const modeRef = useRef('view'); // Track current mode for callbacks
  const scannedItemRef = useRef(null); // Track scanned item for callbacks

  // Initialize scanner
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const initScanner = async () => {
      try {
        // Get available cameras
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setCameras(devices);
          
          // Initialize scanner
          const scanner = new Html5Qrcode(scannerIdRef.current);
          html5QrCodeRef.current = scanner;

          // Try to restore last used camera from localStorage
          let cameraIndexToUse = 0;
          const savedCameraId = localStorage.getItem('qrScannerLastCameraId');
          
          if (savedCameraId) {
            const savedIndex = devices.findIndex(d => d.id === savedCameraId);
            if (savedIndex !== -1) {
              cameraIndexToUse = savedIndex;
              console.log('Restored last used camera:', devices[savedIndex].label);
            }
          }
          
          setCurrentCameraIndex(cameraIndexToUse);
          await startScanning(scanner, devices[cameraIndexToUse].id);
          setScanning(true);
        }
      } catch (error) {
        console.error('Failed to initialize scanner:', error);
      }
    };

    initScanner();

    // Cleanup
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(err => console.error('Error stopping scanner:', err));
      }
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, []);

  // Inactivity timeout (90 seconds)
  useEffect(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    inactivityTimerRef.current = setTimeout(() => {
      console.log('Scanner timeout - no QR code detected for 90 seconds');
      // Could show a message or auto-disable scanner here
    }, 90000);

    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [lastScanTime]);

  const startScanning = async (scanner, cameraId) => {
    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0
    };

    try {
       await scanner.start(
         cameraId,
         config,
         onScanSuccess,
         onScanError
       );
    } catch (error) {
      console.error('Failed to start scanning:', error);
    }
  };

  const onScanSuccess = async (decodedText, decodedResult) => {
    console.log('=== QR SCAN SUCCESS ===');
    console.log('Scanned text:', decodedText);
    console.log('Current mode (state):', mode);
    console.log('Current mode (ref):', modeRef.current);
    
    // Check if this code is on cooldown
    const now = Date.now();
    const cooldownUntil = cooldownCodesRef.current.get(decodedText);
    
    if (cooldownUntil && now < cooldownUntil) {
      // Code is on cooldown - silently ignore
      console.log('⏱️ Code on cooldown, ignoring. Cooldown until:', new Date(cooldownUntil));
      return;
    }
    
    setLastScanTime(now);
    
    // Add 5-second cooldown for this code
    cooldownCodesRef.current.set(decodedText, now + 5000);
    console.log('✓ Added 5-second cooldown for this code');
    
    // Clean up old cooldowns (older than 10 seconds)
    for (const [code, expiry] of cooldownCodesRef.current.entries()) {
      if (now > expiry + 5000) {
        cooldownCodesRef.current.delete(code);
      }
    }
    
    // Visual and audio feedback
    triggerScanFeedback();

    // Process scanned code based on mode (use ref for current value)
    const currentMode = modeRef.current;
    console.log('Processing in mode:', currentMode);
    if (currentMode === 'view') {
      await handleViewMode(decodedText);
    } else {
      await handlePlaceInMode(decodedText);
    }
    console.log('=== END QR SCAN ===');
  };

  const onScanError = (error) => {
    // Silent - scanning errors are normal when no QR in view
  };

  const triggerScanFeedback = () => {
    // Visual flash
    setScanFlash(true);
    setTimeout(() => setScanFlash(false), 200);

    // Beep sound
    playBeep();
  };

  const playBeep = () => {
    if (Platform.OS !== 'web') return;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }

      const context = audioContextRef.current;
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.1);

      oscillator.start(context.currentTime);
      oscillator.stop(context.currentTime + 0.1);
    } catch (error) {
      console.error('Failed to play beep:', error);
    }
  };

  const playPlacementSound = () => {
    if (Platform.OS !== 'web') return;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }

      const context = audioContextRef.current;
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      // Create a descending tone that sounds like dropping/placing
      oscillator.frequency.setValueAtTime(600, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(200, context.currentTime + 0.15);
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.4, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.15);

      oscillator.start(context.currentTime);
      oscillator.stop(context.currentTime + 0.15);
    } catch (error) {
      console.error('Failed to play placement sound:', error);
    }
  };

  const handleViewMode = async (qrCode) => {
    try {
      // Extract UUID from QR code (format: c0h.de/{uuid}?c={imhCode})
      const uuid = extractUuidFromQr(qrCode);
      
      console.log('View mode - QR code:', qrCode, 'Extracted UUID:', uuid);
      
      if (uuid) {
        // First check if item exists in database
        try {
          const response = await axios.get(`${API_URL}/items/${uuid}`);
          console.log('Item found:', response.data);
          
          // Navigate to item details
          navigation.navigate('Item Detail', { uuid });
        } catch (error) {
          if (error.response && error.response.status === 404) {
            console.log('Item not found (404), navigating to Create Item with UUID:', uuid);
            // Item doesn't exist - navigate to Create Item with the UUID pre-filled
            navigation.navigate('Create Item', { uuid: uuid });
          } else {
            console.error('Error fetching item:', error);
          }
        }
      } else {
        console.log('Invalid QR code format, ignoring');
      }
    } catch (error) {
      console.error('Error in view mode:', error);
    }
  };

  const handlePlaceInMode = async (qrCode) => {
    console.log('🔵 handlePlaceInMode CALLED');
    console.log('🔵 QR Code:', qrCode);
    console.log('🔵 Current scannedItem (state):', scannedItem ? `${scannedItem.name} (${scannedItem.uuid})` : 'null');
    console.log('🔵 Current scannedItem (ref):', scannedItemRef.current ? `${scannedItemRef.current.name} (${scannedItemRef.current.uuid})` : 'null');
    
    try {
      const uuid = extractUuidFromQr(qrCode);
      console.log('🔵 Extracted UUID:', uuid);
      
      if (!uuid) {
        console.log('❌ Place-In: Invalid QR code format, ignoring');
        return;
      }
      
      // Fetch the scanned item details
      console.log('🔵 Fetching item from API:', `${API_URL}/items/${uuid}`);
      const response = await axios.get(`${API_URL}/items/${uuid}`);
      const scannedData = response.data;
      console.log('✅ Place-In: Fetched item data:', scannedData);
      
      // Use ref for current value
      const currentItem = scannedItemRef.current;
      
      if (!currentItem) {
        // First scan - store this item
        console.log('🟢 FIRST SCAN - Selecting item:', scannedData.name, '(UUID:', scannedData.uuid, ')');
        setScannedItem(scannedData);
        scannedItemRef.current = scannedData; // Update ref immediately
      } else {
        console.log('🟡 SECOND SCAN - Current item:', currentItem.name, '-> Newly scanned:', scannedData.name);
        console.log('🟡 Is newly scanned item nestable?', scannedData.nestable);
        
        // We have an item already - determine action based on whether 
        // the newly scanned item is a container
        if (scannedData.nestable) {
          // Scanned item is a container - place current item into it
          console.log('🚀 PLACING ITEM IN CONTAINER');
          console.log('   Item:', currentItem.name, '(', currentItem.uuid, ')');
          console.log('   Container:', scannedData.name, '(', scannedData.uuid, ')');
          console.log('   API URL:', `${API_URL}/items/${currentItem.uuid}/store/${scannedData.uuid}`);
          
          const updateResponse = await axios.post(`${API_URL}/items/${currentItem.uuid}/store/${scannedData.uuid}`);
          console.log('✅ Place-In: API SUCCESS! Response:', updateResponse.data);
          
          // Play placement success sound
          playPlacementSound();
          
          // Navigate to container detail view so user can verify the placement
          console.log('📱 Navigating to container detail view:', scannedData.uuid);
          navigation.navigate('Item Detail', { uuid: scannedData.uuid });
          
          // Now the container becomes the new current item
          // (so we can chain: place container into another container)
          setScannedItem(scannedData);
          scannedItemRef.current = scannedData; // Update ref immediately
          console.log('🔄 Container', scannedData.name, 'is now the active item for next placement');
        } else {
          // Scanned item is NOT a container - replace current item
          console.log('🔄 Not a container, replacing', currentItem.name, 'with', scannedData.name);
          setScannedItem(scannedData);
          scannedItemRef.current = scannedData; // Update ref immediately
        }
      }
    } catch (error) {
      if (error.response && error.response.status === 404) {
        // Item doesn't exist - just ignore this scan
        console.log('❌ Place-In: Item not found in database (404), ignoring');
      } else {
        console.error('❌❌❌ Place-In: Error occurred:', error);
        console.error('Error response:', error.response?.data);
        console.error('Error status:', error.response?.status);
        console.error('Error message:', error.message);
        // Reset on error
        setScannedItem(null);
        scannedItemRef.current = null; // Update ref immediately
      }
    }
  };

  const extractUuidFromQr = (qrCode) => {
    // Format: c0h.de/{uuid}?c={imhCode}
    // Or just the raw UUID
    const match = qrCode.match(/c0h\.de\/([a-f0-9-]+)/i);
    if (match) {
      return match[1];
    }
    
    // Check if it's a valid UUID format
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidPattern.test(qrCode)) {
      return qrCode;
    }
    
    return null;
  };



  const capturePhotoFromScanner = async () => {
    if (Platform.OS !== 'web') return;
    
    // Get the video element from html5-qrcode
    const scannerElement = document.getElementById(scannerIdRef.current);
    if (!scannerElement) {
      console.error('Scanner element not found');
      return;
    }
    
    const videoElement = scannerElement.querySelector('video');
    if (!videoElement) {
      console.error('Video element not found in scanner');
      return;
    }
    
    // Create canvas from current video frame
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0);
    
    // Convert to dataURL
    const dataURL = canvas.toDataURL('image/jpeg', 0.9);
    
    // Upload to gallery
    try {
      await axios.post(`${API_URL}/gallery/image`, {
        image: dataURL,
        camera_mode: 'qr-scan'
      }, {
        withCredentials: true
      });
      
      // Visual feedback
      triggerScanFeedback();
      
      // Notify gallery panel to refresh
      if (onGalleryUpdate) {
        onGalleryUpdate();
      }
      
      console.log('✓ Photo captured and uploaded to gallery');
    } catch (error) {
      console.error('Failed to upload gallery image:', error);
    }
  };

  const handleModeSwitch = (newMode) => {
    console.log('🔄 MODE SWITCH:', newMode);
    
    setMode(newMode);
    modeRef.current = newMode; // Update ref immediately for callbacks
    
    // Clear all cooldowns when switching to place-in mode
    if (newMode === 'place-in') {
      cooldownCodesRef.current.clear();
      console.log('✓ Cleared all QR code cooldowns');
      console.log('✓ Switched to Place-In mode, scannedItem:', scannedItem);
    }
    
    // Reset place-in mode state when switching to view mode
    if (newMode === 'view') {
      setScannedItem(null);
      scannedItemRef.current = null; // Update ref immediately
      console.log('✓ Reset scannedItem to null (switched to view mode)');
    }
  };

  return (
    <View style={[styles.container, scanFlash && styles.flashOverlay]}>
      {/* Scanner viewport */}
      <View style={styles.scannerBox}>
        <div id={scannerIdRef.current} style={{ width: '100%' }} />
      </View>



      {/* Mode selector */}
      <View style={styles.modeSelector}>
        <TouchableOpacity 
          style={[styles.modeButton, mode === 'view' && styles.modeButtonActive]}
          onPress={() => {
            console.log('🔘 VIEW BUTTON CLICKED');
            handleModeSwitch('view');
          }}
        >
          <Ionicons name="eye-outline" size={20} color={mode === 'view' ? colors.primary : colors.textSecondary} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.modeButton, mode === 'place-in' && styles.modeButtonActive]}
          onPress={() => {
            console.log('🔘 PLACE-IN BUTTON CLICKED');
            handleModeSwitch('place-in');
          }}
        >
          <Ionicons name="archive-outline" size={20} color={mode === 'place-in' ? colors.primary : colors.textSecondary} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.modeButton}
          onPress={() => {
            console.log('📷 PHOTO CAPTURE BUTTON CLICKED');
            capturePhotoFromScanner();
          }}
        >
          <Ionicons name="camera-outline" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'fixed',
    bottom: 0,
    right: 0,
    height: '33.33vh',
    minWidth: 300,
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary,
    boxShadow: '0px -2px 8px rgba(0,0,0,0.25)',
    elevation: 10,
    zIndex: 100,
    overflow: 'hidden',
  },
  flashOverlay: {
    borderColor: colors.success,
    borderWidth: 4,
  },
  scannerBox: {
    flex: 1,
    backgroundColor: '#000',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 8,
    backgroundColor: colors.primary,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 6,
  },
  controlText: {
    color: colors.card,
    fontSize: 12,
    fontWeight: '600',
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: colors.background,
  },
  modeButton: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  modeButtonActive: {
    borderBottomColor: colors.primary,
    backgroundColor: colors.surface,
  },
  modeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modeTextActive: {
    color: colors.primary,
  },
});

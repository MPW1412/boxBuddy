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

export default function QRScannerOverlay({ navigation, onClose }) {
  const [mode, setMode] = useState('view'); // 'view' or 'place-in'
  const [cameras, setCameras] = useState([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [lastScanTime, setLastScanTime] = useState(Date.now());
  const [scanFlash, setScanFlash] = useState(false);
  
  // Place-in mode state
  const [waitingForContainer, setWaitingForContainer] = useState(false);
  const [scannedItem, setScannedItem] = useState(null);

  const html5QrCodeRef = useRef(null);
  const scannerIdRef = useRef('qr-scanner-' + Date.now());
  const inactivityTimerRef = useRef(null);
  const audioContextRef = useRef(null);

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

          // Start scanning with first camera
          await startScanning(scanner, devices[0].id);
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

      // Apply flash if it was on
      if (isFlashOn) {
        applyFlash(scanner, true);
      }
    } catch (error) {
      console.error('Failed to start scanning:', error);
    }
  };

  const onScanSuccess = async (decodedText, decodedResult) => {
    setLastScanTime(Date.now());
    
    // Visual and audio feedback
    triggerScanFeedback();

    // Process scanned code based on mode
    if (mode === 'view') {
      await handleViewMode(decodedText);
    } else {
      await handlePlaceInMode(decodedText);
    }
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

  const handleViewMode = async (qrCode) => {
    try {
      // Extract UUID from QR code (format: c0h.de/{uuid}?c={imhCode})
      const uuid = extractUuidFromQr(qrCode);
      
      if (uuid) {
        // Navigate to item details
        navigation.navigate('ItemDetails', { uuid });
      } else {
        // If not our QR format, try creating new item with this UUID
        navigation.navigate('CreateItem', { uuid: qrCode });
      }
    } catch (error) {
      console.error('Error in view mode:', error);
    }
  };

  const handlePlaceInMode = async (qrCode) => {
    try {
      const uuid = extractUuidFromQr(qrCode);
      
      if (!waitingForContainer) {
        // First scan - this is the item
        const response = await axios.get(`${API_URL}/items/${uuid}`);
        setScannedItem(response.data);
        setWaitingForContainer(true);
      } else {
        // Second scan - this is the container
        const containerUuid = uuid;
        
        // Move item to container
        await axios.put(`${API_URL}/items/${scannedItem.uuid}`, {
          locationEntityUUID: containerUuid
        });

        // Reset for next item-container pair
        setScannedItem(null);
        setWaitingForContainer(false);

        // Could show success feedback here
      }
    } catch (error) {
      console.error('Error in place-in mode:', error);
      // Reset on error
      setScannedItem(null);
      setWaitingForContainer(false);
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

  const handleCameraSwitch = async () => {
    if (cameras.length <= 1 || !html5QrCodeRef.current) return;

    const nextIndex = (currentCameraIndex + 1) % cameras.length;
    
    try {
      await html5QrCodeRef.current.stop();
      await startScanning(html5QrCodeRef.current, cameras[nextIndex].id);
      setCurrentCameraIndex(nextIndex);
    } catch (error) {
      console.error('Failed to switch camera:', error);
    }
  };

  const toggleFlash = async () => {
    if (!html5QrCodeRef.current) return;

    const newFlashState = !isFlashOn;
    setIsFlashOn(newFlashState);
    applyFlash(html5QrCodeRef.current, newFlashState);
  };

  const applyFlash = async (scanner, enabled) => {
    try {
      const track = scanner.getRunningTrackCameraCapabilities();
      if (track && track.torch) {
        await track.applyConstraints({
          advanced: [{ torch: enabled }]
        });
      }
    } catch (error) {
      console.error('Flash not supported or failed:', error);
    }
  };

  const handleModeSwitch = (newMode) => {
    setMode(newMode);
    // Reset place-in mode state when switching modes
    if (newMode === 'view') {
      setScannedItem(null);
      setWaitingForContainer(false);
    }
  };

  return (
    <View style={[styles.container, scanFlash && styles.flashOverlay]}>
      {/* Scanner viewport */}
      <View style={styles.scannerBox}>
        <div id={scannerIdRef.current} style={{ width: '100%' }} />
      </View>

      {/* Camera controls */}
      <View style={styles.controls}>
        {cameras.length > 1 && (
          <TouchableOpacity style={styles.controlButton} onPress={handleCameraSwitch}>
            <Ionicons name="camera-reverse-outline" size={20} color={colors.card} />
            <Text style={styles.controlText}>Switch</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity style={styles.controlButton} onPress={toggleFlash}>
          <Ionicons 
            name={isFlashOn ? "flash" : "flash-outline"} 
            size={20} 
            color={isFlashOn ? colors.warning : colors.card} 
          />
          <Text style={styles.controlText}>Flash</Text>
        </TouchableOpacity>
      </View>

      {/* Mode selector */}
      <View style={styles.modeSelector}>
        <TouchableOpacity 
          style={[styles.modeButton, mode === 'view' && styles.modeButtonActive]}
          onPress={() => handleModeSwitch('view')}
        >
          <Text style={[styles.modeText, mode === 'view' && styles.modeTextActive]}>
            View Item
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.modeButton, mode === 'place-in' && styles.modeButtonActive]}
          onPress={() => handleModeSwitch('place-in')}
        >
          <Text style={[styles.modeText, mode === 'place-in' && styles.modeTextActive]}>
            Place-In
          </Text>
        </TouchableOpacity>
      </View>

      {/* Status indicator for place-in mode */}
      {mode === 'place-in' && (
        <View style={styles.statusBar}>
          {waitingForContainer ? (
            <Text style={styles.statusText}>
              📦 {scannedItem?.name || 'Item'} → Scan container
            </Text>
          ) : (
            <Text style={styles.statusText}>
              📱 Scan item first
            </Text>
          )}
        </View>
      )}
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 9999,
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
  statusBar: {
    padding: 8,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
  },
});

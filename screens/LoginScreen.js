import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import colors from '../constants/colors';

export default function LoginScreen({ navigation }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { login, register } = useAuth();

  const handleSubmit = async () => {
    setError('');
    
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    
    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    setLoading(true);
    
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password);
      }
      // Navigation will happen automatically when user state changes
    } catch (err) {
      setError(err.response?.data?.description || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.formContainer}>
        <Text style={styles.title}>BoxBuddy</Text>
        <Text style={styles.subtitle}>
          {isLogin ? 'Sign in to your account' : 'Create a new account'}
        </Text>
        
        {error ? <Text style={styles.error}>{error}</Text> : null}
        
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={isLogin ? "password" : "new-password"}
        />
        
        {!isLogin && (
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoComplete="new-password"
          />
        )}
        
        <TouchableOpacity
          style={styles.button}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.card} />
          ) : (
            <Text style={styles.buttonText}>
              {isLogin ? 'Sign In' : 'Sign Up'}
            </Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={() => {
            setIsLogin(!isLogin);
            setError('');
          }}
          style={styles.switchButton}
        >
          <Text style={styles.switchText}>
            {isLogin
              ? "Don't have an account? Sign Up"
              : 'Already have an account? Sign In'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formContainer: {
    width: '90%',
    maxWidth: 400,
    padding: 20,
    backgroundColor: colors.card,
    borderRadius: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
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
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: {
    color: colors.card,
    fontSize: 16,
    fontWeight: 'bold',
  },
  switchButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  switchText: {
    color: colors.primary,
    fontSize: 14,
  },
  error: {
    color: colors.error,
    marginBottom: 12,
    textAlign: 'center',
  },
});

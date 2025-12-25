import React, { useRef, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import CreateItemScreen from './screens/CreateItemScreen';
import ListItemsScreen from './screens/ListItemsScreen';
import ItemDetailScreen from './screens/ItemDetailScreen';
import BinScreen from './screens/BinScreen';
import LoginScreen from './screens/LoginScreen';
import UserSettingsScreen from './screens/UserSettingsScreen';
import Sidebar from './components/Sidebar';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import colors from './constants/colors';

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
    },
  },
};

function AppNavigator() {
  const navigationRef = useRef();
  const [navigation, setNavigation] = useState(null);
  const [pinnedContainers, setPinnedContainers] = useState([]);
  const { user, loading } = useAuth();

  const addPinnedContainer = (container) => {
    if (!pinnedContainers.find(c => c.uuid === container.uuid)) {
      setPinnedContainers([...pinnedContainers, container]);
    }
  };

  const removePinnedContainer = (uuid) => {
    setPinnedContainers(pinnedContainers.filter(c => c.uuid !== uuid));
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
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <Sidebar 
          navigation={navigation} 
          pinnedContainers={pinnedContainers}
          onRemovePinned={removePinnedContainer}
          onPinContainer={addPinnedContainer}
        />
        <View style={{ flex: 1 }}>
          <Stack.Navigator initialRouteName="List Items" screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Create Item" component={CreateItemScreen} />
            <Stack.Screen name="Edit Item" component={CreateItemScreen} />
            <Stack.Screen name="List Items">
              {(props) => <ListItemsScreen {...props} onPinContainer={addPinnedContainer} />}
            </Stack.Screen>
            <Stack.Screen name="Item Detail" component={ItemDetailScreen} />
            <Stack.Screen name="Bin" component={BinScreen} />
            <Stack.Screen name="User Settings" component={UserSettingsScreen} />
          </Stack.Navigator>
        </View>
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
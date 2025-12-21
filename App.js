import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import CreateItemScreen from './screens/CreateItemScreen';
import ListItemsScreen from './screens/ListItemsScreen';
import Sidebar from './components/Sidebar';

const Stack = createStackNavigator();

export default function App() {
  const navigationRef = useRef();
  const [navigation, setNavigation] = useState(null);

  return (
    <NavigationContainer ref={(ref) => { navigationRef.current = ref; setNavigation(ref); }}>
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <Sidebar navigation={navigation} />
        <View style={{ flex: 1 }}>
          <Stack.Navigator initialRouteName="List Items" screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Create Item" component={CreateItemScreen} />
            <Stack.Screen name="List Items" component={ListItemsScreen} />
          </Stack.Navigator>
        </View>
      </View>
    </NavigationContainer>
  );
}
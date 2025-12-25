import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import CreateItemScreen from './screens/CreateItemScreen';
import ListItemsScreen from './screens/ListItemsScreen';
import ItemDetailScreen from './screens/ItemDetailScreen';
import BinScreen from './screens/BinScreen';
import Sidebar from './components/Sidebar';

const Stack = createStackNavigator();

const linking = {
  prefixes: ['https://boxbuddy.walther.haus', 'http://localhost:8081'],
  config: {
    screens: {
      'List Items': {
        path: 'items',
        initialRouteName: true,
      },
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
    },
  },
};

export default function App() {
  const navigationRef = useRef();
  const [navigation, setNavigation] = useState(null);

  return (
    <NavigationContainer 
      ref={(ref) => { navigationRef.current = ref; setNavigation(ref); }}
      linking={linking}
    >
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <Sidebar navigation={navigation} />
        <View style={{ flex: 1 }}>
          <Stack.Navigator initialRouteName="List Items" screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Create Item" component={CreateItemScreen} />
            <Stack.Screen name="Edit Item" component={CreateItemScreen} />
            <Stack.Screen name="List Items" component={ListItemsScreen} />
            <Stack.Screen name="Item Detail" component={ItemDetailScreen} />
            <Stack.Screen name="Bin" component={BinScreen} />
          </Stack.Navigator>
        </View>
      </View>
    </NavigationContainer>
  );
}
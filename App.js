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
    },
  },
};

export default function App() {
  const navigationRef = useRef();
  const [navigation, setNavigation] = useState(null);
  const [pinnedContainers, setPinnedContainers] = useState([]);

  const addPinnedContainer = (container) => {
    if (!pinnedContainers.find(c => c.uuid === container.uuid)) {
      setPinnedContainers([...pinnedContainers, container]);
    }
  };

  const removePinnedContainer = (uuid) => {
    setPinnedContainers(pinnedContainers.filter(c => c.uuid !== uuid));
  };

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
          </Stack.Navigator>
        </View>
      </View>
    </NavigationContainer>
  );
}
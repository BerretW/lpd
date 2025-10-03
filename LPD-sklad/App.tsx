// App.tsx (NOVÁ VERZE)
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthProvider, useAuth } from './src/state/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import InventoryListScreen from './src/screens/InventoryListScreen';
import ScannerScreen from './src/screens/ScannerScreen';
import AddItemScreen from './src/screens/AddItemScreen';

const Stack = createStackNavigator();

function AppNavigator() {
  const { authData, loading } = useAuth();

  if (loading) {
    // Můžeme zobrazit splash screen
    return null;
  }

  return (
    <Stack.Navigator>
      {authData?.token ? (
        // Přihlášený uživatel
        <>
          <Stack.Screen name="Sklad" component={InventoryListScreen} />
          <Stack.Screen name="Scanner" component={ScannerScreen} />
          <Stack.Screen name="AddItem" component={AddItemScreen} options={{ title: 'Přidat položku' }} />
        </>
      ) : (
        // Nepřihlášený
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
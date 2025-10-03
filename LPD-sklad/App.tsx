// App.tsx
import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import * as SecureStore from 'expo-secure-store';

import LoginScreen from './src/screens/LoginScreen';
import InventoryListScreen from './src/screens/InventoryListScreen';
import ScannerScreen from './src/screens/ScannerScreen';
// import AddItemScreen from './src/screens/AddItemScreen'; // Tuto obrazovku si vytvoříte

const Stack = createStackNavigator();

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Při startu aplikace zkontrolujeme, zda je token uložen
    const checkToken = async () => {
      const token = await SecureStore.getItemAsync('authToken');
      if (token) {
        setIsLoggedIn(true);
      }
      setIsLoading(false);
    };
    checkToken();
  }, []);

  if (isLoading) {
    // Zobrazit splash screen, než zkontrolujeme token
    return null;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {isLoggedIn ? (
          // Obrazovky pro přihlášeného uživatele
          <>
            <Stack.Screen name="Sklad" component={InventoryListScreen} />
            <Stack.Screen name="Scanner" component={ScannerScreen} />
            {/* <Stack.Screen name="AddItem" component={AddItemScreen} /> */}
          </>
        ) : (
          // Obrazovka pro přihlášení
          <Stack.Screen name="Login">
            {/* Předáme funkci pro změnu stavu po úspěšném přihlášení */}
            {(props) => <LoginScreen {...props} onLoginSuccess={() => setIsLoggedIn(true)} />}
          </Stack.Screen>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
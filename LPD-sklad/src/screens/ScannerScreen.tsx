// src/screens/ScannerScreen.tsx
import React, { useState, useEffect } from 'react';
import { Text, View, StyleSheet, Button, Alert } from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { findItemByEan } from '../api/apiService';
import { useNavigation } from '@react-navigation/native';

export default function ScannerScreen() {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const navigation = useNavigation();
  const companyId = 1; // Získat po přihlášení

  useEffect(() => {
    (async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleBarCodeScanned = async ({ type, data }) => {
    setScanned(true);
    try {
      const response = await findItemByEan(companyId, data);
      const item = response.data;
      Alert.alert(
        'Položka nalezena!',
        `${item.name}\nSKU: ${item.sku}\nPočet: ${item.quantity}`,
        [
          // Můžete přidat tlačítka pro navigaci na detail nebo úpravu
          { text: 'Zavřít', onPress: () => setScanned(false) },
        ]
      );
      // nebo navigovat na detail: navigation.navigate('ItemDetail', { item });
    } catch (error) {
      if (error.response?.status === 404) {
        Alert.alert(
          'Položka nenalezena',
          `Položka s EAN kódem ${data} nebyla ve skladu nalezena. Chcete ji vytvořit?`,
          [
            { text: 'Zrušit', onPress: () => setScanned(false), style: 'cancel' },
            { text: 'Vytvořit', onPress: () => navigation.navigate('AddItem', { ean: data }) },
          ]
        );
      } else {
        Alert.alert('Chyba', 'Nastala chyba při komunikaci se serverem.');
        setScanned(false);
      }
    }
  };

  if (hasPermission === null) {
    return <Text>Žádost o povolení kamery...</Text>;
  }
  if (hasPermission === false) {
    return <Text>Přístup ke kameře byl zamítnut.</Text>;
  }

  return (
    <View style={styles.container}>
      <BarCodeScanner
        onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
        style={StyleSheet.absoluteFillObject}
      />
      {scanned && <Button title={'Skenovat znovu'} onPress={() => setScanned(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
  },
});
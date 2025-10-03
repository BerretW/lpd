// src/screens/ScannerScreen.tsx
import React, { useState, useEffect } from 'react';
import { Text, View, StyleSheet, Button, Alert, ActivityIndicator } from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { findItemByEan } from '../api/apiService';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../state/AuthContext';

export default function ScannerScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  
  const navigation = useNavigation();
  const { authData } = useAuth(); // Získáme data o přihlášení
  const companyId = authData?.companyId;

  useEffect(() => {
    const getBarCodeScannerPermissions = async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    };

    getBarCodeScannerPermissions();
  }, []);

  const handleBarCodeScanned = async ({ type, data }: { type: string, data: string }) => {
    if (!companyId) {
        Alert.alert("Chyba", "Nejste přihlášen k žádné firmě.");
        return;
    }
    setScanned(true);
    setIsSearching(true);

    try {
      const response = await findItemByEan(companyId, data);
      const item = response.data;
      Alert.alert(
        'Položka nalezena!',
        `${item.name}\nSKU: ${item.sku}\nPočet na skladě: ${item.quantity}`,
        [
          { text: 'OK', onPress: () => setScanned(false) },
        ]
      );
      // Zde bychom mohli navigovat na detail položky
      // navigation.navigate('ItemDetail', { itemId: item.id });
    } catch (error) {
      if (error.response?.status === 404) {
        Alert.alert(
          'Položka nenalezena',
          `Položka s EAN kódem ${data} nebyla ve skladu nalezena. Chcete ji vytvořit?`,
          [
            { text: 'Zrušit', onPress: () => setScanned(false), style: 'cancel' },
            { text: 'Vytvořit novou', onPress: () => navigation.navigate('AddItem', { ean: data }) },
          ]
        );
      } else {
        Alert.alert('Chyba serveru', 'Nastala chyba při komunikaci se serverem.');
        setScanned(false);
      }
    } finally {
        setIsSearching(false);
    }
  };

  if (hasPermission === null) {
    return <Text style={styles.infoText}>Žádost o povolení kamery...</Text>;
  }
  if (hasPermission === false) {
    return <Text style={styles.infoText}>Přístup ke kameře byl zamítnut.</Text>;
  }

  return (
    <View style={styles.container}>
      <BarCodeScanner
        onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.overlay}>
        <Text style={styles.instructions}>Naskenujte EAN kód</Text>
        <View style={styles.scanBox} />
        {isSearching && <ActivityIndicator size="large" color="#fff" style={{marginTop: 20}} />}
        {scanned && !isSearching && (
          <Button title={'Skenovat znovu'} onPress={() => setScanned(false)} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    backgroundColor: 'black',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructions: {
    fontSize: 18,
    color: 'white',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 10,
    borderRadius: 5,
    marginBottom: 20,
  },
  scanBox: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: 'white',
    borderRadius: 10,
  },
  infoText: {
    flex: 1,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 16,
  },
});
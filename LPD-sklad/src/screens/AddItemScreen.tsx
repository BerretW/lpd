// src/screens/AddItemScreen.tsx
import React, { useState } from 'react';
import { View, TextInput, Button, Alert, StyleSheet, ScrollView, Text } from 'react-native';
import { createInventoryItem } from '../api/apiService';
import { useNavigation, useRoute } from '@react-navigation/native';

// Toto ID musíte získat po přihlášení!
const DUMMY_COMPANY_ID = 1;

const AddItemScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  
  // Pokud přicházíme ze skeneru, EAN bude v parametrech
  const initialEan = route.params?.ean || '';

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [ean, setEan] = useState(initialEan);
  const [quantity, setQuantity] = useState('0');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAddItem = async () => {
    if (!name || !sku) {
      Alert.alert('Chyba', 'Název a SKU jsou povinné položky.');
      return;
    }
    setLoading(true);
    try {
      const itemData = {
        name,
        sku,
        ean: ean || null,
        quantity: parseInt(quantity, 10) || 0,
        price: price ? parseFloat(price) : null,
        description: description || null,
      };
      await createInventoryItem(DUMMY_COMPANY_ID, itemData);
      Alert.alert('Úspěch', 'Položka byla úspěšně vytvořena.');
      navigation.goBack(); // Vrátíme se na předchozí obrazovku
    } catch (error) {
      console.error(error.response?.data || error.message);
      Alert.alert('Chyba', 'Nepodařilo se vytvořit položku.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Název položky*</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />

      <Text style={styles.label}>SKU (Skladový kód)*</Text>
      <TextInput style={styles.input} value={sku} onChangeText={setSku} />

      <Text style={styles.label}>EAN kód</Text>
      <TextInput style={styles.input} value={ean} onChangeText={setEan} keyboardType="numeric" />

      <Text style={styles.label}>Počet kusů</Text>
      <TextInput style={styles.input} value={quantity} onChangeText={setQuantity} keyboardType="numeric" />
      
      <Text style={styles.label}>Cena (bez DPH)</Text>
      <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
      
      <Text style={styles.label}>Popis</Text>
      <TextInput style={styles.input} value={description} onChangeText={setDescription} multiline />
      
      <Button title={loading ? "Vytvářím..." : "Vytvořit položku"} onPress={handleAddItem} disabled={loading} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20 },
  label: { fontSize: 16, marginBottom: 5, color: '#333' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 15,
    borderRadius: 5,
    fontSize: 16,
  },
});

export default AddItemScreen;
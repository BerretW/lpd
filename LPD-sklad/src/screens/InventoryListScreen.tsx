// src/screens/InventoryListScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { getInventoryItems } from '../api/apiService';

const InventoryListScreen = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const companyId = 1; // Toto ID musíte získat po přihlášení!

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const response = await getInventoryItems(companyId);
        setItems(response.data);
      } catch (error) {
        console.error("Chyba při načítání skladu:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, []);

  if (loading) {
    return <ActivityIndicator size="large" style={{ flex: 1 }} />;
  }

  const renderItem = ({ item }) => (
    <View style={styles.item}>
      <Text style={styles.itemName}>{item.name}</Text>
      <Text>SKU: {item.sku}</Text>
      <Text style={styles.itemQuantity}>Počet: {item.quantity}</Text>
    </View>
  );

  return (
    <FlatList
      data={items}
      renderItem={renderItem}
      keyExtractor={(item) => item.id.toString()}
    />
  );
};

const styles = StyleSheet.create({
  item: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#ccc' },
  itemName: { fontSize: 18, fontWeight: 'bold' },
  itemQuantity: { fontSize: 16, color: 'green', marginTop: 5 },
});

export default InventoryListScreen;
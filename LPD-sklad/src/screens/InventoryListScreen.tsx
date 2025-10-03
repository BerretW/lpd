// src/screens/InventoryListScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet, Button, RefreshControl, Alert } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { getInventoryItems } from '../api/apiService';
import { useAuth } from '../state/AuthContext';

const InventoryListScreen = () => {
  const navigation = useNavigation();
  const { authData, logout } = useAuth(); // Získáme data o přihlášení a funkci pro odhlášení
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Získáme companyId z kontextu, může být null, pokud ještě není načteno
  const companyId = authData?.companyId;

  // Funkce pro načtení dat
  const fetchItems = async () => {
    // Pokud nemáme companyId, nic neděláme
    if (!companyId) {
      setLoading(false);
      return;
    }

    try {
      const response = await getInventoryItems(companyId);
      setItems(response.data);
    } catch (error) {
      console.error("Chyba při načítání skladu:", error);
      Alert.alert("Chyba", "Nepodařilo se načíst data ze skladu.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Použijeme useFocusEffect, aby se data znovu načetla VŽDY,
  // když se na tuto obrazovku vrátíme (např. po přidání nové položky).
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchItems();
    }, [companyId]) // Znovu se zavolá, jen pokud se změní companyId
  );

  // Funkce pro "pull-to-refresh"
  const onRefresh = () => {
    setRefreshing(true);
    fetchItems();
  };

  // Nastavíme tlačítko pro odhlášení do hlavičky obrazovky
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Button onPress={logout} title="Odhlásit" color="#ff3b30" />
      ),
    });
  }, [navigation, logout]);


  if (loading && !refreshing) {
    return <ActivityIndicator size="large" style={styles.centered} />;
  }

  const renderItem = ({ item }) => (
    <View style={styles.item}>
      <Text style={styles.itemName}>{item.name}</Text>
      <Text style={styles.itemSku}>SKU: {item.sku}</Text>
      <Text style={styles.itemQuantity}>Počet: {item.quantity}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        <Button title="Skenovat EAN" onPress={() => navigation.navigate('Scanner')} />
        <Button title="Přidat ručně" onPress={() => navigation.navigate('AddItem')} />
      </View>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        ListEmptyComponent={<Text style={styles.emptyText}>Sklad je prázdný.</Text>}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 10,
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  item: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  itemName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  itemSku: {
    fontSize: 14,
    color: '#666',
  },
  itemQuantity: {
    fontSize: 16,
    color: 'green',
    marginTop: 5,
    fontWeight: '500',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: 'gray',
  },
});

export default InventoryListScreen;
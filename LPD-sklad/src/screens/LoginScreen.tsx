// src/screens/LoginScreen.tsx
import React, { useState } from 'react';
import { View, TextInput, Button, Alert } from 'react-native';
import { login } from '../api/apiService';

// Předpokládáme, že navigace předává funkci, která změní stav na "přihlášen"
const LoginScreen = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('admin@mojefirma.cz');
  const [password, setPassword] = useState('SuperSilneHeslo123');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      await login(email, password);
      // Zavoláme funkci z hlavní App komponenty, která přepne navigaci
      onLoginSuccess();
    } catch (error) {
      Alert.alert('Chyba přihlášení', 'Zkontrolujte zadané údaje.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
      <TextInput
        placeholder="E-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={{ borderWidth: 1, padding: 10, marginBottom: 10 }}
      />
      <TextInput
        placeholder="Heslo"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{ borderWidth: 1, padding: 10, marginBottom: 20 }}
      />
      <Button title={loading ? "Přihlašuji..." : "Přihlásit"} onPress={handleLogin} disabled={loading} />
    </View>
  );
};

export default LoginScreen;
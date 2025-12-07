import React, { useState } from 'react';
import { StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import HomeScreen from './screens/HomeScreen';
import LoginScreen from './screens/LoginScreen';
import MusicScreen from './screens/MusicScreen';

export default function App() {
    const [currentScreen, setCurrentScreen] = useState('login');

    const renderScreen = () => {
        switch (currentScreen) {
            case 'login':
                return (
                    <LoginScreen
                        onLoginSuccess={() => setCurrentScreen('music')}
                        onSwitch={() => setCurrentScreen('register')}
                    />
                );
            case 'register':
                return (
                    <HomeScreen
                        onSwitch={() => setCurrentScreen('login')}
                    />
                );
            case 'music':
                return (
                    <MusicScreen
                        onLogout={() => setCurrentScreen('login')}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            {renderScreen()}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
});
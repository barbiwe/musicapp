import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

/* SCREENS */
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/HomeScreen';
import TrackListScreen from './screens/TrackListScreen';
import MusicScreen from './screens/MusicScreen';
import AlbumListScreen from './screens/AlbumListScreen';
import AlbumDetailScreen from './screens/AlbumDetailScreen';
import CreateAlbumScreen from './screens/CreateAlbumScreen';

const Stack = createNativeStackNavigator();

/* 🔹 SIMPLE DEMO NAV */
function DemoNav({ navigation }) {
    return (
        <View style={styles.demoNav}>
            <TouchableOpacity onPress={() => navigation.navigate('Tracks')}>
                <Text style={styles.demoLink}>Tracks</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Albums')}>
                <Text style={styles.demoLink}>Albums</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Upload')}>
                <Text style={styles.demoLink}>Upload</Text>
            </TouchableOpacity>
        </View>
    );
}

/* 🔹 WRAPPER FOR MAIN SCREENS */
function WithDemoNav(Component) {
    return function Wrapped(props) {
        return (
            <View style={{ flex: 1 }}>
                <Component {...props} />
                <DemoNav navigation={props.navigation} />
            </View>
        );
    };
}

export default function App() {
    return (
        <NavigationContainer>
            <StatusBar barStyle="dark-content" />

            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {/* AUTH */}
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Register" component={RegisterScreen} />

                {/* MAIN */}
                <Stack.Screen
                    name="Tracks"
                    component={WithDemoNav(TrackListScreen)}
                />
                <Stack.Screen
                    name="Albums"
                    component={WithDemoNav(AlbumListScreen)}
                />
                <Stack.Screen
                    name="Upload"
                    component={WithDemoNav(MusicScreen)}
                />
                <Stack.Screen
                    name="CreateAlbum"
                    component={WithDemoNav(CreateAlbumScreen)}
                />
                <Stack.Screen
                    name="AlbumDetail"
                    component={WithDemoNav(AlbumDetailScreen)}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );
}

/* STYLES */
const styles = StyleSheet.create({
    demoNav: {
        height: 56,
        borderTopWidth: 1,
        borderColor: '#E0E0E0',
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        backgroundColor: '#fff'
    },

    demoLink: {
        fontSize: 14,
        fontWeight: '600',
        color: '#000'
    }
});

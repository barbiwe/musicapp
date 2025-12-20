import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    Button,
    StyleSheet,
    Image,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    ScrollView
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { createAlbum } from '../api/api';

export default function CreateAlbumScreen({ onBack }) {
    const [title, setTitle] = useState('');
    const [artist, setArtist] = useState('');
    const [cover, setCover] = useState(null);
    const [loading, setLoading] = useState(false);

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7
        });

        if (!result.canceled) {
            setCover(result.assets[0]);
        }
    };

    const handleCreate = async () => {
        if (!title || !artist) {
            Alert.alert('Error', 'Enter album title and artist');
            return;
        }

        setLoading(true);
        const result = await createAlbum(title, artist, cover);
        setLoading(false);

        if (result.success) {
            Alert.alert('Success', 'Album created');
            onBack();
        } else {
            Alert.alert('Error', result.error || 'Failed to create album');
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.header}>Create Album</Text>

            <TouchableOpacity
                onPress={pickImage}
                style={styles.imagePicker}
            >
                {cover ? (
                    <Image
                        source={{ uri: cover.uri }}
                        style={styles.image}
                    />
                ) : (
                    <View style={styles.placeholder}>
                        <Text style={styles.placeholderText}>
                            Select cover
                        </Text>
                    </View>
                )}
            </TouchableOpacity>

            <Text style={styles.label}>Album title</Text>
            <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Album title"
            />

            <Text style={styles.label}>Artist</Text>
            <TextInput
                style={styles.input}
                value={artist}
                onChangeText={setArtist}
                placeholder="Artist name"
            />

            <View style={styles.button}>
                {loading ? (
                    <ActivityIndicator size="large" />
                ) : (
                    <Button
                        title="Create"
                        onPress={handleCreate}
                    />
                )}
            </View>

            <View style={styles.button}>
                <Button
                    title="Cancel"
                    onPress={onBack}
                />
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        padding: 20,
        backgroundColor: '#fff',
        alignItems: 'center'
    },
    header: {
        fontSize: 20,
        fontWeight: '600',
        marginBottom: 20
    },
    imagePicker: {
        marginBottom: 20
    },
    image: {
        width: 150,
        height: 150,
        backgroundColor: '#ddd'
    },
    placeholder: {
        width: 150,
        height: 150,
        backgroundColor: '#eee',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ccc'
    },
    placeholderText: {
        color: '#666'
    },
    label: {
        width: '90%',
        fontSize: 14,
        marginBottom: 5
    },
    input: {
        width: '90%',
        borderWidth: 1,
        borderColor: '#ccc',
        padding: 10,
        marginBottom: 15
    },
    button: {
        width: '90%',
        marginTop: 10
    }
});

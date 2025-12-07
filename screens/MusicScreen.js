import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, FlatList, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { uploadTrack, getTracks, getStreamUrl } from '../api/api';

export default function MusicScreen({ onLogout }) {
    const [tracks, setTracks] = useState([]);
    const [title, setTitle] = useState('');
    const [artist, setArtist] = useState('');
    const [album, setAlbum] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploading, setUploading] = useState(false);

    // Нові стани для програвання
    const [sound, setSound] = useState(null);
    const [currentTrackId, setCurrentTrackId] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
        loadTracks();
        return () => {
            if (sound) {
                sound.unloadAsync();
            }
        };
    }, []);

    const loadTracks = async () => {
        const data = await getTracks();
        setTracks(data);
    };

    const pickDocument = async () => {
        const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*' });
        if (!result.canceled) {
            setSelectedFile(result.assets[0]);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile || !title || !artist) {
            Alert.alert("Помилка", "Виберіть файл і заповніть поля");
            return;
        }

        setUploading(true);
        const result = await uploadTrack(selectedFile, title, artist, album);
        setUploading(false);

        if (result.error) {
            Alert.alert("Помилка завантаження", result.error);
        } else {
            Alert.alert("Успіх", "Трек завантажено!");
            setSelectedFile(null);
            setTitle('');
            setArtist('');
            setAlbum('');
            loadTracks();
        }
    };

    // Оновлена функція програвання / зупинки
    const handlePlayStop = async (id) => {
        // Якщо натиснули на той самий трек, що зараз грає -> Зупиняємо
        if (currentTrackId === id && isPlaying) {
            if (sound) {
                await sound.stopAsync();
                await sound.unloadAsync();
            }
            setIsPlaying(false);
            setCurrentTrackId(null);
            setSound(null);
            return;
        }

        // Якщо грає щось інше -> Зупиняємо попередній
        if (sound) {
            await sound.unloadAsync();
        }

        // Запускаємо новий
        try {
            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri: getStreamUrl(id) },
                { shouldPlay: true }
            );

            setSound(newSound);
            setCurrentTrackId(id);
            setIsPlaying(true);

            // Коли трек дограє до кінця -> скидаємо кнопку
            newSound.setOnPlaybackStatusUpdate((status) => {
                if (status.didJustFinish) {
                    setIsPlaying(false);
                    setCurrentTrackId(null);
                }
            });

        } catch (error) {
            console.error(error);
            Alert.alert("Помилка", "Не вдалося відтворити трек");
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Music Maker</Text>

            <View style={styles.form}>
                <Button title={selectedFile ? "Файл обрано" : "Обрати файл"} onPress={pickDocument} color="#2196F3" />
                <Text style={styles.fileName}>{selectedFile ? selectedFile.name : ""}</Text>

                <TextInput placeholder="Назва пісні" value={title} onChangeText={setTitle} style={styles.input} />
                <TextInput placeholder="Виконавець" value={artist} onChangeText={setArtist} style={styles.input} />
                <TextInput placeholder="Альбом" value={album} onChangeText={setAlbum} style={styles.input} />

                {uploading ? (
                    <ActivityIndicator color="#2196F3" />
                ) : (
                    <Button title="Завантажити трек" onPress={handleUpload} color="#2196F3" />
                )}
            </View>

            <Text style={styles.subHeader}>Список треків</Text>

            <FlatList
                data={tracks}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => {
                    // Перевіряємо, чи цей трек зараз грає
                    const isCurrentPlaying = currentTrackId === item.id && isPlaying;

                    return (
                        <View style={styles.trackItem}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.trackTitle}>{item.title}</Text>
                                <Text style={styles.trackArtist}>{item.artist}</Text>
                            </View>
                            <View style={{ width: 80 }}>
                                <Button
                                    title={isCurrentPlaying ? "Stop" : "Play"}
                                    onPress={() => handlePlayStop(item.id)}
                                    color={isCurrentPlaying ? "#FF3B30" : "#2196F3"} // Червоний для Stop, Синій для Play
                                />
                            </View>
                        </View>
                    );
                }}
                style={styles.list}
            />

            <TouchableOpacity onPress={onLogout} style={styles.linkButton}>
                <Text style={styles.linkText}>Вийти</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, paddingTop: 50 },
    header: { fontSize: 24, fontWeight: "bold", marginBottom: 20, textAlign: "center" },
    subHeader: { fontSize: 20, fontWeight: "bold", marginTop: 20, marginBottom: 10 },
    form: { marginBottom: 10 },
    input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 5, padding: 10, marginBottom: 10 },
    fileName: { textAlign: "center", marginVertical: 5, color: "#666" },
    list: { flex: 1 },
    trackItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
    trackTitle: { fontWeight: 'bold', fontSize: 16 },
    trackArtist: { color: 'gray' },
    linkButton: { alignItems: 'center', paddingVertical: 20 },
    linkText: { color: '#2196F3', fontSize: 16 }
});
import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    TouchableOpacity,
    Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { scale } from '../../api/api';

const { width, height } = Dimensions.get('window');

// Ширина одного елемента (3 колонки з відступами)
const ITEM_WIDTH = (width - scale(60)) / 3;

export default function LibraryArtist({ navigation }) {
    // Розширені дані для демонстрації сітки як на макеті
    const DATA = [
        { id: '1', title: 'The Weeknd', image: 'https://images.unsplash.com/photo-1520333789090-1afc82db536a?q=80&w=300&auto=format&fit=crop' },
        { id: '2', title: 'Nikov', image: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?q=80&w=300&auto=format&fit=crop' },
        { id: '3', title: 'Rihanna', image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=300&auto=format&fit=crop' },
        { id: '4', title: 'Lady Gaga', image: 'https://images.unsplash.com/photo-1500917293891-ef795e70e1f6?q=80&w=300&auto=format&fit=crop' },
        { id: '5', title: 'INNA', image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=300&auto=format&fit=crop' },
        { id: '6', title: 'LOBODA', image: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?q=80&w=300&auto=format&fit=crop' },
        { id: '7', title: 'ASAP Rocky', image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=300&auto=format&fit=crop' },
        { id: '8', title: 'MONATIK', image: 'https://www.chipublib.org/wp-content/uploads/sites/3/2022/09/36079964425_7b3042d5e1_k.jpg' },
        { id: '9', title: 'Justien Biber', image: 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=300&auto=format&fit=crop' },
        { id: '10', title: 'Eminem', image: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?q=80&w=300&auto=format&fit=crop' },
        { id: '11', title: 'T-Fest', image: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=300&auto=format&fit=crop' },
        { id: '12', title: 'Drake', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=300&auto=format&fit=crop' },
    ];

    const renderCard = (item) => {
        return (
            <TouchableOpacity
                key={item.id}
                style={styles.cardContainer}
                activeOpacity={0.7}
                onPress={() => {}}
            >
                <View style={styles.imageWrapper}>
                    <Image
                        source={{ uri: item.image }}
                        style={styles.image}
                        resizeMode="cover"
                    />
                </View>

                <Text style={styles.title} numberOfLines={1}>
                    {item.title}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#9A4B39', '#80291E', '#190707']}
                locations={[0, 0.2, 0.59]}
                start={{ x: 1, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.gradient}
            >
                {/* Відступ під хедер */}
                <View style={{ height: scale(220) }} />

                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Контейнер сітки */}
                    <View style={styles.gridContainer}>
                        {DATA.map((item) => renderCard(item))}
                    </View>

                    {/* Відступ знизу (для міні-плеєра та меню) */}
                    <View style={{ height: scale(150) }} />
                </ScrollView>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    gradient: {
        flex: 1,
        width: width,
        height: height,
    },
    scrollContent: {
        paddingHorizontal: scale(20), // Відступи по боках екрану
        paddingTop: scale(10),
    },

    // --- GRID STYLES ---
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap', // Дозволяє переносити елементи на новий рядок
        justifyContent: 'space-between', // Рівномірно розподіляє 3 колонки
    },

    // --- ITEM STYLES ---
    cardContainer: {
        width: ITEM_WIDTH,
        alignItems: 'center', // Вирівнювання по центру вертикально
        marginBottom: scale(24), // Відступ між рядками
    },

    imageWrapper: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
        marginBottom: scale(10), // Відступ між картинкою і текстом
    },

    image: {
        width: scale(96), // Великий розмір як на макеті
        height: scale(96),
        borderRadius: scale(48), // Ідеальне коло (половина від 96)
        backgroundColor: '#333',
    },

    title: {
        color: '#F5D8CB',
        fontSize: scale(13),
        fontFamily: 'Poppins-Regular',
        textAlign: 'center',
        paddingHorizontal: scale(4),
    },
});
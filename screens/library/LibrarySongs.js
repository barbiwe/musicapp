import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    TouchableOpacity,
    Dimensions
} from 'react-native';
import { SvgUri } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { getIcons, scale } from '../../api/api';
import InsetShadow from 'react-native-inset-shadow';
const { width, height } = Dimensions.get('window');

export default function LibrarySongs({ navigation }) {
    // Дані точно як на скріншоті "Songs"
    const DATA = [
        {
            id: '1',
            title: 'Te Molla',
            subtitle: 'Song / Arnon',
            // Білий фон, червоний акцент
            image: 'https://images.unsplash.com/photo-1563205764-6e927cdcb596?q=80&w=300&auto=format&fit=crop'
        },
        {
            id: '2',
            title: 'Family Affair',
            subtitle: 'Song / Broski',
            // Темне, похмуре
            image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=300&auto=format&fit=crop'
        },
        {
            id: '3',
            title: 'Hideaway',
            subtitle: 'Song / Kiesza',
            // Синє небо, яскраве
            image: 'https://images.unsplash.com/photo-1525130413817-d45c1ca32729?q=80&w=300&auto=format&fit=crop'
        },
        {
            id: '4',
            title: 'Friday – Dophamine...',
            subtitle: 'Song / Riton',
            // Жовто-гаряче, яскраве
            image: 'https://images.unsplash.com/photo-1496024840928-4c417adf211d?q=80&w=300&auto=format&fit=crop'
        },
        {
            id: '5',
            title: 'Nobody',
            subtitle: 'Song / Gorgon City & ...',
            // Чорно-біле
            image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=300&auto=format&fit=crop'
        },
    ];

    const renderCard = (item) => {
        return (
            <TouchableOpacity
                key={item.id}
                style={styles.cardContainer} // Стиль 1 в 1 як у Playlist
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

                <View style={styles.textContainer}>
                    <Text style={styles.title} numberOfLines={1}>
                        {item.title}
                    </Text>
                    <Text style={styles.subtitle} numberOfLines={1}>
                        {item.subtitle}
                    </Text>
                </View>
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
                {/* Відступ під хедер (220, як домовлялися) */}
                <View style={{ height: 220 }} />

                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {DATA.map((item) => renderCard(item))}

                    {/* Відступ знизу */}
                    <View style={{ height: scale(100) }} />
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
        paddingHorizontal: scale(16),
        paddingTop: scale(20),
        paddingBottom: scale(100),
    },

    // --- CARD STYLES (Ідентичні до Playlist) ---
    cardContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(48, 12, 10, 0.2)', // Темний напівпрозорий фон
        borderRadius: scale(20), // Рівномірне заокруглення
        marginBottom: scale(16),
        width: '100%',

        // Ті самі налаштування кутів, що ти просив зберегти
        borderTopLeftRadius: scale(50),
        borderBottomLeftRadius: scale(50),

        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },

    imageWrapper: {
        marginRight: scale(16),
        justifyContent: 'center',
        alignItems: 'center',
    },

    image: {
        width: scale(80),
        height: scale(80),
        borderRadius: scale(15),
        backgroundColor: '#333',
    },

    // --- TEXT STYLES ---
    textContainer: {
        flex: 1,
        justifyContent: 'center',
        paddingRight: scale(10),
    },
    title: {
        color: '#F5D8CB',
        fontSize: scale(16),
        fontFamily: 'Unbounded-Medium',
        marginBottom: scale(4),
    },
    subtitle: {
        color: 'rgba(245, 216, 203, 0.7)',
        fontSize: scale(14),
        fontFamily: 'Poppins-Regular',
    },
});
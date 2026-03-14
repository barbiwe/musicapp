import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    StatusBar,
    Platform,
    ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { getIcons, scale } from '../../api/api';
import RemoteTintIcon from '../../components/RemoteTintIcon';

export default function RequestTermsScreen({ navigation }) {
    const [icons, setIcons] = useState({});
    const [isAccepted, setIsAccepted] = useState(false);

    useEffect(() => {
        let mounted = true;

        getIcons()
            .then((map) => {
                if (mounted) setIcons(map || {});
            })
            .catch(() => {});

        return () => {
            mounted = false;
        };
    }, []);

    return (
        <LinearGradient
            colors={['#9A4B39', '#80291E', '#190707']}
            locations={[0, 0.2, 0.59]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.gradient}
        >
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            <View style={styles.container}>
                <View style={styles.headerRow}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                        activeOpacity={0.8}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                        <RemoteTintIcon
                            icons={icons}
                            iconName="arrow-left.svg"
                            width={scale(24)}
                            height={scale(24)}
                            color="#F5D8CB"
                            fallback=""
                        />
                    </TouchableOpacity>

                    <Text style={styles.title}>Terms</Text>
                    <View style={styles.headerSpacer} />
                </View>

                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    <Text style={styles.heading}>1. General Terms</Text>
                    <Text style={styles.bodyText}>
                        By using the platform, users agree to follow these rules. Violating the rules may result in
                        content removal, temporary suspension, or permanent account deletion.
                    </Text>

                    <Text style={styles.heading}>2. Artist Profiles</Text>
                    <Text style={styles.bodyText}>
                        When creating an artist profile, users must:
                    </Text>
                    <Text style={styles.bodyText}>• provide truthful information about themselves or their music project</Text>
                    <Text style={styles.bodyText}>• avoid using names that impersonate other artists</Text>
                    <Text style={styles.bodyText}>• avoid offensive, discriminatory, or illegal names</Text>
                    <Text style={styles.bodyText}>• not impersonate another person or official organization</Text>
                    <Text style={styles.bodyText}>
                        The platform administration reserves the right to modify or remove profiles that violate these rules.
                    </Text>

                    <Text style={styles.heading}>3. Music and Content Upload</Text>
                    <Text style={styles.bodyText}>
                        Users may upload only content for which they own the copyright or have legal permission.
                    </Text>
                    <Text style={styles.bodyText}>The following content is prohibited:</Text>
                    <Text style={styles.bodyText}>• music that violates copyright laws</Text>
                    <Text style={styles.bodyText}>• stolen or illegally distributed recordings</Text>
                    <Text style={styles.bodyText}>• tracks belonging to other artists uploaded without permission</Text>

                    <Text style={styles.heading}>4. Prohibited Content</Text>
                    <Text style={styles.bodyText}>The platform strictly prohibits the following content:</Text>

                    <Text style={styles.subheading}>4.1 Pornography and Sexual Content</Text>
                    <Text style={styles.bodyText}>• pornographic material</Text>
                    <Text style={styles.bodyText}>• explicit sexual audio or artwork</Text>
                    <Text style={styles.bodyText}>• sexual exploitation or sexualization of minors</Text>

                    <Text style={styles.subheading}>4.2 Hate Speech</Text>
                    <Text style={styles.bodyText}>• content promoting hatred or violence</Text>
                    <Text style={styles.bodyText}>
                        • discrimination based on race, nationality, religion, gender, sexual orientation, or disability
                    </Text>

                    <Text style={styles.subheading}>4.3 Violence and Illegal Activity</Text>
                    <Text style={styles.bodyText}>• threats or calls for violence</Text>
                    <Text style={styles.bodyText}>• promotion of criminal activity</Text>
                    <Text style={styles.bodyText}>• harassment or threats against other users</Text>

                    <Text style={styles.subheading}>4.4 Abusive or Harmful Content</Text>
                    <Text style={styles.bodyText}>• bullying or harassment</Text>
                    <Text style={styles.bodyText}>• misleading or harmful content</Text>

                    <Text style={styles.heading}>5. Artwork, Titles, and Descriptions</Text>
                    <Text style={styles.bodyText}>Track titles, descriptions, artwork, and related content must:</Text>
                    <Text style={styles.bodyText}>• not contain pornography</Text>
                    <Text style={styles.bodyText}>• not include hate speech</Text>
                    <Text style={styles.bodyText}>• not violate the law</Text>
                    <Text style={styles.bodyText}>• not mislead users</Text>

                    <Text style={styles.heading}>6. Rule Violations</Text>
                    <Text style={styles.bodyText}>If a user violates these rules, the platform may:</Text>
                    <Text style={styles.bodyText}>• remove content</Text>
                    <Text style={styles.bodyText}>• restrict account features</Text>
                    <Text style={styles.bodyText}>• temporarily suspend the account</Text>
                    <Text style={styles.bodyText}>• permanently delete the account for serious violations</Text>

                    <Text style={styles.heading}>7. Moderation</Text>
                    <Text style={styles.bodyText}>
                        The platform administration reserves the right to review, moderate, and remove content that
                        violates the rules or may harm the platform or its users.
                    </Text>
                </ScrollView>

                <TouchableOpacity
                    style={styles.acceptRow}
                    activeOpacity={0.85}
                    onPress={() => setIsAccepted((prev) => !prev)}
                >
                    <View style={[styles.checkbox, isAccepted && styles.checkboxActive]}>
                        {isAccepted ? <Text style={styles.checkMark}>✓</Text> : null}
                    </View>
                    <Text style={styles.acceptText}>I have read and agree to the Terms.</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.continueButton, !isAccepted && styles.continueButtonDisabled]}
                    activeOpacity={0.85}
                    disabled={!isAccepted}
                    onPress={() => navigation.navigate('RequestDetails')}
                >
                    <Text style={styles.continueText}>Agree and Continue</Text>
                </TouchableOpacity>
            </View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    gradient: {
        flex: 1,
    },
    container: {
        flex: 1,
        paddingHorizontal: scale(16),
        paddingTop: Platform.OS === 'ios' ? scale(60) : scale(40),
        paddingBottom: scale(20),
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: scale(12),
    },
    backButton: {
        width: scale(40),
        height: scale(40),
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    headerSpacer: {
        width: scale(40),
        height: scale(40),
    },
    title: {
        color: '#F5D8CB',
        fontFamily: 'Unbounded-Regular',
        fontSize: scale(32),
        lineHeight: scale(40),
        flex: 1,
        textAlign: 'center',
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: scale(10),
    },
    heading: {
        color: '#F5D8CB',
        fontFamily: 'Poppins-Bold',
        fontSize: scale(14),
        lineHeight: scale(21),
        marginTop: scale(10),
        marginBottom: scale(6),
    },
    subheading: {
        color: '#F5D8CB',
        fontFamily: 'Poppins-Bold',
        fontSize: scale(14),
        lineHeight: scale(21),
        marginTop: scale(8),
        marginBottom: scale(4),
    },
    bodyText: {
        color: '#F5D8CB',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(14),
        lineHeight: scale(21),
        marginBottom: scale(3),
    },
    acceptRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: scale(10),
        marginBottom: scale(14),
    },
    checkbox: {
        width: scale(18),
        height: scale(18),
        borderWidth: 1,
        borderColor: '#F5D8CB',
        borderRadius: scale(3),
        marginRight: scale(10),
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxActive: {
        backgroundColor: '#F5D8CB',
    },
    checkMark: {
        color: '#300C0A',
        fontFamily: 'Poppins-Bold',
        fontSize: scale(12),
        lineHeight: scale(14),
    },
    acceptText: {
        color: '#F5D8CB',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(14),
        flex: 1,
    },
    continueButton: {
        height: scale(48),
        borderRadius: scale(32),
        backgroundColor: '#F5D8CB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    continueButtonDisabled: {
        opacity: 0.5,
    },
    continueText: {
        color: '#300C0A',
        fontFamily: 'Unbounded-Regular',
        fontSize: scale(14),
    },
});

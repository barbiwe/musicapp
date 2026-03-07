import React, { useEffect, useMemo, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

const xmlCache = {};

export default function RemoteTintIcon({
    icons,
    iconName,
    width,
    height,
    color,
    fallback = '',
    style,
}) {
    const iconUrl = icons?.[iconName];
    const isSvg = useMemo(
        () => !!iconUrl && (String(iconName || '').toLowerCase().endsWith('.svg') || String(iconUrl).toLowerCase().endsWith('.svg')),
        [iconName, iconUrl]
    );

    const cacheKey = `${iconUrl || ''}_${color || 'original'}`;
    const [xml, setXml] = useState(isSvg ? xmlCache[cacheKey] || null : null);

    useEffect(() => {
        let isMounted = true;

        if (!isSvg || !iconUrl) return () => { isMounted = false; };
        if (xmlCache[cacheKey]) {
            setXml(xmlCache[cacheKey]);
            return () => { isMounted = false; };
        }

        fetch(iconUrl)
            .then((res) => res.text())
            .then((svgContent) => {
                if (!isMounted) return;

                let cleanXml = svgContent.replace(/fill=['"]none['"]/gi, '###NONE###');
                if (color) {
                    cleanXml = cleanXml.replace(/fill=['"][^'"]*['"]/g, `fill="${color}"`);
                    cleanXml = cleanXml.replace(/stroke=['"][^'"]*['"]/g, `stroke="${color}"`);
                }
                cleanXml = cleanXml.replace(/###NONE###/g, 'fill="none"');

                xmlCache[cacheKey] = cleanXml;
                setXml(cleanXml);
            })
            .catch(() => {});

        return () => { isMounted = false; };
    }, [isSvg, iconUrl, cacheKey, color]);

    if (!iconUrl) {
        if (!fallback) return <View style={[{ width, height }, style]} />;
        return (
            <Text style={[{ width, height, color: color || '#F5D8CB', textAlign: 'center', textAlignVertical: 'center' }, style]}>
                {fallback}
            </Text>
        );
    }

    if (isSvg) {
        if (!xml) return <View style={[{ width, height }, style]} />;
        return <SvgXml xml={xml} width={width} height={height} style={style} />;
    }

    return (
        <Image
            source={{ uri: iconUrl }}
            style={[{ width, height, tintColor: color }, style]}
            resizeMode="contain"
        />
    );
}

// Адреса твого бекенду (перевір, чи порт 5001 правильний)
const API_URL = "http://192.168.68.102:5000";

export const registerUser = async (userData) => {
    try {
        const url = `${API_URL}/api/Auth/register`;
        console.log(`🔗 [POST] Реєстрація: ${url}`);
        console.log("📦 Дані:", userData);

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userData),
        });

        const text = await response.text();
        console.log(`📞 Статус: ${response.status}`);

        if (response.ok) {
            console.log("✅ Успішна реєстрація");
            return text ? JSON.parse(text) : { message: "Успішно" };
        } else {
            console.log("❌ Помилка реєстрації:", text);
            return { error: text || `Помилка ${response.status}` };
        }
    } catch (error) {
        console.error("❌ Catch Error:", error);
        return { error: error.message };
    }
};

export const loginUser = async (loginData) => {
    try {
        const url = `${API_URL}/api/Auth/login`;
        console.log(`🔗 [POST] Вхід: ${url}`);

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(loginData),
        });

        const text = await response.text();
        console.log(`📞 Статус: ${response.status}`);

        if (response.ok) {
            console.log("✅ Вхід виконано");
            return text ? JSON.parse(text) : { message: "Успішний вхід" };
        } else {
            console.log("❌ Помилка входу:", text);
            return { error: text || "Невірний логін або пароль" };
        }
    } catch (error) {
        console.error("❌ Catch Error:", error);
        return { error: "Помилка підключення до сервера" };
    }
};

// --- ОТРИМАННЯ СПИСКУ ТРЕКІВ ---
export const getTracks = async () => {
    try {
        const url = `${API_URL}/api/Tracks`;
        console.log(`🎵 [GET] Отримання треків: ${url}`);

        const response = await fetch(url);

        if (response.ok) {
            const data = await response.json();
            console.log(`✅ Отримано треків: ${data.length}`);
            return data;
        } else {
            console.log("⚠️ Не вдалося отримати треки");
            return [];
        }
    } catch (error) {
        console.error("❌ Catch Error (getTracks):", error);
        return [];
    }
};

export const uploadTrack = async (file, title, artist, album) => {
    try {
        const url = `${API_URL}/api/Tracks/upload`;
        console.log(`⬆️ [POST] Завантаження файлу на: ${url}`);

        // Створюємо FormData для відправки файлу
        const formData = new FormData();

        // Формуємо об'єкт файлу для React Native
        const fileData = {
            uri: file.uri,
            name: file.name,
            type: file.mimeType || "audio/mpeg" // Якщо тип не визначився, ставимо стандартний mp3
        };

        console.log("📄 Файл:", fileData);
        console.log(`📝 Інфо: ${title} - ${artist} (${album})`);

        formData.append("file", fileData);
        formData.append("title", title);
        formData.append("artist", artist);
        formData.append("album", album);

        // Відправляємо як multipart/form-data
        // Важливо: Content-Type не вказуємо вручну, fetch сам підставить boundary
        const response = await fetch(url, {
            method: "POST",
            body: formData,
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });

        const text = await response.text();
        console.log(`📞 Статус завантаження: ${response.status}`);

        if (response.ok) {
            console.log("✅ Трек успішно завантажено!");
            return { success: true };
        } else {
            console.log("❌ Помилка сервера при завантаженні:", text);
            return { error: text };
        }
    } catch (error) {
        console.error("❌ Catch Error (uploadTrack):", error);
        return { error: error.message };
    }
};

export const getStreamUrl = (id) => {
    const url = `${API_URL}/api/Tracks/stream/${id}`;
    // console.log(`🎧 Stream URL: ${url}`); // Можна розкоментувати, якщо треба бачити посилання
    return url;
};
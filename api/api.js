export const API_URL = "https://6933f9a44090fe3bf01e8576.mockapi.io";

export async function sendText(message) {
    const res = await fetch(`${API_URL}/messages`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: message }),
    });

    return await res.json();
}
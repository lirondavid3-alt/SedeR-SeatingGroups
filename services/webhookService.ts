
export const sendToWebhook = async (webhookUrl: string, data: any): Promise<boolean> => {
    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            console.error('Webhook export failed:', response.statusText);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error sending to webhook:', error);
        return false;
    }
};

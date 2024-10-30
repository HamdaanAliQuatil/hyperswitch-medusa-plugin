type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface RequestOptions {
    method: HttpMethod;
    endpoint: string;
    body?: Record<string, unknown>;
}

class HyperswitchClient {
    private readonly baseUrl: string;
    private readonly apiKey: string;
    private readonly defaultHeaders: Record<string, string>;

    constructor(apiKey: string) {
        this.baseUrl = 'https://sandbox.hyperswitch.io';
        this.apiKey = apiKey;
        this.defaultHeaders = {
            'api-key': this.apiKey,
            'Content-Type': 'application/json',
        };
    }

    private async request<T>(options: RequestOptions): Promise<T> {
        const { method, endpoint, body } = options;
        
        const url = `${this.baseUrl}/${endpoint}`;
        const fetchOptions: RequestInit = {
            method,
            headers: this.defaultHeaders,
            ...(body && { body: JSON.stringify(body) }),
        };

        try {
            const response = await fetch(url, fetchOptions);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Request failed:', error);
            throw error;
        }
    }

    // Methods for specific endpoints
    async createPayment(amount: number, authenticationType: string, currency: string) {
        return this.request({
            method: 'POST',
            endpoint: 'payments',
            body: { amount, authentication_type: authenticationType, currency },
        });
    }

    async updatePayment(paymentId: string, amount: number) {
        return this.request({
            method: 'POST',
            endpoint: `payments/${paymentId}`,
            body: { amount },
        });
    }

    async createPaymentSession(paymentId: string, customerAcceptance: Record<string, unknown>, paymentMethod: string, paymentMethodData: Record<string, unknown>, paymentMethodType: string) {
        return this.request({
            method: 'POST',
            endpoint: `payments/${paymentId}/confirm`,
            body: { customer_acceptance: customerAcceptance, payment_method: paymentMethod, payment_method_data: paymentMethodData, payment_method_type: paymentMethodType },
        });
    }

    async getPaymentDetails(paymentId: string, merchantId: string, forceSync: boolean, clientSecret: string, expandCaptures: boolean, expandAttempts: boolean) {
        return this.request({
            method: 'GET',
            endpoint: `payments/${paymentId}`,
            body: { merchant_id: merchantId, force_sync: forceSync, client_secret: clientSecret, expand_captures: expandCaptures, expand_attempts: expandAttempts },
        });
    }
}


export default HyperswitchClient;

import { BigNumber } from '@medusajs/framework/utils';

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
    private clientSecret?: string; 

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

    async hsPaymentsCreate(amount: BigNumber, authenticationType: string, currency: string) {
        const response = await this.request<{ client_secret: string }>({
            method: 'POST',
            endpoint: 'payments',
            body: { amount, authentication_type: authenticationType, currency },
        });

        this.clientSecret = response.client_secret;
        return response;
    }

    async hsPaymentsUpdate(paymentId: string, amount: BigNumber) {
        return this.request({
            method: 'POST',
            endpoint: `payments/${paymentId}`,
            body: { amount },
        });
    }

    async hsPaymentsConfirm(paymentId: string, customerAcceptance: Record<string, unknown>, paymentMethod: string, paymentMethodData: Record<string, unknown>, paymentMethodType: string) {
        return this.request({
            method: 'POST',
            endpoint: `payments/${paymentId}/confirm`,
            body: {
                customer_acceptance: customerAcceptance,
                payment_method: paymentMethod,
                payment_method_data: paymentMethodData,
                payment_method_type: paymentMethodType,
                client_secret: this.clientSecret,
            },
        });
    }

    async hsPaymentsRetrieve(paymentId: string, merchantId: string, forceSync: boolean, expandCaptures: boolean, expandAttempts: boolean) {
        return this.request({
            method: 'GET',
            endpoint: `payments/${paymentId}`,
            body: {
                merchant_id: merchantId,
                force_sync: forceSync,
                client_secret: this.clientSecret,
                expand_captures: expandCaptures,
                expand_attempts: expandAttempts,
            },
        });
    }

    async hsPaymentsCompleteAuthorize(paymentId: string, shipping: Record<string, unknown>) {
        return this.request({
            method: 'POST',
            endpoint: `${paymentId}/complete_authorize`,
            body: { shipping, client_secret: this.clientSecret },
        });
    }

    async hsPaymentsCancel(paymentId: string) {
        return paymentId;
    }
    
    async hsPaymentsDelete(paymentId: string) {
        return paymentId;
    }

    async hsPaymentsGetStatus(paymentId: string) {
        return paymentId;
    }

    async hsPaymentsRefund(paymentId: string, amount: BigNumber) {
        return { paymentId, amount };
    }

    async hsPaymentsCapture(paymentId: string, amount: BigNumber) {
        return { paymentId, amount };
    }
}

export default HyperswitchClient;

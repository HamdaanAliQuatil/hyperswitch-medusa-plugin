export const PaymentProviderKeys = {
    HYPERSWITCH: "hyperswitch",
}

export const ErrorIntentStatus = {
    SUCCEEDED: "succeeded",
    CANCELED: "canceled",
}

export const ErrorCodes = {
    PAYMENT_INTENT_UNEXPECTED_STATE: "payment_intent_unexpected_state",
}

export interface PaymentIntentOptions {
    capture_method?: "automatic" | "manual"
    setup_future_usage?: "on_session" | "off_session"
    payment_method_types?: string[]
}

export type Options = {
    apiKey: string;

    webhookSecret: string;

    capture?: boolean;

    automaticPaymentMethods?: boolean;

    paymentDescription?: string;
  };

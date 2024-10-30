import {
  AbstractPaymentProvider,
  BigNumber,
  MedusaError,
  ModuleProvider,
  Modules,
  PaymentSessionStatus,
} from '@medusajs/framework/utils';
import {
  CreatePaymentProviderSession,
  Logger,
  PaymentProviderError,
  PaymentProviderSessionResponse,
  ProviderWebhookPayload,
  UpdatePaymentProviderSession,
  WebhookActionResult,
} from '@medusajs/framework/types';
import HyperswitchClinet from './apiservice';

type InjectedDependencies = {
  logger: Logger;
};

type Options = {
  apiKey: string;
};

class HyperswitchMedusaService extends AbstractPaymentProvider<Options> {
  static identifier = 'my-payment';
  protected logger_: Logger;
  protected options_: Options;
  // Assuming you're using a client to integrate
  // with a third-party service
  protected client;

  constructor(
    { logger }: InjectedDependencies,
    options: Options,
    ...args: unknown[]
  ) {
    // @ts-expect-error - super() is not called
    super(...args);

    this.logger_ = logger;
    this.options_ = options;

    this.client = new HyperswitchClinet();
  }

  static validateOptions(options: Record<string | number | symbol, unknown>) {
    if (!options.apiKey) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "API key is required in the provider's options."
      );
    }
  }

  async capturePayment(
    paymentData: Record<string, unknown>
  ): Promise<PaymentProviderError | PaymentProviderSessionResponse['data']> {
    const externalId = paymentData.id;

    try {
      const newData = await this.client.capturePayment(externalId);

      return {
        ...newData,
        id: externalId,
      };
    } catch (e) {
      return {
        error: e,
        code: 'unknown',
        detail: e,
      };
    }
  }

  async createPaymentSession(
    paymentData: Record<string, unknown>
  ): Promise<PaymentProviderError | PaymentProviderSessionResponse['data']> {
    try {
      const session = await this.client.createPaymentSession(paymentData);

      return {
        ...session,
        id: session.id,
      };
    } catch (e) {
      return {
        error: e,
        code: 'unknown',
        detail: e,
      };
    }
  }

  async retrievePaymentSession(
    paymentData: Record<string, unknown>
  ): Promise<PaymentProviderError | PaymentProviderSessionResponse['data']> {
    const externalId = paymentData.id;

    try {
      const session = await this.client.retrievePaymentSession(externalId);

      return {
        ...session,
        id: externalId,
      };
    } catch (e) {
      return {
        error: e,
        code: 'unknown',
        detail: e,
      };
    }
  }

  async authorizePayment(
    paymentSessionData: Record<string, unknown>,
    context: Record<string, unknown>
  ): Promise<
    PaymentProviderError | {
      status: PaymentSessionStatus
      data: PaymentProviderSessionResponse["data"]
    }
  > {
    const externalId = paymentSessionData.id

    try {
      const paymentData = await this.client.authorizePayment(externalId)

      const contextData = {
        ...context
      }

      console.log(contextData)

      return {
        data: {
          ...paymentData,
          id: externalId
        },
        status: null //TODO: Add status
      }
    } catch (e) {
      return {
        error: e,
        code: "unknown",
        detail: e
      }
    }
  }

  async cancelPayment(
    paymentData: Record<string, unknown>
  ): Promise<PaymentProviderError | PaymentProviderSessionResponse["data"]> {
    const externalId = paymentData.id

    try {
      const paymentData = await this.client.cancelPayment(externalId)
      console.log(paymentData)
    } catch (e) {
      return {
        error: e,
        code: "unknown",
        detail: e
      }
    }
  }

  async initiatePayment(
    context: CreatePaymentProviderSession
  ): Promise<PaymentProviderError | PaymentProviderSessionResponse> {
    const {
      amount,
      currency_code,
      context: customerDetails
    } = context

    try {
      const response = await this.client.init(
        amount, currency_code, customerDetails
      )

      return {
        ...response,
        data: {
          id: response.id
        }
      }
    } catch (e) {
      return {
        error: e,
        code: "unknown",
        detail: e
      }
    }
  }

  async deletePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<
    PaymentProviderError | PaymentProviderSessionResponse["data"]
  > {
    const externalId = paymentSessionData.id

    try {
      await this.client.cancelPayment(externalId)
    } catch (e) {
      return {
        error: e,
        code: "unknown",
        detail: e
      }
    }
  }

  async getPaymentStatus(
    paymentSessionData: Record<string, unknown>
  ): Promise<PaymentSessionStatus> {
    const externalId = paymentSessionData.id

    try {
      const status = await this.client.getStatus(externalId)

      switch (status) {
        case "requires_capture":
          return PaymentSessionStatus.AUTHORIZED
        case "success":
          return PaymentSessionStatus.CAPTURED
        case "canceled":
          return PaymentSessionStatus.CANCELED
        default:
          return PaymentSessionStatus.REQUIRES_MORE
      }
    } catch (e) {
      return e //TODO: Check appropriate status type
    }
  }

  async refundPayment(
    paymentData: Record<string, unknown>,
    refundAmount: number
  ): Promise<
    PaymentProviderError | PaymentProviderSessionResponse["data"]
  > {
    const externalId = paymentData.id

    try {
      const newData = await this.client.refund(
        externalId,
        refundAmount
      )

      return {
        ...newData,
        id: externalId
      }
    } catch (e) {
      return {
        error: e,
        code: "unknown",
        detail: e
      }
    }
  


  }

  async retrievePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<
    PaymentProviderError | PaymentProviderSessionResponse["data"]
  > {
    const externalId = paymentSessionData.id

    try {
      return await this.client.retrieve(externalId)
    } catch (e) {
      return {
        error: e,
        code: "unknown",
        detail: e
      }
    }
  }

  async updatePayment(
    context: UpdatePaymentProviderSession
  ): Promise<PaymentProviderError | PaymentProviderSessionResponse> {
    const {
      amount,
      currency_code,
      context: customerDetails,
      data
    } = context
    const externalId = data.id

    try {
      const response = await this.client.update(
        externalId,
        {
          amount,
          currency_code,
          customerDetails
        }
      )

      return {
        ...response,
        data: {
          id: response.id
        }
      }
    } catch (e) {
      return {
        error: e,
        code: "unknown",
        detail: e
      }
    }
  }

  async getWebhookActionAndData(
    payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const {
      data,
      rawData,
      headers
    } = payload

    console.log(rawData)
    console.log(headers)

    try {
      switch(data.event_type) {
        case "authorized_amount":
          return {
            action: "authorized",
            data: {
              session_id: (data.metadata as Record<string, any>).session_id,
              amount: new BigNumber(data.amount as number)
            }
          }
        case "success":
          return {
            action: "captured",
            data: {
              session_id: (data.metadata as Record<string, any>).session_id,
              amount: new BigNumber(data.amount as number)
            }
          }
        default:
          return {
            action: "not_supported"
          }
      }
    } catch (e) {
      console.log(e)
      return {
        action: "failed",
        data: {
          session_id: (data.metadata as Record<string, any>).session_id,
          amount: new BigNumber(data.amount as number)
        }
      }
    }
  }


}

export default ModuleProvider(Modules.PAYMENT, {
  services: [HyperswitchMedusaService],
})


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
    ...args: any[]
  ) {
    // @ts-expect-error - super() is not called
    super(...args);

    this.logger_ = logger;
    this.options_ = options;

    this.client = new HyperswitchClinet(this.options_.apiKey);
  }

  static validateOptions(options: Record<string | number | symbol, any>) {
    if (!options.apiKey) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "API key is required in the provider's options."
      );
    }
  }

  async capturePayment(
    paymentData: Record<string, any>
  ): Promise<PaymentProviderError | PaymentProviderSessionResponse['data']> {
    const externalId = paymentData.id;

    try {
      const newData = await this.client.hsPaymentsCapture(externalId, new BigNumber(100));

      return {
        ...newData,
        id: externalId,
      };
    } catch (e) {
      return {
        error: e,
        code: 'any',
        detail: e,
      };
    }
  }

  ///Authorizes a payment.
  async authorizePayment(
    paymentSessionData: Record<string, any>,
    context: Record<string, any>
  ): Promise<
    PaymentProviderError | {
      status: PaymentSessionStatus
      data: PaymentProviderSessionResponse["data"]
    }
  > {
    const externalId = paymentSessionData.id

    try {
      const paymentData = await this.client.hsPaymentsCompleteAuthorize(externalId, context)

      const contextData = {
        ...context
      }

      console.log(contextData)

      return {
        data: {
          ...(typeof paymentData === 'object' ? paymentData : {}),
          id: externalId
        },
        status: null //TODO: Add status
      }
    } catch (e) {
      return {
        error: e,
        code: "any",
        detail: e
      }
    }
  }

  async cancelPayment(
    paymentData: Record<string, any>
  ): Promise<PaymentProviderError | PaymentProviderSessionResponse["data"]> {
    const externalId = paymentData.id

    try {
      const paymentData = await this.client.hsPaymentsCancel(externalId)
      console.log(paymentData)
    } catch (e) {
      return {
        error: e,
        code: "any",
        detail: e
      }
    }
  }

  ///Creates a payment object when amount and currency are passed.
  async initiatePayment(
    context: CreatePaymentProviderSession
  ): Promise<PaymentProviderError | PaymentProviderSessionResponse> {
    const {
      amount,
      currency_code,
      context: customerDetails
    } = context

    console.log(customerDetails)
    try {
      const response = await this.client.hsPaymentsCreate(
        new BigNumber(amount),
        "recurring",
        currency_code
      )

      return {
        ...(typeof response === 'object' ? response : {}),
        data: {
          id: response.client_secret
        }
      }
    } catch (e) {
      return {
        error: e,
        code: "any",
        detail: e
      }
    }
  }

  async deletePayment(
    paymentSessionData: Record<string, any>
  ): Promise<
    PaymentProviderError | PaymentProviderSessionResponse["data"]
  > {
    const externalId = paymentSessionData.id

    try {
      await this.client.hsPaymentsDelete(externalId)
    } catch (e) {
      return {
        error: e,
        code: "any",
        detail: e
      }
    }
  }

  async getPaymentStatus(
    paymentSessionData: Record<string, any>
  ): Promise<PaymentSessionStatus> {
    const externalId = paymentSessionData.id

    try {
      const status = await this.client.hsPaymentsGetStatus(externalId)

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
    paymentData: Record<string, any>,
    refundAmount: number
  ): Promise<
    PaymentProviderError | PaymentProviderSessionResponse["data"]
  > {
    const externalId = paymentData.id

    try {
      const newData = await this.client.hsPaymentsRefund(
        externalId,
        new BigNumber(refundAmount)
      )

      return {
        ...newData,
        id: externalId
      }
    } catch (e) {
      return {
        error: e,
        code: "any",
        detail: e
      }
    }
  


  }

  ///Retrieves a Payment. 
  ///This can also be used to get the status of a previously initiated payment 
  ///or next action for an ongoing payment
  async retrievePayment(
    paymentSessionData: Record<string, any>
  ): Promise<
    PaymentProviderError | PaymentProviderSessionResponse["data"]
  > {
    const externalId = paymentSessionData.id

    try {
      const result = await this.client.hsPaymentsRetrieve(externalId, "any", false, false, false)

      return {
        ...(typeof result === 'object' ? result : {}),
        id: externalId
      }
    } catch (e) {
      return {
        error: e,
        code: "any",
        detail: e
      }
    }
  }

  ///To update the properties of a PaymentIntent object. 
  ///This may include attaching a payment method, or attaching customer object 
  ////or metadata fields after the Payment is created
  async updatePayment(
    context: UpdatePaymentProviderSession
  ): Promise<PaymentProviderError | PaymentProviderSessionResponse> {
    const {
      amount,
      currency_code,
      context: customerDetails,
      data
    } = context
    const externalId = data.id as string

    console.log(customerDetails)
    console.log(currency_code)

    try {
      const response = await this.client.hsPaymentsUpdate(
        externalId,
        new BigNumber(amount)
      )

      return {
        ...(typeof response === 'object' ? response : {}),
        data: {
          id: externalId
        }
      }
    } catch (e) {
      return {
        error: e,
        code: "any",
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


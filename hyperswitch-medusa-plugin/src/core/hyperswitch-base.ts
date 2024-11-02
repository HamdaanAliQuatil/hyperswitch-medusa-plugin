import {
  AbstractPaymentProvider,
  BigNumber,
  isDefined,
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

abstract class HyperswitchBase extends AbstractPaymentProvider<Options> {
  static identifier = 'hyperswitch-medusa-plugin';
  protected logger_: Logger;
  protected options_: Options;

  //TODO: Add Hyper-node service

  protected client;

  static validateOptions(options: Record<string | number | symbol, any>) {
    if (!isDefined(options.apiKey)){
      throw new Error("Required option `apiKey` is missing in HyperSwitch Plugin");
    }
  }

  constructor(
      { logger }: InjectedDependencies,
      options: Options,
      ...args: any[]
  ) {
      // @ts-expect-error - super() is not called
      super(...args);

      this.logger_ = logger;
      this.options_ = options;

      this.client = new HyperswitchClinet(options.apiKey);
  }

  async capturePayment(
      paymentData: Record<string, any>
  ): Promise<PaymentProviderError | PaymentProviderSessionResponse['data']> {
      const externalId = paymentData.id;

      try {
          const newData = await this.client.hsPaymentsCapture(externalId, new BigNumber(100));

          return {
              ...(typeof newData === 'object' ? newData : {}),
              id: externalId
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

  ///Fetch the status of a payment
  async getPaymentStatus(
      paymentSessionData: Record<string, any>
  ): Promise<PaymentSessionStatus> {
      const externalId = paymentSessionData.id as string

      try {
          //TODO: Swap with Hyper-node service
          const status = await this.client.hsPaymentsGetStatus(externalId, "any", false, false, false)

          switch (status) {
            case "requires_payment_method":
            case "requires_confirmation":
            case "processing":
              return PaymentSessionStatus.PENDING
            case "requires_action":
              return PaymentSessionStatus.REQUIRES_MORE
            case "canceled":
              return PaymentSessionStatus.CANCELED
            case "requires_capture":
              return PaymentSessionStatus.AUTHORIZED
            case "succeeded":
              return PaymentSessionStatus.CAPTURED
            default:
              return PaymentSessionStatus.PENDING
          }
      } catch (e) {
          return e
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
              ...(typeof newData === 'object' ? newData : {}),
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
          switch (data.event_type) {
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

export default HyperswitchBase

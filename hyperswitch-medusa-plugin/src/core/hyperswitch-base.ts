import {
  AbstractPaymentProvider,
  isDefined,
  isPaymentProviderError,
  isPresent,
  PaymentSessionStatus,
  PaymentActions
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

import Stripe from "@juspay-tech/hyper-node";

import { ErrorCodes, ErrorIntentStatus, Options, PaymentIntentOptions } from '../types';
import { EOL } from 'os';
import { getAmountFromSmallestUnit, getSmallestUnit } from '../utils/utils';
import createChalkLogger from '../utils/logger';

type InjectedDependencies = {
  logger: Logger;
};

abstract class HyperswitchBase extends AbstractPaymentProvider<Options> {
  static identifier = 'hyperswitch-medusa-plugin';
  protected logger_: Logger;
  protected options_: Options;
  protected stripe_: Stripe;

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

      this.logger_ = createChalkLogger(logger);
      this.options_ = options;

      this.client = new Stripe(options.apiKey, {
        apiVersion: "2020-08-27"
      });
  }

  abstract get paymentIntentOptions(): PaymentIntentOptions

  get options(): Options {
    return this.options_
  }

  getPaymentIntentOptions(): PaymentIntentOptions {
    const options: PaymentIntentOptions = {}

    if (this?.paymentIntentOptions?.capture_method) {
      options.capture_method = this.paymentIntentOptions.capture_method
    }

    if (this?.paymentIntentOptions?.setup_future_usage) {
      options.setup_future_usage = this.paymentIntentOptions.setup_future_usage
    }

    if (this?.paymentIntentOptions?.payment_method_types) {
      options.payment_method_types =
        this.paymentIntentOptions.payment_method_types
    }

    return options
  }

  ///Captures a payment.
  ///Capture the funds of an existing uncaptured PaymentIntent when its status is requires_capture.
  ///Uncaptured PaymentIntents will be canceled a set number of days after they are created (7 by default).
  async capturePayment(
      paymentData: Record<string, any>
  ): Promise<PaymentProviderError | PaymentProviderSessionResponse['data']> {
      const externalId = paymentData.id as string

      const activityId = this.logger_.activity("Capturing payment");

      try {
          this.logger_.progress(activityId, "Payment captured");
          const intent = await this.stripe_.paymentIntents.capture(externalId)
          return intent as unknown as PaymentProviderSessionResponse['data']
      } catch (error) {
        this.logger_.error("An error occurred in capturePayment", error)
        if (error.code === ErrorCodes.PAYMENT_INTENT_UNEXPECTED_STATE) {
            if (error.payment_intent?.status === ErrorIntentStatus.SUCCEEDED) {
              return error.payment_intent
            }
        }
      }
  }

  ///Authorizes a payment.
  async authorizePayment(
      paymentSessionData: Record<string, any>
  ): Promise<
      PaymentProviderError | {
          status: PaymentSessionStatus
          data: PaymentProviderSessionResponse["data"]
      }
  > {
    const activityId = this.logger_.activity("Authorizing payment");
      try {
        const status = await this.getPaymentStatus(paymentSessionData)

        this.logger_.progress(activityId, "Payment authorized");
        return { data: paymentSessionData, status }
      } catch (e) {
        this.logger_.failure(activityId, "Error authorizing payment");
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
    const externalId = paymentData.id as string
  
    try {
      const intent = await this.stripe_.paymentIntents.cancel(externalId)
      this.logger_.success("Payment canceled successfully", intent.id)
      return intent as unknown as PaymentProviderSessionResponse['data']
    } catch (error) {
      if (error.payment_intent?.status === ErrorIntentStatus.CANCELED) {
        this.logger_.info("Payment was already canceled");
        return error.payment_intent;
      } else {
        this.logger_.error("An error occurred while canceling the payment", error)
        return this.buildError("An error occurred in cancelPayment", error)
      }
    }
  }
  
  ///Creates a payment object when amount and currency are passed.
  async initiatePayment(
      input: CreatePaymentProviderSession
  ): Promise<PaymentProviderError | PaymentProviderSessionResponse> {
    const intentRequestData = this.getPaymentIntentOptions()
    const { email, extra, session_id, customer } = input.context
    const { currency_code, amount } = input

    const activityId = this.logger_.activity("Creating Stripe payment intent")
  
    const description = (extra?.payment_description ??
      this.options_?.paymentDescription) as string

    const intentRequest: Stripe.PaymentIntentCreateParams = {
      description,
      amount: getSmallestUnit(amount, currency_code),
      currency: currency_code,
      metadata: { session_id: session_id },
      capture_method: this.options_.capture ? "automatic" : "manual",
      ...intentRequestData,
    }

    if (this.options_?.automaticPaymentMethods) {
      intentRequest.automatic_payment_methods = { enabled: true }
    }

    if (customer?.metadata?.stripe_id) {
      intentRequest.customer = customer.metadata.stripe_id as string
    } else {
      this.logger_.activity("Creating Stripe customer", input)
      try {
        const stripeCustomer = await this.stripe_.customers.create({
          email,
        });
        intentRequest.customer = stripeCustomer.id;
        this.logger_.success("Hyperswitch customer created successfully", stripeCustomer.id);
      } catch (e) {
        this.logger_.error("An error occurred while creating a Stripe customer", e)
        return this.buildError(
          "An error occurred in initiatePayment when creating a Stripe customer",
          e
        )
      }
    }
  
    this.logger_.activity("Creating Stripe payment intent", intentRequest)
    try {
      const sessionData = (await this.stripe_.paymentIntents.create(
        intentRequest
      )) as unknown as Record<string, unknown>;
      this.logger_.success("Stripe payment intent created successfully", activityId)
      return {
        data: sessionData,
      };
    } catch (e) {
      this.logger_.error("An error occurred in InitiatePayment during the creation of the stripe payment intent", e)
      return this.buildError(
        "An error occurred in InitiatePayment during the creation of the stripe payment intent",
        e
      )
    }
  }

  async deletePayment(
      paymentSessionData: Record<string, any>
  ): Promise<
      PaymentProviderError | PaymentProviderSessionResponse["data"]
  > {
      this.logger_.activity("Deleting payment", paymentSessionData)
      return await this.cancelPayment(paymentSessionData)
  }

  ///Fetch the status of a payment
  async getPaymentStatus(
      paymentSessionData: Record<string, any>
  ): Promise<PaymentSessionStatus> {
      const externalId = paymentSessionData.id as string

      try {
          this.logger_.activity("Retrieving payment status", paymentSessionData)
          const paymentIntent = await this.stripe_.paymentIntents.retrieve(externalId)

          switch (paymentIntent.status) {
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
          this.logger_.error("An error occurred in getPaymentStatus", e)
          return e
      }
  }

  async refundPayment(
      paymentSessionData: Record<string, any>,
      refundAmount: number
  ): Promise<
      PaymentProviderError | PaymentProviderSessionResponse["data"]
  > {
    const id = paymentSessionData.id as string

    try {
      this.logger_.activity("Refunding payment", paymentSessionData)
      const { currency } = paymentSessionData
      await this.stripe_.refunds.create({
        amount: getSmallestUnit(refundAmount, currency as string),
        payment_intent: id as string,
      })
    } catch (e) {
      this.logger_.error("An error occurred in refundPayment", e)
      return this.buildError("An error occurred in refundPayment", e)
    }

    return paymentSessionData
  }

  ///Retrieves a Payment. 
  ///This can also be used to get the status of a previously initiated payment 
  ///or next action for an ongoing payment
  async retrievePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<PaymentProviderError | PaymentProviderSessionResponse["data"]> {
    try {
      const id = paymentSessionData.id as string
      const intent = await this.stripe_.paymentIntents.retrieve(id)
      
      this.logger_.activity("Payment retrieved successfully", intent)
      intent.amount = getAmountFromSmallestUnit(intent.amount, intent.currency)

      return intent as unknown as PaymentProviderSessionResponse["data"]
    } catch (e) {
      this.logger_.error("An error occurred in retrievePayment", e)
      return this.buildError("An error occurred in retrievePayment", e)
    }
  }

  ///To update the properties of a PaymentIntent object. 
  ///This may include attaching a payment method, or attaching customer object 
  ////or metadata fields after the Payment is created
  async updatePayment(
    input: UpdatePaymentProviderSession
  ): Promise<PaymentProviderError | PaymentProviderSessionResponse> {
    const { context, data, currency_code, amount } = input

    const amountNumeric = getSmallestUnit(amount, currency_code)

    const stripeId = context.customer?.metadata?.stripe_id

    const activityId = this.logger_.activity("Updating payment", input)

    if (stripeId !== data.customer) {
      const result = await this.initiatePayment(input)
      if (isPaymentProviderError(result)) {
        this.logger_.error("An error occurred in updatePayment during the initiate of the new payment for the new customer")
        return this.buildError(
          "An error occurred in updatePayment during the initiate of the new payment for the new customer",
          result
        )
      }

      this.logger_.success("Payment updated successfully", activityId)
      return result
    } else {
      if (isPresent(amount) && data.amount === amountNumeric) {
        this.logger_.info("No changes to amount")
        return { data }
      }

      try {
        const id = data.id as string
        const sessionData = (await this.stripe_.paymentIntents.update(id, {
          amount: amountNumeric,
        })) as unknown as PaymentProviderSessionResponse["data"]

        this.logger_.success("Payment updated successfully", activityId)
        return { data: sessionData }
      } catch (e) {
        this.logger_.error("An error occurred in updatePayment", e)
        return this.buildError("An error occurred in updatePayment", e)
      }
    }
  }

  constructWebhookEvent(data: ProviderWebhookPayload["payload"]): Stripe.Event {
    const signature = data.headers["stripe-signature"] as string

    this.logger_.activity("Constructing webhook event", data)
    return this.stripe_.webhooks.constructEvent(
      data.rawData as string | Buffer,
      signature,
      this.options_.webhookSecret
    )
  }

  async getWebhookActionAndData(
      payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {

      const event = this.constructWebhookEvent(payload)
      const intent = event.data.object as Stripe.PaymentIntent

      const { currency } = intent
      const activityId = this.logger_.activity("Processing webhook event", event)

      switch (event.type) {
          case "payment_intent.amount_capturable_updated":{
              this.logger_.progress(activityId, "Payment intent amount capturable updated")
              return {
                  action: PaymentActions.AUTHORIZED,
                  data: {
                      session_id: intent.metadata.session_id,
                      amount: getAmountFromSmallestUnit(
                          intent.amount_capturable,
                          currency
                      ),
                  },
              }
            }
          case "payment_intent.succeeded": {
              this.logger_.progress(activityId, "Payment intent succeeded")
              return {
                  action: PaymentActions.SUCCESSFUL,
                  data: {
                      session_id: intent.metadata.session_id,
                      amount: getAmountFromSmallestUnit(intent.amount_received, currency),
                  },
              }
            }
          case "payment_intent.payment_failed": {
              this.logger_.progress(activityId, "Payment intent payment failed")
              return {
                  action: PaymentActions.FAILED,
                  data: {
                      session_id: intent.metadata.session_id,
                      amount: getAmountFromSmallestUnit(intent.amount, currency),
                  },
              }
            }
          default: {
              this.logger_.progress(activityId, "Payment intent not supported")
              return { action: PaymentActions.NOT_SUPPORTED }
          }
      }
  }

  protected buildError(
    message: string,
    error: Stripe.StripeRawError | PaymentProviderError | Error
  ): PaymentProviderError {
    this.logger_.error(message, error as Error)
    return {
      error: message,
      code: "code" in error ? error.code : "unknown",
      detail: isPaymentProviderError(error)
        ? `${error.error}${EOL}${error.detail ?? ""}`
        : "detail" in error
        ? error.detail
        : error.message ?? "",
    }
      }
  }

export default HyperswitchBase

import {
  AbstractPaymentProvider,
  MedusaError,
} from '@medusajs/framework/utils';
import {
  Logger,
  PaymentProviderError,
  PaymentProviderSessionResponse,
} from '@medusajs/framework/types';

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

    this.client = new Client(options);
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

  async refundPayment(
    paymentData: Record<string, unknown>
  ): Promise<PaymentProviderError | PaymentProviderSessionResponse['data']> {
    const externalId = paymentData.id;

    try {
      const newData = await this.client.refundPayment(externalId);

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
}

export default HyperswitchMedusaService;

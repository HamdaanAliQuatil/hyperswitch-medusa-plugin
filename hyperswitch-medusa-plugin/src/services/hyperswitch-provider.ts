import HyperswitchBase from "../core/hyperswitch-base";
import { PaymentProviderKeys, PaymentIntentOptions } from "../types";

class HyperswitchProviderService extends HyperswitchBase {
    static identifier: string = PaymentProviderKeys.HYPERSWITCH;

    constructor(_: any, options: any){
        super(_, options);
    }

    get paymentIntentOptions(): PaymentIntentOptions {
        return {}
    }
}

export default HyperswitchProviderService;

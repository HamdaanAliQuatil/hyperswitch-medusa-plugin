import { 
  ModuleProvider, 
  Modules
} from "@medusajs/framework/utils"

import { HyperswitchProviderService } from "./services"

const services = [
    HyperswitchProviderService
]

export default ModuleProvider(Modules.PAYMENT, {
  services,
})

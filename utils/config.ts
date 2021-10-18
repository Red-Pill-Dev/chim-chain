import * as dotenv from 'dotenv';
import env = require('env-var');

dotenv.config({ path: '.env_secret' });
dotenv.config({ path: '.env_base' });

export const secretConfig = {
  etherscanApiKey: env.get('ETHERSCAN_API_KEY').required(true).asString(),
  contractsOwnerPrivateKey: env.get('CONTRACTS_OWNER_PRIVATE_KEY').asString(),
};

export const baseConfig = {
  gasPriceInGwei: env.get('GAS_PRICE_IN_GWEI').default(15).asInt(),
  gasLimit: env.get('GAS_LIMIT').default(5000000).asInt(),
  gweiDecimals: 9,
  ethDecimals: 18,
  daySec: env.get('DAY_SEC').default(86400).asInt(),
};

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

export const walletsConfig = [
  env.get('WALLET_1_ADDRESS').required(false).asString(),
  env.get('WALLET_2_ADDRESS').required(false).asString(),
  env.get('WALLET_3_ADDRESS').required(false).asString(),
];

export const contractsConfig = {
  chimToken: {
    totalSupply: '62000000',
    maxTotalSupply: '75000000',
    contractAddress: env.get('CONTRACT_CHIM_TOKEN_ADDRESS').required(false).asString(),
  },
  chimVesting: {
    plans: [
      {
        id: 1,
        name: 'Team',
        maxPlanTotal: 11250000,
        startPercent: 0, // 0 equal 0.00%
        startDelay: baseConfig.daySec * 30, // equal 30 days,
        nextPercent: 200, // 200 equal 2.00%
        nextDelay: baseConfig.daySec * 30, // equal 30 days,
      },
      {
        id: 2,
        name: 'Advisors',
        maxPlanTotal: 3375000,
        startPercent: 0, // 0 equal 0.00%
        startDelay: baseConfig.daySec * 30, // equal 30 days,
        nextPercent: 300, // 300 equal 3.00%
        nextDelay: baseConfig.daySec * 30, // equal 30 days,
      },
      {
        id: 3,
        name: 'Early Supporters Allocation',
        maxPlanTotal: 6000000,
        startPercent: 0, // 0 equal 0.00%
        startDelay: baseConfig.daySec * 30, // equal 30 days,
        nextPercent: 800, // 800 equal 8.00%
        nextDelay: baseConfig.daySec * 30, // equal 30 days,
      },
      {
        id: 4,
        name: 'Business Expenses',
        maxPlanTotal: 7500000,
        startPercent: 0, // 0 equal 0.00%
        startDelay: baseConfig.daySec * 30, // equal 30 days,
        nextPercent: 400, // 400 equal 4.00%
        nextDelay: baseConfig.daySec * 30, // equal 30 days,
      },
      {
        id: 5,
        name: 'Special program for strong holders',
        maxPlanTotal: 3750000,
        startPercent: 0, // 0 equal 0.00%
        startDelay: baseConfig.daySec * 180, // equal 180 days,
        nextPercent: 300, // 300 equal 3.00%
        nextDelay: baseConfig.daySec * 30, // equal 30 days,
      },
      {
        id: 6,
        name: 'NFT, Liquidity mining programs',
        maxPlanTotal: 6000000,
        startPercent: 0, // 0 equal 0.00%
        startDelay: baseConfig.daySec * 180, // equal 180 days,
        nextPercent: 400, // 400 equal 4.00%
        nextDelay: baseConfig.daySec * 30, // equal 30 days,
      },
      {
        id: 7,
        name: 'Game Farming',
        maxPlanTotal: 6750000,
        startPercent: 385, // 385 equal 3.85%
        startDelay: baseConfig.daySec * 30, // equal 30 days,
        nextPercent: 385, // 385 equal 3.85%
        nextDelay: baseConfig.daySec * 30, // equal 30 days,
      },
      {
        id: 8,
        name: 'Early CHIM users, KOLs, Influencers',
        maxPlanTotal: 1500000,
        startPercent: 0, // 0 equal 0%
        startDelay: baseConfig.daySec * 30, // equal 30 days,
        nextPercent: 193, // 193 equal 1.93%
        nextDelay: baseConfig.daySec * 7, // equal 7 days,
      },
      {
        id: 9,
        name: 'Reserve',
        maxPlanTotal: 9875000,
        startPercent: 0, // 0 equal 0%
        startDelay: baseConfig.daySec * 30, // equal 30 days,
        nextPercent: 300, // 300 equal 3.00%
        nextDelay: baseConfig.daySec * 30, // equal 30 days,
      },
      {
        id: 10,
        name: 'Pool 1 sold out',
        maxPlanTotal: 1000000,
        startPercent: 500, // 500 equal 5.00%
        startDelay: baseConfig.daySec * 7, // equal 7 days,
        nextPercent: 183, // 183 equal 1.83%
        nextDelay: baseConfig.daySec * 7, // equal 7 days,
      },
      {
        id: 11,
        name: 'Pool 2 sold out',
        maxPlanTotal: 2000000,
        startPercent: 600, // 600 equal 6.00%
        startDelay: baseConfig.daySec * 7, // equal 7 days,
        nextPercent: 218, // 218 equal 2.18%
        nextDelay: baseConfig.daySec * 7, // equal 7 days,
      },
      {
        id: 12,
        name: 'Pool 3 sold out',
        maxPlanTotal: 3000000,
        startPercent: 700, // 700 equal 7.00%
        startDelay: baseConfig.daySec * 7, // equal 7 days,
        nextPercent: 270, // 270 equal 2.70%
        nextDelay: baseConfig.daySec * 7, // equal 7 days,
      },
    ],
    contractAddress: env.get('CONTRACT_CHIM_VESTING_ADDRESS').required(false).asString(),
    releaseTime: env.get('CONTRACT_CHIM_VESTING_RELEASE_TIME_SEC').required(false).asInt()
  },
};

export const supportExternalNetworkChainIds = [
  97, // testnet
  56, // mainnet
];

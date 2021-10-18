import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';
import 'hardhat-typechain';
import '@typechain/ethers-v5';
import '@openzeppelin/hardhat-upgrades';

import { HardhatUserConfig } from 'hardhat/config';
import { secretConfig } from './utils/config';

const config: HardhatUserConfig = {
  solidity: '0.7.3',
  networks: {
    hardhat: {
      gas: 99999999,
      gasPrice: 20000000000,
      blockGasLimit: 999999999,
      allowUnlimitedContractSize: true,
    },
    testnet: {
      url: 'https://data-seed-prebsc-1-s1.binance.org:8545',
      chainId: 97,
      gasPrice: 20000000000
    },
    mainnet: {
      url: 'https://bsc-dataseed.binance.org/',
      chainId: 56,
      gasPrice: 20000000000
    }
  },
  typechain: {
    outDir: 'typechain',
    target: 'ethers-v5',
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: secretConfig.etherscanApiKey
  },
};

export default config;

# chim-chain

1. Make sure to use node v14.17.3

2. Run `npm install` in project root directory

3. Create `.env_secret` file
```
ETHERSCAN_API_KEY={YOUR_ETHERSCAN_API_KEY}, required (for test and scripts)

CONTRACTS_OWNER_ADDRESS={YOUR_OWNER_ADDRESS}, not required
CONTRACTS_OWNER_PRIVATE_KEY={YOUR_OWNER_PRIVATE_KEY} required (for all scripts)
```

4. Create `.env_base` file
```
GAS_PRICE_IN_GWEI={GAS_PRICE_IN_GWEI}, default: 15
GAS_LIMIT={GAS_LIMIT}, default: 5000000
DAY_SEC={DAY_SEC}, default: 86400 = 24 * 60 * 60 (equal 1 day)

CONTRACT_CHIM_TOKEN_ADDRESS={YOUR_CONTRACT_CHIM_TOKEN_ADDRESS}, required for deploy ChimVesting contract and mint tokens to ChimVesting contract
CONTRACT_CHIM_VESTING_ADDRESS={YOUR_CONTRACT_CHIM_VESTING_ADDRESS}, required for create ChimVesting plans, mint tokens to ChimVesting contract, ChimVesting lock tokens and ChimVesting set release time  
CONTRACT_CHIM_VESTING_RELEASE_TIME_SEC={YOUR_CONTRACT_CHIM_VESTING_RELEASE_TIME_SEC}, required for ChimVesting set release time
```

5. Run `npm run rebuild` in project root directory

6. Run tests:
    `npm run test` 
    
7. scripts to networks (mainnet, testnet):
    `npx hardhat run scripts/1-CHIM-token-deploy.ts --network mainnet|testnet`
    `npx hardhat run scripts/2-CHIM-vesting-deploy.ts --network mainnet|testnet`
    `npx hardhat run scripts/3-CHIM-vesting-create-plans.ts --network mainnet|testnet`
    `npx hardhat run scripts/4-CHIM-token-mint-to-CHIM-vesting-address.ts --network mainnet|testnet`
    `npx hardhat run scripts/5-CHIM-vesting-lock-tokens.ts --network mainnet|testnet`
    `npx hardhat run scripts/6-CHIM-vesting-set-release-time.ts --network mainnet|testnet`

# Contract descriptions:
### 1. The ChimUpgradeableV1 token contract is compatible with the ERC20/BEP20 standards. 
The @openzeppelin ERC20Upgradeable contract was taken as the basis with the added ability to pause the contract and add or remove addresses to and from the blacklist. The contract is deployed through a proxy using the @openzeppelin/hardhat-upgrades library.

### 2. ChimVesting is a contract used for transferring a certain amount of tokens to addresses based on a predetermined schedule with receipt delays.
The address can receive the tokens, or part of the amount of tokens, only upon the expiration of a certain period, which depends on the specific plan and date of vesting start. The admin, or owner, can set the date for vesting start, create and change vesting plans, and transfer a certain amount of tokens to the address based on the desired plan, since a single plan can entail several transfers to a single address. The calculation of the amounts of tokens users can withdraw starts from the date of vesting, which can be set only once. There are no withdrawals before vesting starts. The user can monitor and withdraw the amount that is available for withdrawal as per each plan.

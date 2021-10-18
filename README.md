# chim-chain

1. Make sure to use node v14.17.3

2. Run `npm install` in project root directory

3. Create `.env_secret` file
```
ETHERSCAN_API_KEY={YOUR_ETHERSCAN_API_KEY}, required (for test and scripts)

CONTRACT_OWNER_ADDRESS={OWNER_ADDRESS}, not required
CONTRACT_OWNER_PRIVATE_KEY={OWNER_PRIVATE_KEY}, required (for scripts)
```

4. Create `.env_basic` file
```
GAS_PRICE_IN_GWEI={GAS_PRICE_IN_GWEI}, default: 15
GAS_LIMIT={GAS_LIMIT}, default: 5000000
```

5. Run `npm run rebuild` in project root directory

6. Run tests: `npm run test` 

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
LOCK_PLAN_ID={EXIST_LOCK_PLAN_ID}, required for ChimVesting lock tokens
LOCK_ADDRESSES={COMMA_SEPARATED_LOCK_ADDRESSES}, required for ChimVesting lock tokens
LOCK_AMOUNTS={COMMA_SEPARATED_LOCK_AMOUNTS}, required for ChimVesting lock tokens
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

# Краткое описание контрактов:
### 1. ChimUpgradeableV1 - контракт токенов совместим с ERC20/BEP20. 
За основу взят @openzeppelin контракт ERC20Upgradeable с возможностью ставить контракт на паузу и добавлять/удалять адреса в/из блеклиста. Контракт разворачивается через proxy с помощью библиотеки @openzeppelin/hardhat-upgrades.

###2. ChimVesting - контракт для начисления адресам некой суммы токенов по определенному плану с задержкой получения.
Адрес может забрать свои токены (часть токенов) только с истечением времени, которое зависит от конкретного плана и даты старта вестинга. Админ (овнер) может установить дату старта вестинга, создать/изменить планы вестинга, также начислить адресу по нужному плану определенную сумму (по одному плану может быть несколько начисление одному адресу). Расчет сумм для вывода токенов пользователями начинается с даты старта вестинга (устанавливается 1 раз). Пока старта не было - никто ничего вывести не может. Пользователь может по каждому плану мониторить и выводить сумму, которая ему уже доступна для вывода.

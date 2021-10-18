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


# Краткое описание контрактов:
### 1. ChimUpgradeableV1 - контракт токенов совместим с ERC20/BEP20. 
За основу взят @openzeppelin контракт ERC20Upgradeable с возможностью ставить контракт на паузу и добавлять/удалять адреса в/из блеклиста. Контракт разворачивается через proxy с помощью библиотеки @openzeppelin/hardhat-upgrades.

###2. ChimVesting - контракт для начисления адресам некой суммы токенов по определенному плану с задержкой получения.
Адрес может забрать свои токены (часть токенов) только с истечением времени, которое зависит от конкретного плана и даты старта вестинга. Админ (овнер) может установить дату старта вестинга, создать/изменить планы вестинга, также начислить адресу по нужному плану определенную сумму (по одному плану может быть несколько начисление одному адресу). Расчет сумм для вывода токенов пользователями начинается с даты старта вестинга (устанавливается 1 раз). Пока старта не было - никто ничего вывести не может. Пользователь может по каждому плану мониторить и выводить сумму, которая ему уже доступна для вывода.

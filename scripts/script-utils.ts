import hre from 'hardhat';
import { BigNumber, Overrides } from 'ethers';

import {
  baseConfig,
  contractsConfig,
  secretConfig,
  supportExternalNetworkChainIds,
  walletsConfig,
} from '../utils/config';
import { getWalletByPrivateKey, logGasUsageEthTransaction, parseBigNumber, parseEthAddress } from '../utils/utilities';
import { ChimUpgradeableV1__factory, ChimVesting__factory } from '../typechain';
import { ChimUpgradeableV1 } from '../typechain/ChimUpgradeableV1';

export async function chimTokenDeployContract(): Promise<void> {
  console.log(`\n\nCHIM token deploy. Config: ${JSON.stringify(Object.assign({}, baseConfig, contractsConfig.chimToken))}`);
  if (!secretConfig.contractsOwnerPrivateKey
    || !baseConfig.gasPriceInGwei
    || !baseConfig.gasLimit
  ) {
    throw new Error('Environment variables not specified');
  }

  console.log(`\nGet network`);
  const networkChainId = (await hre.ethers.provider.getNetwork()).chainId;
  console.log(`Network chain id: ${networkChainId}`);

  console.log('\nGet and check wallet');
  const wallet = supportExternalNetworkChainIds.indexOf(networkChainId) !== -1
    ? getWalletByPrivateKey(secretConfig.contractsOwnerPrivateKey)
    : (await hre.ethers.getSigners())[0];
  console.log(`Wallet address: ${wallet.address}`);

  console.log(`\nDeploy ChimUpgradeableV1`);
  const deployParams = [
    parseBigNumber(contractsConfig.chimToken.maxTotalSupply, baseConfig.ethDecimals),
  ];
  console.log(`Deploy params: ${deployParams.join(',')}`);
  const contractFactory = await new (ChimUpgradeableV1__factory as any)(wallet);
  const token = (await hre.upgrades.deployProxy(
      contractFactory,
      deployParams,
      { initializer: 'initialize' },
    )
  ) as ChimUpgradeableV1;
  await token.deployed();
  console.log(`Deployed to address: ${token.address}`);
  console.log(`Transaction id: ${token.deployTransaction.hash}`);
  console.log(`Waiting for confirmation transaction ...`);
  const gasLimit = token.deployTransaction && token.deployTransaction.gasLimit && token.deployTransaction.gasLimit.toNumber();
  const confirmedTx = await token.deployTransaction.wait();
  const useGas = confirmedTx.gasUsed && confirmedTx.gasUsed.toNumber();
  const percentUse = gasLimit && useGas && Number(useGas * 100 / gasLimit).toFixed(2);
  console.log(`Transaction confirmed in block: ${confirmedTx.blockNumber}.\tUseGas - ${useGas} of ${gasLimit} ${percentUse ? `(${percentUse} %)` : ''}`);

  console.log('\nEtherscan verify script:');
  console.log(`Logic contract: npx hardhat verify --network <<network>> <<logicAddress>>`);
  console.log(`ProxyAdmin contract: npx hardhat verify --network <<network>> <<proxyAdminAddress>>`);
  console.log(`Proxy contract: npx hardhat verify --network <<network>> <<proxyAddress>> <<logicAddress>> <<proxyAdminAddress>> <<encodedInitializeDataParams>>`);
}

export async function chimVestingDeployContract(): Promise<void> {
  console.log(`\n\nCHIM vesting deploy. Config: ${JSON.stringify(Object.assign({}, baseConfig, { chimTokenAddress: contractsConfig.chimToken.contractAddress }))}`);
  if (!secretConfig.contractsOwnerPrivateKey
    || !baseConfig.gasPriceInGwei
    || !baseConfig.gasLimit
    || !contractsConfig.chimToken.contractAddress
  ) {
    throw new Error('Environment variables not specified');
  }

  console.log(`\nGet network`);
  const networkChainId = (await hre.ethers.provider.getNetwork()).chainId;
  console.log(`Network chain id: ${networkChainId}`);

  console.log('\nGet and check wallet and token address');
  const wallet = supportExternalNetworkChainIds.indexOf(networkChainId) !== -1
    ? getWalletByPrivateKey(secretConfig.contractsOwnerPrivateKey)
    : (await hre.ethers.getSigners())[0];
  const chimTokenAddress = parseEthAddress(contractsConfig.chimToken.contractAddress);
  console.log(`Wallet address: ${wallet.address}`);
  console.log(`CHIM token address: ${chimTokenAddress}`);

  console.log('\nGet overrides');
  const overrides: Overrides = {
    gasPrice: parseBigNumber(baseConfig.gasPriceInGwei.toString(), baseConfig.gweiDecimals),
    gasLimit: baseConfig.gasLimit,
  };
  console.log(`Overrides: ${JSON.stringify(overrides)}`);

  console.log(`\nDeploy ChimVesting`);
  const deployParams = [
    chimTokenAddress,
  ];
  console.log(`Deploy params: ${deployParams.join(',')}`);
  const vesting = await new ChimVesting__factory(wallet).deploy(
    chimTokenAddress,
    overrides,
  );
  await vesting.deployed();
  console.log(`Deployed to address: ${vesting.address}`);
  console.log(`Transaction id: ${vesting.deployTransaction.hash}`);
  console.log(`Waiting for confirmation transaction ...`);
  const gasLimit = vesting.deployTransaction && vesting.deployTransaction.gasLimit && vesting.deployTransaction.gasLimit.toNumber();
  const confirmedTx = await vesting.deployTransaction.wait();
  const useGas = confirmedTx.gasUsed && confirmedTx.gasUsed.toNumber();
  const percentUse = gasLimit && useGas && Number(useGas * 100 / gasLimit).toFixed(2);
  console.log(`Transaction confirmed in block: ${confirmedTx.blockNumber}.\tUseGas - ${useGas} of ${gasLimit} ${percentUse ? `(${percentUse} %)` : ''}`);

  console.log('\nEtherscan verify script:');
  const etherscanVerifyScript = `npx hardhat verify --network --network <<network>> ${vesting.address} ${deployParams.join(' ')}`;
  console.log(etherscanVerifyScript);
}

export async function chimVestingCreatePlans(): Promise<void> {
  console.log(`\n\nCHIM vesting create plans. Config: ${JSON.stringify(Object.assign({}, baseConfig, {
    chimVestingAddress: contractsConfig.chimVesting.contractAddress,
    chimVestingPlansLength: contractsConfig.chimVesting.plans.length,
  }))}`);
  if (!secretConfig.contractsOwnerPrivateKey
    || !baseConfig.gasPriceInGwei
    || !baseConfig.gasLimit
    || !contractsConfig.chimVesting.contractAddress
      || contractsConfig.chimVesting.plans.length === 0
  ) {
    throw new Error('Environment variables not specified');
  }

  console.log(`\nGet network`);
  const networkChainId = (await hre.ethers.provider.getNetwork()).chainId;
  console.log(`Network chain id: ${networkChainId}`);

  console.log('\nGet and check wallet and vesting address');
  const wallet = supportExternalNetworkChainIds.indexOf(networkChainId) !== -1
    ? getWalletByPrivateKey(secretConfig.contractsOwnerPrivateKey)
    : (await hre.ethers.getSigners())[0];
  const chimVestingAddress = parseEthAddress(contractsConfig.chimVesting.contractAddress);
  console.log(`Wallet address: ${wallet.address}`);
  console.log(`CHIM vesting address: ${chimVestingAddress}`);

  console.log('\nGet overrides');
  const overrides: Overrides = {
    gasPrice: parseBigNumber(baseConfig.gasPriceInGwei.toString(), baseConfig.gweiDecimals),
    gasLimit: baseConfig.gasLimit,
  };
  console.log(`Overrides: ${JSON.stringify(overrides)}`);

  console.log(`\nConnect to ChimVesting: ${chimVestingAddress}`);
  const vesting = await new ChimVesting__factory(wallet).attach(chimVestingAddress);
  console.log(`Successfully connected to ChimVesting: ${chimVestingAddress}`);

  console.log('\nCreate ChimVesting plans:');
  for (let i = 0; i < contractsConfig.chimVesting.plans.length; i++) {
    const plan = contractsConfig.chimVesting.plans[i];
    const confirmedTx = await vesting.connect(wallet).addLockPlan(
      plan.name,
      parseBigNumber(plan.maxPlanTotal.toString(), baseConfig.ethDecimals),
      plan.startPercent,
      plan.startDelay,
      plan.nextPercent,
      plan.nextDelay,
      overrides,
    );
    await logGasUsageEthTransaction(`addLockPlan - ${plan.name}`, (confirmedTx as any));
  }
}

export async function chimTokenMintToChimVestingAddress(): Promise<void> {
  console.log(`\n\nCHIM token mint to CHIM vesting address. Config: ${JSON.stringify(Object.assign({}, baseConfig, {
    chimTokenAddress: contractsConfig.chimToken.contractAddress,
    chimVestingAddress: contractsConfig.chimVesting.contractAddress,
  }))}`);
  if (!secretConfig.contractsOwnerPrivateKey
    || !baseConfig.gasPriceInGwei
    || !baseConfig.gasLimit
    || !contractsConfig.chimToken.contractAddress
    || !contractsConfig.chimVesting.contractAddress
  ) {
    throw new Error('Environment variables not specified');
  }

  console.log(`\nGet network`);
  const networkChainId = (await hre.ethers.provider.getNetwork()).chainId;
  console.log(`Network chain id: ${networkChainId}`);

  console.log('\nGet and check wallet, token and vesting address');
  const wallet = supportExternalNetworkChainIds.indexOf(networkChainId) !== -1
    ? getWalletByPrivateKey(secretConfig.contractsOwnerPrivateKey)
    : (await hre.ethers.getSigners())[0];
  const chimTokenAddress = parseEthAddress(contractsConfig.chimToken.contractAddress);
  const chimVestingAddress = parseEthAddress(contractsConfig.chimVesting.contractAddress);
  console.log(`Wallet address: ${wallet.address}`);
  console.log(`CHIM token address: ${chimTokenAddress}`);
  console.log(`CHIM vesting address: ${chimVestingAddress}`);

  console.log('\nGet overrides');
  const overrides: Overrides = {
    gasPrice: parseBigNumber(baseConfig.gasPriceInGwei.toString(), baseConfig.gweiDecimals),
    gasLimit: baseConfig.gasLimit,
  };
  console.log(`Overrides: ${JSON.stringify(overrides)}`);

  console.log(`\nConnect to ChimUpgradeableV1: ${chimTokenAddress}`);
  const token = await new ChimUpgradeableV1__factory(wallet).attach(chimTokenAddress);
  console.log(`Successfully connected to ChimUpgradeableV1: ${chimTokenAddress}`);

  console.log(`\nMint CHIM tokens to chimVesting address: ${chimVestingAddress}`);
  const totalSupply = parseBigNumber(contractsConfig.chimToken.totalSupply, baseConfig.ethDecimals);
  const confirmedTx = await token.mintAmount(chimVestingAddress, totalSupply, overrides);
  await logGasUsageEthTransaction(`mintAmount - ${totalSupply} to ${chimVestingAddress}`, (confirmedTx as any));
}

export async function chimVestingLockTokens(): Promise<void> {
  console.log(`\n\nCHIM vesting lock tokens. Config: ${JSON.stringify(Object.assign({}, baseConfig, { chimVestingAddress: contractsConfig.chimVesting.contractAddress }, walletsConfig))}`);
  if (!secretConfig.contractsOwnerPrivateKey
    || !baseConfig.gasPriceInGwei
    || !baseConfig.gasLimit
    || !contractsConfig.chimVesting.contractAddress
  ) {
    throw new Error('Environment variables not specified');
  }

  console.log(`\nGet network`);
  const networkChainId = (await hre.ethers.provider.getNetwork()).chainId;
  console.log(`Network chain id: ${networkChainId}`);

  console.log('\nGet and check wallet and vesting address');
  const wallet = supportExternalNetworkChainIds.indexOf(networkChainId) !== -1
    ? getWalletByPrivateKey(secretConfig.contractsOwnerPrivateKey)
    : (await hre.ethers.getSigners())[0];
  const walletNonce = await wallet.getTransactionCount('pending');
  const chimVestingAddress = parseEthAddress(contractsConfig.chimVesting.contractAddress);
  console.log(`Wallet address: ${wallet.address}`);
  console.log(`Wallet nonce: ${walletNonce}`);
  console.log(`CHIM vesting address: ${chimVestingAddress}`);

  console.log('\nGet overrides');
  const overrides: Overrides = {
    gasPrice: parseBigNumber(baseConfig.gasPriceInGwei.toString(), baseConfig.gweiDecimals),
    gasLimit: baseConfig.gasLimit,
  };
  console.log(`Overrides: ${JSON.stringify(overrides)}`);

  console.log(`\nConnect to ChimVesting: ${chimVestingAddress}`);
  const vesting = await new ChimVesting__factory(wallet).attach(chimVestingAddress);
  console.log(`Successfully connected to ChimVesting: ${chimVestingAddress}`);

  console.log(`\nLock tokens for all plans`);
  const listTx = [];
  const receiversAddresses = walletsConfig.filter(item => item !== undefined).map(item => parseEthAddress(item as string));
  console.log(`receiversAddresses: ${receiversAddresses.join(', ')}`);
  for (let i = 0; i < contractsConfig.chimVesting.plans.length; i++) {
    const plan = contractsConfig.chimVesting.plans[i];
    const planId = BigNumber.from(plan.id);
    let totalLock = parseBigNumber(plan.maxPlanTotal.toString(), baseConfig.ethDecimals).div(10);
    for (let j = 0; j < receiversAddresses.length; j++) {
      const receiverAddress = receiversAddresses[j];
      const receiversAmount = j === receiversAddresses.length - 1 ? totalLock : totalLock.mul(67).div(100);
      totalLock = totalLock.sub(receiversAmount);
      listTx.push(vesting.connect(wallet).lockTokens(
        receiverAddress,
        receiversAmount,
        planId,
        Object.assign({}, overrides, { nonce: walletNonce + i * receiversAddresses.length + j }),
      ));
    }
  }
  const txList = await Promise.all(listTx);
  console.log(`Tx ids: ${txList.map(item => item.hash).join(', ')}`);
  const blockNumbers = await Promise.all(txList.map(item => item.wait()));
  console.log(`Block numbers: ${blockNumbers.map(item => item.blockNumber).join(', ')}`);
  console.log(`Gas used: ${blockNumbers.map(item => item.gasUsed).join(', ')}`);
}

export async function chimVestingSetReleaseTime(): Promise<void> {
  console.log(`\n\nCHIM vesting set release time. Config: ${JSON.stringify(Object.assign({}, baseConfig, {
    chimVestingAddress: contractsConfig.chimVesting.contractAddress,
    chimVestingReleaseTime: contractsConfig.chimVesting.releaseTime,
  }))}`);
  if (!secretConfig.contractsOwnerPrivateKey
    || !baseConfig.gasPriceInGwei
    || !baseConfig.gasLimit
    || !contractsConfig.chimVesting.contractAddress
    || !contractsConfig.chimVesting.releaseTime
  ) {
    throw new Error('Environment variables not specified');
  }

  console.log(`\nGet network`);
  const networkChainId = (await hre.ethers.provider.getNetwork()).chainId;
  console.log(`Network chain id: ${networkChainId}`);

  console.log('\nGet and check wallet and vesting address');
  const wallet = supportExternalNetworkChainIds.indexOf(networkChainId) !== -1
    ? getWalletByPrivateKey(secretConfig.contractsOwnerPrivateKey)
    : (await hre.ethers.getSigners())[0];
  const chimVestingAddress = parseEthAddress(contractsConfig.chimVesting.contractAddress);
  console.log(`Wallet address: ${wallet.address}`);
  console.log(`CHIM vesting address: ${chimVestingAddress}`);

  console.log('\nGet overrides');
  const overrides: Overrides = {
    gasPrice: parseBigNumber(baseConfig.gasPriceInGwei.toString(), baseConfig.gweiDecimals),
    gasLimit: baseConfig.gasLimit,
  };
  console.log(`Overrides: ${JSON.stringify(overrides)}`);

  console.log(`\nConnect to ChimVesting: ${chimVestingAddress}`);
  const vesting = await new ChimVesting__factory(wallet).attach(chimVestingAddress);
  console.log(`Successfully connected to ChimVesting: ${chimVestingAddress}`);

  console.log(`\nSet release time`);
  const confirmedTx = await vesting.connect(wallet).setReleaseTime(contractsConfig.chimVesting.releaseTime, overrides);
  await logGasUsageEthTransaction(`setReleaseTime - ${contractsConfig.chimVesting.releaseTime}`, (confirmedTx as any));
}

import hre from 'hardhat';
import { BigNumber } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import { parseBigNumber } from '../../utils/utilities';
import { baseConfig } from '../../utils/config';
import { ChimUpgradeableV1 } from '../../typechain/ChimUpgradeableV1';
import { ChimVesting } from '../../typechain/ChimVesting';
import { ChimUpgradeableV1__factory, ChimVesting__factory } from '../../typechain';

export let tokenLocks: tokenLock[] = [];
export const chimVestingParams = {
  chim: {
    name: 'Chimeras',
    symbol: 'CHIM',
    decimals: BigNumber.from(18),
    totalSupply: parseBigNumber('100000000', baseConfig.ethDecimals),
    maxTotalSupply: parseBigNumber('1000000000', baseConfig.ethDecimals),
  },
  vesting: {
    maxLockPlans: BigNumber.from(15),
    maxPercent: 10000, // 10000 equal 100%
    stepPercent: 6767, // 6767 equal 67.67%
    plans: [
      {
        id: BigNumber.from(1),
        name: 'Plan 1',
        maxPlanTotal: parseBigNumber('10000000', baseConfig.ethDecimals),
        total: BigNumber.from(0),
        withdrawn: BigNumber.from(0),
        startPercent: 2500, // 2500 equal 25%
        startDelay: 30, // 30 sec,
        nextPercent: 222, // 222 equal 2.22%
        nextDelay: 30, // 30 sec,
        percentToStartLock: 3000, // 3000 equal 30%
      },
      {
        id: BigNumber.from(2),
        name: 'Plan 2',
        maxPlanTotal: parseBigNumber('20000000', baseConfig.ethDecimals),
        total: BigNumber.from(0),
        withdrawn: BigNumber.from(0),
        startPercent: 10000, // 10000 equal 100%
        startDelay: 0, // 0 sec,
        nextPercent: 0, // 0 equal 0%
        nextDelay: 0, // 0 sec,
        percentToStartLock: 2500, // 2500 equal 25%
      },
      {
        id: BigNumber.from(3),
        name: 'Plan 3',
        times: [BigNumber.from(90), BigNumber.from(900)],
        percents: [BigNumber.from(40), BigNumber.from(60)],
        maxPlanTotal: parseBigNumber('30000000', baseConfig.ethDecimals),
        total: BigNumber.from(0),
        withdrawn: BigNumber.from(0),
        startPercent: 6000, // 6000 equal 60%
        startDelay: 5, // 5 sec,
        nextPercent: 101, // 101 equal 1.01%
        nextDelay: 5, // 5 sec,
        percentToStartLock: 2000, // 2000 equal 20%
      },
    ],
  },
};

export async function setupChimVestingContracts(
  [chimTokenOwnerWallet, chimVestingWallet]: SignerWithAddress[],
  lockAddresses: string[],
): Promise<VestingDeployedContracts> {
  // 1. deploy ChimUpgradeableV1 with proxy
  const deployParams = [
    chimVestingParams.chim.maxTotalSupply,
  ];
  const contractFactory = await new (ChimUpgradeableV1__factory as any)(chimTokenOwnerWallet);
  const chimToken = (await hre.upgrades.deployProxy(contractFactory, deployParams, { initializer: 'initialize' })) as ChimUpgradeableV1;

  // 2. deploy ChimVesting
  const chimVesting = await new ChimVesting__factory(chimVestingWallet).deploy(chimToken.address);

  // 3. create ChimVesting plans
  for (let i = 0; i < chimVestingParams.vesting.plans.length; i++) {
    const plan = chimVestingParams.vesting.plans[i];
    await chimVesting.connect(chimVestingWallet).addLockPlan(
      plan.name,
      plan.maxPlanTotal,
      plan.startPercent,
      plan.startDelay,
      plan.nextPercent,
      plan.nextDelay,
    );
  }

  // 4. mint some tokens to ChimVesting address
  await chimToken.mintAmount(chimVesting.address, chimVestingParams.chim.totalSupply);

  // 5. lock tokens for all plans
  tokenLocks = [];
  for (let i = 0; i < chimVestingParams.vesting.plans.length; i++) {
    const plan = chimVestingParams.vesting.plans[i];
    plan.total = plan.maxPlanTotal.mul(plan.percentToStartLock).div(chimVestingParams.vesting.maxPercent);
    let totalPlanLock = plan.total;
    for (let j = 0; j < lockAddresses.length; j++) {
      const address = lockAddresses[j];
      const amount = (j !== lockAddresses.length - 1) ? totalPlanLock.mul(chimVestingParams.vesting.stepPercent).div(chimVestingParams.vesting.maxPercent) : totalPlanLock;
      totalPlanLock = totalPlanLock.sub(amount);
      await chimVesting.connect(chimVestingWallet).lockTokens(address, amount, plan.id);
      tokenLocks.push({
        address,
        planId: plan.id,
        total: amount,
        withdrawn: BigNumber.from(0),
      });
    }
  }

  return {
    chimToken,
    chimVesting,
  };
}

export interface VestingDeployedContracts {
  chimToken: ChimUpgradeableV1;
  chimVesting: ChimVesting;
}

export interface tokenLock {
  address: string;
  planId: BigNumber;
  total: BigNumber;
  withdrawn: BigNumber;
}

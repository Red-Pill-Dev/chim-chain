import hre from 'hardhat';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import {
  checkContractOwner,
  getUnixTime,
  logGasUsageEthTransaction,
  nullAddress,
  parseBigNumber,
} from '../../utils/utilities';
import { ChimUpgradeableV1 } from '../../typechain/ChimUpgradeableV1';
import { ChimVesting } from '../../typechain/ChimVesting';
import { chimVestingParams, setupChimVestingContracts, tokenLocks } from './chim-vesting-setup';
import { baseConfig } from '../../utils/config';

const ERRORS = {
  OWNABLE_NOT_OWNER: 'Ownable: caller is not the owner',
  CHIM_VESTING_INVALID_ADDRESS: 'ChimVesting: Invalid address',
  CHIM_VESTING_RELEASE_NOT_SET: 'ChimVesting: The release time not set',
  CHIM_VESTING_START_RELEASE_CAN_SET_ONCE: 'ChimVesting: The release time can only be set once',
  CHIM_VESTING_MAX_PLANS_LIMIT: 'ChimVesting: Max lock plans limit reached',
  CHIM_VESTING_INVALID_NAME: 'ChimVesting: Invalid name',
  CHIM_VESTING_INVALID_START_PERCENT: 'ChimVesting: Invalid start percent',
  CHIM_VESTING_INVALID_NEXT_PERCENT: 'ChimVesting: Invalid next percent',
  CHIM_VESTING_INVALID_MAX_PLAN_TOTAL: 'ChimVesting: Invalid max plan total',
  CHIM_VESTING_INVALID_PLAN_PARAMS: 'ChimVesting: Invalid plan params',
  CHIM_VESTING_PLAN_NOT_EXIST: 'ChimVesting: LockPlanId not exist',
  CHIM_VESTING_NOT_ENOUGH_FUNDS: 'ChimVesting: There are not enough funds in the contract',
  CHIM_VESTING_MAX_PLAN_TOTAL_LIMIT_REACHED: 'ChimVesting: Max plan total limit reached',
};

describe('Chim-vesting', () => {
  let chimToken: ChimUpgradeableV1;
  let chimVesting: ChimVesting;
  let chimTokenOwnerWallet: SignerWithAddress;
  let chimVestingWallet: SignerWithAddress;
  let aliceWallet: SignerWithAddress;
  let bobWallet: SignerWithAddress;
  let eveWallet: SignerWithAddress;
  let blacklistedWallet: SignerWithAddress;

  beforeEach(async () => {
    // get wallets
    [
      chimTokenOwnerWallet,
      chimVestingWallet,
      aliceWallet,
      bobWallet,
      eveWallet,
      blacklistedWallet,
    ] = await hre.ethers.getSigners();

    // deploy contracts
    const deployedContracts = await setupChimVestingContracts(
      [chimTokenOwnerWallet, chimVestingWallet],
      [aliceWallet.address, bobWallet.address, blacklistedWallet.address],
    );
    chimToken = deployedContracts.chimToken;
    chimVesting = deployedContracts.chimVesting;

    // add blacklistedWallet's address to blacklist
    await chimToken.connect(chimTokenOwnerWallet).addToBlacklist(blacklistedWallet.address);
  });

  describe('owner - public', () => {
    it('success', async () => {
      const owner = await chimVesting.connect(aliceWallet).owner();
      expect(owner).to.be.eq(chimVestingWallet.address);
    });
  });

  describe('erc20TokenAddress - public', () => {
    it('success', async () => {
      const tokenAddress = await chimVesting.connect(aliceWallet).erc20TokenAddress();
      expect(tokenAddress).to.be.eq(chimToken.address);
    });
  });

  describe('maxLockPlans - public', () => {
    it('success', async () => {
      const maxLockPlans = await chimVesting.connect(aliceWallet).maxLockPlans();
      expect(maxLockPlans).to.be.eq(chimVestingParams.vesting.maxLockPlans);
    });
  });

  describe('releaseTime - public', () => {
    it('success', async () => {
      let releaseTime = await chimVesting.connect(aliceWallet).releaseTime();
      expect(releaseTime).to.be.eq(BigNumber.from(0));

      const startReleaseTime = getUnixTime() + 60 * 60;
      await chimVesting.connect(chimVestingWallet).setReleaseTime(startReleaseTime);

      releaseTime = await chimVesting.connect(aliceWallet).releaseTime();
      expect(releaseTime).to.be.eq(startReleaseTime);
    });
  });

  describe('stats - public', () => {
    it('success', async () => {
      const expectedTotalBalance = await chimToken.connect(aliceWallet).balanceOf(chimVesting.address);
      const expectedMaxPlansTotal = chimVestingParams.vesting.plans.reduce((maxPlansTotal: BigNumber, item: any) => {
        return maxPlansTotal.add(item.maxPlanTotal);
      }, BigNumber.from(0));
      const expectedTotal = chimVestingParams.vesting.plans.reduce((total: BigNumber, item: any) => {
        return total.add(item.total);
      }, BigNumber.from(0));
      const expectedTotalWithdrawn = chimVestingParams.vesting.plans.reduce((totalWithdrawn: BigNumber, item: any) => {
        return totalWithdrawn.add(item.withdrawn);
      }, BigNumber.from(0));

      const stats = await chimVesting.connect(aliceWallet).stats();

      expect(stats.totalBalance).to.be.eq(expectedTotalBalance);
      expect(stats.maxPlansTotal).to.be.eq(expectedMaxPlansTotal);
      expect(stats.total).to.be.eq(expectedTotal);
      expect(stats.totalLocked).to.be.eq(expectedTotal.sub(expectedTotalWithdrawn));
      expect(stats.totalWithdrawn).to.be.eq(expectedTotalWithdrawn);
    });
  });

  describe('getLockPlanCount - public', () => {
    it('success', async () => {
      let lockPlanCount = await chimVesting.connect(aliceWallet).getLockPlanCount();
      expect(lockPlanCount).to.be.eq(BigNumber.from(chimVestingParams.vesting.plans.length));
    });
  });

  describe('getLockPlan - public', () => {
    it('success - non-existent plans', async () => {
      const planIdList = [
        BigNumber.from(0),
        chimVestingParams.vesting.maxLockPlans.add(1),
      ];

      for (const planId of planIdList) {
        const planInfo = await chimVesting.connect(aliceWallet).getLockPlan(planId);
        expect(planInfo).to.deep.eq([
          '',
          BigNumber.from(0),
          BigNumber.from(0),
          BigNumber.from(0),
          BigNumber.from(0),
          0,
          0,
          0,
          0,
        ]);
      }
    });

    it('success - existing plans', async () => {
      for (const plan of chimVestingParams.vesting.plans) {
        const planInfo = await chimVesting.connect(aliceWallet).getLockPlan(plan.id);
        expect(planInfo).to.deep.eq([
          plan.name,
          plan.maxPlanTotal,
          plan.total,
          plan.total.sub(plan.withdrawn),
          plan.withdrawn,
          plan.startPercent,
          plan.startDelay,
          plan.nextPercent,
          plan.nextDelay,
        ]);
      }
    });
  });

  describe('getPlanBalanceOf - public', () => {
    it('success', async () => {
      const addressList = [
        aliceWallet.address,
        eveWallet.address,
        nullAddress,
      ];
      const planIdList = [
        BigNumber.from(0),
        chimVestingParams.vesting.maxLockPlans.add(1),
        ...chimVestingParams.vesting.plans.map(item => item.id),
      ];

      for (const address of addressList) {
        for (const planId of planIdList) {
          const findLock = tokenLocks.find(item => item.address === address && item.planId === planId);
          const balanceInfo = await chimVesting.connect(aliceWallet).getPlanBalanceOf(address, planId);
          expect(balanceInfo.total).to.be.eq(findLock ? findLock.total : BigNumber.from(0));
          expect(balanceInfo.locked).to.be.eq(findLock ? findLock.total.sub(findLock.withdrawn) : BigNumber.from(0));
          expect(balanceInfo.withdrawn).to.be.eq(findLock ? findLock.withdrawn : BigNumber.from(0));
        }
      }
    });
  });

  describe('getTotalBalanceOf - public', () => {
    it('success', async () => {
      const addressList = [
        aliceWallet.address,
        eveWallet.address,
        nullAddress,
      ];

      for (const address of addressList) {
        const findLock = tokenLocks.filter(item => item.address === address);
        const expectedTotal = findLock.reduce((total: BigNumber, item: any) => total.add(item.total), BigNumber.from(0));
        const expectedWithdrawn = findLock.reduce((withdrawn: BigNumber, item: any) => withdrawn.add(item.withdrawn), BigNumber.from(0));
        const balanceInfo = await chimVesting.connect(aliceWallet).getTotalBalanceOf(address);
        expect(balanceInfo.total).to.be.eq(expectedTotal);
        expect(balanceInfo.locked).to.be.eq(expectedTotal.sub(expectedWithdrawn));
        expect(balanceInfo.withdrawn).to.be.eq(expectedWithdrawn);
      }
    });
  });

  describe('checkLocks - public', () => {
    it('success - vesting not start', async () => {
      const addressList = [
        aliceWallet.address,
        eveWallet.address,
        nullAddress,
      ];
      const planIdList = [
        ...chimVestingParams.vesting.plans.map(item => item.id),
      ];

      const plans = chimVestingParams.vesting.plans.filter(item => planIdList.indexOf(item.id) !== -1);
      expect(plans.length).to.be.eq(planIdList.length);

      const releaseTime = await chimVesting.connect(aliceWallet).releaseTime();
      expect(releaseTime).to.be.eq(BigNumber.from(0));

      for (const address of addressList) {
        for (const planId of planIdList) {
          const locksInfo = await chimVesting.connect(aliceWallet).checkLocks(address, planId);
          expect(locksInfo.afterReleaseTime).to.be.eq(BigNumber.from(0));
          expect(locksInfo.unlockPercents).to.be.eq(BigNumber.from(0));
          expect(locksInfo.nextUnlockTime).to.be.eq(BigNumber.from(0));
          expect(locksInfo.total).to.be.eq(BigNumber.from(0));
          expect(locksInfo.totalUnlock).to.be.eq(BigNumber.from(0));
          expect(locksInfo.withdrawn).to.be.eq(BigNumber.from(0));
          expect(locksInfo.pendingUnlock).to.be.eq(BigNumber.from(0));
        }
      }
    });

    it('success - vesting does not start soon', async () => {
      const addressList = [
        aliceWallet.address,
        eveWallet.address,
        nullAddress,
      ];
      const planIdList = [
        ...chimVestingParams.vesting.plans.map(item => item.id),
      ];

      const plans = chimVestingParams.vesting.plans.filter(item => planIdList.indexOf(item.id) !== -1);
      expect(plans.length).to.be.eq(planIdList.length);

      const timeToWait = 30;
      await chimVesting.connect(chimVestingWallet).setReleaseTime(getUnixTime() + 1500000);

      const releaseTime = await chimVesting.connect(aliceWallet).releaseTime();
      expect(releaseTime).to.be.gt(BigNumber.from(getUnixTime() + timeToWait));

      await chimToken.connect(chimTokenOwnerWallet).increaseAllowance(eveWallet.address, BigNumber.from(1)); // new tx to change block number

      for (const address of addressList) {
        for (const planId of planIdList) {
          const locksInfo = await chimVesting.connect(aliceWallet).checkLocks(address, planId);
          expect(locksInfo.afterReleaseTime).to.be.eq(BigNumber.from(0));
          expect(locksInfo.unlockPercents).to.be.eq(BigNumber.from(0));
          expect(locksInfo.nextUnlockTime).to.be.eq(BigNumber.from(0));
          expect(locksInfo.total).to.be.eq(BigNumber.from(0));
          expect(locksInfo.totalUnlock).to.be.eq(BigNumber.from(0));
          expect(locksInfo.withdrawn).to.be.eq(BigNumber.from(0));
          expect(locksInfo.pendingUnlock).to.be.eq(BigNumber.from(0));
        }
      }
    });

    it('success - vesting started, but plan not exists', async () => {
      const addressList = [
        aliceWallet.address,
        eveWallet.address,
        nullAddress,
      ];
      const planIdList = [
        BigNumber.from(0),
        chimVestingParams.vesting.maxLockPlans.add(1),
      ];

      const plans = chimVestingParams.vesting.plans.filter(item => planIdList.indexOf(item.id) !== -1);
      expect(plans.length).to.be.eq(0);

      const timeToWait = 30;
      await chimVesting.connect(chimVestingWallet).setReleaseTime(getUnixTime());

      const releaseTime = await chimVesting.connect(aliceWallet).releaseTime();
      expect(releaseTime).to.be.lte(BigNumber.from(getUnixTime() + timeToWait));

      await chimToken.connect(chimTokenOwnerWallet).increaseAllowance(eveWallet.address, BigNumber.from(1)); // new tx to change block number

      for (const address of addressList) {
        for (const planId of planIdList) {
          const locksInfo = await chimVesting.connect(aliceWallet).checkLocks(address, planId);
          expect(locksInfo.afterReleaseTime).to.be.eq(BigNumber.from(0));
          expect(locksInfo.unlockPercents).to.be.eq(BigNumber.from(0));
          expect(locksInfo.nextUnlockTime).to.be.eq(BigNumber.from(0));
          expect(locksInfo.total).to.be.eq(BigNumber.from(0));
          expect(locksInfo.totalUnlock).to.be.eq(BigNumber.from(0));
          expect(locksInfo.withdrawn).to.be.eq(BigNumber.from(0));
          expect(locksInfo.pendingUnlock).to.be.eq(BigNumber.from(0));
        }
      }
    });

    it('success - vesting started, plan exists', async () => {
      const addressList = [
        aliceWallet.address,
        eveWallet.address,
        nullAddress,
      ];
      const planIdList = [
        ...chimVestingParams.vesting.plans.map(item => item.id),
      ];

      const plans = chimVestingParams.vesting.plans.filter(item => planIdList.indexOf(item.id) !== -1);
      expect(plans.length).to.be.eq(planIdList.length);

      const timeToWait = 30;
      await chimVesting.connect(chimVestingWallet).setReleaseTime(getUnixTime());

      const releaseTime = await chimVesting.connect(aliceWallet).releaseTime();
      expect(releaseTime).to.be.lte(BigNumber.from(getUnixTime() + timeToWait));

      await chimToken.connect(chimTokenOwnerWallet).increaseAllowance(eveWallet.address, BigNumber.from(1)); // new tx to change block number

      for (const address of addressList) {
        for (const planId of planIdList) {
          const findLock = tokenLocks.find(item => item.address === address && item.planId === planId);
          const findPlan = chimVestingParams.vesting.plans.find(item => item.id === planId);

          const locksInfo = await chimVesting.connect(aliceWallet).checkLocks(address, planId);
          expect(locksInfo.afterReleaseTime).to.be.gt(BigNumber.from(0));

          let expectedUnlockPercents = BigNumber.from((findPlan as any).startPercent);
          let expectedNextUnlockTime = BigNumber.from((findPlan as any).startDelay);
          while ((findPlan as any).nextPercent > 0
            && (findPlan as any).nextDelay > 0
            && expectedUnlockPercents.lt(BigNumber.from(chimVestingParams.vesting.maxPercent))
            && expectedNextUnlockTime.lte(locksInfo.afterReleaseTime)) {
            expectedUnlockPercents = expectedUnlockPercents.add((findPlan as any).nextPercent);
            expectedNextUnlockTime = expectedNextUnlockTime.add((findPlan as any).nextDelay);
          }
          if (expectedUnlockPercents.gte(BigNumber.from(chimVestingParams.vesting.maxPercent))) {
            expectedUnlockPercents = BigNumber.from(chimVestingParams.vesting.maxPercent);
            expectedNextUnlockTime = BigNumber.from(0);
          }
          expect(locksInfo.unlockPercents).to.be.eq(expectedUnlockPercents);
          expect(locksInfo.nextUnlockTime).to.be.eq(expectedNextUnlockTime);

          if (findLock) {
            const expectedTotal = (findLock as any).total;
            const expectedTotalUnlock = expectedTotal.mul(expectedUnlockPercents).div(chimVestingParams.vesting.maxPercent);
            const expectedWithdrawn = (findLock as any).withdrawn;
            const expectedPendingUnlock = expectedTotalUnlock.gt(expectedWithdrawn) ? expectedTotalUnlock.sub(expectedWithdrawn) : BigNumber.from(0);

            expect(locksInfo.total).to.be.eq(expectedTotal);
            expect(locksInfo.totalUnlock).to.be.eq(expectedTotalUnlock);
            expect(locksInfo.withdrawn).to.be.eq(expectedWithdrawn);
            expect(locksInfo.pendingUnlock).to.be.eq(expectedPendingUnlock);
          } else {
            expect(locksInfo.total).to.be.eq(BigNumber.from(0));
            expect(locksInfo.totalUnlock).to.be.eq(BigNumber.from(0));
            expect(locksInfo.withdrawn).to.be.eq(BigNumber.from(0));
            expect(locksInfo.pendingUnlock).to.be.eq(BigNumber.from(0));
          }
        }
      }
    });
  });

  describe('withdraw - public', () => {
    it('fail - vesting not start', async () => {
      const actionWalletList = [
        aliceWallet,
        eveWallet,
      ];
      const planIdList = [
        ...chimVestingParams.vesting.plans.map(item => item.id),
      ];

      const plans = chimVestingParams.vesting.plans.filter(item => planIdList.indexOf(item.id) !== -1);
      expect(plans.length).to.be.eq(planIdList.length);

      const releaseTime = await chimVesting.connect(aliceWallet).releaseTime();
      expect(releaseTime).to.be.eq(BigNumber.from(0));

      for (const actionWallet of actionWalletList) {
        for (const planId of planIdList) {
          const contractBalanceBefore = await chimToken.connect(actionWallet).balanceOf(chimVesting.address);
          const addressBalanceBefore = await chimToken.connect(actionWallet).balanceOf(actionWallet.address);
          const statsBefore = await chimVesting.connect(actionWallet).stats();
          const locksInfoBefore = await chimVesting.connect(actionWallet).checkLocks(actionWallet.address, planId);

          await expect(chimVesting.connect(actionWallet).withdraw(planId)).to.be.revertedWith(ERRORS.CHIM_VESTING_RELEASE_NOT_SET);

          const contractBalanceAfter = await chimToken.connect(actionWallet).balanceOf(chimVesting.address);
          const addressBalanceAfter = await chimToken.connect(actionWallet).balanceOf(actionWallet.address);
          const statsAfter = await chimVesting.connect(actionWallet).stats();
          const locksInfoAfter = await chimVesting.connect(actionWallet).checkLocks(actionWallet.address, planId);
          expect(contractBalanceAfter).to.be.eq(contractBalanceBefore);
          expect(addressBalanceAfter).to.be.eq(addressBalanceBefore);
          expect(statsAfter).to.deep.eq(statsBefore);
          expect(locksInfoAfter).to.deep.eq(locksInfoBefore);
        }
      }
    });

    it('fail - vesting started, but plan not exists', async () => {
      const actionWalletList = [
        aliceWallet,
        eveWallet,
      ];
      const planIdList = [
        BigNumber.from(0),
        chimVestingParams.vesting.maxLockPlans.add(1),
      ];

      const plans = chimVestingParams.vesting.plans.filter(item => planIdList.indexOf(item.id) !== -1);
      expect(plans.length).to.be.eq(0);

      const timeToWait = 30;
      await chimVesting.connect(chimVestingWallet).setReleaseTime(getUnixTime());

      const releaseTime = await chimVesting.connect(chimVestingWallet).releaseTime();
      expect(releaseTime).to.be.lte(BigNumber.from(getUnixTime() + timeToWait));

      await chimToken.connect(chimTokenOwnerWallet).increaseAllowance(eveWallet.address, BigNumber.from(1)); // new tx to change block number

      for (const actionWallet of actionWalletList) {
        for (const planId of planIdList) {
          const contractBalanceBefore = await chimToken.connect(actionWallet).balanceOf(chimVesting.address);
          const addressBalanceBefore = await chimToken.connect(actionWallet).balanceOf(actionWallet.address);
          const statsBefore = await chimVesting.connect(actionWallet).stats();
          const locksInfoBefore = await chimVesting.connect(actionWallet).checkLocks(actionWallet.address, planId);

          await expect(chimVesting.connect(actionWallet).withdraw(planId)).to.be.revertedWith(ERRORS.CHIM_VESTING_PLAN_NOT_EXIST);

          const contractBalanceAfter = await chimToken.connect(actionWallet).balanceOf(chimVesting.address);
          const addressBalanceAfter = await chimToken.connect(actionWallet).balanceOf(actionWallet.address);
          const statsAfter = await chimVesting.connect(actionWallet).stats();
          const locksInfoAfter = await chimVesting.connect(actionWallet).checkLocks(actionWallet.address, planId);
          expect(contractBalanceAfter).to.be.eq(contractBalanceBefore);
          expect(addressBalanceAfter).to.be.eq(addressBalanceBefore);
          expect(statsAfter).to.deep.eq(statsBefore);
          expect(locksInfoAfter).to.deep.eq(locksInfoBefore);
        }
      }
    });

    it('success - vesting started, plan exists', async () => {
      const actionWalletList = [
        aliceWallet,
        eveWallet,
      ];
      const planIdList = [
        ...chimVestingParams.vesting.plans.map(item => item.id),
      ];

      const plans = chimVestingParams.vesting.plans.filter(item => planIdList.indexOf(item.id) !== -1);
      expect(plans.length).to.be.eq(planIdList.length);

      const timeToWait = 30;
      await chimVesting.connect(chimVestingWallet).setReleaseTime(getUnixTime());

      const releaseTime = await chimVesting.connect(chimVestingWallet).releaseTime();
      expect(releaseTime).to.be.lte(BigNumber.from(getUnixTime() + timeToWait));

      await chimToken.connect(chimTokenOwnerWallet).increaseAllowance(eveWallet.address, BigNumber.from(1)); // new tx to change block number

      for (const actionWallet of actionWalletList) {
        for (const planId of planIdList) {
          const contractBalanceBefore = await chimToken.connect(actionWallet).balanceOf(chimVesting.address);
          const addressBalanceBefore = await chimToken.connect(actionWallet).balanceOf(actionWallet.address);
          const statsBefore = await chimVesting.connect(actionWallet).stats();
          const locksInfoBefore = await chimVesting.connect(actionWallet).checkLocks(actionWallet.address, planId);

          const diff = locksInfoBefore.pendingUnlock.gt(BigNumber.from(0)) ? locksInfoBefore.pendingUnlock : BigNumber.from(0);
          const ethTx = await expect(chimVesting.connect(actionWallet).withdraw(planId)).not.to.be.reverted;
          await logGasUsageEthTransaction(`withdraw - ${diff} - ${locksInfoBefore.unlockPercents}%`, (ethTx as any));

          const contractBalanceAfter = await chimToken.connect(actionWallet).balanceOf(chimVesting.address);
          const addressBalanceAfter = await chimToken.connect(actionWallet).balanceOf(actionWallet.address);
          const statsAfter = await chimVesting.connect(actionWallet).stats();
          const locksInfoAfter = await chimVesting.connect(actionWallet).checkLocks(actionWallet.address, planId);
          expect(contractBalanceAfter).to.be.eq(contractBalanceBefore.sub(diff));
          expect(addressBalanceAfter).to.be.eq(addressBalanceBefore.add(diff));
          expect(statsAfter.totalBalance).to.be.eq(statsBefore.totalBalance.sub(diff));
          expect(statsAfter.total).to.be.eq(statsBefore.total);
          expect(statsAfter.totalLocked).to.be.eq(statsBefore.totalLocked.sub(diff));
          expect(statsAfter.totalWithdrawn).to.be.eq(statsBefore.totalWithdrawn.add(diff));
          expect(locksInfoAfter.total).to.be.eq(locksInfoBefore.total);
          expect(locksInfoAfter.totalUnlock).to.be.eq(locksInfoBefore.totalUnlock);
          expect(locksInfoAfter.withdrawn).to.be.eq(locksInfoBefore.withdrawn.add(diff));
          expect(locksInfoAfter.pendingUnlock).to.be.eq(locksInfoBefore.pendingUnlock.sub(diff));
        }
      }
    });
  });

  describe('setReleaseTime - onlyOwner', () => {
    it('fail - not owner', async () => {
      const actionWallet = eveWallet;
      const startReleaseTime = getUnixTime() + 60 * 60;

      const releaseTimeBefore = await chimVesting.connect(actionWallet).releaseTime();
      expect(releaseTimeBefore).to.be.eq(BigNumber.from(0));

      await checkContractOwner(actionWallet.address, chimVesting, false);

      await expect(chimVesting.connect(actionWallet).setReleaseTime(startReleaseTime)).to.be.revertedWith(ERRORS.OWNABLE_NOT_OWNER);

      const releaseTimeAfter = await chimVesting.connect(actionWallet).releaseTime();
      expect(releaseTimeAfter).to.be.eq(releaseTimeBefore);
    });

    it('fail - release time can only be set once', async () => {
      const actionWallet = chimVestingWallet;
      const startReleaseTime = getUnixTime() + 60 * 60;
      const newStartReleaseTime = getUnixTime() + 60 * 60 * 24;

      await chimVesting.connect(actionWallet).setReleaseTime(startReleaseTime);

      const releaseTimeBefore = await chimVesting.connect(actionWallet).releaseTime();
      expect(releaseTimeBefore).to.be.eq(startReleaseTime);

      await checkContractOwner(actionWallet.address, chimVesting, true);

      await expect(chimVesting.connect(actionWallet).setReleaseTime(newStartReleaseTime)).to.be.revertedWith(ERRORS.CHIM_VESTING_START_RELEASE_CAN_SET_ONCE);

      const releaseTimeAfter = await chimVesting.connect(actionWallet).releaseTime();
      expect(releaseTimeAfter).to.be.eq(releaseTimeBefore);
    });

    it('success', async () => {
      const actionWallet = chimVestingWallet;
      const startReleaseTime = getUnixTime() + 60 * 60;

      const releaseTimeBefore = await chimVesting.connect(actionWallet).releaseTime();
      expect(releaseTimeBefore).to.be.eq(BigNumber.from(0));

      await checkContractOwner(actionWallet.address, chimVesting, true);

      const ethTx = await expect(chimVesting.connect(actionWallet).setReleaseTime(startReleaseTime)).not.to.be.reverted;
      await logGasUsageEthTransaction('setReleaseTime', (ethTx as any));

      const releaseTimeAfter = await chimVesting.connect(actionWallet).releaseTime();
      expect(releaseTimeAfter).to.be.eq(startReleaseTime);
    });
  });

  describe('addLockPlan - onlyOwner', () => {
    it('fail - not owner', async () => {
      const actionWallet = eveWallet;
      const newPlanParams = {
        name: 'New plan',
        maxPlanTotal: parseBigNumber('4000000', baseConfig.ethDecimals),
        startPercent: 1000, // 1000 equal 10%
        startDelay: 30, // 30 sec,
        nextPercent: 300, // 300 equal 3%
        nextDelay: 30, // 30 sec,
      };

      const maxLockPlans = await chimVesting.connect(actionWallet).maxLockPlans();
      const lockPlanCountBefore = await chimVesting.connect(actionWallet).getLockPlanCount();
      expect(lockPlanCountBefore).to.be.lt(maxLockPlans);

      await checkContractOwner(actionWallet.address, chimVesting, false);

      await expect(chimVesting.connect(actionWallet).addLockPlan(
        newPlanParams.name,
        newPlanParams.maxPlanTotal,
        newPlanParams.startPercent,
        newPlanParams.startDelay,
        newPlanParams.nextPercent,
        newPlanParams.nextDelay,
      )).to.be.revertedWith(ERRORS.OWNABLE_NOT_OWNER);

      const lockPlanCountAfter = await chimVesting.connect(actionWallet).getLockPlanCount();
      expect(lockPlanCountAfter).to.be.eq(lockPlanCountBefore);
    });

    it('fail - max lock plans limit reached', async () => {
      const actionWallet = chimVestingWallet;
      const newPlanParams = {
        name: 'New plan',
        maxPlanTotal: parseBigNumber('4000000', baseConfig.ethDecimals),
        startPercent: 1000, // 1000 equal 10%
        startDelay: 30, // 30 sec,
        nextPercent: 300, // 300 equal 3%
        nextDelay: 30, // 30 sec,
      };

      const maxLockPlans = await chimVesting.connect(actionWallet).maxLockPlans();
      let lockPlanCountBefore = await chimVesting.connect(actionWallet).getLockPlanCount();
      for (let i = lockPlanCountBefore; i.lt(maxLockPlans); i = i.add(1)) {
        const planName = `${newPlanParams.name} - ${i.toString()}`;
        const ethTx = await chimVesting.connect(actionWallet).addLockPlan(
          planName,
          newPlanParams.maxPlanTotal,
          newPlanParams.startPercent,
          newPlanParams.startDelay,
          newPlanParams.nextPercent,
          newPlanParams.nextDelay,
        );
        await logGasUsageEthTransaction(`addLockPlan - ${planName}`, (ethTx as any));
      }
      lockPlanCountBefore = await chimVesting.connect(actionWallet).getLockPlanCount();
      expect(lockPlanCountBefore).to.be.gte(maxLockPlans);

      await checkContractOwner(actionWallet.address, chimVesting, true);

      await expect(chimVesting.connect(actionWallet).addLockPlan(
        newPlanParams.name,
        newPlanParams.maxPlanTotal,
        newPlanParams.startPercent,
        newPlanParams.startDelay,
        newPlanParams.nextPercent,
        newPlanParams.nextDelay,
      )).to.be.revertedWith(ERRORS.CHIM_VESTING_MAX_PLANS_LIMIT);

      const lockPlanCountAfter = await chimVesting.connect(actionWallet).getLockPlanCount();
      expect(lockPlanCountAfter).to.be.eq(lockPlanCountBefore);
    });

    it('fail - invalid name', async () => {
      const actionWallet = chimVestingWallet;
      const newPlanParams = {
        name: '',
        maxPlanTotal: parseBigNumber('4000000', baseConfig.ethDecimals),
        startPercent: 1000, // 1000 equal 10%
        startDelay: 30, // 30 sec,
        nextPercent: 300, // 300 equal 3%
        nextDelay: 30, // 30 sec,
      };

      const maxLockPlans = await chimVesting.connect(actionWallet).maxLockPlans();
      const lockPlanCountBefore = await chimVesting.connect(actionWallet).getLockPlanCount();
      expect(lockPlanCountBefore).to.be.lt(maxLockPlans);

      await checkContractOwner(actionWallet.address, chimVesting, true);

      await expect(chimVesting.connect(actionWallet).addLockPlan(
        newPlanParams.name,
        newPlanParams.maxPlanTotal,
        newPlanParams.startPercent,
        newPlanParams.startDelay,
        newPlanParams.nextPercent,
        newPlanParams.nextDelay,
      )).to.be.revertedWith(ERRORS.CHIM_VESTING_INVALID_NAME);

      const lockPlanCountAfter = await chimVesting.connect(actionWallet).getLockPlanCount();
      expect(lockPlanCountAfter).to.be.eq(lockPlanCountBefore);
    });

    it('fail - invalid max plan total', async () => {
      const actionWallet = chimVestingWallet;
      const newPlanParams = {
        name: 'New plan',
        maxPlanTotal: BigNumber.from(0),
        startPercent: 1000, // 1000 equal 10%
        startDelay: 30, // 30 sec,
        nextPercent: 300, // 300 equal 3%
        nextDelay: 30, // 30 sec,
      };

      const maxLockPlans = await chimVesting.connect(actionWallet).maxLockPlans();
      const lockPlanCountBefore = await chimVesting.connect(actionWallet).getLockPlanCount();
      expect(lockPlanCountBefore).to.be.lt(maxLockPlans);

      await checkContractOwner(actionWallet.address, chimVesting, true);

      await expect(chimVesting.connect(actionWallet).addLockPlan(
        newPlanParams.name,
        newPlanParams.maxPlanTotal,
        newPlanParams.startPercent,
        newPlanParams.startDelay,
        newPlanParams.nextPercent,
        newPlanParams.nextDelay,
      )).to.be.revertedWith(ERRORS.CHIM_VESTING_INVALID_MAX_PLAN_TOTAL);

      const lockPlanCountAfter = await chimVesting.connect(actionWallet).getLockPlanCount();
      expect(lockPlanCountAfter).to.be.eq(lockPlanCountBefore);
    });

    it('fail - invalid start percent', async () => {
      const actionWallet = chimVestingWallet;
      const newPlanParams = {
        name: 'New plan',
        maxPlanTotal: parseBigNumber('4000000', baseConfig.ethDecimals),
        startPercent: 10001, // 100001 equal 100.01%
        startDelay: 30, // 30 sec,
        nextPercent: 300, // 300 equal 3%
        nextDelay: 30, // 30 sec,
      };

      const maxLockPlans = await chimVesting.connect(actionWallet).maxLockPlans();
      const lockPlanCountBefore = await chimVesting.connect(actionWallet).getLockPlanCount();
      expect(lockPlanCountBefore).to.be.lt(maxLockPlans);

      await checkContractOwner(actionWallet.address, chimVesting, true);

      await expect(chimVesting.connect(actionWallet).addLockPlan(
        newPlanParams.name,
        newPlanParams.maxPlanTotal,
        newPlanParams.startPercent,
        newPlanParams.startDelay,
        newPlanParams.nextPercent,
        newPlanParams.nextDelay,
      )).to.be.revertedWith(ERRORS.CHIM_VESTING_INVALID_START_PERCENT);

      const lockPlanCountAfter = await chimVesting.connect(actionWallet).getLockPlanCount();
      expect(lockPlanCountAfter).to.be.eq(lockPlanCountBefore);
    });

    it('fail - invalid next percent', async () => {
      const actionWallet = chimVestingWallet;
      const newPlanParams = {
        name: 'New plan',
        maxPlanTotal: parseBigNumber('4000000', baseConfig.ethDecimals),
        startPercent: 1000, // 1000 equal 10%
        startDelay: 30, // 30 sec,
        nextPercent: 10001, // 100001 equal 100.01%
        nextDelay: 30, // 30 sec,
      };

      const maxLockPlans = await chimVesting.connect(actionWallet).maxLockPlans();
      const lockPlanCountBefore = await chimVesting.connect(actionWallet).getLockPlanCount();
      expect(lockPlanCountBefore).to.be.lt(maxLockPlans);

      await checkContractOwner(actionWallet.address, chimVesting, true);

      await expect(chimVesting.connect(actionWallet).addLockPlan(
        newPlanParams.name,
        newPlanParams.maxPlanTotal,
        newPlanParams.startPercent,
        newPlanParams.startDelay,
        newPlanParams.nextPercent,
        newPlanParams.nextDelay,
      )).to.be.revertedWith(ERRORS.CHIM_VESTING_INVALID_NEXT_PERCENT);

      const lockPlanCountAfter = await chimVesting.connect(actionWallet).getLockPlanCount();
      expect(lockPlanCountAfter).to.be.eq(lockPlanCountBefore);
    });

    it('fail - invalid plan params', async () => {
      const actionWallet = chimVestingWallet;
      const newPlanParams = {
        name: 'New plan',
        maxPlanTotal: parseBigNumber('4000000', baseConfig.ethDecimals),
        startPercent: 5000, // 5000 equal 50%
        startDelay: 30, // 30 sec,
        nextPercent: 0, // 0 equal 0%
        nextDelay: 0, // 0 sec,
      };

      const maxLockPlans = await chimVesting.connect(actionWallet).maxLockPlans();
      const lockPlanCountBefore = await chimVesting.connect(actionWallet).getLockPlanCount();
      expect(lockPlanCountBefore).to.be.lt(maxLockPlans);

      await checkContractOwner(actionWallet.address, chimVesting, true);

      await expect(chimVesting.connect(actionWallet).addLockPlan(
        newPlanParams.name,
        newPlanParams.maxPlanTotal,
        newPlanParams.startPercent,
        newPlanParams.startDelay,
        newPlanParams.nextPercent,
        newPlanParams.nextDelay,
      )).to.be.revertedWith(ERRORS.CHIM_VESTING_INVALID_PLAN_PARAMS);

      const lockPlanCountAfter = await chimVesting.connect(actionWallet).getLockPlanCount();
      expect(lockPlanCountAfter).to.be.eq(lockPlanCountBefore);
    });

    it('success', async () => {
      const actionWallet = chimVestingWallet;
      const newPlanParams = {
        name: 'New plan',
        maxPlanTotal: parseBigNumber('4000000', baseConfig.ethDecimals),
        startPercent: 1000, // 1000 equal 10%
        startDelay: 30, // 30 sec,
        nextPercent: 300, // 300 equal 3%
        nextDelay: 30, // 30 sec,
      };

      const maxLockPlans = await chimVesting.connect(actionWallet).maxLockPlans();
      const lockPlanCountBefore = await chimVesting.connect(actionWallet).getLockPlanCount();
      expect(lockPlanCountBefore).to.be.lt(maxLockPlans);

      await checkContractOwner(actionWallet.address, chimVesting, true);

      const ethTx = await expect(chimVesting.connect(actionWallet).addLockPlan(
        newPlanParams.name,
        newPlanParams.maxPlanTotal,
        newPlanParams.startPercent,
        newPlanParams.startDelay,
        newPlanParams.nextPercent,
        newPlanParams.nextDelay,
      )).not.to.be.reverted;
      await logGasUsageEthTransaction(`addLockPlan - ${newPlanParams.name}`, (ethTx as any));

      const lockPlanCountAfter = await chimVesting.connect(actionWallet).getLockPlanCount();
      expect(lockPlanCountAfter).to.be.eq(lockPlanCountBefore.add(1));

      const lockPlanInfo = await chimVesting.connect(actionWallet).getLockPlan(lockPlanCountAfter);
      expect(lockPlanInfo).to.deep.eq([
        newPlanParams.name,
        newPlanParams.maxPlanTotal,
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        newPlanParams.startPercent,
        newPlanParams.startDelay,
        newPlanParams.nextPercent,
        newPlanParams.nextDelay,
      ]);
    });
  });

  describe('updateLockPlan - onlyOwner', () => {
    it('fail - not owner', async () => {
      const actionWallet = eveWallet;
      const lockPlanInfo = chimVestingParams.vesting.plans[0];
      const newPlanParams = {
        lockPlanId: lockPlanInfo.id,
        name: 'New plan',
        startPercent: 2000, // 2000 equal 10%
        startDelay: 180, // 180 sec,
        nextPercent: 333, // 333 equal 3.33%
        nextDelay: 60, // 60 sec,
      };

      const lockPlanCountBefore = await chimVesting.connect(actionWallet).getLockPlanCount();
      expect(lockPlanCountBefore).to.be.gte(newPlanParams.lockPlanId);
      const lockPlanBefore = await chimVesting.connect(actionWallet).getLockPlan(newPlanParams.lockPlanId);
      expect(lockPlanBefore.name).not.to.be.eq('');

      await checkContractOwner(actionWallet.address, chimVesting, false);

      await expect(chimVesting.connect(actionWallet).updateLockPlan(
        newPlanParams.lockPlanId,
        newPlanParams.name,
        newPlanParams.startPercent,
        newPlanParams.startDelay,
        newPlanParams.nextPercent,
        newPlanParams.nextDelay,
      )).to.be.revertedWith(ERRORS.OWNABLE_NOT_OWNER);

      const lockPlanAfter = await chimVesting.connect(actionWallet).getLockPlan(newPlanParams.lockPlanId);
      expect(lockPlanAfter).to.deep.eq(lockPlanBefore);
    });

    it('fail - lock plan not exist', async () => {
      const actionWallet = chimVestingWallet;
      const lockPlanInfo = { id: BigNumber.from(10000) };
      const newPlanParams = {
        lockPlanId: lockPlanInfo.id,
        name: 'New plan',
        startPercent: 2000, // 2000 equal 10%
        startDelay: 180, // 180 sec,
        nextPercent: 333, // 333 equal 3.33%
        nextDelay: 60, // 60 sec,
      };

      const lockPlanCountBefore = await chimVesting.connect(actionWallet).getLockPlanCount();
      expect(lockPlanCountBefore).to.be.lt(newPlanParams.lockPlanId);
      const lockPlanBefore = await chimVesting.connect(actionWallet).getLockPlan(newPlanParams.lockPlanId);
      expect(lockPlanBefore.name).to.be.eq('');

      await checkContractOwner(actionWallet.address, chimVesting, true);

      await expect(chimVesting.connect(actionWallet).updateLockPlan(
        newPlanParams.lockPlanId,
        newPlanParams.name,
        newPlanParams.startPercent,
        newPlanParams.startDelay,
        newPlanParams.nextPercent,
        newPlanParams.nextDelay,
      )).to.be.revertedWith(ERRORS.CHIM_VESTING_PLAN_NOT_EXIST);

      const lockPlanAfter = await chimVesting.connect(actionWallet).getLockPlan(newPlanParams.lockPlanId);
      expect(lockPlanAfter).to.deep.eq(lockPlanBefore);
    });

    it('fail - invalid name', async () => {
      const actionWallet = chimVestingWallet;
      const lockPlanInfo = chimVestingParams.vesting.plans[0];
      const newPlanParams = {
        lockPlanId: lockPlanInfo.id,
        name: '',
        startPercent: 2000, // 2000 equal 10%
        startDelay: 180, // 180 sec,
        nextPercent: 333, // 333 equal 3.33%
        nextDelay: 60, // 60 sec,
      };

      const lockPlanCountBefore = await chimVesting.connect(actionWallet).getLockPlanCount();
      expect(lockPlanCountBefore).to.be.gte(newPlanParams.lockPlanId);
      const lockPlanBefore = await chimVesting.connect(actionWallet).getLockPlan(newPlanParams.lockPlanId);
      expect(lockPlanBefore.name).not.to.be.eq('');

      await checkContractOwner(actionWallet.address, chimVesting, true);

      await expect(chimVesting.connect(actionWallet).updateLockPlan(
        newPlanParams.lockPlanId,
        newPlanParams.name,
        newPlanParams.startPercent,
        newPlanParams.startDelay,
        newPlanParams.nextPercent,
        newPlanParams.nextDelay,
      )).to.be.revertedWith(ERRORS.CHIM_VESTING_INVALID_NAME);

      const lockPlanAfter = await chimVesting.connect(actionWallet).getLockPlan(newPlanParams.lockPlanId);
      expect(lockPlanAfter).to.deep.eq(lockPlanBefore);
    });

    it('fail - invalid start percent', async () => {
      const actionWallet = chimVestingWallet;
      const lockPlanInfo = chimVestingParams.vesting.plans[0];
      const newPlanParams = {
        lockPlanId: lockPlanInfo.id,
        name: 'New plan',
        startPercent: 10001, // 100001 equal 100.01%
        startDelay: 180, // 180 sec,
        nextPercent: 333, // 333 equal 3.33%
        nextDelay: 60, // 60 sec,
      };

      const lockPlanCountBefore = await chimVesting.connect(actionWallet).getLockPlanCount();
      expect(lockPlanCountBefore).to.be.gte(newPlanParams.lockPlanId);
      const lockPlanBefore = await chimVesting.connect(actionWallet).getLockPlan(newPlanParams.lockPlanId);
      expect(lockPlanBefore.name).not.to.be.eq('');

      await checkContractOwner(actionWallet.address, chimVesting, true);

      await expect(chimVesting.connect(actionWallet).updateLockPlan(
        newPlanParams.lockPlanId,
        newPlanParams.name,
        newPlanParams.startPercent,
        newPlanParams.startDelay,
        newPlanParams.nextPercent,
        newPlanParams.nextDelay,
      )).to.be.revertedWith(ERRORS.CHIM_VESTING_INVALID_START_PERCENT);

      const lockPlanAfter = await chimVesting.connect(actionWallet).getLockPlan(newPlanParams.lockPlanId);
      expect(lockPlanAfter).to.deep.eq(lockPlanBefore);
    });

    it('fail - invalid next percent', async () => {
      const actionWallet = chimVestingWallet;
      const lockPlanInfo = chimVestingParams.vesting.plans[0];
      const newPlanParams = {
        lockPlanId: lockPlanInfo.id,
        name: 'New plan',
        startPercent: 2000, // 2000 equal 10%
        startDelay: 180, // 180 sec,
        nextPercent: 10001, // 100001 equal 100.01%
        nextDelay: 60, // 60 sec,
      };

      const lockPlanCountBefore = await chimVesting.connect(actionWallet).getLockPlanCount();
      expect(lockPlanCountBefore).to.be.gte(newPlanParams.lockPlanId);
      const lockPlanBefore = await chimVesting.connect(actionWallet).getLockPlan(newPlanParams.lockPlanId);
      expect(lockPlanBefore.name).not.to.be.eq('');

      await checkContractOwner(actionWallet.address, chimVesting, true);

      await expect(chimVesting.connect(actionWallet).updateLockPlan(
        newPlanParams.lockPlanId,
        newPlanParams.name,
        newPlanParams.startPercent,
        newPlanParams.startDelay,
        newPlanParams.nextPercent,
        newPlanParams.nextDelay,
      )).to.be.revertedWith(ERRORS.CHIM_VESTING_INVALID_NEXT_PERCENT);

      const lockPlanAfter = await chimVesting.connect(actionWallet).getLockPlan(newPlanParams.lockPlanId);
      expect(lockPlanAfter).to.deep.eq(lockPlanBefore);
    });

    it('fail - invalid plan params', async () => {
      const actionWallet = chimVestingWallet;
      const lockPlanInfo = chimVestingParams.vesting.plans[0];
      const newPlanParams = {
        lockPlanId: lockPlanInfo.id,
        name: 'New plan',
        startPercent: 2000, // 2000 equal 10%
        startDelay: 180, // 180 sec,
        nextPercent: 0, // 0 equal 0%
        nextDelay: 0, // 0 sec,
      };

      const lockPlanCountBefore = await chimVesting.connect(actionWallet).getLockPlanCount();
      expect(lockPlanCountBefore).to.be.gte(newPlanParams.lockPlanId);
      const lockPlanBefore = await chimVesting.connect(actionWallet).getLockPlan(newPlanParams.lockPlanId);
      expect(lockPlanBefore.name).not.to.be.eq('');

      await checkContractOwner(actionWallet.address, chimVesting, true);

      await expect(chimVesting.connect(actionWallet).updateLockPlan(
        newPlanParams.lockPlanId,
        newPlanParams.name,
        newPlanParams.startPercent,
        newPlanParams.startDelay,
        newPlanParams.nextPercent,
        newPlanParams.nextDelay,
      )).to.be.revertedWith(ERRORS.CHIM_VESTING_INVALID_PLAN_PARAMS);

      const lockPlanAfter = await chimVesting.connect(actionWallet).getLockPlan(newPlanParams.lockPlanId);
      expect(lockPlanAfter).to.deep.eq(lockPlanBefore);
    });

    it('success', async () => {
      const actionWallet = chimVestingWallet;
      const lockPlanInfo = chimVestingParams.vesting.plans[0];
      const newPlanParams = {
        lockPlanId: lockPlanInfo.id,
        name: 'New plan',
        startPercent: 2000, // 2000 equal 10%
        startDelay: 180, // 180 sec,
        nextPercent: 333, // 333 equal 3.33%
        nextDelay: 60, // 60 sec,
      };

      const lockPlanCountBefore = await chimVesting.connect(actionWallet).getLockPlanCount();
      expect(lockPlanCountBefore).to.be.gte(newPlanParams.lockPlanId);
      const lockPlanBefore = await chimVesting.connect(actionWallet).getLockPlan(newPlanParams.lockPlanId);
      expect(lockPlanBefore.name).not.to.be.eq('');

      await checkContractOwner(actionWallet.address, chimVesting, true);

      const ethTx = await expect(chimVesting.connect(actionWallet).updateLockPlan(
        newPlanParams.lockPlanId,
        newPlanParams.name,
        newPlanParams.startPercent,
        newPlanParams.startDelay,
        newPlanParams.nextPercent,
        newPlanParams.nextDelay,
      )).not.to.be.reverted;
      await logGasUsageEthTransaction(`updateLockPlan - ${newPlanParams.name}`, (ethTx as any));

      const lockPlanAfter = await chimVesting.connect(actionWallet).getLockPlan(newPlanParams.lockPlanId);
      expect(lockPlanAfter).to.deep.eq([
        newPlanParams.name,
        lockPlanBefore.maxPlanTotal,
        lockPlanBefore.total,
        lockPlanBefore.locked,
        lockPlanBefore.withdrawn,
        newPlanParams.startPercent,
        newPlanParams.startDelay,
        newPlanParams.nextPercent,
        newPlanParams.nextDelay,
      ]);
    });
  });

  describe('lockTokens - onlyOwner', () => {
    it('fail - not owner', async () => {
      const actionWallet = eveWallet;
      const lockPlanInfo = chimVestingParams.vesting.plans[0];
      const address = eveWallet.address;
      const amount = parseBigNumber('100', baseConfig.ethDecimals);
      const planId = lockPlanInfo.id;

      const lockPlanCount = await chimVesting.connect(actionWallet).getLockPlanCount();
      expect(planId).to.be.gt(0).and.to.be.lte(lockPlanCount);

      const lockPlanBefore = await chimVesting.connect(actionWallet).getLockPlan(planId);
      const planBalanceOfBefore = await chimVesting.connect(actionWallet).getPlanBalanceOf(address, planId);
      const statsBefore = await chimVesting.connect(actionWallet).stats();
      expect(lockPlanBefore.maxPlanTotal).to.be.gte(lockPlanBefore.total.add(amount));
      expect(statsBefore.totalBalance).to.be.gte(statsBefore.totalLocked.add(amount));

      await checkContractOwner(actionWallet.address, chimVesting, false);

      await expect(chimVesting.connect(actionWallet).lockTokens(
        address,
        amount,
        planId,
      )).to.be.revertedWith(ERRORS.OWNABLE_NOT_OWNER);

      const lockPlanAfter = await chimVesting.connect(actionWallet).getLockPlan(planId);
      const planBalanceOfAfter = await chimVesting.connect(actionWallet).getPlanBalanceOf(address, planId);
      const statsAfter = await chimVesting.connect(actionWallet).stats();
      expect(lockPlanAfter).to.deep.eq(lockPlanBefore);
      expect(planBalanceOfAfter).to.deep.eq(planBalanceOfBefore);
      expect(statsAfter).to.deep.eq(statsBefore);
    });

    it('fail - invalid address', async () => {
      const actionWallet = chimVestingWallet;
      const lockPlanInfo = chimVestingParams.vesting.plans[0];
      const address = nullAddress;
      const amount = parseBigNumber('100', baseConfig.ethDecimals);
      const planId = lockPlanInfo.id;

      const lockPlanCount = await chimVesting.connect(actionWallet).getLockPlanCount();
      expect(planId).to.be.gt(0).and.to.be.lte(lockPlanCount);

      const lockPlanBefore = await chimVesting.connect(actionWallet).getLockPlan(planId);
      const planBalanceOfBefore = await chimVesting.connect(actionWallet).getPlanBalanceOf(address, planId);
      const statsBefore = await chimVesting.connect(actionWallet).stats();
      expect(lockPlanBefore.maxPlanTotal).to.be.gte(lockPlanBefore.total.add(amount));
      expect(statsBefore.totalBalance).to.be.gte(statsBefore.totalLocked.add(amount));

      await checkContractOwner(actionWallet.address, chimVesting, true);

      await expect(chimVesting.connect(actionWallet).lockTokens(
        address,
        amount,
        planId,
      )).to.be.revertedWith(ERRORS.CHIM_VESTING_INVALID_ADDRESS);

      const lockPlanAfter = await chimVesting.connect(actionWallet).getLockPlan(planId);
      const planBalanceOfAfter = await chimVesting.connect(actionWallet).getPlanBalanceOf(address, planId);
      const statsAfter = await chimVesting.connect(actionWallet).stats();
      expect(lockPlanAfter).to.deep.eq(lockPlanBefore);
      expect(planBalanceOfAfter).to.deep.eq(planBalanceOfBefore);
      expect(statsAfter).to.deep.eq(statsBefore);
    });

    it('fail - lockPlanId not exist', async () => {
      const actionWallet = chimVestingWallet;
      const lockPlanInfo = { id: BigNumber.from(0) };
      const address = eveWallet.address;
      const amount = parseBigNumber('100', baseConfig.ethDecimals);
      const planId = lockPlanInfo.id;

      const lockPlanCount = await chimVesting.connect(actionWallet).getLockPlanCount();
      expect(planId).to.be.eq(0).and.to.be.lte(lockPlanCount);

      const lockPlanBefore = await chimVesting.connect(actionWallet).getLockPlan(planId);
      const planBalanceOfBefore = await chimVesting.connect(actionWallet).getPlanBalanceOf(address, planId);
      const statsBefore = await chimVesting.connect(actionWallet).stats();
      expect(lockPlanBefore.maxPlanTotal).to.be.eq(BigNumber.from(0));
      expect(statsBefore.totalBalance).to.be.gte(statsBefore.totalLocked.add(amount));

      await checkContractOwner(actionWallet.address, chimVesting, true);

      await expect(chimVesting.connect(actionWallet).lockTokens(
        address,
        amount,
        planId,
      )).to.be.revertedWith(ERRORS.CHIM_VESTING_PLAN_NOT_EXIST);

      const lockPlanAfter = await chimVesting.connect(actionWallet).getLockPlan(planId);
      const planBalanceOfAfter = await chimVesting.connect(actionWallet).getPlanBalanceOf(address, planId);
      const statsAfter = await chimVesting.connect(actionWallet).stats();
      expect(lockPlanAfter).to.deep.eq(lockPlanBefore);
      expect(planBalanceOfAfter).to.deep.eq(planBalanceOfBefore);
      expect(statsAfter).to.deep.eq(statsBefore);
    });

    it('fail - max plan total limit reached', async () => {
      const actionWallet = chimVestingWallet;
      const lockPlanInfo = chimVestingParams.vesting.plans[0];
      const address = eveWallet.address;
      const amount = lockPlanInfo.maxPlanTotal.sub(lockPlanInfo.total).add(1);
      const planId = lockPlanInfo.id;

      const lockPlanCount = await chimVesting.connect(actionWallet).getLockPlanCount();
      expect(planId).to.be.gt(0).and.to.be.lte(lockPlanCount);

      const lockPlanBefore = await chimVesting.connect(actionWallet).getLockPlan(planId);
      const planBalanceOfBefore = await chimVesting.connect(actionWallet).getPlanBalanceOf(address, planId);
      const statsBefore = await chimVesting.connect(actionWallet).stats();
      expect(lockPlanBefore.maxPlanTotal).to.be.lt(lockPlanBefore.total.add(amount));
      expect(statsBefore.totalBalance).to.be.gte(statsBefore.totalLocked.add(amount));

      await checkContractOwner(actionWallet.address, chimVesting, true);
      await expect(chimVesting.connect(actionWallet).lockTokens(
        address,
        amount,
        planId,
      )).to.be.revertedWith(ERRORS.CHIM_VESTING_MAX_PLAN_TOTAL_LIMIT_REACHED);

      const lockPlanAfter = await chimVesting.connect(actionWallet).getLockPlan(planId);
      const planBalanceOfAfter = await chimVesting.connect(actionWallet).getPlanBalanceOf(address, planId);
      const statsAfter = await chimVesting.connect(actionWallet).stats();
      expect(lockPlanAfter).to.deep.eq(lockPlanBefore);
      expect(planBalanceOfAfter).to.deep.eq(planBalanceOfBefore);
      expect(statsAfter).to.deep.eq(statsBefore);
    });

    it('success', async () => {
      const actionWallet = chimVestingWallet;
      const lockPlanInfo = chimVestingParams.vesting.plans[0];
      const address = eveWallet.address;
      const amount = parseBigNumber('100', baseConfig.ethDecimals);
      const planId = lockPlanInfo.id;

      const lockPlanCount = await chimVesting.connect(actionWallet).getLockPlanCount();
      expect(planId).to.be.gt(0).and.to.be.lte(lockPlanCount);

      const lockPlanBefore = await chimVesting.connect(actionWallet).getLockPlan(planId);
      const planBalanceOfBefore = await chimVesting.connect(actionWallet).getPlanBalanceOf(address, planId);
      const statsBefore = await chimVesting.connect(actionWallet).stats();
      expect(lockPlanBefore.maxPlanTotal).to.be.gte(lockPlanBefore.total.add(amount));
      expect(statsBefore.totalBalance).to.be.gte(statsBefore.totalLocked.add(amount));

      await checkContractOwner(actionWallet.address, chimVesting, true);

      const ethTx = await expect(chimVesting.connect(actionWallet).lockTokens(
        address,
        amount,
        planId,
      )).not.to.be.reverted;
      await logGasUsageEthTransaction(`lockTokens - ${planId}`, (ethTx as any));

      const lockPlanAfter = await chimVesting.connect(actionWallet).getLockPlan(planId);
      const planBalanceOfAfter = await chimVesting.connect(actionWallet).getPlanBalanceOf(address, planId);
      const statsAfter = await chimVesting.connect(actionWallet).stats();
      expect(lockPlanAfter.total).to.be.eq(lockPlanBefore.total.add(amount));
      expect(lockPlanAfter.locked).to.be.eq(lockPlanBefore.locked.add(amount));
      expect(lockPlanAfter.withdrawn).to.be.eq(lockPlanBefore.withdrawn);
      expect(planBalanceOfAfter.total).to.be.eq(planBalanceOfBefore.total.add(amount));
      expect(planBalanceOfAfter.locked).to.be.eq(planBalanceOfBefore.locked.add(amount));
      expect(planBalanceOfAfter.withdrawn).to.be.eq(planBalanceOfBefore.withdrawn);
      expect(statsAfter.totalBalance).to.be.eq(statsBefore.totalBalance);
      expect(statsAfter.total).to.be.eq(statsBefore.total.add(amount));
      expect(statsAfter.totalLocked).to.be.eq(statsBefore.totalLocked.add(amount));
      expect(statsAfter.totalWithdrawn).to.be.eq(statsBefore.totalWithdrawn);
    });
  });
});

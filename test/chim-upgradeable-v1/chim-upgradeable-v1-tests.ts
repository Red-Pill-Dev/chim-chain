import hre from 'hardhat';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import { ChimUpgradeableV1 } from '../../typechain/ChimUpgradeableV1';
import { chimParams, setupChimUpgradeableV1 } from './chim-upgradeable-v1-setup';
import { checkContractOwner, logGasUsageEthTransaction, nullAddress, parseBigNumber } from '../../utils/utilities';
import { baseConfig } from '../../utils/config';

const ERRORS = {
  OWNABLE_NOT_OWNER: 'Ownable: caller is not the owner',
  ERC20_TRANSFER_AMOUNT_EXCEEDS_BALANCE: 'ERC20: transfer amount exceeds balance',
  PAUSABLE_ALREADY_PAUSED: 'Pausable: paused',
  PAUSABLE_ALREADY_UNPAUSED: 'Pausable: not paused',
  PAUSABLE_TOKEN_TRANSFER_PAUSED: 'ERC20Pausable: token transfer while paused',
  CHIM_INVALID_ADDRESS: 'CHIM: Invalid address',
  CHIM_MAX_TOTAL_SUPPLY_LIMIT: 'CHIM: Max total supply limit reached',
  CHIM_ADDRESS_IS_BLACKLISTED: 'CHIM: Address is blacklisted',
};

describe('Chim-token-upgradeable-v1', () => {
  let chimToken: ChimUpgradeableV1;
  let ownerWallet: SignerWithAddress;
  let aliceWallet: SignerWithAddress;
  let bobWallet: SignerWithAddress;
  let eveWallet: SignerWithAddress;
  let blacklistedWallet: SignerWithAddress;

  beforeEach(async () => {
    // get wallets
    [ownerWallet, aliceWallet, bobWallet, eveWallet, blacklistedWallet] = await hre.ethers.getSigners();

    // deploy contract
    chimToken = await setupChimUpgradeableV1(ownerWallet);

    // mint tokens to Alice, Bob, blacklistedWallet addresses
    await chimToken.connect(ownerWallet).transfer(
      aliceWallet.address,
      parseBigNumber('10000', baseConfig.ethDecimals),
    );
    await chimToken.connect(ownerWallet).transfer(
      bobWallet.address,
      parseBigNumber('20000', baseConfig.ethDecimals),
    );
    await chimToken.connect(ownerWallet).transfer(
      blacklistedWallet.address,
      parseBigNumber('30000', baseConfig.ethDecimals),
    );

    // add blacklistedWallet's address to blacklist
    await chimToken.connect(ownerWallet).addToBlacklist(
      blacklistedWallet.address,
    );
  });

  describe('name - public', () => {
    it('success', async () => {
      const name = await chimToken.connect(aliceWallet).name();
      expect(name).to.be.eq(chimParams.name);
    });
  });

  describe('symbol - public', () => {
    it('success', async () => {
      const symbol = await chimToken.connect(aliceWallet).symbol();
      expect(symbol).to.be.eq(chimParams.symbol);
    });
  });

  describe('decimals - public', () => {
    it('success', async () => {
      const decimals = await chimToken.connect(aliceWallet).decimals();
      expect(decimals).to.be.eq(chimParams.decimals);
    });
  });

  describe('owner - public', () => {
    it('success', async () => {
      const owner = await chimToken.connect(aliceWallet).owner();
      expect(owner).to.be.eq(ownerWallet.address);
    });
  });

  describe('getOwner - public', () => {
    it('success', async () => {
      const owner = await chimToken.connect(aliceWallet).getOwner();
      expect(owner).to.be.eq(ownerWallet.address);
    });
  });

  describe('totalSupply - public', () => {
    it('success', async () => {
      const totalSupply = await chimToken.connect(aliceWallet).totalSupply();
      expect(totalSupply).to.be.eq(chimParams.totalSupply);
    });
  });

  describe('maxTotalSupply - public', () => {
    it('success', async () => {
      const maxTotalSupply = await chimToken.connect(aliceWallet).maxTotalSupply();
      expect(maxTotalSupply).to.be.eq(chimParams.maxTotalSupply);
    });
  });

  describe('paused - public', () => {
    it('success', async () => {
      let paused = await chimToken.connect(aliceWallet).paused();
      expect(paused).to.be.eq(false);

      await chimToken.connect(ownerWallet).pauseContract();
      paused = await chimToken.connect(aliceWallet).paused();
      expect(paused).to.be.eq(true);

      await chimToken.connect(ownerWallet).unpauseContract();
      paused = await chimToken.connect(aliceWallet).paused();
      expect(paused).to.be.eq(false);
    });
  });

  describe('isBlacklistedAddress - public', () => {
    it('success', async () => {
      const isBlacklistedBobAddress = await chimToken.connect(aliceWallet).isBlacklistedAddress(bobWallet.address);
      expect(isBlacklistedBobAddress).to.be.eq(false);

      const isBlacklistedWalletAddress = await chimToken.connect(aliceWallet).isBlacklistedAddress(blacklistedWallet.address);
      expect(isBlacklistedWalletAddress).to.be.eq(true);
    });
  });

  describe('transfer - public', () => {
    it('fail - transfer amount exceeds balance', async () => {
      const actionWallet = aliceWallet;
      const addressFrom = actionWallet.address;
      const addressTo = bobWallet.address;
      const amount = parseBigNumber('10000000', baseConfig.ethDecimals);

      const isBlacklistedAddressFrom = await chimToken.connect(actionWallet).isBlacklistedAddress(addressFrom);
      expect(isBlacklistedAddressFrom).to.be.eq(false);
      const isBlacklistedAddressTo = await chimToken.connect(actionWallet).isBlacklistedAddress(addressTo);
      expect(isBlacklistedAddressTo).to.be.eq(false);

      const addressFromBalanceBefore = await chimToken.connect(actionWallet).balanceOf(addressFrom);
      expect(addressFromBalanceBefore).to.be.lt(amount);
      const addressToBalanceBefore = await chimToken.connect(actionWallet).balanceOf(addressTo);
      expect(addressToBalanceBefore).to.be.gte(BigNumber.from(0));

      await expect(chimToken.connect(actionWallet).transfer(addressTo, amount)).to.be.revertedWith(ERRORS.ERC20_TRANSFER_AMOUNT_EXCEEDS_BALANCE);

      const addressFromBalanceAfter = await chimToken.connect(actionWallet).balanceOf(addressFrom);
      expect(addressFromBalanceAfter).to.be.eq(addressFromBalanceBefore);
      const addressToBalanceAfter = await chimToken.connect(actionWallet).balanceOf(addressTo);
      expect(addressToBalanceAfter).to.be.eq(addressToBalanceBefore);
    });

    it('fail - contract paused', async () => {
      const actionWallet = aliceWallet;
      const addressFrom = actionWallet.address;
      const addressTo = bobWallet.address;
      const amount = parseBigNumber('100', baseConfig.ethDecimals);

      await chimToken.connect(ownerWallet).pauseContract();

      const isBlacklistedAddressFrom = await chimToken.connect(actionWallet).isBlacklistedAddress(addressFrom);
      expect(isBlacklistedAddressFrom).to.be.eq(false);
      const isBlacklistedAddressTo = await chimToken.connect(actionWallet).isBlacklistedAddress(addressTo);
      expect(isBlacklistedAddressTo).to.be.eq(false);

      const addressFromBalanceBefore = await chimToken.connect(actionWallet).balanceOf(addressFrom);
      expect(addressFromBalanceBefore).to.be.gte(amount);
      const addressToBalanceBefore = await chimToken.connect(actionWallet).balanceOf(addressTo);
      expect(addressToBalanceBefore).to.be.gte(BigNumber.from(0));

      await expect(chimToken.connect(actionWallet).transfer(addressTo, amount)).to.be.revertedWith(ERRORS.PAUSABLE_TOKEN_TRANSFER_PAUSED);

      const addressFromBalanceAfter = await chimToken.connect(actionWallet).balanceOf(addressFrom);
      expect(addressFromBalanceAfter).to.be.eq(addressFromBalanceBefore);
      const addressToBalanceAfter = await chimToken.connect(actionWallet).balanceOf(addressTo);
      expect(addressToBalanceAfter).to.be.eq(addressToBalanceBefore);
    });

    it('fail - addressFrom is blacklisted', async () => {
      const actionWallet = blacklistedWallet;
      const addressFrom = actionWallet.address;
      const addressTo = bobWallet.address;
      const amount = parseBigNumber('100', baseConfig.ethDecimals);

      const isBlacklistedAddressFrom = await chimToken.connect(actionWallet).isBlacklistedAddress(addressFrom);
      expect(isBlacklistedAddressFrom).to.be.eq(true);
      const isBlacklistedAddressTo = await chimToken.connect(actionWallet).isBlacklistedAddress(addressTo);
      expect(isBlacklistedAddressTo).to.be.eq(false);

      const addressFromBalanceBefore = await chimToken.connect(actionWallet).balanceOf(addressFrom);
      expect(addressFromBalanceBefore).to.be.gte(amount);
      const addressToBalanceBefore = await chimToken.connect(actionWallet).balanceOf(addressTo);
      expect(addressToBalanceBefore).to.be.gte(BigNumber.from(0));

      await expect(chimToken.connect(actionWallet).transfer(addressTo, amount)).to.be.revertedWith(ERRORS.CHIM_ADDRESS_IS_BLACKLISTED);

      const addressFromBalanceAfter = await chimToken.connect(actionWallet).balanceOf(addressFrom);
      expect(addressFromBalanceAfter).to.be.eq(addressFromBalanceBefore);
      const addressToBalanceAfter = await chimToken.connect(actionWallet).balanceOf(addressTo);
      expect(addressToBalanceAfter).to.be.eq(addressToBalanceBefore);
    });

    it('fail - addressTo is blacklisted', async () => {
      const actionWallet = aliceWallet;
      const addressFrom = actionWallet.address;
      const addressTo = blacklistedWallet.address;
      const amount = parseBigNumber('100', baseConfig.ethDecimals);

      const isBlacklistedAddressFrom = await chimToken.connect(actionWallet).isBlacklistedAddress(addressFrom);
      expect(isBlacklistedAddressFrom).to.be.eq(false);
      const isBlacklistedAddressTo = await chimToken.connect(actionWallet).isBlacklistedAddress(addressTo);
      expect(isBlacklistedAddressTo).to.be.eq(true);

      const addressFromBalanceBefore = await chimToken.connect(actionWallet).balanceOf(addressFrom);
      expect(addressFromBalanceBefore).to.be.gte(amount);
      const addressToBalanceBefore = await chimToken.connect(actionWallet).balanceOf(addressTo);
      expect(addressToBalanceBefore).to.be.gte(BigNumber.from(0));

      await expect(chimToken.connect(actionWallet).transfer(addressTo, amount)).to.be.revertedWith(ERRORS.CHIM_ADDRESS_IS_BLACKLISTED);

      const addressFromBalanceAfter = await chimToken.connect(actionWallet).balanceOf(addressFrom);
      expect(addressFromBalanceAfter).to.be.eq(addressFromBalanceBefore);
      const addressToBalanceAfter = await chimToken.connect(actionWallet).balanceOf(addressTo);
      expect(addressToBalanceAfter).to.be.eq(addressToBalanceBefore);
    });

    it('success', async () => {
      const actionWallet = aliceWallet;
      const addressFrom = actionWallet.address;
      const addressTo = bobWallet.address;
      const amount = parseBigNumber('100', baseConfig.ethDecimals);

      const isBlacklistedAddressFrom = await chimToken.connect(actionWallet).isBlacklistedAddress(addressFrom);
      expect(isBlacklistedAddressFrom).to.be.eq(false);
      const isBlacklistedAddressTo = await chimToken.connect(actionWallet).isBlacklistedAddress(addressTo);
      expect(isBlacklistedAddressTo).to.be.eq(false);

      const addressFromBalanceBefore = await chimToken.connect(actionWallet).balanceOf(addressFrom);
      expect(addressFromBalanceBefore).to.be.gte(amount);
      const addressToBalanceBefore = await chimToken.connect(actionWallet).balanceOf(addressTo);
      expect(addressToBalanceBefore).to.be.gte(BigNumber.from(0));

      const ethTx = await expect(chimToken.connect(actionWallet).transfer(addressTo, amount)).not.to.be.reverted;
      await logGasUsageEthTransaction('transfer', (ethTx as any));

      const addressFromBalanceAfter = await chimToken.connect(actionWallet).balanceOf(addressFrom);
      expect(addressFromBalanceAfter).to.be.eq(addressFromBalanceBefore.sub(amount));
      const addressToBalanceAfter = await chimToken.connect(actionWallet).balanceOf(addressTo);
      expect(addressToBalanceAfter).to.be.eq(addressToBalanceBefore.add(amount));
    });
  });

  describe('transferFrom - public', () => {
    it('fail - transfer amount exceeds balance', async () => {
      const actionWallet = aliceWallet;
      const addressFromWallet = bobWallet;
      const addressFrom = addressFromWallet.address;
      const addressTo = eveWallet.address;
      const amount = parseBigNumber('10000000', baseConfig.ethDecimals);

      const isBlacklistedaAtionWallet = await chimToken.connect(actionWallet).isBlacklistedAddress(actionWallet.address);
      expect(isBlacklistedaAtionWallet).to.be.eq(false);
      const isBlacklistedAddressFrom = await chimToken.connect(actionWallet).isBlacklistedAddress(addressFrom);
      expect(isBlacklistedAddressFrom).to.be.eq(false);
      const isBlacklistedAddressTo = await chimToken.connect(actionWallet).isBlacklistedAddress(addressTo);
      expect(isBlacklistedAddressTo).to.be.eq(false);

      await chimToken.connect(addressFromWallet).increaseAllowance(actionWallet.address, amount);
      const allowanceBefore = await chimToken.connect(addressFromWallet).allowance(addressFrom, actionWallet.address);
      expect(allowanceBefore).to.be.gte(amount);
      const addressFromBalanceBefore = await chimToken.connect(actionWallet).balanceOf(addressFrom);
      expect(addressFromBalanceBefore).to.be.lt(amount);
      const addressToBalanceBefore = await chimToken.connect(actionWallet).balanceOf(addressTo);
      expect(addressToBalanceBefore).to.be.gte(BigNumber.from(0));

      await expect(chimToken.connect(actionWallet).transferFrom(addressFrom, addressTo, amount)).to.be.revertedWith(ERRORS.ERC20_TRANSFER_AMOUNT_EXCEEDS_BALANCE);

      const addressFromBalanceAfter = await chimToken.connect(actionWallet).balanceOf(addressFrom);
      expect(addressFromBalanceAfter).to.be.eq(addressFromBalanceBefore);
      const addressToBalanceAfter = await chimToken.connect(actionWallet).balanceOf(addressTo);
      expect(addressToBalanceAfter).to.be.eq(addressToBalanceBefore);
      const allowanceAfter = await chimToken.connect(addressFromWallet).allowance(addressFrom, actionWallet.address);
      expect(allowanceAfter).to.be.eq(allowanceBefore);
    });

    it('fail - contract paused', async () => {
      const actionWallet = aliceWallet;
      const addressFromWallet = bobWallet;
      const addressFrom = addressFromWallet.address;
      const addressTo = eveWallet.address;
      const amount = parseBigNumber('100', baseConfig.ethDecimals);

      await chimToken.connect(ownerWallet).pauseContract();

      const isBlacklistedaAtionWallet = await chimToken.connect(actionWallet).isBlacklistedAddress(actionWallet.address);
      expect(isBlacklistedaAtionWallet).to.be.eq(false);
      const isBlacklistedAddressFrom = await chimToken.connect(actionWallet).isBlacklistedAddress(addressFrom);
      expect(isBlacklistedAddressFrom).to.be.eq(false);
      const isBlacklistedAddressTo = await chimToken.connect(actionWallet).isBlacklistedAddress(addressTo);
      expect(isBlacklistedAddressTo).to.be.eq(false);

      await chimToken.connect(addressFromWallet).increaseAllowance(actionWallet.address, amount);
      const allowanceBefore = await chimToken.connect(addressFromWallet).allowance(addressFrom, actionWallet.address);
      expect(allowanceBefore).to.be.gte(amount);
      const addressFromBalanceBefore = await chimToken.connect(actionWallet).balanceOf(addressFrom);
      expect(addressFromBalanceBefore).to.be.gte(amount);
      const addressToBalanceBefore = await chimToken.connect(actionWallet).balanceOf(addressTo);
      expect(addressToBalanceBefore).to.be.gte(BigNumber.from(0));

      await expect(chimToken.connect(actionWallet).transferFrom(addressFrom, addressTo, amount)).to.be.revertedWith(ERRORS.PAUSABLE_TOKEN_TRANSFER_PAUSED);

      const addressFromBalanceAfter = await chimToken.connect(actionWallet).balanceOf(addressFrom);
      expect(addressFromBalanceAfter).to.be.eq(addressFromBalanceBefore);
      const addressToBalanceAfter = await chimToken.connect(actionWallet).balanceOf(addressTo);
      expect(addressToBalanceAfter).to.be.eq(addressToBalanceBefore);
      const allowanceAfter = await chimToken.connect(addressFromWallet).allowance(addressFrom, actionWallet.address);
      expect(allowanceAfter).to.be.eq(allowanceBefore);
    });

    it('fail - actionWallet address is blacklisted', async () => {
      const actionWallet = blacklistedWallet;
      const addressFromWallet = bobWallet;
      const addressFrom = addressFromWallet.address;
      const addressTo = eveWallet.address;
      const amount = parseBigNumber('100', baseConfig.ethDecimals);

      const isBlacklistedaAtionWallet = await chimToken.connect(actionWallet).isBlacklistedAddress(actionWallet.address);
      expect(isBlacklistedaAtionWallet).to.be.eq(true);
      const isBlacklistedAddressFrom = await chimToken.connect(actionWallet).isBlacklistedAddress(addressFrom);
      expect(isBlacklistedAddressFrom).to.be.eq(false);
      const isBlacklistedAddressTo = await chimToken.connect(actionWallet).isBlacklistedAddress(addressTo);
      expect(isBlacklistedAddressTo).to.be.eq(false);

      await chimToken.connect(addressFromWallet).increaseAllowance(actionWallet.address, amount);
      const allowanceBefore = await chimToken.connect(addressFromWallet).allowance(addressFrom, actionWallet.address);
      expect(allowanceBefore).to.be.gte(amount);
      const addressFromBalanceBefore = await chimToken.connect(actionWallet).balanceOf(addressFrom);
      expect(addressFromBalanceBefore).to.be.gte(amount);
      const addressToBalanceBefore = await chimToken.connect(actionWallet).balanceOf(addressTo);
      expect(addressToBalanceBefore).to.be.gte(BigNumber.from(0));

      await expect(chimToken.connect(actionWallet).transferFrom(addressFrom, addressTo, amount)).to.be.revertedWith(ERRORS.CHIM_ADDRESS_IS_BLACKLISTED);

      const addressFromBalanceAfter = await chimToken.connect(actionWallet).balanceOf(addressFrom);
      expect(addressFromBalanceAfter).to.be.eq(addressFromBalanceBefore);
      const addressToBalanceAfter = await chimToken.connect(actionWallet).balanceOf(addressTo);
      expect(addressToBalanceAfter).to.be.eq(addressToBalanceBefore);
      const allowanceAfter = await chimToken.connect(addressFromWallet).allowance(addressFrom, actionWallet.address);
      expect(allowanceAfter).to.be.eq(allowanceBefore);
    });

    it('fail - addressFrom address is blacklisted', async () => {
      const actionWallet = aliceWallet;
      const addressFromWallet = blacklistedWallet;
      const addressFrom = addressFromWallet.address;
      const addressTo = eveWallet.address;
      const amount = parseBigNumber('100', baseConfig.ethDecimals);

      const isBlacklistedaAtionWallet = await chimToken.connect(actionWallet).isBlacklistedAddress(actionWallet.address);
      expect(isBlacklistedaAtionWallet).to.be.eq(false);
      const isBlacklistedAddressFrom = await chimToken.connect(actionWallet).isBlacklistedAddress(addressFrom);
      expect(isBlacklistedAddressFrom).to.be.eq(true);
      const isBlacklistedAddressTo = await chimToken.connect(actionWallet).isBlacklistedAddress(addressTo);
      expect(isBlacklistedAddressTo).to.be.eq(false);

      await chimToken.connect(addressFromWallet).increaseAllowance(actionWallet.address, amount);
      const allowanceBefore = await chimToken.connect(addressFromWallet).allowance(addressFrom, actionWallet.address);
      expect(allowanceBefore).to.be.gte(amount);
      const addressFromBalanceBefore = await chimToken.connect(actionWallet).balanceOf(addressFrom);
      expect(addressFromBalanceBefore).to.be.gte(amount);
      const addressToBalanceBefore = await chimToken.connect(actionWallet).balanceOf(addressTo);
      expect(addressToBalanceBefore).to.be.gte(BigNumber.from(0));

      await expect(chimToken.connect(actionWallet).transferFrom(addressFrom, addressTo, amount)).to.be.revertedWith(ERRORS.CHIM_ADDRESS_IS_BLACKLISTED);

      const addressFromBalanceAfter = await chimToken.connect(actionWallet).balanceOf(addressFrom);
      expect(addressFromBalanceAfter).to.be.eq(addressFromBalanceBefore);
      const addressToBalanceAfter = await chimToken.connect(actionWallet).balanceOf(addressTo);
      expect(addressToBalanceAfter).to.be.eq(addressToBalanceBefore);
      const allowanceAfter = await chimToken.connect(addressFromWallet).allowance(addressFrom, actionWallet.address);
      expect(allowanceAfter).to.be.eq(allowanceBefore);
    });

    it('fail - addressTo address is blacklisted', async () => {
      const actionWallet = aliceWallet;
      const addressFromWallet = bobWallet;
      const addressFrom = addressFromWallet.address;
      const addressTo = blacklistedWallet.address;
      const amount = parseBigNumber('100', baseConfig.ethDecimals);

      const isBlacklistedaAtionWallet = await chimToken.connect(actionWallet).isBlacklistedAddress(actionWallet.address);
      expect(isBlacklistedaAtionWallet).to.be.eq(false);
      const isBlacklistedAddressFrom = await chimToken.connect(actionWallet).isBlacklistedAddress(addressFrom);
      expect(isBlacklistedAddressFrom).to.be.eq(false);
      const isBlacklistedAddressTo = await chimToken.connect(actionWallet).isBlacklistedAddress(addressTo);
      expect(isBlacklistedAddressTo).to.be.eq(true);

      await chimToken.connect(addressFromWallet).increaseAllowance(actionWallet.address, amount);
      const allowanceBefore = await chimToken.connect(addressFromWallet).allowance(addressFrom, actionWallet.address);
      expect(allowanceBefore).to.be.gte(amount);
      const addressFromBalanceBefore = await chimToken.connect(actionWallet).balanceOf(addressFrom);
      expect(addressFromBalanceBefore).to.be.gte(amount);
      const addressToBalanceBefore = await chimToken.connect(actionWallet).balanceOf(addressTo);
      expect(addressToBalanceBefore).to.be.gte(BigNumber.from(0));

      await expect(chimToken.connect(actionWallet).transferFrom(addressFrom, addressTo, amount)).to.be.revertedWith(ERRORS.CHIM_ADDRESS_IS_BLACKLISTED);

      const addressFromBalanceAfter = await chimToken.connect(actionWallet).balanceOf(addressFrom);
      expect(addressFromBalanceAfter).to.be.eq(addressFromBalanceBefore);
      const addressToBalanceAfter = await chimToken.connect(actionWallet).balanceOf(addressTo);
      expect(addressToBalanceAfter).to.be.eq(addressToBalanceBefore);
      const allowanceAfter = await chimToken.connect(addressFromWallet).allowance(addressFrom, actionWallet.address);
      expect(allowanceAfter).to.be.eq(allowanceBefore);
    });

    it('success', async () => {
      const actionWallet = aliceWallet;
      const addressFromWallet = bobWallet;
      const addressFrom = addressFromWallet.address;
      const addressTo = eveWallet.address;
      const amount = parseBigNumber('100', baseConfig.ethDecimals);

      const isBlacklistedaAtionWallet = await chimToken.connect(actionWallet).isBlacklistedAddress(actionWallet.address);
      expect(isBlacklistedaAtionWallet).to.be.eq(false);
      const isBlacklistedAddressFrom = await chimToken.connect(actionWallet).isBlacklistedAddress(addressFrom);
      expect(isBlacklistedAddressFrom).to.be.eq(false);
      const isBlacklistedAddressTo = await chimToken.connect(actionWallet).isBlacklistedAddress(addressTo);
      expect(isBlacklistedAddressTo).to.be.eq(false);

      await chimToken.connect(addressFromWallet).increaseAllowance(actionWallet.address, amount);
      const allowanceBefore = await chimToken.connect(addressFromWallet).allowance(addressFrom, actionWallet.address);
      expect(allowanceBefore).to.be.gte(amount);
      const addressFromBalanceBefore = await chimToken.connect(actionWallet).balanceOf(addressFrom);
      expect(addressFromBalanceBefore).to.be.gte(amount);
      const addressToBalanceBefore = await chimToken.connect(actionWallet).balanceOf(addressTo);
      expect(addressToBalanceBefore).to.be.gte(BigNumber.from(0));

      const ethTx = await expect(chimToken.connect(actionWallet).transferFrom(addressFrom, addressTo, amount)).not.to.be.reverted;
      await logGasUsageEthTransaction('transferFrom', (ethTx as any));

      const addressFromBalanceAfter = await chimToken.connect(actionWallet).balanceOf(addressFrom);
      expect(addressFromBalanceAfter).to.be.eq(addressFromBalanceBefore.sub(amount));
      const addressToBalanceAfter = await chimToken.connect(actionWallet).balanceOf(addressTo);
      expect(addressToBalanceAfter).to.be.eq(addressToBalanceBefore.add(amount));
      const allowanceAfter = await chimToken.connect(addressFromWallet).allowance(addressFrom, actionWallet.address);
      expect(allowanceAfter).to.be.eq(allowanceBefore.sub(amount));
    });
  });

  describe('pauseContract - onlyOwner', () => {
    it('fail - not owner', async () => {
      const actionWallet = aliceWallet;

      const pausedBefore = await chimToken.connect(actionWallet).paused();
      expect(pausedBefore).to.be.eq(false);

      await checkContractOwner(actionWallet.address, chimToken, false);

      await expect(chimToken.connect(actionWallet).pauseContract()).to.be.revertedWith(ERRORS.OWNABLE_NOT_OWNER);

      const pausedAfter = await chimToken.connect(actionWallet).paused();
      expect(pausedAfter).to.be.eq(false);
    });

    it('fail - already paused', async () => {
      const actionWallet = ownerWallet;

      await chimToken.connect(actionWallet).pauseContract();
      const pausedBefore = await chimToken.connect(actionWallet).paused();
      expect(pausedBefore).to.be.eq(true);

      await checkContractOwner(actionWallet.address, chimToken, true);

      await expect(chimToken.connect(actionWallet).pauseContract()).to.be.revertedWith(ERRORS.PAUSABLE_ALREADY_PAUSED);

      const pausedAfter = await chimToken.connect(actionWallet).paused();
      expect(pausedAfter).to.be.eq(true);
    });

    it('success', async () => {
      const actionWallet = ownerWallet;

      const pausedBefore = await chimToken.connect(actionWallet).paused();
      expect(pausedBefore).to.be.eq(false);

      await checkContractOwner(actionWallet.address, chimToken, true);

      const ethTx = await expect(chimToken.connect(actionWallet).pauseContract()).not.to.be.reverted;
      await logGasUsageEthTransaction('pauseContract', (ethTx as any));

      const pausedAfter = await chimToken.connect(actionWallet).paused();
      expect(pausedAfter).to.be.eq(true);
    });
  });

  describe('unpauseContract - onlyOwner', () => {
    beforeEach(async () => {
      await chimToken.connect(ownerWallet).pauseContract();
    });

    it('fail - not owner', async () => {
      const actionWallet = aliceWallet;

      const pausedBefore = await chimToken.connect(actionWallet).paused();
      expect(pausedBefore).to.be.eq(true);

      await checkContractOwner(actionWallet.address, chimToken, false);

      await expect(chimToken.connect(actionWallet).unpauseContract()).to.be.revertedWith(ERRORS.OWNABLE_NOT_OWNER);

      const pausedAfter = await chimToken.connect(actionWallet).paused();
      expect(pausedAfter).to.be.eq(true);
    });

    it('fail - already unpaused', async () => {
      const actionWallet = ownerWallet;

      await chimToken.connect(actionWallet).unpauseContract();
      const pausedBefore = await chimToken.connect(actionWallet).paused();
      expect(pausedBefore).to.be.eq(false);

      await checkContractOwner(actionWallet.address, chimToken, true);

      await expect(chimToken.connect(actionWallet).unpauseContract()).to.be.revertedWith(ERRORS.PAUSABLE_ALREADY_UNPAUSED);

      const pausedAfter = await chimToken.connect(actionWallet).paused();
      expect(pausedAfter).to.be.eq(false);
    });

    it('success', async () => {
      const actionWallet = ownerWallet;

      const pausedBefore = await chimToken.connect(actionWallet).paused();
      expect(pausedBefore).to.be.eq(true);

      await checkContractOwner(actionWallet.address, chimToken, true);

      const ethTx = await expect(chimToken.connect(actionWallet).unpauseContract()).not.to.be.reverted;
      await logGasUsageEthTransaction('unpauseContract', (ethTx as any));

      const pausedAfter = await chimToken.connect(actionWallet).paused();
      expect(pausedAfter).to.be.eq(false);
    });
  });

  describe('addToBlacklist - onlyOwner', () => {
    it('fail - not owner', async () => {
      const actionWallet = aliceWallet;
      const blacklistAddress = eveWallet.address;

      const isBlacklistedAddressBefore = await chimToken.connect(actionWallet).isBlacklistedAddress(blacklistAddress);
      expect(isBlacklistedAddressBefore).to.be.eq(false);

      await checkContractOwner(actionWallet.address, chimToken, false);

      await expect(chimToken.connect(actionWallet).addToBlacklist(blacklistAddress)).to.be.revertedWith(ERRORS.OWNABLE_NOT_OWNER);

      const isBlacklistedAddressAfter = await chimToken.connect(actionWallet).isBlacklistedAddress(blacklistAddress);
      expect(isBlacklistedAddressAfter).to.be.eq(false);
    });

    it('success', async () => {
      const actionWallet = ownerWallet;
      const blacklistAddress = eveWallet.address;

      const isBlacklistedAddressBefore = await chimToken.connect(actionWallet).isBlacklistedAddress(blacklistAddress);
      expect(isBlacklistedAddressBefore).to.be.eq(false);

      await checkContractOwner(actionWallet.address, chimToken, true);

      const ethTx = await expect(chimToken.connect(actionWallet).addToBlacklist(blacklistAddress)).not.to.be.reverted;
      await logGasUsageEthTransaction('addToBlacklist', (ethTx as any));

      const isBlacklistedAddressAfter = await chimToken.connect(actionWallet).isBlacklistedAddress(blacklistAddress);
      expect(isBlacklistedAddressAfter).to.be.eq(true);
    });
  });

  describe('removeFromBlacklist - onlyOwner', () => {
    it('fail - not owner', async () => {
      const actionWallet = aliceWallet;
      const blacklistAddress = blacklistedWallet.address;

      const isBlacklistedAddressBefore = await chimToken.connect(actionWallet).isBlacklistedAddress(blacklistAddress);
      expect(isBlacklistedAddressBefore).to.be.eq(true);

      await checkContractOwner(actionWallet.address, chimToken, false);

      await expect(chimToken.connect(actionWallet).removeFromBlacklist(blacklistAddress)).to.be.revertedWith(ERRORS.OWNABLE_NOT_OWNER);

      const isBlacklistedAddressAfter = await chimToken.connect(actionWallet).isBlacklistedAddress(blacklistAddress);
      expect(isBlacklistedAddressAfter).to.be.eq(true);
    });

    it('success', async () => {
      const actionWallet = ownerWallet;
      const blacklistAddress = blacklistedWallet.address;

      const isBlacklistedAddressBefore = await chimToken.connect(actionWallet).isBlacklistedAddress(blacklistAddress);
      expect(isBlacklistedAddressBefore).to.be.eq(true);

      await checkContractOwner(actionWallet.address, chimToken, true);

      const ethTx = await expect(chimToken.connect(actionWallet).removeFromBlacklist(blacklistAddress)).not.to.be.reverted;
      await logGasUsageEthTransaction('removeFromBlacklist', (ethTx as any));

      const isBlacklistedAddressAfter = await chimToken.connect(actionWallet).isBlacklistedAddress(blacklistAddress);
      expect(isBlacklistedAddressAfter).to.be.eq(false);
    });
  });

  describe('mintAmount - onlyOwner', () => {
    it('fail - not owner', async () => {
      const actionWallet = aliceWallet;
      const mintAddress = eveWallet.address;
      const amount = parseBigNumber('10', baseConfig.ethDecimals);

      const isBlacklistedMintAddress = await chimToken.connect(actionWallet).isBlacklistedAddress(mintAddress);
      expect(isBlacklistedMintAddress).to.be.eq(false);

      const balanceBefore = await chimToken.connect(actionWallet).balanceOf(mintAddress);
      expect(balanceBefore).to.be.gte(BigNumber.from(0));

      await checkContractOwner(actionWallet.address, chimToken, false);

      await expect(chimToken.connect(actionWallet).mintAmount(mintAddress, amount)).to.be.revertedWith(ERRORS.OWNABLE_NOT_OWNER);

      const balanceAfter = await chimToken.connect(actionWallet).balanceOf(mintAddress);
      expect(balanceAfter).to.be.eq(balanceBefore);
    });

    it('fail - max total supply limit reached', async () => {
      const actionWallet = ownerWallet;
      const mintAddress = eveWallet.address;
      const amount = BigNumber.from(chimParams.maxTotalSupply);

      const isBlacklistedMintAddress = await chimToken.connect(actionWallet).isBlacklistedAddress(mintAddress);
      expect(isBlacklistedMintAddress).to.be.eq(false);

      const balanceBefore = await chimToken.connect(actionWallet).balanceOf(mintAddress);
      expect(balanceBefore).to.be.gte(BigNumber.from(0));

      await checkContractOwner(actionWallet.address, chimToken, true);

      await expect(chimToken.connect(actionWallet).mintAmount(mintAddress, amount)).to.be.revertedWith(ERRORS.CHIM_MAX_TOTAL_SUPPLY_LIMIT);

      const balanceAfter = await chimToken.connect(actionWallet).balanceOf(mintAddress);
      expect(balanceAfter).to.be.eq(balanceBefore);
    });

    it('fail - invalid mintAddress', async () => {
      const actionWallet = ownerWallet;
      const mintAddress = nullAddress;
      const amount = parseBigNumber('10', baseConfig.ethDecimals);

      const isBlacklistedMintAddress = await chimToken.connect(actionWallet).isBlacklistedAddress(mintAddress);
      expect(isBlacklistedMintAddress).to.be.eq(false);

      const balanceBefore = await chimToken.connect(actionWallet).balanceOf(mintAddress);
      expect(balanceBefore).to.be.gte(BigNumber.from(0));

      await checkContractOwner(actionWallet.address, chimToken, true);

      await expect(chimToken.connect(actionWallet).mintAmount(mintAddress, amount)).to.be.revertedWith(ERRORS.CHIM_INVALID_ADDRESS);

      const balanceAfter = await chimToken.connect(actionWallet).balanceOf(mintAddress);
      expect(balanceAfter).to.be.eq(balanceBefore);
    });

    it('fail - contract paused', async () => {
      const actionWallet = ownerWallet;
      const mintAddress = eveWallet.address;
      const amount = parseBigNumber('10', baseConfig.ethDecimals);

      await chimToken.connect(ownerWallet).pauseContract();

      const isBlacklistedMintAddress = await chimToken.connect(actionWallet).isBlacklistedAddress(mintAddress);
      expect(isBlacklistedMintAddress).to.be.eq(false);

      const balanceBefore = await chimToken.connect(actionWallet).balanceOf(mintAddress);
      expect(balanceBefore).to.be.gte(BigNumber.from(0));

      await checkContractOwner(actionWallet.address, chimToken, true);

      await expect(chimToken.connect(actionWallet).mintAmount(mintAddress, amount)).to.be.revertedWith(ERRORS.PAUSABLE_TOKEN_TRANSFER_PAUSED);

      const balanceAfter = await chimToken.connect(actionWallet).balanceOf(mintAddress);
      expect(balanceAfter).to.be.eq(balanceBefore);
    });

    it('fail - mintAddress is blacklisted', async () => {
      const actionWallet = ownerWallet;
      const mintAddress = blacklistedWallet.address;
      const amount = parseBigNumber('10', baseConfig.ethDecimals);

      const isBlacklistedMintAddress = await chimToken.connect(actionWallet).isBlacklistedAddress(mintAddress);
      expect(isBlacklistedMintAddress).to.be.eq(true);

      const balanceBefore = await chimToken.connect(actionWallet).balanceOf(mintAddress);
      expect(balanceBefore).to.be.gte(BigNumber.from(0));

      await checkContractOwner(actionWallet.address, chimToken, true);

      await expect(chimToken.connect(actionWallet).mintAmount(mintAddress, amount)).to.be.revertedWith(ERRORS.CHIM_ADDRESS_IS_BLACKLISTED);

      const balanceAfter = await chimToken.connect(actionWallet).balanceOf(mintAddress);
      expect(balanceAfter).to.be.eq(balanceBefore);
    });

    it('success', async () => {
      const actionWallet = ownerWallet;
      const mintAddress = eveWallet.address;
      const amount = parseBigNumber('10', baseConfig.ethDecimals);

      const isBlacklistedMintAddress = await chimToken.connect(actionWallet).isBlacklistedAddress(mintAddress);
      expect(isBlacklistedMintAddress).to.be.eq(false);

      const balanceBefore = await chimToken.connect(actionWallet).balanceOf(mintAddress);
      expect(balanceBefore).to.be.gte(BigNumber.from(0));

      await checkContractOwner(actionWallet.address, chimToken, true);

      const ethTx = await expect(chimToken.connect(actionWallet).mintAmount(mintAddress, amount)).not.to.be.reverted;
      await logGasUsageEthTransaction('mintAmount', (ethTx as any));

      const balanceAfter = await chimToken.connect(actionWallet).balanceOf(mintAddress);
      expect(balanceAfter).to.be.eq(balanceBefore.add(amount));
    });
  });
});

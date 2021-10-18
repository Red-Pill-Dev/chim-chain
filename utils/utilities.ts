import { ethers } from 'hardhat';
import { BigNumber, Contract, ContractTransaction, Wallet } from 'ethers';
import { expect } from 'chai';

export const nullAddress = '0x0000000000000000000000000000000000000000';

export function parseBigNumber(value: string, decimals: number): BigNumber {
  return ethers.utils.parseUnits(value, decimals);
}

export function getWalletByPrivateKey(privateKey: string): Wallet {
  try {
    return new ethers.Wallet(privateKey, ethers.provider);
  } catch (e) {
    throw new Error(`Invalid privateKey: ${privateKey}`);
  }
}

export function parseEthAddress(address: string): string {
  try {
    return ethers.utils.getAddress(address);
  } catch (e) {
    throw new Error(`Invalid address: ${address}`);
  }
}

export function getUnixTime(): number {
  return Math.floor(Date.now() / 1000);
}

export function millisFromSec(time: number): number {
  return time * 1000;
}

export function sleep(millis: number) {
  return new Promise(resolve => setTimeout(resolve, millis));
}

export async function checkContractOwner(address: string,
                                         contract: Contract,
                                         expectOwner: boolean): Promise<void> {
  const ownerAddress = await contract.owner();
  if (expectOwner) {
    expect(ownerAddress).to.be.eq(address);
  } else {
    expect(ownerAddress).to.not.be.eq(address);
  }
}

export async function logGasUsageEthTransaction(methodName: string,
                                                tx: ContractTransaction): Promise<void> {
  const gasLimit = tx && tx.gasLimit && tx.gasLimit.toNumber();
  const confirmedTx = await tx.wait();
  const useGas = confirmedTx.gasUsed && confirmedTx.gasUsed.toNumber();
  const percentUse = gasLimit && useGas && Number(useGas * 100 / gasLimit).toFixed(2);
  console.log(`\tMethod name - ${methodName}.\tUseGas - ${useGas} of ${gasLimit} ${percentUse ? `(${percentUse} %)` : ''}`);
}

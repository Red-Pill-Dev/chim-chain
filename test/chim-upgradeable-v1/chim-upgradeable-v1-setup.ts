import hre from 'hardhat';
import { BigNumber } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import { parseBigNumber } from '../../utils/utilities';
import { baseConfig } from '../../utils/config';
import { ChimUpgradeableV1 } from '../../typechain/ChimUpgradeableV1';
import { ChimUpgradeableV1__factory } from '../../typechain';

export const chimParams = {
  name: 'Chimeras',
  symbol: 'CHIM',
  decimals: BigNumber.from(18),
  totalSupply: parseBigNumber('100000000', baseConfig.ethDecimals),
  maxTotalSupply: parseBigNumber('1000000000', baseConfig.ethDecimals),
};

export async function setupChimUpgradeableV1(
  ownerWallet: SignerWithAddress,
): Promise<ChimUpgradeableV1> {
  // deploy ChimUpgradeableV1 with proxy
  const deployParams = [
    chimParams.maxTotalSupply,
  ];
  const contractFactory = await new (ChimUpgradeableV1__factory as any)(ownerWallet);
  const chimToken = (await hre.upgrades.deployProxy(contractFactory, deployParams, { initializer: 'initialize' })) as ChimUpgradeableV1;

  // mint some tokens to owner
  await chimToken.mintAmount(ownerWallet.address, chimParams.totalSupply);

  return chimToken;
}

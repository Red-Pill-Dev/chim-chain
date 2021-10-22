import { chimTokenMintToChimVestingAddress } from './script-utils';

async function main() {
  await chimTokenMintToChimVestingAddress();
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

import { chimVestingLockTokens } from './script-utils';

async function main() {
  await chimVestingLockTokens();
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

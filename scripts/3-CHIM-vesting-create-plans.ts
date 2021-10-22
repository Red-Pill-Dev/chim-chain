import { chimVestingCreatePlans } from './script-utils';

async function main() {
  await chimVestingCreatePlans();
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

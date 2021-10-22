import { chimTokenDeployContract } from './script-utils';

async function main() {
  await chimTokenDeployContract();
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

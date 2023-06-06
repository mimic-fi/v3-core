import { TASK_TEST } from 'hardhat/builtin-tasks/task-names'
import { task, types } from 'hardhat/config'

import { overrideTestTask } from './src/tests'

task(TASK_TEST)
  .addOptionalParam('fork', 'Optional network name to be forked in case of running fork tests.')
  .addOptionalParam('forkIgnoreUnknownTxType', 'Optional flag to ignore unknown tx types.', false, types.boolean)
  .addOptionalParam('chainId', 'Optional chain ID to overwrite hardhat local network ID.', undefined, types.int)
  .addOptionalParam('blockNumber', 'Optional block number to fork in case of running fork tests.', undefined, types.int)
  .setAction(overrideTestTask)

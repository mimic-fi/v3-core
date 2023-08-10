import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import 'hardhat-local-networks-config-plugin'

import { TASK_COMPILE } from 'hardhat/builtin-tasks/task-names'
import { task } from 'hardhat/config'
import { homedir } from 'os'
import path from 'path'

import overrideSimulateFunction from './src/overrideSimulateFunction'

task(TASK_COMPILE).setAction(overrideSimulateFunction)

export default {
  localNetworksConfig: path.join(homedir(), '/.hardhat/networks.mimic.json'),
  solidity: {
    version: '0.8.17',
    settings: {
      optimizer: {
        enabled: true,
        runs: 10000,
      },
    },
  },
}

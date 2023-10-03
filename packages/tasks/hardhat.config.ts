import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import '@mimic-fi/v3-helpers/dist/tests'
import 'hardhat-local-networks-config-plugin'

import { homedir } from 'os'
import path from 'path'

export default {
  localNetworksConfig: path.join(homedir(), '/.hardhat/networks.mimic.json'),
  solidity: {
    version: '0.8.17',
    settings: {
      optimizer: {
        enabled: true,
        runs: 500,
      },
    },
  },
}

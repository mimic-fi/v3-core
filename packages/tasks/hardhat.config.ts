import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import '@mimic-fi/helpers/dist/tests'
import 'hardhat-local-networks-config-plugin'
import 'hardhat-gas-reporter'

import { homedir } from 'os'
import path from 'path'

export default {
  localNetworksConfig: path.join(homedir(), '/.hardhat/networks.mimic.json'),
  solidity: {
    version: '0.8.17',
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },
  gasReporter: {
    outputFile: 'gasReporterOutput.json',
    enabled: !!process.env.REPORT_GAS,
    noColors: true,
    excludeContracts: ['Mock'],
  },
}
